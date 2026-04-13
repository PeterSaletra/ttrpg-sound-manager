import type { DragEvent } from 'react'

import type { Scene } from '@/types'

export const AUDIO_EXTENSION_REGEX = /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i

export const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const createDefaultScene = (): Scene => ({
  id: createId(),
  name: 'Start Scene',
  trackIds: [],
})

export const sliderToNumber = (value: number | readonly number[]): number =>
  typeof value === 'number' ? value : (value[0] ?? 0)

export const buildDragPayload = (source: 'scene' | 'library', trackId: string): string =>
  `${source}:${trackId}`

export const parseDragPayload = (value: string): { source: 'scene' | 'library'; trackId: string } | null => {
  const [source, trackId] = value.split(':')
  if (!trackId || (source !== 'scene' && source !== 'library')) {
    return null
  }

  return { source, trackId }
}

export const normalizeHotkey = (value: string): string => value.trim().toLowerCase()

export const extractYouTubeId = (value: string): string | null => {
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

export const eventToHotkey = (event: KeyboardEvent): string => {
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

export const setTrackCardDragPreview = (event: DragEvent<HTMLElement>, trackCard: HTMLElement) => {
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

export const hasFilesInDragEvent = (event: DragEvent<HTMLElement>): boolean =>
  Array.from(event.dataTransfer.types).includes('Files')
