import { useState } from 'react'

import { createId } from '@/lib/app-helpers'

type ToastTone = 'info' | 'error'

type ToastItem = {
  id: string
  text: string
  tone: ToastTone
}

export function useToastQueue() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = (text: string, tone: ToastTone = 'info') => {
    const toastId = createId()
    setToasts((previous) => [...previous, { id: toastId, text, tone }])
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== toastId))
    }, 2600)
  }

  return {
    toasts,
    pushToast,
  }
}
