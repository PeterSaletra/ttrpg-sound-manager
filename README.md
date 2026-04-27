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

## Arduino Firmware Frame Format

The external controller integration uses Web Serial and reads newline-delimited frames.
Each frame should end with `\n` (or `\r\n`).

### Supported text frames

- `PLAY` or `BTN_PLAY`: play action
- `STOP` or `BTN_STOP`: stop action
- `PANIC` or `BTN_PANIC`: panic action
- `MASTER:<value>` or `VOLUME:<value>` or `POT_MASTER:<value>`: master volume
- `CROSSFADE:<value>` or `POT_CROSSFADE:<value>`: crossfade control
- `SCENE:<value>` or `BTN_SCENE:<value>`: scene select

### Supported JSON frames

Each line can also be JSON with this shape:

```json
{"type":"master","value":512}
{"type":"crossfade","value":600}
{"type":"play"}
{"type":"stop"}
{"type":"panic"}
{"type":"scene","value":2}
```

Allowed `type` values: `master`, `crossfade`, `play`, `stop`, `panic`, `scene`.

### Value mapping

- Master volume accepts:
	- `0-100` as percent directly, or
	- `0-1023` (Arduino analog range), auto-mapped to `0-100`
- Crossfade accepts:
	- `0-100` as percent (mapped to `200-5000 ms`), or
	- `0-1023` auto-mapped to percent first
- Scene values are 1-based in incoming frames:
	- `1` selects the first scene, `2` the second, and so on

### Example serial output from firmware

```text
POT_MASTER:742
POT_CROSSFADE:210
BTN_PLAY
SCENE:3
```

## Persistence

The app stores session state in browser storage:

- Local metadata: `localStorage`
- Local audio files: `IndexedDB`

Saved state includes scenes, tracks, volume settings, favorites, hotkeys,
crossfade configuration, and source metadata.

