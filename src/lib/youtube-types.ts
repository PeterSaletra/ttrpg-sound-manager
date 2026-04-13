export type YouTubePlayerState = {
  ENDED: number
}

export type YouTubePlayer = {
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

export type YouTubePlayerEvent = {
  target: YouTubePlayer
  data?: number
}

export type YouTubeApi = {
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
