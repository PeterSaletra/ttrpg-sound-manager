import { useEffect, useMemo, useRef, useState } from 'react'
import { ActiveSceneCard } from '@/components/app/ActiveSceneCard'
import { FileDropOverlay } from '@/components/app/FileDropOverlay'
import { ScenesCard } from '@/components/app/ScenesCard'
import { SoundLibraryCard } from '@/components/app/SoundLibraryCard'
import { ToastStack } from '@/components/app/ToastStack'
import { TopControlsCard } from '@/components/app/TopControlsCard'
import { YouTubeHostsMount } from '@/components/app/YouTubeHostsMount'
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys'
import { useToastQueue } from '@/hooks/useToastQueue'
import { Separator } from '@/components/ui/separator'
import { AudioEngine } from '@/lib/audio-engine'
import {
  BUTTON_ACTIVE_CLASS,
  BUTTON_UNIFIED_CLASS,
  DEFAULT_CROSSFADE_DURATION_MS,
  DEFAULT_CROSSFADE_LAYERS,
  DEFAULT_LAYER,
  HOTKEY_PRESETS,
} from '@/lib/app-config'
import {
  AUDIO_EXTENSION_REGEX,
  buildDragPayload,
  createDefaultScene,
  createId,
  hasFilesInDragEvent,
  extractYouTubeId,
  normalizeHotkey,
  parseDragPayload,
  setTrackCardDragPreview,
} from '@/lib/app-helpers'
import {
  deleteAudioFile,
  loadAudioFile,
  loadSession,
  saveAudioFile,
  saveSession,
  toStoredTracks,
} from '@/lib/storage'
import type { YouTubePlayer } from '@/lib/youtube-types'
import type { Scene, Track, TrackLayer } from '@/types'

function App() {
  const [scenes, setScenes] = useState<Scene[]>(() => [createDefaultScene()])
  const [tracks, setTracks] = useState<Track[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string>('')
  const [masterVolume, setMasterVolume] = useState<number>(85)
  const [newSceneName, setNewSceneName] = useState<string>('')
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
  const { toasts, pushToast } = useToastQueue()

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
      pushToast('No valid audio files were found for import.', 'error')
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
        pushToast(`Imported ${importedTracks.length} audio file(s), skipped ${skippedCount}.`, 'info')
      } else {
        pushToast(`Imported ${importedTracks.length} file(s).`)
      }
    } catch {
      pushToast('Audio import failed.', 'error')
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
      pushToast('The browser blocked autoplay. Click Play again after interacting with the page.', 'error')
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
      pushToast('Some tracks were blocked by the autoplay policy.', 'error')
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
      pushToast('Scene name cannot be empty.', 'error')
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
      pushToast('At least one scene must remain.', 'error')
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
      pushToast('Invalid YouTube URL.', 'error')
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
    pushToast('Added YouTube track to the active scene.')
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
      pushToast(`Hotkey ${normalized} is already assigned in this scene.`, 'error')
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

    pushToast(`Applied hotkey preset: ${preset}.`)
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
        pushToast('Some tracks could not start because of autoplay policy.', 'error')
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
        pushToast('Crossfade finished. Some tracks may have been blocked by autoplay policy.', 'error')
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

  useGlobalHotkeys({
    sceneTracks,
    scenes,
    onStopAll: handleStopAll,
    onPlayAll: handlePlayAll,
    onSceneSelect: handleSceneSelect,
    onToggleTrackPlay: handleTogglePlay,
    onToast: pushToast,
  })

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
      <TopControlsCard
        masterVolume={masterVolume}
        crossfadeDurationMs={crossfadeDurationMs}
        crossfadeLayers={crossfadeLayers}
        youtubeInput={youtubeInput}
        fileInputRef={fileInputRef}
        buttonClassName={BUTTON_UNIFIED_CLASS}
        onMasterVolumeChange={setMasterVolume}
        onCrossfadeDurationChange={setCrossfadeDurationMs}
        onToggleCrossfadeLayer={toggleCrossfadeLayer}
        onFilesImported={(files) => {
          void handleFilesImported(files)
        }}
        onYoutubeInputChange={setYoutubeInput}
        onAddYouTubeTrack={handleAddYouTubeTrack}
        onPlayScene={() => {
          void handlePlayAll()
        }}
        onStopAll={handleStopAll}
        onPanic={handleStopAll}
        onApplyHotkeyPreset={applyHotkeyPreset}
      />

      <section className="grid flex-1 gap-4 lg:grid-cols-[260px_1fr_460px]">
        <ScenesCard
          scenes={scenes}
          activeSceneId={activeScene?.id ?? activeSceneId}
          newSceneName={newSceneName}
          editingSceneId={editingSceneId}
          editingSceneName={editingSceneName}
          buttonClassName={BUTTON_UNIFIED_CLASS}
          activeButtonClassName={BUTTON_ACTIVE_CLASS}
          onNewSceneNameChange={setNewSceneName}
          onCreateScene={handleCreateScene}
          onSceneSelect={(sceneId) => {
            void handleSceneSelect(sceneId)
          }}
          onStartSceneRename={handleStartSceneRename}
          onEditingSceneNameChange={setEditingSceneName}
          onSaveSceneRename={handleSaveSceneRename}
          onCancelSceneRename={handleCancelSceneRename}
          onDeleteScene={handleDeleteScene}
        />

        <ActiveSceneCard
          activeSceneName={activeScene?.name ?? ''}
          sceneTracks={sceneTracks}
          draggedTrackId={draggedTrackId}
          draggedOverTrackId={draggedOverTrackId}
          buttonClassName={BUTTON_UNIFIED_CLASS}
          activeButtonClassName={BUTTON_ACTIVE_CLASS}
          onSceneDragEnter={setDraggedOverTrackId}
          onSceneDragLeave={(trackId) => setDraggedOverTrackId((previous) => (previous === trackId ? null : previous))}
          onSceneTrackDrop={(event, targetTrackId) => {
            event.preventDefault()
            const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))

            if (payload?.source === 'scene') {
              moveTrackInActiveScene(payload.trackId, targetTrackId)
            }

            if (payload?.source === 'library') {
              addTrackToActiveScene(payload.trackId, targetTrackId)
              pushToast('Added track to the active scene.')
            }

            if (!payload && draggedTrackId) {
              moveTrackInActiveScene(draggedTrackId, targetTrackId)
            }

            setDraggedTrackId(null)
            setDraggedOverTrackId(null)
          }}
          onEmptyDrop={(event) => {
            event.preventDefault()
            const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
            if (payload?.source === 'library') {
              addTrackToActiveScene(payload.trackId)
              pushToast('Added track to the active scene.')
            }
          }}
          onSceneTrackDragStart={(event, trackId) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', buildDragPayload('scene', trackId))

            const trackCard = event.currentTarget.closest('[data-track-card]') as HTMLElement | null
            if (trackCard) {
              setTrackCardDragPreview(event, trackCard)
            }

            setDraggedTrackId(trackId)
          }}
          onSceneTrackDragEnd={() => {
            setDraggedTrackId(null)
            setDraggedOverTrackId(null)
          }}
          onTrackTogglePlay={(track) => {
            void handleTogglePlay(track)
          }}
          onTrackDelete={(track) => {
            void handleDeleteTrack(track)
          }}
          onTrackVolumeChange={(trackId, nextVolume) => {
            updateTrack(trackId, (current) => ({ ...current, volume: nextVolume }))
          }}
          onTrackLoopChange={(trackId, checked) => {
            updateTrack(trackId, (current) => ({
              ...current,
              loop: checked,
            }))
          }}
          onTrackLayerChange={handleLayerChange}
          onTrackHotkeyChange={handleHotkeyChange}
          getTrackOutputVolume={getTrackOutputVolume}
        />

        <SoundLibraryCard
          filteredLibraryTracks={filteredLibraryTracks}
          librarySearch={librarySearch}
          libraryLayerFilter={libraryLayerFilter}
          activeSceneTrackIdSet={activeSceneTrackIdSet}
          buttonClassName={BUTTON_UNIFIED_CLASS}
          activeButtonClassName={BUTTON_ACTIVE_CLASS}
          onLibrarySearchChange={setLibrarySearch}
          onLayerFilterChange={setLibraryLayerFilter}
          onLibraryTrackDragStart={(event, trackId) => {
            event.dataTransfer.effectAllowed = 'copyMove'
            event.dataTransfer.setData('text/plain', buildDragPayload('library', trackId))
          }}
          onToggleFavorite={handleToggleFavorite}
          onRenameTrack={handleRenameTrack}
          onToggleTrackInScene={handleToggleTrackInActiveScene}
          onTogglePlay={(track) => {
            void handleTogglePlay(track)
          }}
        />
      </section>

      <Separator />
      <p className="pb-2 text-center text-xs text-zinc-400">
        Layout: top controls | left scenes panel | right sound library.
      </p>

      <FileDropOverlay visible={isFileDragOver} />

      <ToastStack toasts={toasts} />

      <YouTubeHostsMount tracks={tracks} youtubeHostRefs={youtubeHostRefs} />
    </main>
  )
}

export default App
