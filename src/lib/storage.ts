import type { SessionState, StoredTrack, Track, TrackLayer } from '@/types'

const SESSION_STORAGE_KEY = 'sound-manager-session-v1'
const DB_NAME = 'sound-manager-files'
const DB_VERSION = 1
const FILE_STORE = 'files'

const DEFAULT_CROSSFADE = {
  durationMs: 1200,
  layers: {
    ambient: true,
    music: true,
    sfx: false,
  } satisfies Record<TrackLayer, boolean>,
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'))
  })

  return dbPromise
}

function makeStoredTrack(track: Track): StoredTrack {
  return {
    id: track.id,
    name: track.name,
    fileId: track.fileId,
    sourceUrl: track.sourceUrl,
    sourceType: track.sourceType,
    youtubeId: track.youtubeId,
    volume: track.volume,
    loop: track.loop,
    layer: track.layer,
    hotkey: track.hotkey,
    favorite: track.favorite,
  }
}

export async function saveAudioFile(fileId: string, file: File): Promise<void> {
  const db = await getDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    const store = tx.objectStore(FILE_STORE)
    store.put(file, fileId)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save audio file.'))
  })
}

export async function loadAudioFile(fileId: string): Promise<File | null> {
  const db = await getDatabase()

  return new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly')
    const store = tx.objectStore(FILE_STORE)
    const request = store.get(fileId)

    request.onsuccess = () => {
      const result = request.result
      resolve(result instanceof File ? result : null)
    }

    request.onerror = () => reject(request.error ?? new Error('Failed to load audio file.'))
  })
}

export async function deleteAudioFile(fileId: string): Promise<void> {
  const db = await getDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    const store = tx.objectStore(FILE_STORE)
    store.delete(fileId)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete audio file.'))
  })
}

export function saveSession(session: Omit<SessionState, 'updatedAt'>): void {
  const payload: SessionState = {
    ...session,
    updatedAt: new Date().toISOString(),
    tracks: session.tracks.map((track) => ({ ...track })),
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
}

export function loadSession(): SessionState | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionState>
    if (!parsed.activeSceneId || !Array.isArray(parsed.scenes) || !Array.isArray(parsed.tracks)) {
      return null
    }

    const normalizedTracks: StoredTrack[] = parsed.tracks.map((track) => ({
      id: track.id ?? '',
      name: track.name ?? 'Track',
      fileId: track.fileId ?? '',
      sourceUrl: track.sourceUrl ?? '',
      sourceType: (track.sourceType ?? 'local') as Track['sourceType'],
      youtubeId: track.youtubeId ?? '',
      volume: typeof track.volume === 'number' ? track.volume : 80,
      loop: Boolean(track.loop),
      layer: (track.layer ?? 'ambient') as TrackLayer,
      hotkey: typeof track.hotkey === 'string' ? track.hotkey : '',
      favorite: Boolean(track.favorite),
    }))

    const crossfade = parsed.crossfade
      ? {
          durationMs:
            typeof parsed.crossfade.durationMs === 'number'
              ? parsed.crossfade.durationMs
              : DEFAULT_CROSSFADE.durationMs,
          layers: {
            ambient: parsed.crossfade.layers?.ambient ?? DEFAULT_CROSSFADE.layers.ambient,
            music: parsed.crossfade.layers?.music ?? DEFAULT_CROSSFADE.layers.music,
            sfx: parsed.crossfade.layers?.sfx ?? DEFAULT_CROSSFADE.layers.sfx,
          },
        }
      : DEFAULT_CROSSFADE

    return {
      activeSceneId: parsed.activeSceneId,
      masterVolume: typeof parsed.masterVolume === 'number' ? parsed.masterVolume : 85,
      scenes: parsed.scenes,
      tracks: normalizedTracks,
      crossfade,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function toStoredTracks(tracks: Track[]): StoredTrack[] {
  return tracks.map(makeStoredTrack)
}
