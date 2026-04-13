import { AlertTriangle } from 'lucide-react'

type ToastItem = {
  id: string
  text: string
  tone: 'info' | 'error'
}

type ToastStackProps = {
  toasts: ToastItem[]
}

export function ToastStack({ toasts }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 grid gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur ${
            toast.tone === 'error'
              ? 'border-red-300/40 bg-red-500/20 text-red-100'
              : 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100'
          }`}
        >
          <AlertTriangle className="size-4" />
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  )
}
