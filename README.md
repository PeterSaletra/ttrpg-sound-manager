# TTRPG Sound Manager

TTRPG Sound Manager is a web application for live RPG session audio control.
It lets you build scenes, play multiple sounds in parallel, switch scenes with crossfade,
and manage both local audio files and YouTube audio sources.

## Key Features

- Multi-track playback with per-track controls
- Scene-based workflow with fast scene switching
- Configurable crossfade between scenes
- Layer support (`ambient`, `music`, `sfx`)
- Global hotkeys and per-track hotkeys
- Sound library with search, filtering, favorites, and drag and drop
- Drag and drop import from the operating system (audio files only)
- YouTube source support (audio playback via YouTube IFrame API)
- Session persistence in browser storage

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Web Audio API (local files)
- YouTube IFrame API (YouTube tracks)

## Getting Started

### Requirements

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## How Audio Sources Work

### Local files

- Imported from disk using file picker or drag and drop
- Stored in IndexedDB
- Played through Web Audio/HTML audio pipeline

### YouTube

- Added by URL
- Controlled through YouTube IFrame API
- Video is hidden in the app UI; audio is used for playback
- Per-track volume slider and master volume both affect YouTube tracks

## Hotkeys

- `1-9`: switch scenes by scene list order
- `Space`: play active scene or stop all
- `Shift+Space`: panic stop
- Custom per-track hotkeys are supported

## Persistence

The app stores session state in browser storage:

- Local metadata: `localStorage`
- Local audio files: `IndexedDB`

Saved state includes scenes, tracks, volume settings, favorites, hotkeys,
crossfade configuration, and source metadata.

