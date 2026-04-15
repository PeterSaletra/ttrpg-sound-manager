import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'

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
import type { Scene } from '@/types'

type ScenesCardProps = {
  scenes: Scene[]
  sceneShortcutKeys: string[]
  activeSceneId: string
  newSceneName: string
  editingSceneId: string | null
  editingSceneName: string
  buttonClassName: string
  activeButtonClassName: string
  onNewSceneNameChange: (value: string) => void
  onCreateScene: () => void
  onSceneSelect: (sceneId: string) => void
  onStartSceneRename: (scene: Scene) => void
  onEditingSceneNameChange: (value: string) => void
  onSaveSceneRename: () => void
  onCancelSceneRename: () => void
  onDeleteScene: (sceneId: string) => void
}

export function ScenesCard({
  scenes,
  sceneShortcutKeys,
  activeSceneId,
  newSceneName,
  editingSceneId,
  editingSceneName,
  buttonClassName,
  activeButtonClassName,
  onNewSceneNameChange,
  onCreateScene,
  onSceneSelect,
  onStartSceneRename,
  onEditingSceneNameChange,
  onSaveSceneRename,
  onCancelSceneRename,
  onDeleteScene,
}: ScenesCardProps) {
  return (
    <Card className="h-full border-0 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-amber-500/15 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl">Scenes</CardTitle>
        <CardDescription>Create, switch, and organize your encounter sound sets.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="New scene"
            value={newSceneName}
            onChange={(event) => onNewSceneNameChange(event.currentTarget.value)}
          />
          <Button size="icon" variant="outline" className={buttonClassName} onClick={onCreateScene} aria-label="Add scene">
            <Plus className="size-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1 rounded-md border border-zinc-700/50 p-2">
          <div className="grid gap-2">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                className="grid h-[74px] cursor-pointer gap-1 rounded-md border border-zinc-700/60 bg-zinc-900/70 p-1.5"
                onClick={() => {
                  if (editingSceneId !== scene.id) {
                    onSceneSelect(scene.id)
                  }
                }}
              >
                {editingSceneId === scene.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8"
                      value={editingSceneName}
                      onChange={(event) => onEditingSceneNameChange(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          onSaveSceneRename()
                        }
                        if (event.key === 'Escape') {
                          onCancelSceneRename()
                        }
                      }}
                    />
                    <Button
                      size="icon-xs"
                      variant="outline"
                      className={buttonClassName}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSaveSceneRename()
                      }}
                      aria-label="Save scene name"
                    >
                      <Check className="size-3" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="outline"
                      className={buttonClassName}
                      onClick={(event) => {
                        event.stopPropagation()
                        onCancelSceneRename()
                      }}
                      aria-label="Cancel scene edit"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant={scene.id === activeSceneId ? 'default' : 'outline'}
                      className={
                        scene.id === activeSceneId
                          ? `justify-between ${activeButtonClassName}`
                          : `justify-between ${buttonClassName}`
                      }
                      onClick={() => {
                        onSceneSelect(scene.id)
                      }}
                    >
                      <span className="font-medium tracking-wide">{scene.name}</span>
                      <Badge variant="secondary">{(sceneShortcutKeys[index] ?? '-').toUpperCase()}</Badge>
                    </Button>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon-xs"
                        variant="outline"
                        className={buttonClassName}
                        onClick={(event) => {
                          event.stopPropagation()
                          onStartSceneRename(scene)
                        }}
                        aria-label={`Rename scene ${scene.name}`}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="outline"
                        className={buttonClassName}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteScene(scene.id)
                        }}
                        aria-label={`Delete scene ${scene.name}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
