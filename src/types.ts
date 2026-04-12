export type TrackLayer = 'ambient' | 'music' | 'sfx'
export type TrackSourceType = 'local' | 'youtube'

export interface Track {
  id: string
  name: string
  fileId: string
  sourceUrl: string
  sourceType: TrackSourceType
  youtubeId: string
  volume: number
  loop: boolean
  isPlaying: boolean
  layer: TrackLayer
  hotkey: string
  favorite: boolean
}

export interface Scene {
  id: string
  name: string
  trackIds: string[]
}

export interface StoredTrack {
  id: string
  name: string
  fileId: string
  sourceUrl: string
  sourceType: TrackSourceType
  youtubeId: string
  volume: number
  loop: boolean
  layer: TrackLayer
  hotkey: string
  favorite: boolean
}

export interface CrossfadeSettings {
  durationMs: number
  layers: Record<TrackLayer, boolean>
}

export interface SessionState {
  activeSceneId: string
  masterVolume: number
  scenes: Scene[]
  tracks: StoredTrack[]
  crossfade: CrossfadeSettings
  updatedAt: string
}
