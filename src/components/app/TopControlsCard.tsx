import { type RefObject, useEffect, useState } from 'react'
import { Link2, Pause, Play, Skull, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { Scene, Track, TrackLayer } from '@/types'

const sliderToNumber = (value: number | readonly number[]): number =>
  typeof value === 'number' ? value : (value[0] ?? 0)

type TopControlsCardProps = {
  masterVolume: number
  crossfadeDurationMs: number
  crossfadeLayers: Record<TrackLayer, boolean>
  youtubeInput: string
  scenes: Scene[]
  activeSceneId: string
  activeSceneTracks: Track[]
  fileInputRef: RefObject<HTMLInputElement | null>
  buttonClassName: string
  onMasterVolumeChange: (value: number) => void
  onCrossfadeDurationChange: (value: number) => void
  onToggleCrossfadeLayer: (layer: TrackLayer, checked: boolean) => void
  onFilesImported: (files: FileList | null) => void
  onYoutubeInputChange: (value: string) => void
  onAddYouTubeTrack: () => void
  onPlayScene: () => void
  onStopAll: () => void
  onPanic: () => void
  sceneShortcutKeys: string[]
  trackShortcutKeys: string[]
  onSceneSelect: (sceneId: string) => void
  onSaveShortcuts: (sceneShortcutKeys: string[], trackShortcutKeys: string[]) => void
  controllerSupported: boolean
  controllerConnected: boolean
  controllerLabel: string
  controllerError: string
  onControllerConnect: () => void
  onControllerDisconnect: () => void
}

export function TopControlsCard({
  masterVolume,
  crossfadeDurationMs,
  crossfadeLayers,
  youtubeInput,
  scenes,
  activeSceneId,
  activeSceneTracks,
  fileInputRef,
  buttonClassName,
  onMasterVolumeChange,
  onCrossfadeDurationChange,
  onToggleCrossfadeLayer,
  onFilesImported,
  onYoutubeInputChange,
  onAddYouTubeTrack,
  onPlayScene,
  onStopAll,
  onPanic,
  sceneShortcutKeys,
  trackShortcutKeys,
  onSceneSelect,
  onSaveShortcuts,
  controllerSupported,
  controllerConnected,
  controllerLabel,
  controllerError,
  onControllerConnect,
  onControllerDisconnect,
}: TopControlsCardProps) {
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState<boolean>(false)
  const [sceneShortcutDrafts, setSceneShortcutDrafts] = useState<string[]>([])
  const [trackShortcutDrafts, setTrackShortcutDrafts] = useState<string[]>([])
  const [shortcutError, setShortcutError] = useState<string>('')

  const visibleSceneCount = scenes.length
  const visibleTrackCount = activeSceneTracks.length

  const openShortcutModal = () => {
    setSceneShortcutDrafts(
      Array.from({ length: visibleSceneCount }, (_, index) => sceneShortcutKeys[index] ?? ''),
    )
    setTrackShortcutDrafts(
      Array.from({ length: visibleTrackCount }, (_, index) => trackShortcutKeys[index] ?? ''),
    )
    setShortcutError('')
    setIsShortcutModalOpen(true)
  }

  const handleSceneSelectInsideModal = (sceneId: string) => {
    onSceneSelect(sceneId)
  }

  const updateDraftValue = (
    previous: string[],
    index: number,
    value: string,
  ): string[] => {
    const next = [...previous]
    next[index] = value
    return next
  }

  const hasDuplicates = (values: string[]): boolean => {
    const normalized = values.map((value) => value.trim().toLowerCase()).filter(Boolean)
    return new Set(normalized).size !== normalized.length
  }

  const handleSaveShortcutChanges = () => {
    const nextScene = sceneShortcutDrafts
      .slice(0, visibleSceneCount)
      .map((value) => value.trim().toLowerCase())
    const nextTrack = trackShortcutDrafts
      .slice(0, visibleTrackCount)
      .map((value) => value.trim().toLowerCase())

    if (nextScene.length === 0 || nextScene.some((value) => !value)) {
      setShortcutError('Each visible scene must have a shortcut key.')
      return
    }

    if (visibleTrackCount > 0 && nextTrack.some((value) => !value)) {
      setShortcutError('Each visible track must have a shortcut key.')
      return
    }

    if (hasDuplicates(nextScene) || hasDuplicates(nextTrack)) {
      setShortcutError('Shortcut keys must be unique within each list.')
      return
    }

    onSaveShortcuts(nextScene, nextTrack)
    setIsShortcutModalOpen(false)
  }

  useEffect(() => {
    if (!isShortcutModalOpen) {
      return
    }

    setTrackShortcutDrafts(
      Array.from({ length: visibleTrackCount }, (_, index) => trackShortcutKeys[index] ?? ''),
    )
    setShortcutError('')
  }, [isShortcutModalOpen, trackShortcutKeys, visibleTrackCount])

  return (
    <>
      <style>{`
        .shortcut-modal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .shortcut-modal-scroll::-webkit-scrollbar-track {
          background: rgba(24, 24, 27, 0.5);
          border-radius: 4px;
        }
        .shortcut-modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 4px;
        }
        .shortcut-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.6);
        }
      `}</style>
      <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-amber-500/20 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-3xl tracking-wide">TTRPG Sound Manager</CardTitle>
          <CardDescription className="text-zinc-300">
            Build immersive soundscapes fast with scenes, layered tracks, and live controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="grid gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className={buttonClassName} onClick={onPlayScene}>
                <Play className="size-4" /> Play Scene
              </Button>
              <Button variant="outline" className={buttonClassName} onClick={onStopAll}>
                <Pause className="size-4" /> Stop All
              </Button>
              <Button variant="outline" className={buttonClassName} onClick={onPanic}>
                <Skull className="size-4" /> Panic
              </Button>
            </div>
            <label className="grid gap-2 text-sm">
              Master Volume: <span className="font-semibold">{masterVolume}%</span>
              <Slider
                className="[&_[data-slot='slider-track']]:bg-zinc-700 [&_[data-slot='slider-range']]:bg-amber-300 [&_[data-slot='slider-thumb']]:border-amber-100 [&_[data-slot='slider-thumb']]:bg-zinc-100"
                value={[masterVolume]}
                onValueChange={(value) => onMasterVolumeChange(sliderToNumber(value))}
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
                onValueChange={(value) => onCrossfadeDurationChange(sliderToNumber(value))}
              />
            </label>
            <div className="grid gap-1 text-xs text-zinc-300">
              <label className="inline-flex items-center justify-between gap-2 rounded border border-zinc-700 px-2 py-1">
                Ambient
                <Switch
                  className="data-checked:bg-emerald-300 data-unchecked:bg-zinc-600 [&_[data-slot='switch-thumb']]:bg-zinc-100 data-checked:[&_[data-slot='switch-thumb']]:bg-zinc-900"
                  checked={crossfadeLayers.ambient}
                  onCheckedChange={(checked) => onToggleCrossfadeLayer('ambient', checked)}
                />
              </label>
              <label className="inline-flex items-center justify-between gap-2 rounded border border-zinc-700 px-2 py-1">
                Music
                <Switch
                  className="data-checked:bg-emerald-300 data-unchecked:bg-zinc-600 [&_[data-slot='switch-thumb']]:bg-zinc-100 data-checked:[&_[data-slot='switch-thumb']]:bg-zinc-900"
                  checked={crossfadeLayers.music}
                  onCheckedChange={(checked) => onToggleCrossfadeLayer('music', checked)}
                />
              </label>
              <label className="inline-flex items-center justify-between gap-2 rounded border border-zinc-700 px-2 py-1">
                SFX
                <Switch
                  className="data-checked:bg-emerald-300 data-unchecked:bg-zinc-600 [&_[data-slot='switch-thumb']]:bg-zinc-100 data-checked:[&_[data-slot='switch-thumb']]:bg-zinc-900"
                  checked={crossfadeLayers.sfx}
                  onCheckedChange={(checked) => onToggleCrossfadeLayer('sfx', checked)}
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
                onFilesImported(event.currentTarget.files)
                event.currentTarget.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              className={buttonClassName}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" /> Choose Audio Files
            </Button>
            <div className="flex gap-2">
              <Input
                placeholder="YouTube URL"
                value={youtubeInput}
                onChange={(event) => onYoutubeInputChange(event.currentTarget.value)}
              />
              <Button variant="outline" className={buttonClassName} onClick={onAddYouTubeTrack}>
                <Link2 className="size-4" /> Add
              </Button>
            </div>
            <div className="text-xs text-zinc-300">Supported formats: MP3, WAV, OGG, M4A</div>
            <div className="grid gap-1 rounded-md border border-zinc-700/60 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
              <div className="font-medium text-zinc-200">Reserved Shortcuts</div>
              <div>Space: Play Scene / Stop All</div>
              <div>Shift+Space: Panic</div>
              <div>Scenes: {sceneShortcutKeys.join(', ')}</div>
              <div>Tracks in active scene: {trackShortcutKeys.join(', ')}</div>
              <Button size="sm" variant="outline" className={buttonClassName} onClick={openShortcutModal}>
                Customize shortcuts
              </Button>
            </div>
            <div className="grid gap-1 rounded-md border border-zinc-700/60 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
              <div className="font-medium text-zinc-200">External Controller</div>
              <div>
                {controllerSupported
                  ? controllerConnected
                    ? `Connected${controllerLabel ? `: ${controllerLabel}` : ''}`
                    : 'Disconnected'
                  : 'Web Serial not supported by this browser'}
              </div>
              {controllerError ? <div className="text-rose-300">{controllerError}</div> : null}
              <div>Keyboard shortcuts and controller buttons can be used at the same time.</div>
              {controllerConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={buttonClassName}
                  onClick={onControllerDisconnect}
                >
                  Disconnect Controller
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className={buttonClassName}
                  onClick={onControllerConnect}
                  disabled={!controllerSupported}
                >
                  Connect Controller
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isShortcutModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-zinc-950/75 p-4 backdrop-blur-sm lg:items-center"
          onKeyDownCapture={(event) => event.stopPropagation()}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.65)] ring-1 ring-sky-500/15">
            <div className="shrink-0 border-b border-zinc-800 bg-gradient-to-r from-zinc-950 to-zinc-900 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-wide">Customize shortcuts</h2>
                  <p className="mt-1 max-w-2xl text-sm text-zinc-300">
                    Edit scene shortcuts for the added scenes, then open a scene and adjust shortcuts for its tracks.
                  </p>
                </div>
                <Button variant="outline" className={buttonClassName} onClick={() => setIsShortcutModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[1fr_1.15fr]">
              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-inner shadow-black/20">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Scenes</div>
                  <div className="text-xs text-zinc-400">Each scene reserves one shortcut.</div>
                </div>
                <div className="grid min-h-0 gap-2 overflow-auto pr-1 shortcut-modal-scroll" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(168, 85, 247, 0.4) rgba(24, 24, 27, 0.5)' }}>
                  {scenes.map((scene, index) => {
                    const isActiveScene = scene.id === activeSceneId

                    return (
                      <div
                        key={scene.id}
                        className={`grid gap-2 rounded-xl border px-3 py-3 text-left transition ${
                          isActiveScene
                            ? 'border-sky-400/40 bg-sky-500/10 shadow-[0_0_0_1px_rgba(125,211,252,0.15)]'
                            : 'border-zinc-700/80 bg-zinc-950/50 hover:border-zinc-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSceneSelectInsideModal(scene.id)}
                          className="flex items-center justify-between gap-3 rounded-md px-1 py-0.5 text-left"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-100">{scene.name}</div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                              {isActiveScene ? 'active scene' : 'scene'}
                            </div>
                          </div>
                          <div className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
                            {sceneShortcutDrafts[index] ?? '—'}
                          </div>
                        </button>
                        <Input
                          className="h-9 border-zinc-700 bg-zinc-900 text-sm text-zinc-100"
                          value={sceneShortcutDrafts[index] ?? ''}
                          onKeyDown={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const { value } = event.currentTarget
                            setSceneShortcutDrafts((previous) =>
                              updateDraftValue(previous, index, value),
                            )
                          }}
                          placeholder="1"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-inner shadow-black/20">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Tracks in active scene</div>
                  <div className="text-xs text-zinc-400">Shown in scene order, using the reserved track shortcut set.</div>
                </div>

                <div
                  className="shortcut-modal-scroll grid min-h-0 gap-2 overflow-auto pr-1"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(168, 85, 247, 0.4) rgba(24, 24, 27, 0.5)',
                  }}
                >
                  {activeSceneTracks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                      Select a scene with tracks to edit track shortcuts here.
                    </div>
                  ) : (
                    activeSceneTracks.map((track, index) => (
                      <div
                        key={track.id}
                        className="grid h-28 gap-2 rounded-xl border border-zinc-700/80 bg-zinc-950/55 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-100">{track.name}</div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">track {index + 1}</div>
                          </div>
                          <div className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
                            {trackShortcutDrafts[index] ?? '—'}
                          </div>
                        </div>
                        <Input
                          className="h-9 border-zinc-700 bg-zinc-900 text-sm text-zinc-100"
                          value={trackShortcutDrafts[index] ?? ''}
                          onKeyDown={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const { value } = event.currentTarget
                            setTrackShortcutDrafts((previous) =>
                              updateDraftValue(previous, index, value),
                            )
                          }}
                          placeholder="q"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {shortcutError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 lg:col-span-2">
                  {shortcutError}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950 px-5 py-4">
              <Button variant="outline" className={buttonClassName} onClick={() => setIsShortcutModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="outline" className={buttonClassName} onClick={handleSaveShortcutChanges}>
                Save shortcuts
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
