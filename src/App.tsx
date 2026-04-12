import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  GripVertical,
  Keyboard,
  Link2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Skull,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { AudioEngine } from '@/lib/audio-engine'
import {
  deleteAudioFile,
  loadAudioFile,
  loadSession,
  saveAudioFile,
  saveSession,
  toStoredTracks,
} from '@/lib/storage'
import type { Scene, Track, TrackLayer } from '@/types'

const DEFAULT_LAYER: TrackLayer = 'ambient'
const DEFAULT_CROSSFADE_DURATION_MS = 1200
const DEFAULT_CROSSFADE_LAYERS: Record<TrackLayer, boolean> = {
  ambient: true,
  music: true,
  sfx: false,
}

const HOTKEY_PRESETS = {
  combat: ['1', '2', '3', '4', '5', 'q', 'w', 'e', 'r'],
  exploration: ['a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v'],
  horror: ['h', 'j', 'k', 'l', 'b', 'n', 'm', 'u', 'i'],
} as const

const BUTTON_UNIFIED_CLASS = 'border-zinc-500 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-zinc-50'
const BUTTON_ACTIVE_CLASS = 'bg-sky-300 text-zinc-950 hover:bg-sky-200 hover:text-zinc-950 border-sky-200'

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createDefaultScene = (): Scene => ({
  id: createId(),
  name: 'Start Scene',
  trackIds: [],
})

const sliderToNumber = (value: number | readonly number[]): number =>
  typeof value === 'number' ? value : (value[0] ?? 0)

const buildDragPayload = (source: 'scene' | 'library', trackId: string): string =>
  `${source}:${trackId}`

const parseDragPayload = (value: string): { source: 'scene' | 'library'; trackId: string } | null => {
  const [source, trackId] = value.split(':')
  if (!trackId || (source !== 'scene' && source !== 'library')) {
    return null
  }

  return { source, trackId }
}

const normalizeHotkey = (value: string): string => value.trim().toLowerCase()

const AUDIO_EXTENSION_REGEX = /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i

const extractYouTubeId = (value: string): string | null => {
  const input = value.trim()
  if (!input) {
    return null
  }

  const directId = input.match(/^[a-zA-Z0-9_-]{11}$/)
  if (directId) {
    return input
  }

  try {
    const url = new URL(input)
    const host = url.hostname.replace('www.', '')

    if (host === 'youtu.be') {
      const candidate = url.pathname.replace('/', '')
      return candidate || null
    }

    if (host.includes('youtube.com')) {
      if (url.searchParams.get('v')) {
        return url.searchParams.get('v')
      }

      const parts = url.pathname.split('/').filter(Boolean)
      const index = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live')
      if (index >= 0 && parts[index + 1]) {
        return parts[index + 1]
      }
    }
  } catch {
    return null
  }

  return null
}

const eventToHotkey = (event: KeyboardEvent): string => {
  const parts: string[] = []

  if (event.ctrlKey) {
    parts.push('ctrl')
  }
  if (event.altKey) {
    parts.push('alt')
  }
  if (event.shiftKey) {
    parts.push('shift')
  }

  const key = event.code === 'Space' ? 'space' : event.key.toLowerCase()
  parts.push(key)

  return parts.join('+')
}

const setTrackCardDragPreview = (event: DragEvent<HTMLElement>, trackCard: HTMLElement) => {
  const rect = trackCard.getBoundingClientRect()
  const clone = trackCard.cloneNode(true) as HTMLElement

  clone.style.position = 'fixed'
  clone.style.top = '-9999px'
  clone.style.left = '-9999px'
  clone.style.width = `${rect.width}px`
  clone.style.opacity = '0.92'
  clone.style.transform = 'scale(0.98)'
  clone.style.pointerEvents = 'none'
  clone.style.zIndex = '9999'

  document.body.appendChild(clone)
  event.dataTransfer.setDragImage(clone, 20, 20)

  window.setTimeout(() => {
    clone.remove()
  }, 0)
}

type YouTubePlayerState = {
  ENDED: number
}

type YouTubePlayer = {
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  setVolume: (volume: number) => void
  cueVideoById: (videoId: string) => void
  loadVideoById: (videoId: string) => void
  destroy: () => void
  getPlayerState: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

type YouTubePlayerEvent = {
  target: YouTubePlayer
  data?: number
}

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    config: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void
        onStateChange?: (event: YouTubePlayerEvent) => void
      }
    },
  ) => YouTubePlayer
  PlayerState: YouTubePlayerState
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

function App() {
  const [scenes, setScenes] = useState<Scene[]>(() => [createDefaultScene()])
  const [tracks, setTracks] = useState<Track[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string>('')
  const [masterVolume, setMasterVolume] = useState<number>(85)
  const [newSceneName, setNewSceneName] = useState<string>('')
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; tone: 'info' | 'error' }>>([])
  const [hydrated, setHydrated] = useState<boolean>(false)
  const [volumeOverrides, setVolumeOverrides] = useState<Record<string, number>>({})
  const [crossfadeDurationMs, setCrossfadeDurationMs] = useState<number>(DEFAULT_CROSSFADE_DURATION_MS)
  const [crossfadeLayers, setCrossfadeLayers] =
    useState<Record<TrackLayer, boolean>>(DEFAULT_CROSSFADE_LAYERS)
  const [librarySearch, setLibrarySearch] = useState<string>('')
  const [libraryLayerFilter, setLibraryLayerFilter] = useState<'all' | TrackLayer>('all')
  const [youtubeInput, setYoutubeInput] = useState<string>('')
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null)
  const [draggedOverTrackId, setDraggedOverTrackId] = useState<string | null>(null)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editingSceneName, setEditingSceneName] = useState<string>('')
  const [isFileDragOver, setIsFileDragOver] = useState<boolean>(false)
  const [youtubeApiReady, setYoutubeApiReady] = useState<boolean>(false)

  const audioEngineRef = useRef<AudioEngine>(new AudioEngine())
  const objectUrlsRef = useRef<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const crossfadeIntervalRef = useRef<number | null>(null)
  const crossfadeTimeoutRef = useRef<number | null>(null)
  const fileDragDepthRef = useRef<number>(0)
  const youtubePlayersRef = useRef<Map<string, YouTubePlayer>>(new Map())
  const youtubeHostRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const youtubeReadyRef = useRef<Set<string>>(new Set())
  const youtubeVideoByTrackRef = useRef<Map<string, string>>(new Map())
  const tracksRef = useRef<Track[]>([])

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0],
    [activeSceneId, scenes],
  )

  const sceneTracks = useMemo(() => {
    if (!activeScene) {
      return []
    }

    return activeScene.trackIds
      .map((trackId) => tracks.find((track) => track.id === trackId))
      .filter((track): track is Track => Boolean(track))
  }, [activeScene, tracks])

  const activeSceneTrackIdSet = useMemo(
    () => new Set(activeScene?.trackIds ?? []),
    [activeScene],
  )

  const filteredLibraryTracks = useMemo(() => {
    const search = librarySearch.trim().toLowerCase()

    return [...tracks]
      .filter((track) => (libraryLayerFilter === 'all' ? true : track.layer === libraryLayerFilter))
      .filter((track) => (search ? track.name.toLowerCase().includes(search) : true))
      .sort((left, right) => {
        if (left.favorite !== right.favorite) {
          return left.favorite ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })
  }, [libraryLayerFilter, librarySearch, tracks])

  const getTrackOutputVolume = (track: Track): number => volumeOverrides[track.id] ?? track.volume

  const clearCrossfadeTimers = () => {
    if (crossfadeIntervalRef.current !== null) {
      window.clearInterval(crossfadeIntervalRef.current)
      crossfadeIntervalRef.current = null
    }

    if (crossfadeTimeoutRef.current !== null) {
      window.clearTimeout(crossfadeTimeoutRef.current)
      crossfadeTimeoutRef.current = null
    }
  }

  const pushToast = (text: string, tone: 'info' | 'error' = 'info') => {
    const toastId = createId()
    setToasts((previous) => [...previous, { id: toastId, text, tone }])
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== toastId))
    }, 2600)
  }

  const hasFilesInDragEvent = (event: DragEvent<HTMLElement>): boolean =>
    Array.from(event.dataTransfer.types).includes('Files')

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  useEffect(() => {
    if (window.YT?.Player) {
      setYoutubeApiReady(true)
      return
    }

    const existingScript = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null
    if (!existingScript) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      setYoutubeApiReady(true)
    }

    return () => {
      window.onYouTubeIframeAPIReady = previous
    }
  }, [])

  useEffect(() => {
    const currentAudioEngine = audioEngineRef.current

    return () => {
      clearCrossfadeTimers()
      currentAudioEngine.dispose()

      for (const player of youtubePlayersRef.current.values()) {
        player.destroy()
      }
      youtubePlayersRef.current.clear()
      youtubeReadyRef.current.clear()
      youtubeVideoByTrackRef.current.clear()
      youtubeHostRefs.current.clear()

      for (const objectUrl of objectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl)
      }

      objectUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const bootstrap = async () => {
      const persisted = loadSession()

      if (!persisted) {
        const scene = createDefaultScene()
        if (!disposed) {
          setScenes([scene])
          setActiveSceneId(scene.id)
          setHydrated(true)
        }
        return
      }

      const restoredTracks: Track[] = []

      for (const track of persisted.tracks) {
        if (track.sourceType === 'youtube') {
          restoredTracks.push({
            ...track,
            sourceType: 'youtube',
            sourceUrl: track.sourceUrl || `https://www.youtube.com/watch?v=${track.youtubeId}`,
            isPlaying: false,
          })
          continue
        }

        const file = await loadAudioFile(track.fileId)
        if (!file) {
          continue
        }

        const sourceUrl = URL.createObjectURL(file)
        objectUrlsRef.current.push(sourceUrl)

        restoredTracks.push({
          ...track,
          sourceType: 'local',
          sourceUrl,
          isPlaying: false,
        })
      }

      const restoredScenes = persisted.scenes.length > 0 ? persisted.scenes : [createDefaultScene()]
      const initialSceneId = restoredScenes.some((scene) => scene.id === persisted.activeSceneId)
        ? persisted.activeSceneId
        : restoredScenes[0].id

      if (!disposed) {
        setTracks(restoredTracks)
        setScenes(restoredScenes)
        setMasterVolume(persisted.masterVolume)
        setCrossfadeDurationMs(persisted.crossfade.durationMs)
        setCrossfadeLayers(persisted.crossfade.layers)
        setActiveSceneId(initialSceneId)
        setHydrated(true)
      }
    }

    void bootstrap()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    for (const track of tracks) {
      if (track.sourceType !== 'local') {
        continue
      }

      audioEngineRef.current.syncTrack(
        {
          ...track,
          volume: getTrackOutputVolume(track),
        },
        masterVolume,
      )
    }
  }, [hydrated, masterVolume, tracks, volumeOverrides])

  useEffect(() => {
    if (!youtubeApiReady || !window.YT?.Player) {
      return
    }

    const youtubeTracks = tracks.filter((track) => track.sourceType === 'youtube')
    const youtubeTrackIds = new Set(youtubeTracks.map((track) => track.id))

    for (const [trackId, player] of youtubePlayersRef.current.entries()) {
      if (!youtubeTrackIds.has(trackId)) {
        player.destroy()
        youtubePlayersRef.current.delete(trackId)
        youtubeReadyRef.current.delete(trackId)
        youtubeVideoByTrackRef.current.delete(trackId)
        youtubeHostRefs.current.delete(trackId)
      }
    }

    for (const track of youtubeTracks) {
      if (youtubePlayersRef.current.has(track.id)) {
        continue
      }

      const host = youtubeHostRefs.current.get(track.id)
      if (!host) {
        continue
      }

      const player = new window.YT.Player(host, {
        videoId: track.youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          loop: track.loop ? 1 : 0,
          playlist: track.youtubeId,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            youtubeReadyRef.current.add(track.id)
            youtubeVideoByTrackRef.current.set(track.id, track.youtubeId)

            const liveTrack = tracksRef.current.find((item) => item.id === track.id)
            if (!liveTrack) {
              return
            }

            const outputVolume = Math.max(
              0,
              Math.min(100, Math.round((getTrackOutputVolume(liveTrack) * masterVolume) / 100)),
            )
            event.target.setVolume(outputVolume)
            if (liveTrack.isPlaying) {
              event.target.playVideo()
            } else {
              event.target.pauseVideo()
            }
          },
          onStateChange: (event) => {
            const ytEnded = window.YT?.PlayerState.ENDED
            if (typeof ytEnded !== 'number' || event.data !== ytEnded) {
              return
            }

            const latestTrack = tracksRef.current.find((item) => item.id === track.id)
            if (!latestTrack) {
              return
            }

            if (latestTrack.loop) {
              event.target.seekTo(0, true)
              event.target.playVideo()
              return
            }

            setTracks((previous) =>
              previous.map((item) =>
                item.id === track.id
                  ? {
                      ...item,
                      isPlaying: false,
                    }
                  : item,
              ),
            )
          },
        },
      })

      youtubePlayersRef.current.set(track.id, player)
    }
  }, [tracks, youtubeApiReady, masterVolume, volumeOverrides])

  useEffect(() => {
    for (const track of tracks) {
      if (track.sourceType !== 'youtube') {
        continue
      }

      const player = youtubePlayersRef.current.get(track.id)
      if (!player || !youtubeReadyRef.current.has(track.id)) {
        continue
      }

      const currentVideoId = youtubeVideoByTrackRef.current.get(track.id)
      if (currentVideoId !== track.youtubeId) {
        if (track.isPlaying) {
          player.loadVideoById(track.youtubeId)
        } else {
          player.cueVideoById(track.youtubeId)
        }
        youtubeVideoByTrackRef.current.set(track.id, track.youtubeId)
      }

      const outputVolume = Math.max(0, Math.min(100, Math.round((getTrackOutputVolume(track) * masterVolume) / 100)))
      player.setVolume(outputVolume)

      if (track.isPlaying) {
        player.playVideo()
      } else {
        player.pauseVideo()
      }
    }
  }, [masterVolume, tracks, volumeOverrides])

  useEffect(() => {
    if (!hydrated || !activeScene) {
      return
    }

    const timer = window.setTimeout(() => {
      saveSession({
        activeSceneId,
        masterVolume,
        scenes,
        tracks: toStoredTracks(tracks),
        crossfade: {
          durationMs: crossfadeDurationMs,
          layers: crossfadeLayers,
        },
      })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [activeScene, activeSceneId, crossfadeDurationMs, crossfadeLayers, hydrated, masterVolume, scenes, tracks])

  const updateTrack = (trackId: string, updater: (track: Track) => Track) => {
    setTracks((previous) => previous.map((track) => (track.id === trackId ? updater(track) : track)))
  }

  const handleFilesImported = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeScene) {
      return
    }

    const allFiles = Array.from(files)
    const audioFiles = allFiles.filter(
      (file) => file.type.startsWith('audio/') || AUDIO_EXTENSION_REGEX.test(file.name),
    )
    const skippedCount = allFiles.length - audioFiles.length

    if (audioFiles.length === 0) {
      pushToast('Nie znaleziono poprawnych plikow audio do importu.', 'error')
      return
    }

    try {
      const importedTracks = await Promise.all(
        audioFiles.map(async (file) => {
          const fileId = createId()
          const trackId = createId()

          await saveAudioFile(fileId, file)

          const sourceUrl = URL.createObjectURL(file)
          objectUrlsRef.current.push(sourceUrl)

          const track: Track = {
            id: trackId,
            name: file.name.replace(/\.[^/.]+$/, ''),
            fileId,
            sourceUrl,
            sourceType: 'local',
            youtubeId: '',
            volume: 80,
            loop: true,
            isPlaying: false,
            layer: DEFAULT_LAYER,
            hotkey: '',
            favorite: false,
          }

          return track
        }),
      )

      const importedIds = importedTracks.map((track) => track.id)

      setTracks((previous) => [...previous, ...importedTracks])
      setScenes((previous) =>
        previous.map((scene) =>
          scene.id === activeScene.id
            ? {
                ...scene,
                trackIds: [...scene.trackIds, ...importedIds],
              }
            : scene,
        ),
      )

      if (skippedCount > 0) {
        pushToast(`Dodano ${importedTracks.length} plik(i) audio, pominieto ${skippedCount}.`, 'info')
      } else {
        pushToast(`Dodano ${importedTracks.length} plik(i).`)
      }
    } catch {
      pushToast('Nie udalo sie zaimportowac plikow audio.', 'error')
    }
  }

  const handleTogglePlay = async (track: Track) => {
    if (track.isPlaying) {
      if (track.sourceType === 'local') {
        audioEngineRef.current.stopTrack(track.id)
      } else {
        youtubePlayersRef.current.get(track.id)?.pauseVideo()
      }
      updateTrack(track.id, (current) => ({ ...current, isPlaying: false }))
      return
    }

    if (track.sourceType === 'youtube') {
      updateTrack(track.id, (current) => ({
        ...current,
        isPlaying: true,
      }))
      return
    }

    try {
      await audioEngineRef.current.playTrack(
        {
          ...track,
          isPlaying: true,
          volume: getTrackOutputVolume(track),
        },
        masterVolume,
      )
      updateTrack(track.id, (current) => ({ ...current, isPlaying: true }))
    } catch {
      pushToast('Przegladarka zablokowala autoplay. Kliknij Play ponownie po interakcji.', 'error')
    }
  }

  const handlePlayAll = async () => {
    const playable = sceneTracks.filter((track) => !track.isPlaying)

    if (playable.length === 0) {
      return
    }

    let blocked = false
    for (const track of playable) {
      if (track.sourceType === 'youtube') {
        updateTrack(track.id, (current) => ({
          ...current,
          isPlaying: true,
        }))
        continue
      }

      try {
        await audioEngineRef.current.playTrack(
          {
            ...track,
            isPlaying: true,
            volume: getTrackOutputVolume(track),
          },
          masterVolume,
        )
      } catch {
        blocked = true
      }
    }

    setTracks((previous) =>
      previous.map((track) =>
        sceneTracks.some((sceneTrack) => sceneTrack.id === track.id)
          ? {
              ...track,
              isPlaying: track.sourceType === 'youtube' ? true : track.isPlaying ? true : playable.some((t) => t.id === track.id),
            }
          : track,
      ),
    )

    if (blocked) {
      pushToast('Czesc dzwiekow zostala zablokowana przez autoplay policy.', 'error')
    }
  }

  const handleStopAll = () => {
    clearCrossfadeTimers()
    audioEngineRef.current.stopAll()
    for (const player of youtubePlayersRef.current.values()) {
      player.pauseVideo()
    }
    setVolumeOverrides({})
    setTracks((previous) => previous.map((track) => ({ ...track, isPlaying: false })))
  }

  const handleDeleteTrack = async (track: Track) => {
    if (track.sourceType === 'local') {
      audioEngineRef.current.removeTrack(track.id)
      await deleteAudioFile(track.fileId)
    } else {
      youtubePlayersRef.current.get(track.id)?.destroy()
      youtubePlayersRef.current.delete(track.id)
      youtubeReadyRef.current.delete(track.id)
      youtubeVideoByTrackRef.current.delete(track.id)
      youtubeHostRefs.current.delete(track.id)
    }

    setTracks((previous) => previous.filter((item) => item.id !== track.id))
    setScenes((previous) =>
      previous.map((scene) => ({
        ...scene,
        trackIds: scene.trackIds.filter((trackId) => trackId !== track.id),
      })),
    )

    if (track.sourceType === 'local') {
      URL.revokeObjectURL(track.sourceUrl)
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== track.sourceUrl)
    }
    setVolumeOverrides((previous) => {
      const next = { ...previous }
      delete next[track.id]
      return next
    })
  }

  const handleCreateScene = () => {
    const name = newSceneName.trim()
    if (!name) {
      return
    }

    const newScene: Scene = {
      id: createId(),
      name,
      trackIds: [],
    }

    setScenes((previous) => [...previous, newScene])
    setActiveSceneId(newScene.id)
    setNewSceneName('')
  }

  const handleStartSceneRename = (scene: Scene) => {
    setEditingSceneId(scene.id)
    setEditingSceneName(scene.name)
  }

  const handleCancelSceneRename = () => {
    setEditingSceneId(null)
    setEditingSceneName('')
  }

  const handleSaveSceneRename = () => {
    if (!editingSceneId) {
      return
    }

    const nextName = editingSceneName.trim()
    if (!nextName) {
      pushToast('Nazwa sceny nie moze byc pusta.', 'error')
      return
    }

    setScenes((previous) =>
      previous.map((scene) =>
        scene.id === editingSceneId
          ? {
              ...scene,
              name: nextName,
            }
          : scene,
      ),
    )

    setEditingSceneId(null)
    setEditingSceneName('')
  }

  const handleDeleteScene = (sceneId: string) => {
    if (scenes.length <= 1) {
      pushToast('Musi zostac przynajmniej jedna scena.', 'error')
      return
    }

    const fallbackScene = scenes.find((scene) => scene.id !== sceneId)
    setScenes((previous) => previous.filter((scene) => scene.id !== sceneId))

    if (activeSceneId === sceneId && fallbackScene) {
      setActiveSceneId(fallbackScene.id)
    }

    if (editingSceneId === sceneId) {
      handleCancelSceneRename()
    }
  }

  const handleLayerChange = (trackId: string, layer: TrackLayer) => {
    updateTrack(trackId, (track) => ({ ...track, layer }))
  }

  const handleAddYouTubeTrack = () => {
    if (!activeScene) {
      return
    }

    const youtubeId = extractYouTubeId(youtubeInput)
    if (!youtubeId) {
      pushToast('Niepoprawny link YouTube.', 'error')
      return
    }

    const trackId = createId()
    const track: Track = {
      id: trackId,
      name: `YouTube ${youtubeId}`,
      fileId: '',
      sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      sourceType: 'youtube',
      youtubeId,
      volume: 80,
      loop: true,
      isPlaying: false,
      layer: 'music',
      hotkey: '',
      favorite: false,
    }

    setTracks((previous) => [...previous, track])
    setScenes((previous) =>
      previous.map((scene) =>
        scene.id === activeScene.id
          ? {
              ...scene,
              trackIds: [...scene.trackIds, trackId],
            }
          : scene,
      ),
    )
    setYoutubeInput('')
    pushToast('Dodano track YouTube do aktywnej sceny.')
  }

  const handleToggleFavorite = (trackId: string) => {
    updateTrack(trackId, (track) => ({
      ...track,
      favorite: !track.favorite,
    }))
  }

  const handleHotkeyChange = (trackId: string, value: string) => {
    const normalized = normalizeHotkey(value)
    const duplicate = sceneTracks.some((track) => track.id !== trackId && normalizeHotkey(track.hotkey) === normalized)

    if (normalized && duplicate) {
      pushToast(`Hotkey ${normalized} jest juz przypisany w tej scenie.`, 'error')
      return
    }

    updateTrack(trackId, (track) => ({ ...track, hotkey: normalized }))
  }

  const handleRenameTrack = (trackId: string, name: string) => {
    updateTrack(trackId, (track) => ({
      ...track,
      name,
    }))
  }

  const handleToggleTrackInActiveScene = (trackId: string) => {
    if (!activeScene) {
      return
    }

    const exists = activeScene.trackIds.includes(trackId)

    setScenes((previous) =>
      previous.map((scene) => {
        if (scene.id !== activeScene.id) {
          return scene
        }

        return {
          ...scene,
          trackIds: exists
            ? scene.trackIds.filter((id) => id !== trackId)
            : [...scene.trackIds, trackId],
        }
      }),
    )
  }

  const addTrackToActiveScene = (trackId: string, insertBeforeTrackId?: string) => {
    if (!activeScene) {
      return
    }

    setScenes((previous) =>
      previous.map((scene) => {
        if (scene.id !== activeScene.id) {
          return scene
        }

        if (scene.trackIds.includes(trackId)) {
          if (!insertBeforeTrackId || insertBeforeTrackId === trackId) {
            return scene
          }

          const fromIndex = scene.trackIds.indexOf(trackId)
          const toIndex = scene.trackIds.indexOf(insertBeforeTrackId)
          if (fromIndex < 0 || toIndex < 0) {
            return scene
          }

          const reordered = [...scene.trackIds]
          const [moved] = reordered.splice(fromIndex, 1)
          reordered.splice(toIndex, 0, moved)

          return {
            ...scene,
            trackIds: reordered,
          }
        }

        if (!insertBeforeTrackId || !scene.trackIds.includes(insertBeforeTrackId)) {
          return {
            ...scene,
            trackIds: [...scene.trackIds, trackId],
          }
        }

        const nextIds = [...scene.trackIds]
        const toIndex = nextIds.indexOf(insertBeforeTrackId)
        nextIds.splice(toIndex, 0, trackId)

        return {
          ...scene,
          trackIds: nextIds,
        }
      }),
    )
  }

  const applyHotkeyPreset = (preset: keyof typeof HOTKEY_PRESETS) => {
    if (!activeScene) {
      return
    }

    const keys = HOTKEY_PRESETS[preset]
    const indexMap = new Map<string, string>()
    activeScene.trackIds.forEach((trackId, index) => {
      indexMap.set(trackId, keys[index] ?? '')
    })

    setTracks((previous) =>
      previous.map((track) =>
        indexMap.has(track.id)
          ? {
              ...track,
              hotkey: indexMap.get(track.id) ?? '',
            }
          : track,
      ),
    )

    pushToast(`Zastosowano preset hotkey: ${preset}.`)
  }

  const toggleCrossfadeLayer = (layer: TrackLayer, checked: boolean) => {
    setCrossfadeLayers((previous) => ({
      ...previous,
      [layer]: checked,
    }))
  }

  const handleSceneSelect = async (sceneId: string) => {
    if (!activeScene || sceneId === activeScene.id) {
      setActiveSceneId(sceneId)
      return
    }

    const nextScene = scenes.find((scene) => scene.id === sceneId)
    if (!nextScene) {
      setActiveSceneId(sceneId)
      return
    }

    const currentTrackIds = new Set(activeScene.trackIds)
    const nextTrackIds = new Set(nextScene.trackIds)

    const allOutgoingTracks = activeScene.trackIds
      .map((trackId) => tracks.find((track) => track.id === trackId))
      .filter((track): track is Track => Boolean(track))
      .filter((track) => track.isPlaying && !nextTrackIds.has(track.id))

    const allIncomingTracks = nextScene.trackIds
      .map((trackId) => tracks.find((track) => track.id === trackId))
      .filter((track): track is Track => Boolean(track))
      .filter((track) => !currentTrackIds.has(track.id))

    const outgoingTracks = allOutgoingTracks.filter((track) => crossfadeLayers[track.layer])
    const incomingTracks = allIncomingTracks.filter((track) => crossfadeLayers[track.layer])
    const immediateOutgoingTracks = allOutgoingTracks.filter((track) => !crossfadeLayers[track.layer])
    const immediateIncomingTracks = allIncomingTracks.filter((track) => !crossfadeLayers[track.layer])

    setActiveSceneId(sceneId)

    for (const track of immediateOutgoingTracks) {
      if (track.sourceType === 'local') {
        audioEngineRef.current.stopTrack(track.id)
      }
    }

    if (immediateOutgoingTracks.length > 0) {
      const immediateOutgoingIds = new Set(immediateOutgoingTracks.map((track) => track.id))
      setTracks((previous) =>
        previous.map((track) =>
          immediateOutgoingIds.has(track.id)
            ? {
                ...track,
                isPlaying: false,
              }
            : track,
        ),
      )
    }

    const immediateIncomingIds: string[] = []
    for (const track of immediateIncomingTracks) {
      if (track.sourceType === 'youtube') {
        immediateIncomingIds.push(track.id)
        continue
      }

      try {
        await audioEngineRef.current.playTrack(
          {
            ...track,
            isPlaying: true,
            volume: getTrackOutputVolume(track),
          },
          masterVolume,
        )
        immediateIncomingIds.push(track.id)
      } catch {
        pushToast('Niektore tracki nie odpalily sie przez autoplay policy.', 'error')
      }
    }

    if (immediateIncomingIds.length > 0) {
      setTracks((previous) =>
        previous.map((track) =>
          immediateIncomingIds.includes(track.id)
            ? {
                ...track,
                isPlaying: true,
              }
            : track,
        ),
      )
    }

    if (outgoingTracks.length === 0 && incomingTracks.length === 0) {
      return
    }

    clearCrossfadeTimers()

    const initialOverrides: Record<string, number> = {}
    for (const track of outgoingTracks) {
      initialOverrides[track.id] = track.volume
    }
    for (const track of incomingTracks) {
      initialOverrides[track.id] = 0
    }

    setVolumeOverrides((previous) => ({ ...previous, ...initialOverrides }))

    const activatedIncomingIds: string[] = []
    let blocked = false
    for (const track of incomingTracks) {
      if (track.sourceType === 'youtube') {
        activatedIncomingIds.push(track.id)

        const player = youtubePlayersRef.current.get(track.id)
        if (player) {
          const outputVolume = Math.max(
            0,
            Math.min(100, Math.round((track.volume * masterVolume) / 100)),
          )
          player.setVolume(outputVolume)
          player.playVideo()
        }

        continue
      }

      try {
        await audioEngineRef.current.playTrack(
          {
            ...track,
            volume: 0,
            isPlaying: true,
          },
          masterVolume,
        )
        activatedIncomingIds.push(track.id)
      } catch {
        blocked = true
      }
    }

    if (activatedIncomingIds.length > 0) {
      setTracks((previous) =>
        previous.map((track) =>
          activatedIncomingIds.includes(track.id)
            ? {
                ...track,
                isPlaying: true,
              }
            : track,
        ),
      )
    }

    const fadeDurationMs = Math.max(150, crossfadeDurationMs)
    const fadeStart = performance.now()
    crossfadeIntervalRef.current = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - fadeStart) / fadeDurationMs)

      setVolumeOverrides((previous) => {
        const next = { ...previous }

        for (const track of outgoingTracks) {
          next[track.id] = Math.round(track.volume * (1 - progress))
        }

        for (const track of incomingTracks) {
          next[track.id] = Math.round(track.volume * progress)
        }

        return next
      })

      if (progress >= 1) {
        clearCrossfadeTimers()
      }
    }, 40)

    crossfadeTimeoutRef.current = window.setTimeout(() => {
      for (const track of outgoingTracks) {
        if (track.sourceType === 'local') {
          audioEngineRef.current.stopTrack(track.id)
        } else {
          youtubePlayersRef.current.get(track.id)?.pauseVideo()
        }
      }

      const outgoingIds = new Set(outgoingTracks.map((track) => track.id))
      setTracks((previous) =>
        previous.map((track) =>
          outgoingIds.has(track.id)
            ? {
                ...track,
                isPlaying: false,
              }
            : track,
        ),
      )

      setVolumeOverrides((previous) => {
        const next = { ...previous }

        for (const track of outgoingTracks) {
          delete next[track.id]
        }

        for (const track of incomingTracks) {
          delete next[track.id]
        }

        return next
      })

      if (blocked) {
        pushToast('Crossfade zakonczony. Czesc trackow mogla zostac zablokowana przez autoplay policy.', 'error')
      }
    }, fadeDurationMs + 50)
  }

  const moveTrackInActiveScene = (fromId: string, toId: string) => {
    if (!activeScene || fromId === toId) {
      return
    }

    const fromIndex = activeScene.trackIds.indexOf(fromId)
    const toIndex = activeScene.trackIds.indexOf(toId)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }

    const reordered = [...activeScene.trackIds]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    setScenes((previous) =>
      previous.map((scene) =>
        scene.id === activeScene.id
          ? {
              ...scene,
              trackIds: reordered,
            }
          : scene,
      ),
    )

    setDraggedTrackId(null)
    setDraggedOverTrackId(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.code === 'Space' && event.shiftKey) {
        event.preventDefault()
        handleStopAll()
        pushToast('Panic przez hotkey Shift+Space.')
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        if (sceneTracks.some((track) => track.isPlaying)) {
          handleStopAll()
        } else {
          void handlePlayAll()
        }
        return
      }

      const numericKey = Number(event.key)
      if (Number.isInteger(numericKey) && numericKey >= 1 && numericKey <= 9) {
        event.preventDefault()
        const scene = scenes[numericKey - 1]
        if (scene) {
          void handleSceneSelect(scene.id)
        }
        return
      }

      const pressedHotkey = normalizeHotkey(eventToHotkey(event))
      const mappedTrack = sceneTracks.find((track) => normalizeHotkey(track.hotkey) === pressedHotkey)
      if (mappedTrack) {
        event.preventDefault()
        void handleTogglePlay(mappedTrack)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sceneTracks, activeScene, scenes])

  return (
    <main
      className="relative mx-auto flex min-h-screen w-full max-w-[1540px] flex-col gap-4 p-4 md:p-6"
      onDragEnterCapture={(event) => {
        if (!hasFilesInDragEvent(event)) {
          return
        }

        fileDragDepthRef.current += 1
        setIsFileDragOver(true)
      }}
      onDragOverCapture={(event) => {
        if (!hasFilesInDragEvent(event)) {
          return
        }

        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeaveCapture={(event) => {
        if (!hasFilesInDragEvent(event)) {
          return
        }

        fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1)
        if (fileDragDepthRef.current === 0) {
          setIsFileDragOver(false)
        }
      }}
      onDropCapture={(event) => {
        if (!hasFilesInDragEvent(event)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        fileDragDepthRef.current = 0
        setIsFileDragOver(false)

        if (event.dataTransfer.files.length > 0) {
          void handleFilesImported(event.dataTransfer.files)
        }
      }}
    >
      <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-amber-500/20 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-3xl tracking-wide">TTRPG Sound Manager</CardTitle>
          <CardDescription className="text-zinc-300">
            Top: ustawienia globalne. Lewy panel: sceny. Prawy panel: wszystkie dzwieki.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="grid gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={() => void handlePlayAll()}>
                <Play className="size-4" /> Play Scene
              </Button>
              <Button variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={handleStopAll}>
                <Pause className="size-4" /> Stop All
              </Button>
              <Button variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={handleStopAll}>
                <Skull className="size-4" /> Panic
              </Button>
            </div>
            <label className="grid gap-2 text-sm">
              Master Volume: <span className="font-semibold">{masterVolume}%</span>
              <Slider
                className="[&_[data-slot='slider-track']]:bg-zinc-700 [&_[data-slot='slider-range']]:bg-amber-300 [&_[data-slot='slider-thumb']]:border-amber-100 [&_[data-slot='slider-thumb']]:bg-zinc-100"
                value={[masterVolume]}
                onValueChange={(value) => setMasterVolume(sliderToNumber(value))}
                min={0}
                max={100}
                step={1}
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-2.5">
            <label className="grid gap-1 text-sm">
              Crossfade: <span className="font-semibold">{crossfadeDurationMs} ms</span>
              <Slider
                className="[&_[data-slot='slider-track']]:bg-zinc-700 [&_[data-slot='slider-range']]:bg-sky-300 [&_[data-slot='slider-thumb']]:border-sky-100 [&_[data-slot='slider-thumb']]:bg-zinc-100"
                value={[crossfadeDurationMs]}
                min={200}
                max={5000}
                step={100}
                onValueChange={(value) => setCrossfadeDurationMs(sliderToNumber(value))}
              />
            </label>
            <div className="grid gap-1 text-xs text-zinc-300">
              <label className="inline-flex items-center justify-between gap-2 rounded border border-zinc-700 px-2 py-1">
                Ambient
                <Switch
                  className="data-checked:bg-emerald-300 data-unchecked:bg-zinc-600 [&_[data-slot='switch-thumb']]:bg-zinc-100 data-checked:[&_[data-slot='switch-thumb']]:bg-zinc-900"
                  checked={crossfadeLayers.ambient}
                  onCheckedChange={(checked) => toggleCrossfadeLayer('ambient', checked)}
                />
              </label>
              <label className="inline-flex items-center justify-between gap-2 rounded border border-zinc-700 px-2 py-1">
                Music
                <Switch
                  className="data-checked:bg-emerald-300 data-unchecked:bg-zinc-600 [&_[data-slot='switch-thumb']]:bg-zinc-100 data-checked:[&_[data-slot='switch-thumb']]:bg-zinc-900"
                  checked={crossfadeLayers.music}
                  onCheckedChange={(checked) => toggleCrossfadeLayer('music', checked)}
                />
              </label>
              <label className="inline-flex items-center justify-between gap-2 rounded border border-zinc-700 px-2 py-1">
                SFX
                <Switch
                  className="data-checked:bg-emerald-300 data-unchecked:bg-zinc-600 [&_[data-slot='switch-thumb']]:bg-zinc-100 data-checked:[&_[data-slot='switch-thumb']]:bg-zinc-900"
                  checked={crossfadeLayers.sfx}
                  onCheckedChange={(checked) => toggleCrossfadeLayer('sfx', checked)}
                />
              </label>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-2.5">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => {
                void handleFilesImported(event.currentTarget.files)
                event.currentTarget.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              className={BUTTON_UNIFIED_CLASS}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" /> Wybierz pliki audio
            </Button>
            <div className="flex gap-2">
              <Input
                placeholder="Link YouTube"
                value={youtubeInput}
                onChange={(event) => setYoutubeInput(event.currentTarget.value)}
              />
              <Button variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={handleAddYouTubeTrack}>
                <Link2 className="size-4" /> Dodaj
              </Button>
            </div>
            <div className="text-xs text-zinc-300">Formaty: MP3, WAV, OGG, M4A</div>
            <div className="grid gap-1 rounded-md border border-zinc-700/60 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
              <div className="inline-flex items-center gap-2 font-medium text-zinc-200">
                <Keyboard className="size-3.5" /> Presety hotkey
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={() => applyHotkeyPreset('combat')}>Combat</Button>
                <Button size="sm" variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={() => applyHotkeyPreset('exploration')}>Exploration</Button>
                <Button size="sm" variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={() => applyHotkeyPreset('horror')}>Horror</Button>
              </div>
              <div>Space: Play Scene / Stop All</div>
              <div>Shift+Space: Panic</div>
              <div>1-9: Przelaczanie scen wg kolejnosci na liscie</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid flex-1 gap-4 lg:grid-cols-[260px_1fr_460px]">
        <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-amber-500/15 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Scenes</CardTitle>
            <CardDescription>Panel po lewej stronie</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nowa scena"
                value={newSceneName}
                onChange={(event) => setNewSceneName(event.currentTarget.value)}
              />
              <Button size="icon" variant="outline" className={BUTTON_UNIFIED_CLASS} onClick={handleCreateScene} aria-label="Dodaj scene">
                <Plus className="size-4" />
              </Button>
            </div>
            <ScrollArea className="h-[60vh] rounded-md border border-zinc-700/50 p-2">
              <div className="grid gap-2">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="grid h-[74px] cursor-pointer gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/70 p-1.5"
                    onClick={() => {
                      if (editingSceneId !== scene.id) {
                        void handleSceneSelect(scene.id)
                      }
                    }}
                  >
                    {editingSceneId === scene.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8"
                          value={editingSceneName}
                          onChange={(event) => setEditingSceneName(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              handleSaveSceneRename()
                            }
                            if (event.key === 'Escape') {
                              handleCancelSceneRename()
                            }
                          }}
                        />
                        <Button
                          size="icon-xs"
                          variant="outline"
                          className={BUTTON_UNIFIED_CLASS}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSaveSceneRename()
                          }}
                          aria-label="Zapisz nazwe sceny"
                        >
                          <Check className="size-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          className={BUTTON_UNIFIED_CLASS}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCancelSceneRename()
                          }}
                          aria-label="Anuluj edycje sceny"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant={scene.id === activeScene?.id ? 'default' : 'outline'}
                          className={
                            scene.id === activeScene?.id
                              ? `justify-between ${BUTTON_ACTIVE_CLASS}`
                              : `justify-between ${BUTTON_UNIFIED_CLASS}`
                          }
                          onClick={() => {
                            void handleSceneSelect(scene.id)
                          }}
                        >
                          <span className="font-medium tracking-wide">{scene.name}</span>
                          <Badge variant="secondary">{scene.trackIds.length}</Badge>
                        </Button>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-xs"
                            variant="outline"
                            className={BUTTON_UNIFIED_CLASS}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleStartSceneRename(scene)
                            }}
                            aria-label={`Edytuj scene ${scene.name}`}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="outline"
                            className={BUTTON_UNIFIED_CLASS}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDeleteScene(scene.id)
                            }}
                            aria-label={`Usun scene ${scene.name}`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-sky-500/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Aktywna scena: {activeScene ? activeScene.name : '-'}</CardTitle>
            <CardDescription>Tracki przypiete do sceny i ich pelna kontrola</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sceneTracks.length === 0 ? (
              <div
                className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-400"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
                  if (payload?.source === 'library') {
                    addTrackToActiveScene(payload.trackId)
                    pushToast('Dodano dzwiek do aktywnej sceny.')
                  }
                }}
              >
                Brak trackow w tej scenie. Dodaj je z prawego panelu Wszystkie dzwieki.
              </div>
            ) : (
              sceneTracks.map((track) => (
                <div
                  key={track.id}
                  data-track-card={track.id}
                  className={`grid gap-3 rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-3 md:grid-cols-[1.2fr_1fr_auto] ${
                    draggedOverTrackId === track.id ? 'ring-2 ring-sky-300/70' : ''
                  } ${
                    draggedTrackId === track.id ? 'scale-[0.99] opacity-70 ring-2 ring-sky-300/60 transition' : ''
                  }`}
                  onDragEnter={() => setDraggedOverTrackId(track.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDraggedOverTrackId((previous) => (previous === track.id ? null : previous))}
                  onDrop={(event) => {
                    event.preventDefault()
                    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))

                    if (payload?.source === 'scene') {
                      moveTrackInActiveScene(payload.trackId, track.id)
                    }

                    if (payload?.source === 'library') {
                      addTrackToActiveScene(payload.trackId, track.id)
                      pushToast('Dodano dzwiek do aktywnej sceny.')
                    }

                    if (!payload && draggedTrackId) {
                      moveTrackInActiveScene(draggedTrackId, track.id)
                    }

                    setDraggedTrackId(null)
                    setDraggedOverTrackId(null)
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        draggable
                        className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded border border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:cursor-grabbing"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', buildDragPayload('scene', track.id))

                          const trackCard = event.currentTarget.closest('[data-track-card]') as HTMLElement | null
                          if (trackCard) {
                            setTrackCardDragPreview(event, trackCard)
                          }

                          setDraggedTrackId(track.id)
                        }}
                        onDragEnd={() => {
                          setDraggedTrackId(null)
                          setDraggedOverTrackId(null)
                        }}
                        aria-label={`Przeciagnij track ${track.name}`}
                      >
                        <GripVertical className="size-3.5" />
                      </button>
                      <h3 className="text-sm font-medium text-zinc-100">{track.name}</h3>
                      <Badge
                        variant={track.isPlaying ? 'default' : 'outline'}
                          className={track.isPlaying ? 'bg-emerald-300 text-zinc-950' : 'border-zinc-300 bg-zinc-800 text-zinc-50'}
                      >
                        {track.isPlaying ? 'LIVE' : 'IDLE'}
                      </Badge>
                      <Badge variant="secondary">{track.layer.toUpperCase()}</Badge>
                      <Badge variant="outline" className="border-zinc-500 bg-zinc-800 text-zinc-200">
                        {track.sourceType === 'youtube' ? 'YOUTUBE' : 'LOCAL'}
                      </Badge>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">drag handle to reorder</span>
                    </div>
                    {track.sourceType === 'youtube' && track.isPlaying ? (
                      <div className="rounded-md border border-zinc-700 bg-zinc-950/70 px-2 py-1 text-xs text-zinc-300">
                        YouTube audio aktywne
                      </div>
                    ) : null}
                    <label className="grid gap-1 text-xs text-zinc-300">
                      Volume: {track.volume}%
                      {getTrackOutputVolume(track) !== track.volume ? (
                        <span className="text-[11px] text-amber-300">Crossfade output: {getTrackOutputVolume(track)}%</span>
                      ) : null}
                      <Slider
                        className="[&_[data-slot='slider-track']]:bg-zinc-700 [&_[data-slot='slider-range']]:bg-emerald-300 [&_[data-slot='slider-thumb']]:border-emerald-100 [&_[data-slot='slider-thumb']]:bg-zinc-100"
                        value={[track.volume]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(value) => {
                          const nextVolume = sliderToNumber(value)
                          updateTrack(track.id, (current) => ({ ...current, volume: nextVolume }))
                        }}
                      />
                    </label>
                  </div>

                  <div className="grid content-center gap-2 text-xs text-zinc-300">
                    <label className="inline-flex items-center justify-between gap-2 rounded-md border border-zinc-700 px-2 py-1">
                      Loop
                      <Switch
                        checked={track.loop}
                        onCheckedChange={(checked) => {
                          updateTrack(track.id, (current) => ({
                            ...current,
                            loop: checked,
                          }))
                        }}
                      />
                    </label>

                    <label className="grid gap-1">
                      Layer
                      <select
                        className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                        value={track.layer}
                        onChange={(event) => handleLayerChange(track.id, event.currentTarget.value as TrackLayer)}
                      >
                        <option value="ambient">Ambient</option>
                        <option value="music">Music</option>
                        <option value="sfx">SFX</option>
                      </select>
                    </label>

                    <label className="grid gap-1">
                      Hotkey
                      <Input
                        className="h-8 border-zinc-700 bg-zinc-900 text-xs"
                        placeholder="np. a, ctrl+1, shift+g"
                        value={track.hotkey}
                        onChange={(event) => handleHotkeyChange(track.id, event.currentTarget.value)}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className={track.isPlaying ? BUTTON_ACTIVE_CLASS : BUTTON_UNIFIED_CLASS}
                      onClick={() => {
                        void handleTogglePlay(track)
                      }}
                    >
                      {track.isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                      {track.isPlaying ? 'Stop' : 'Play'}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className={BUTTON_UNIFIED_CLASS}
                      onClick={() => {
                        void handleDeleteTrack(track)
                      }}
                      aria-label={`Usun track ${track.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-violet-500/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Wszystkie dzwieki</CardTitle>
            <CardDescription>Panel po prawej stronie, biblioteka globalna</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-zinc-400" />
                <Input
                  className="pl-8"
                  placeholder="Szukaj dzwieku"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.currentTarget.value)}
                />
              </label>
              <select
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-200"
                value={libraryLayerFilter}
                onChange={(event) => setLibraryLayerFilter(event.currentTarget.value as 'all' | TrackLayer)}
              >
                <option value="all">Wszystkie warstwy</option>
                <option value="ambient">Ambient</option>
                <option value="music">Music</option>
                <option value="sfx">SFX</option>
              </select>
            </div>
            <ScrollArea className="h-[66vh] rounded-md border border-zinc-700/50 p-2">
              <div className="grid gap-2">
                {filteredLibraryTracks.length === 0 ? (
                  <div className="rounded border border-dashed border-zinc-700 p-4 text-xs text-zinc-400">
                    Brak dzwiekow dla wybranych filtrow.
                  </div>
                ) : (
                  filteredLibraryTracks.map((track) => (
                    <div
                      key={track.id}
                      className="grid gap-2 rounded border border-zinc-700/70 bg-zinc-900/80 p-2"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copyMove'
                        event.dataTransfer.setData('text/plain', buildDragPayload('library', track.id))
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-100">{track.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            {track.layer.toUpperCase()} | {track.sourceType === 'youtube' ? 'YOUTUBE' : 'LOCAL'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-xs"
                            variant={track.favorite ? 'secondary' : 'outline'}
                            className={track.favorite ? BUTTON_ACTIVE_CLASS : BUTTON_UNIFIED_CLASS}
                            onClick={() => handleToggleFavorite(track.id)}
                            aria-label={`Ulubiony ${track.name}`}
                          >
                            <Star className={`size-3 ${track.favorite ? 'fill-current' : ''}`} />
                          </Button>
                          <Badge
                            variant={track.isPlaying ? 'default' : 'outline'}
                            className={track.isPlaying ? 'bg-emerald-300 text-zinc-950' : 'border-zinc-300 bg-zinc-800 text-zinc-50'}
                          >
                          {track.isPlaying ? 'LIVE' : 'IDLE'}
                          </Badge>
                        </div>
                      </div>
                      <Input
                        className="h-8 border-zinc-700 bg-zinc-900 text-zinc-100"
                        value={track.name}
                        onChange={(event) => handleRenameTrack(track.id, event.currentTarget.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={activeSceneTrackIdSet.has(track.id) ? 'secondary' : 'outline'}
                          className={
                            activeSceneTrackIdSet.has(track.id)
                              ? `flex-1 ${BUTTON_ACTIVE_CLASS}`
                              : `flex-1 ${BUTTON_UNIFIED_CLASS}`
                          }
                          onClick={() => handleToggleTrackInActiveScene(track.id)}
                        >
                          {activeSceneTrackIdSet.has(track.id) ? 'Usun ze sceny' : 'Dodaj do sceny'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={BUTTON_UNIFIED_CLASS}
                          onClick={() => {
                            void handleTogglePlay(track)
                          }}
                        >
                          {track.isPlaying ? 'Stop' : 'Play'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <Separator />
      <p className="pb-2 text-center text-xs text-zinc-400">
        Układ: gora ustawienia | lewy panel sceny | prawy panel wszystkie dzwieki.
      </p>

      {isFileDragOver ? (
        <div className="pointer-events-none absolute inset-4 z-40 rounded-xl border-2 border-dashed border-sky-300 bg-sky-300/15">
          <div className="flex h-full items-center justify-center">
            <div className="rounded-md border border-sky-200/60 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-sky-100">
              Upusc pliki audio, aby je dodac do aktywnej sceny
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-4 top-4 z-50 grid gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur ${
              toast.tone === 'error'
                ? 'border-red-300/40 bg-red-500/20 text-red-100'
                : 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100'
            }`}
          >
            <AlertTriangle className="size-4" />
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      <div className="hidden" aria-hidden="true">
        {tracks
          .filter((track) => track.sourceType === 'youtube')
          .map((track) => (
            <div
              key={`youtube-host-${track.id}`}
              ref={(element) => {
                if (element) {
                  youtubeHostRefs.current.set(track.id, element)
                } else {
                  youtubeHostRefs.current.delete(track.id)
                }
              }}
            />
          ))}
      </div>
    </main>
  )
}

export default App
