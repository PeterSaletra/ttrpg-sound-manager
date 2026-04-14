import { useEffect } from 'react'

import type { Scene, Track } from '@/types'

type UseGlobalHotkeysParams = {
  sceneTracks: Track[]
  scenes: Scene[]
  sceneShortcutKeys: string[]
  trackShortcutKeys: string[]
  onStopAll: () => void
  onPlayAll: () => Promise<void>
  onSceneSelect: (sceneId: string) => Promise<void>
  onToggleTrackPlay: (track: Track) => Promise<void>
  onToast: (text: string, tone?: 'info' | 'error') => void
}

export function useGlobalHotkeys({
  sceneTracks,
  scenes,
  sceneShortcutKeys,
  trackShortcutKeys,
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

      const sceneIndex = sceneShortcutKeys.indexOf(event.key)
      if (sceneIndex >= 0) {
        event.preventDefault()
        const scene = scenes[sceneIndex]
        if (scene) {
          void onSceneSelect(scene.id)
        }
        return
      }

      const pressedKey = event.key.toLowerCase()
      const trackIndex = trackShortcutKeys.indexOf(pressedKey)
      if (trackIndex < 0) {
        return
      }

      const mappedTrack = sceneTracks[trackIndex]
      if (mappedTrack) {
        event.preventDefault()
        void onToggleTrackPlay(mappedTrack)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    onPlayAll,
    onSceneSelect,
    onStopAll,
    onToast,
    onToggleTrackPlay,
    sceneShortcutKeys,
    sceneTracks,
    scenes,
    trackShortcutKeys,
  ])
}
