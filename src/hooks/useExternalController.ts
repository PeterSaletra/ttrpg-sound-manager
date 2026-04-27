import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_BAUD_RATE = 115200
const ANALOG_MAX = 1023
const CROSSFADE_MIN_MS = 200
const CROSSFADE_MAX_MS = 5000
const ANALOG_THROTTLE_MS = 50
const ACTION_DEDUPE_MS = 120

type UseExternalControllerParams = {
  sceneCount: number
  onMasterVolumeChange: (value: number) => void
  onCrossfadeDurationChange: (value: number) => void
  onPlay: () => void
  onStop: () => void
  onPanic: () => void
  onSceneSelect: (sceneIndex: number) => void
  onToast: (text: string, tone?: 'info' | 'error') => void
}

type ControllerPayload =
  | { type: 'master'; value: number }
  | { type: 'crossfade'; value: number }
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'panic' }
  | { type: 'scene'; value: number }

type ExternalControllerState = {
  isSupported: boolean
  isConnected: boolean
  deviceLabel: string
  lastError: string
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const normalizeAnalogPercent = (raw: number): number => {
  if (!Number.isFinite(raw)) {
    return 0
  }

  const value = raw > 100 ? (raw / ANALOG_MAX) * 100 : raw
  return clamp(Math.round(value), 0, 100)
}

const percentToCrossfadeMs = (percent: number): number => {
  const safePercent = clamp(percent, 0, 100)
  const range = CROSSFADE_MAX_MS - CROSSFADE_MIN_MS
  return Math.round(CROSSFADE_MIN_MS + (range * safePercent) / 100)
}

const normalizeSceneIndex = (raw: number): number => {
  if (!Number.isFinite(raw)) {
    return 0
  }

  const value = raw > 0 ? Math.round(raw) - 1 : 0
  return Math.max(0, value)
}

const parseNumber = (raw: string): number | null => {
  const parsed = Number(raw.trim())
  return Number.isFinite(parsed) ? parsed : null
}

const parseStructuredPayload = (line: string): ControllerPayload | null => {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  const upper = trimmed.toUpperCase()
  if (upper === 'PLAY' || upper === 'BTN_PLAY') {
    return { type: 'play' }
  }

  if (upper === 'STOP' || upper === 'BTN_STOP') {
    return { type: 'stop' }
  }

  if (upper === 'PANIC' || upper === 'BTN_PANIC') {
    return { type: 'panic' }
  }

  const [rawKey, rawValue] = trimmed.split(':', 2)
  if (!rawKey || rawValue === undefined) {
    return null
  }

  const key = rawKey.trim().toUpperCase()
  const parsed = parseNumber(rawValue)
  if (parsed === null) {
    return null
  }

  if (key === 'MASTER' || key === 'VOLUME' || key === 'POT_MASTER') {
    return { type: 'master', value: parsed }
  }

  if (key === 'CROSSFADE' || key === 'POT_CROSSFADE') {
    return { type: 'crossfade', value: parsed }
  }

  if (key === 'SCENE' || key === 'BTN_SCENE') {
    return { type: 'scene', value: parsed }
  }

  return null
}

const parseJsonPayload = (line: string): ControllerPayload | null => {
  try {
    const parsed = JSON.parse(line) as { type?: unknown; value?: unknown }
    if (typeof parsed.type !== 'string') {
      return null
    }

    const type = parsed.type.toLowerCase()
    const value = typeof parsed.value === 'number' ? parsed.value : Number(parsed.value)

    if (type === 'play') {
      return { type: 'play' }
    }

    if (type === 'stop') {
      return { type: 'stop' }
    }

    if (type === 'panic') {
      return { type: 'panic' }
    }

    if (type === 'master' && Number.isFinite(value)) {
      return { type: 'master', value }
    }

    if (type === 'crossfade' && Number.isFinite(value)) {
      return { type: 'crossfade', value }
    }

    if (type === 'scene' && Number.isFinite(value)) {
      return { type: 'scene', value }
    }

    return null
  } catch {
    return null
  }
}

const parseControllerLine = (line: string): ControllerPayload | null => {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseJsonPayload(trimmed)
  }

  return parseStructuredPayload(trimmed)
}

export function useExternalController({
  sceneCount,
  onMasterVolumeChange,
  onCrossfadeDurationChange,
  onPlay,
  onStop,
  onPanic,
  onSceneSelect,
  onToast,
}: UseExternalControllerParams): ExternalControllerState {
  const isSupported = useMemo(
    () => typeof navigator !== 'undefined' && typeof navigator.serial !== 'undefined',
    [],
  )

  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [deviceLabel, setDeviceLabel] = useState<string>('')
  const [lastError, setLastError] = useState<string>('')

  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const readLoopAbortRef = useRef<boolean>(false)
  const actionTimestampRef = useRef<Record<string, number>>({})
  const analogTimestampRef = useRef<Record<string, number>>({})
  const analogValueRef = useRef<Record<string, number>>({})

  const allowAction = useCallback((actionName: string): boolean => {
    const now = performance.now()
    const previous = actionTimestampRef.current[actionName] ?? 0
    if (now - previous < ACTION_DEDUPE_MS) {
      return false
    }
    actionTimestampRef.current[actionName] = now
    return true
  }, [])

  const allowAnalogUpdate = useCallback((name: string, nextValue: number): boolean => {
    const now = performance.now()
    const previousAt = analogTimestampRef.current[name] ?? 0
    const previousValue = analogValueRef.current[name]

    if (previousValue === nextValue) {
      return false
    }

    if (now - previousAt < ANALOG_THROTTLE_MS) {
      return false
    }

    analogTimestampRef.current[name] = now
    analogValueRef.current[name] = nextValue
    return true
  }, [])

  const emitPayload = useCallback(
    (payload: ControllerPayload) => {
      switch (payload.type) {
        case 'master': {
          const nextVolume = normalizeAnalogPercent(payload.value)
          if (allowAnalogUpdate('master', nextVolume)) {
            onMasterVolumeChange(nextVolume)
          }
          return
        }
        case 'crossfade': {
          const percent = normalizeAnalogPercent(payload.value)
          const nextDuration = percentToCrossfadeMs(percent)
          if (allowAnalogUpdate('crossfade', nextDuration)) {
            onCrossfadeDurationChange(nextDuration)
          }
          return
        }
        case 'play': {
          if (allowAction('play')) {
            onPlay()
          }
          return
        }
        case 'stop': {
          if (allowAction('stop')) {
            onStop()
          }
          return
        }
        case 'panic': {
          if (allowAction('panic')) {
            onPanic()
          }
          return
        }
        case 'scene': {
          const nextIndex = normalizeSceneIndex(payload.value)
          if (nextIndex >= sceneCount) {
            return
          }

          const actionName = `scene:${nextIndex}`
          if (allowAction(actionName)) {
            onSceneSelect(nextIndex)
          }
        }
      }
    },
    [allowAction, allowAnalogUpdate, onCrossfadeDurationChange, onMasterVolumeChange, onPanic, onPlay, onSceneSelect, onStop, sceneCount],
  )

  const disconnect = useCallback(async () => {
    readLoopAbortRef.current = true

    if (readerRef.current) {
      try {
        await readerRef.current.cancel()
      } catch {
        // Ignore reader cancel errors during shutdown.
      }
      readerRef.current.releaseLock()
      readerRef.current = null
    }

    if (portRef.current) {
      try {
        await portRef.current.close()
      } catch {
        // Ignore close errors during shutdown.
      }
      portRef.current = null
    }

    setIsConnected(false)
    setDeviceLabel('')
  }, [])

  const startReadLoop = useCallback(
    async (port: SerialPort) => {
      if (!port.readable) {
        return
      }

      readLoopAbortRef.current = false
      const reader = port.readable.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (!readLoopAbortRef.current) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }

          if (!value) {
            continue
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const payload = parseControllerLine(line)
            if (payload) {
              emitPayload(payload)
            }
          }
        }
      } catch {
        if (!readLoopAbortRef.current) {
          setLastError('Lost connection to external controller.')
          onToast('External controller disconnected unexpectedly.', 'error')
        }
      } finally {
        reader.releaseLock()
        if (readerRef.current === reader) {
          readerRef.current = null
        }

        if (!readLoopAbortRef.current) {
          await disconnect()
        }
      }
    },
    [disconnect, emitPayload, onToast],
  )

  const connect = useCallback(async () => {
    const serialApi = navigator.serial
    if (!isSupported || !serialApi) {
      setLastError('Web Serial is not supported by this browser.')
      onToast('Web Serial is not available in this browser.', 'error')
      return
    }

    try {
      setLastError('')
      const port = await serialApi.requestPort()
      await port.open({ baudRate: DEFAULT_BAUD_RATE })

      portRef.current = port
      const portInfo = port.getInfo()
      const product = typeof portInfo.usbProductId === 'number' ? portInfo.usbProductId.toString(16) : 'unknown'
      const vendor = typeof portInfo.usbVendorId === 'number' ? portInfo.usbVendorId.toString(16) : 'unknown'

      setDeviceLabel(`USB ${vendor}:${product}`)
      setIsConnected(true)
      onToast('External controller connected.', 'info')

      void startReadLoop(port)
    } catch {
      setLastError('Could not connect to external controller.')
      onToast('Controller connection failed.', 'error')
    }
  }, [isSupported, onToast, startReadLoop])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  return {
    isSupported,
    isConnected,
    deviceLabel,
    lastError,
    connect,
    disconnect,
  }
}