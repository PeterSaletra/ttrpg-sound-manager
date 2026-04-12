import type { Track } from '@/types'

interface TrackPlayer {
  trackId: string
  audio: HTMLAudioElement
}

export class AudioEngine {
  private players = new Map<string, TrackPlayer>()

  private getOrCreatePlayer(track: Track): TrackPlayer {
    const existing = this.players.get(track.id)
    if (existing) {
      if (existing.audio.src !== track.sourceUrl) {
        const previousTime = existing.audio.currentTime
        const wasPlaying = !existing.audio.paused

        existing.audio.pause()
        existing.audio.src = track.sourceUrl
        existing.audio.currentTime = Math.min(previousTime, existing.audio.duration || previousTime)

        if (wasPlaying) {
          void existing.audio.play()
        }
      }

      return existing
    }

    const audio = new Audio(track.sourceUrl)
    audio.preload = 'auto'

    const player = { trackId: track.id, audio }
    this.players.set(track.id, player)

    return player
  }

  syncTrack(track: Track, masterVolume: number): void {
    const player = this.getOrCreatePlayer(track)
    player.audio.loop = track.loop
    player.audio.volume = Math.max(0, Math.min(1, (track.volume / 100) * (masterVolume / 100)))

    if (!track.isPlaying && !player.audio.paused) {
      player.audio.pause()
      player.audio.currentTime = 0
    }
  }

  async playTrack(track: Track, masterVolume: number): Promise<void> {
    const player = this.getOrCreatePlayer(track)
    player.audio.loop = track.loop
    player.audio.volume = Math.max(0, Math.min(1, (track.volume / 100) * (masterVolume / 100)))
    await player.audio.play()
  }

  stopTrack(trackId: string): void {
    const player = this.players.get(trackId)
    if (!player) {
      return
    }

    player.audio.pause()
    player.audio.currentTime = 0
  }

  stopAll(): void {
    for (const player of this.players.values()) {
      player.audio.pause()
      player.audio.currentTime = 0
    }
  }

  removeTrack(trackId: string): void {
    const player = this.players.get(trackId)
    if (!player) {
      return
    }

    player.audio.pause()
    player.audio.src = ''
    this.players.delete(trackId)
  }

  dispose(): void {
    this.stopAll()

    for (const player of this.players.values()) {
      player.audio.src = ''
    }

    this.players.clear()
  }
}
