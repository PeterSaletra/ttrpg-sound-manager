import type { RefObject } from 'react'
import { Keyboard, Link2, Pause, Play, Skull, Upload } from 'lucide-react'

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
import type { TrackLayer } from '@/types'

const sliderToNumber = (value: number | readonly number[]): number =>
  typeof value === 'number' ? value : (value[0] ?? 0)

type HotkeyPreset = 'combat' | 'exploration' | 'horror'

type TopControlsCardProps = {
  masterVolume: number
  crossfadeDurationMs: number
  crossfadeLayers: Record<TrackLayer, boolean>
  youtubeInput: string
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
  onApplyHotkeyPreset: (preset: HotkeyPreset) => void
}

export function TopControlsCard({
  masterVolume,
  crossfadeDurationMs,
  crossfadeLayers,
  youtubeInput,
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
  onApplyHotkeyPreset,
}: TopControlsCardProps) {
  return (
    <Card className="border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-amber-500/20 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl tracking-wide">TTRPG Sound Manager</CardTitle>
        <CardDescription className="text-zinc-300">
          Top: global controls. Left panel: scenes. Right panel: full sound library.
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
            <div className="inline-flex items-center gap-2 font-medium text-zinc-200">
              <Keyboard className="size-3.5" /> Hotkey presets
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className={buttonClassName} onClick={() => onApplyHotkeyPreset('combat')}>Combat</Button>
              <Button size="sm" variant="outline" className={buttonClassName} onClick={() => onApplyHotkeyPreset('exploration')}>Exploration</Button>
              <Button size="sm" variant="outline" className={buttonClassName} onClick={() => onApplyHotkeyPreset('horror')}>Horror</Button>
            </div>
            <div>Space: Play Scene / Stop All</div>
            <div>Shift+Space: Panic</div>
            <div>1-9: Switch scenes by their order in the list</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
