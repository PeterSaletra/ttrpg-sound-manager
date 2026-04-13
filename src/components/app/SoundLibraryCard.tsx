import type { DragEvent } from 'react'
import { Search, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Track, TrackLayer } from '@/types'

type SoundLibraryCardProps = {
  filteredLibraryTracks: Track[]
  librarySearch: string
  libraryLayerFilter: 'all' | TrackLayer
  activeSceneTrackIdSet: Set<string>
  buttonClassName: string
  activeButtonClassName: string
  onLibrarySearchChange: (value: string) => void
  onLayerFilterChange: (value: 'all' | TrackLayer) => void
  onLibraryTrackDragStart: (event: DragEvent<HTMLDivElement>, trackId: string) => void
  onToggleFavorite: (trackId: string) => void
  onRenameTrack: (trackId: string, name: string) => void
  onToggleTrackInScene: (trackId: string) => void
  onTogglePlay: (track: Track) => void
}

export function SoundLibraryCard({
  filteredLibraryTracks,
  librarySearch,
  libraryLayerFilter,
  activeSceneTrackIdSet,
  buttonClassName,
  activeButtonClassName,
  onLibrarySearchChange,
  onLayerFilterChange,
  onLibraryTrackDragStart,
  onToggleFavorite,
  onRenameTrack,
  onToggleTrackInScene,
  onTogglePlay,
}: SoundLibraryCardProps) {
  return (
    <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-violet-500/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Sound Library</CardTitle>
        <CardDescription>Right-side global track library</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-zinc-400" />
            <Input
              className="pl-8"
              placeholder="Search tracks"
              value={librarySearch}
              onChange={(event) => onLibrarySearchChange(event.currentTarget.value)}
            />
          </label>
          <select
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-200"
            value={libraryLayerFilter}
            onChange={(event) => onLayerFilterChange(event.currentTarget.value as 'all' | TrackLayer)}
          >
            <option value="all">All layers</option>
            <option value="ambient">Ambient</option>
            <option value="music">Music</option>
            <option value="sfx">SFX</option>
          </select>
        </div>
        <ScrollArea className="h-[66vh] rounded-md border border-zinc-700/50 p-2">
          <div className="grid gap-2">
            {filteredLibraryTracks.length === 0 ? (
              <div className="rounded border border-dashed border-zinc-700 p-4 text-xs text-zinc-400">
                No tracks match the selected filters.
              </div>
            ) : (
              filteredLibraryTracks.map((track) => (
                <div
                  key={track.id}
                  className="grid gap-2 rounded border border-zinc-700/70 bg-zinc-900/80 p-2"
                  draggable
                  onDragStart={(event) => onLibraryTrackDragStart(event, track.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">{track.name}</div>
                      <div className="text-[11px] text-zinc-400">
                        {track.layer.toUpperCase()} | {track.sourceType === 'youtube' ? 'YOUTUBE' : 'LOCAL'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-xs"
                        variant={track.favorite ? 'secondary' : 'outline'}
                        className={track.favorite ? activeButtonClassName : buttonClassName}
                        onClick={() => onToggleFavorite(track.id)}
                        aria-label={`Favorite ${track.name}`}
                      >
                        <Star className={`size-3 ${track.favorite ? 'fill-current' : ''}`} />
                      </Button>
                      <Badge
                        variant={track.isPlaying ? 'default' : 'outline'}
                        className={track.isPlaying ? 'bg-emerald-300 text-zinc-950' : 'border-zinc-300 bg-zinc-800 text-zinc-50'}
                      >
                        {track.isPlaying ? 'LIVE' : 'IDLE'}
                      </Badge>
                    </div>
                  </div>
                  <Input
                    className="h-8 border-zinc-700 bg-zinc-900 text-zinc-100"
                    value={track.name}
                    onChange={(event) => onRenameTrack(track.id, event.currentTarget.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={activeSceneTrackIdSet.has(track.id) ? 'secondary' : 'outline'}
                      className={
                        activeSceneTrackIdSet.has(track.id)
                          ? `flex-1 ${activeButtonClassName}`
                          : `flex-1 ${buttonClassName}`
                      }
                      onClick={() => onToggleTrackInScene(track.id)}
                    >
                      {activeSceneTrackIdSet.has(track.id) ? 'Remove from Scene' : 'Add to Scene'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={buttonClassName}
                      onClick={() => onTogglePlay(track)}
                    >
                      {track.isPlaying ? 'Stop' : 'Play'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
