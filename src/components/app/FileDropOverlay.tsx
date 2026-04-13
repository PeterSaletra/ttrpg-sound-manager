type FileDropOverlayProps = {
  visible: boolean
}

export function FileDropOverlay({ visible }: FileDropOverlayProps) {
  if (!visible) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-4 z-40 rounded-xl border-2 border-dashed border-sky-300 bg-sky-300/15">
      <div className="flex h-full items-center justify-center">
        <div className="rounded-md border border-sky-200/60 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-sky-100">
          Drop audio files to add them to the active scene
        </div>
      </div>
    </div>
  )
}
