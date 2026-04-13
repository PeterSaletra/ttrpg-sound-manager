import { useEffect } from 'react'

import { eventToHotkey, normalizeHotkey } from '@/lib/app-helpers'
import type { Scene, Track } from '@/types'

type UseGlobalHotkeysParams = {
  sceneTracks: Track[]
  scenes: Scene[]
  onStopAll: () => void
  onPlayAll: () => Promise<void>
  onSceneSelect: (sceneId: string) => Promise<void>
  onToggleTrackPlay: (track: Track) => Promise<void>
  onToast: (text: string, tone?: 'info' | 'error') => void
}

export function useGlobalHotkeys({
  sceneTracks,
  scenes,
  onStopAll,
  onPlayAll,
  onSceneSelect,
  onToggleTrackPlay,
  onToast,
}: UseGlobalHotkeysParams) {
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
        onStopAll()
        onToast('Panic triggered by Shift+Space.')
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        if (sceneTracks.some((track) => track.isPlaying)) {
          onStopAll()
        } else {
          void onPlayAll()
        }
        return
      }

      const numericKey = Number(event.key)
      if (Number.isInteger(numericKey) && numericKey >= 1 && numericKey <= 9) {
        event.preventDefault()
        const scene = scenes[numericKey - 1]
        if (scene) {
          void onSceneSelect(scene.id)
        }
        return
      }

      const pressedHotkey = normalizeHotkey(eventToHotkey(event))
      const mappedTrack = sceneTracks.find((track) => normalizeHotkey(track.hotkey) === pressedHotkey)
      if (mappedTrack) {
        event.preventDefault()
        void onToggleTrackPlay(mappedTrack)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onPlayAll, onSceneSelect, onStopAll, onToast, onToggleTrackPlay, sceneTracks, scenes])
}
