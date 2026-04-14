import type { TrackLayer } from '@/types'

export const DEFAULT_LAYER: TrackLayer = 'ambient'
export const DEFAULT_CROSSFADE_DURATION_MS = 1200
export const DEFAULT_CROSSFADE_LAYERS: Record<TrackLayer, boolean> = {
  ambient: true,
  music: true,
  sfx: false,
}

export const SCENE_SHORTCUT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const

export const TRACK_SHORTCUT_KEYS = [
  'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
  'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
  'z', 'x', 'c', 'v', 'b', 'n', 'm',
] as const

export const BUTTON_UNIFIED_CLASS =
  'border-zinc-500 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-zinc-50'
export const BUTTON_ACTIVE_CLASS =
  'bg-sky-300 text-zinc-950 hover:bg-sky-200 hover:text-zinc-950 border-sky-200'
