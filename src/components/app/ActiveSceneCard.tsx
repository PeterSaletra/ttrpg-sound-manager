import type { DragEvent } from 'react'
import { GripVertical, Pause, Play, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { Track, TrackLayer } from '@/types'

type ActiveSceneCardProps = {
  activeSceneName: string
  sceneTracks: Track[]
  draggedTrackId: string | null
  draggedOverTrackId: string | null
  buttonClassName: string
  activeButtonClassName: string
  onSceneDragEnter: (trackId: string) => void
  onSceneDragLeave: (trackId: string) => void
  onSceneTrackDrop: (event: DragEvent<HTMLDivElement>, targetTrackId: string) => void
  onEmptyDrop: (event: DragEvent<HTMLDivElement>) => void
  onSceneTrackDragStart: (event: DragEvent<HTMLButtonElement>, trackId: string) => void
  onSceneTrackDragEnd: () => void
  onTrackTogglePlay: (track: Track) => void
  onTrackDelete: (track: Track) => void
  onTrackVolumeChange: (trackId: string, nextVolume: number) => void
  onTrackLoopChange: (trackId: string, checked: boolean) => void
  onTrackLayerChange: (trackId: string, layer: TrackLayer) => void
  getTrackShortcut: (trackIndex: number) => string
  getTrackOutputVolume: (track: Track) => number
}

const sliderToNumber = (value: number | readonly number[]): number =>
  typeof value === 'number' ? value : (value[0] ?? 0)

export function ActiveSceneCard({
  activeSceneName,
  sceneTracks,
  draggedTrackId,
  draggedOverTrackId,
  buttonClassName,
  activeButtonClassName,
  onSceneDragEnter,
  onSceneDragLeave,
  onSceneTrackDrop,
  onEmptyDrop,
  onSceneTrackDragStart,
  onSceneTrackDragEnd,
  onTrackTogglePlay,
  onTrackDelete,
  onTrackVolumeChange,
  onTrackLoopChange,
  onTrackLayerChange,
  getTrackShortcut,
  getTrackOutputVolume,
}: ActiveSceneCardProps) {
  return (
    <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-sky-500/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Active Scene: {activeSceneName || '-'}</CardTitle>
        <CardDescription>Tracks assigned to this scene with full controls</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {sceneTracks.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-400"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onEmptyDrop}
          >
            No tracks in this scene yet. Add tracks from the right-side Sound Library panel.
          </div>
        ) : (
          sceneTracks.map((track, index) => (
            <div
              key={track.id}
              data-track-card={track.id}
              className={`grid gap-3 rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-3 md:grid-cols-[1.2fr_1fr_auto] ${
                draggedOverTrackId === track.id ? 'ring-2 ring-sky-300/70' : ''
              } ${
                draggedTrackId === track.id ? 'scale-[0.99] opacity-70 ring-2 ring-sky-300/60 transition' : ''
              }`}
              onDragEnter={() => onSceneDragEnter(track.id)}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => onSceneDragLeave(track.id)}
              onDrop={(event) => onSceneTrackDrop(event, track.id)}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    draggable
                    className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded border border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:cursor-grabbing"
                    onDragStart={(event) => onSceneTrackDragStart(event, track.id)}
                    onDragEnd={onSceneTrackDragEnd}
                    aria-label={`Drag track ${track.name}`}
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                  <h3 className="text-sm font-medium text-zinc-100">{track.name}</h3>
                  <Badge
                    variant={track.isPlaying ? 'default' : 'outline'}
                    className={track.isPlaying ? 'bg-emerald-300 text-zinc-950' : 'border-zinc-300 bg-zinc-800 text-zinc-50'}
                  >
                    {track.isPlaying ? 'LIVE' : 'IDLE'}
                  </Badge>
                  <Badge variant="secondary">{track.layer.toUpperCase()}</Badge>
                  <Badge variant="outline" className="border-zinc-500 bg-zinc-800 text-zinc-200">
                    {track.sourceType === 'youtube' ? 'YOUTUBE' : 'LOCAL'}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">drag handle to reorder</span>
                </div>
                {track.sourceType === 'youtube' && track.isPlaying ? (
                  <div className="rounded-md border border-zinc-700 bg-zinc-950/70 px-2 py-1 text-xs text-zinc-300">
                    YouTube audio is active
                  </div>
                ) : null}
                <label className="grid gap-1 text-xs text-zinc-300">
                  Volume: {track.volume}%
                  {getTrackOutputVolume(track) !== track.volume ? (
                    <span className="text-[11px] text-amber-300">Crossfade output: {getTrackOutputVolume(track)}%</span>
                  ) : null}
                  <Slider
                    className="[&_[data-slot='slider-track']]:bg-zinc-700 [&_[data-slot='slider-range']]:bg-emerald-300 [&_[data-slot='slider-thumb']]:border-emerald-100 [&_[data-slot='slider-thumb']]:bg-zinc-100"
                    value={[track.volume]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) => {
                      onTrackVolumeChange(track.id, sliderToNumber(value))
                    }}
                  />
                </label>
              </div>

              <div className="grid content-center gap-2 text-xs text-zinc-300">
                <label className="inline-flex items-center justify-between gap-2 rounded-md border border-zinc-700 px-2 py-1">
                  Loop
                  <Switch
                    checked={track.loop}
                    onCheckedChange={(checked) => {
                      onTrackLoopChange(track.id, checked)
                    }}
                  />
                </label>

                <label className="grid gap-1">
                  Layer
                  <select
                    className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                    value={track.layer}
                    onChange={(event) => onTrackLayerChange(track.id, event.currentTarget.value as TrackLayer)}
                  >
                    <option value="ambient">Ambient</option>
                    <option value="music">Music</option>
                    <option value="sfx">SFX</option>
                  </select>
                </label>

                <div className="grid gap-1">
                  <span>Hotkey</span>
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200">
                    {getTrackShortcut(index) || '-'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={track.isPlaying ? activeButtonClassName : buttonClassName}
                  onClick={() => onTrackTogglePlay(track)}
                >
                  {track.isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {track.isPlaying ? 'Stop' : 'Play'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={buttonClassName}
                  onClick={() => onTrackDelete(track)}
                  aria-label={`Delete track ${track.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
