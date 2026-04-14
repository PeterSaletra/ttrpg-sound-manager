const SHORTCUTS_STORAGE_KEY = 'ttrpg-sound-manager-shortcuts-v1'

type ShortcutConfig = {
  sceneShortcutKeys: string[]
  trackShortcutKeysByScene: Record<string, string[]>
}

const sanitizeShortcutList = (keys: string[]): string[] => {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const key of keys) {
    const value = key.trim().toLowerCase()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    normalized.push(value)
  }

  return normalized
}

export const loadShortcutConfig = (
  defaultSceneShortcutKeys: string[],
  defaultTrackShortcutKeys: string[],
): ShortcutConfig => {
  if (typeof window === 'undefined') {
    return {
      sceneShortcutKeys: defaultSceneShortcutKeys,
      trackShortcutKeysByScene: {},
    }
  }

  try {
    const raw = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!raw) {
      return {
        sceneShortcutKeys: defaultSceneShortcutKeys,
        trackShortcutKeysByScene: {},
      }
    }

    const parsed = JSON.parse(raw) as Partial<ShortcutConfig>
    const sceneShortcutKeys = sanitizeShortcutList(
      Array.isArray(parsed.sceneShortcutKeys) ? parsed.sceneShortcutKeys : defaultSceneShortcutKeys,
    )
    const trackShortcutKeysByScene =
      parsed.trackShortcutKeysByScene && typeof parsed.trackShortcutKeysByScene === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.trackShortcutKeysByScene).map(([sceneId, keys]) => [
              sceneId,
              sanitizeShortcutList(Array.isArray(keys) ? keys : defaultTrackShortcutKeys),
            ]),
          )
        : {}

    return {
      sceneShortcutKeys: sceneShortcutKeys.length > 0 ? sceneShortcutKeys : defaultSceneShortcutKeys,
      trackShortcutKeysByScene,
    }
  } catch {
    return {
      sceneShortcutKeys: defaultSceneShortcutKeys,
      trackShortcutKeysByScene: {},
    }
  }
}

export const saveShortcutConfig = (
  sceneShortcutKeys: string[],
  trackShortcutKeysByScene: Record<string, string[]>,
) => {
  if (typeof window === 'undefined') {
    return
  }

  const payload: ShortcutConfig = {
    sceneShortcutKeys: sanitizeShortcutList(sceneShortcutKeys),
    trackShortcutKeysByScene: Object.fromEntries(
      Object.entries(trackShortcutKeysByScene).map(([sceneId, keys]) => [
        sceneId,
        sanitizeShortcutList(keys),
      ]),
    ),
  }

  window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(payload))
}
