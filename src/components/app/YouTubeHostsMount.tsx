import type { RefObject } from 'react'

import type { Track } from '@/types'

type YouTubeHostsMountProps = {
  tracks: Track[]
  youtubeHostRefs: RefObject<Map<string, HTMLDivElement>>
}

export function YouTubeHostsMount({ tracks, youtubeHostRefs }: YouTubeHostsMountProps) {
  return (
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
  )
}
