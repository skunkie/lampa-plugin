<!--
SPDX-FileCopyrightText: 2026 TorrPlay

SPDX-License-Identifier: MIT
-->

# TorrPlay Lampa Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Lampa](https://img.shields.io/badge/Lampa-Plugin-purple)](https://github.com/yumata/lampa)

The official [TorrPlay](https://github.com/torrplay/torrplay) plugin for the [Lampa](https://github.com/yumata/lampa) media client. Stream torrents seamlessly across Android TV, Smart TV (Tizen, WebOS), and web browsers using TorrPlay.

---

## Key Features

- **Multi-Instance Pool with Latency Preference**:
  - Add and manage multiple TorrPlay instances.
  - **Auto Mode**: Pings instances concurrently using `/api/system/health`, benchmarks round-trip latency, and routes requests to the fastest reachable instance.
  - **Automatic Failover**: If an active instance becomes unresponsive, traffic seamlessly shifts to the next best available instance.
- **Preload Buffering Before Playback**:
  - Initiates streaming preloading via `PUT /api/v1/torrents/{hash}/preload`.
  - Displays real-time progress, buffered size vs. target size, download speed, and connected peers.
  - Automatically hands off to `Lampa.Player.play()` once the buffer threshold is reached.
- **Sidebar TorrPlay Torrents (Database)**:
  - Adds a dedicated **TorrPlay** entry to Lampa's sidebar menu, backed by its own self-contained `torrplay_torrents` browser component (native TorrServer's `mytorrents` view is left untouched, and is instead hidden in "Always TorrPlay" mode).
  - Browse torrents stored in the TorrPlay database with posters, metadata, and multi-file selection.
  - Displays a file-storage badge icon over card posters for torrents cached on disk, alongside file counts and sizes.
- **Torrent Search Providers (Jackett/Prowlarr)**:
  - Manage a pool of Jackett and Prowlarr search providers from **Settings → TorrPlay → Manage Search Providers**, independent of the TorrPlay instance pool.
  - Aggregates results from all enabled providers concurrently, deduplicates them, and ranks by seeder count.
  - Transparently replaces Lampa's native torrent search when at least one provider is configured, falling back to the native parser otherwise.
- **Catalog & Torrent Card Playback Choice**:
  - Adds a **TorrPlay** action button directly inside movie/show catalog detail cards.
  - Adds **"Play via TorrPlay"** and **"Save to TorrPlay"** to the context menu (`long press`) of any torrent card.
  - Configurable playback choice: prompt between TorrPlay and default player, always use TorrPlay, or use context menu.
- **Flexible Storage & Database Persistence**:
  - Configure storage type: **RAM (`memory`)** or **Disk (`file`)**.
  - Configure persistence: **Save to TorrPlay DB** or **Stream Temporarily**.
  - Optional **"Ask Before Play"** prompt allows choosing storage and persistence per playback session with a "remember choice" option.
- **Comprehensive Authentication & Token Management**:
  - Supports `none`, `basic`, and `bearer` authentication modes per instance.
  - **Bearer Auth**: Automatically acquires JWT access tokens via `POST /oauth/token` and refreshes before expiration or upon HTTP 401.
  - **Playback Tokens**: Dynamically issues scoped tokens via `POST /api/v1/tokens` (`{"scope": "playback"}`) for authenticated media streaming.
- **Universal TV & Device Compatibility**: Bundled into a standalone, dependency-free JavaScript file compatible with Android TV, Tizen, WebOS, and desktop browsers.

---

## Installation in Lampa

1. Open **Lampa** on your device.
2. Navigate to **Settings** (`Настройки`) &rarr; **Extensions** (`Расширения`).
3. Click **Add Plugin** (`Добавить плагин`).
4. Enter the direct URL to the compiled plugin:
   ```text
   https://your-domain.example.com/dist/torrplay.js
   ```
   *(Or host `dist/torrplay.min.js` locally or via a CDN / GitHub Pages)*.
5. Restart Lampa. A dedicated **TorrPlay** entry will appear in **Settings** (`Настройки`) and the main sidebar menu.

---

## Configuration

In Lampa, open **Settings** &rarr; **TorrPlay**:

| Setting | Description | Default |
|---|---|---|
| **Enable TorrPlay** | Toggle TorrPlay client routing for torrent playback; also suppresses host promotional banners, pre-roll overlays, and CUB upsell notices while enabled | `Enabled` |
| **Instance Pool Selection** | `Auto (Lowest Latency)` or `Manual Selection` | `Auto` |
| **Manage Instance Pool** | Add/edit instances, configure credentials, test latency, select active instance | Interactive |
| **Manage Search Providers** | Add/edit Jackett and Prowlarr search providers, test latency | Interactive |
| **Player in Catalog & Cards** | `Always TorrPlay`, `Manual (Context Menu & Button)`, or `Ask Before Play (TorrPlay / TorrServer)` | `Always TorrPlay` |
| **Storage Type** | `RAM`, `Disk`, or `Ask Before Play` | `RAM` |
| **Database Persistence** | `Do Not Save`, `Save to Database`, or `Ask Before Play` | `Do Not Save` |
| **Preload Stream** | Buffer stream chunks before launching the video player | `Enabled` |

---

## Security & Credential Storage

- **Client-Side Credential Obfuscation at Rest**: Stored passwords are automatically masked with a reversible obfuscation cipher (`enc:v1:` prefix) before saving to `Lampa.Storage` (`localStorage` / WebView storage). This prevents credentials from being exposed as plaintext strings during casual storage inspection, screen sharing, shoulder-surfing, or naive storage dumps.
  > [!NOTE]
  > Because client-side JavaScript plugins running in browser or TV WebViews lack a secure hardware enclave or native OS keystore, this mechanism provides defense-in-depth obfuscation to raise the bar against casual inspection, rather than cryptographic security against an attacker with full access to the device or client source code.
- **Ephemeral In-Memory Tokens**: Short-lived authentication tokens (OAuth2 Bearer JWT access tokens and scoped streaming playback tokens) are strictly held in runtime memory and are **never** serialized to disk or persistent storage.
- **Shared Device Guidance**: On shared televisions or multi-user profiles where local storage is accessible to other installed plugins or scripts, consider using TorrPlay instances with dedicated, restricted streaming credentials.

---

## Host App Integration & Notice Filtering

To ensure a smooth, uninterrupted streaming experience on Smart TVs:
- **Pre-Roll Suppression**: Every player item and playlist entry handed to `Lampa.Player` is unconditionally tagged `torrent: true` and `continue_play: true` — the flags Lampa's own player reads to exempt playback from VAST preroll ads, since TorrPlay playback is always genuinely torrent playback.
- **Promotional Notice Filtering**: By default, the plugin silences CUB promotional banners, premiere upsell prompts, and pre-roll overlays while playing torrents. This behavior is tied to the **Enable TorrPlay** toggle in **Settings** &rarr; **TorrPlay**.

## Development & Build

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- `npm`

### Installation

```bash
npm install
```

### Quality Verification

Before committing, ensure all quality gates pass:

```bash
# Run unit tests with Node test runner
npm test

# Type check TypeScript definitions
npm run typecheck

# Lint source files with ESLint
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Compile and bundle standalone distribution files
npm run build
```

The build produces:
- `dist/torrplay.js`: Standalone unminified bundle with source maps.
- `dist/torrplay.min.js`: Production minified bundle.
- `dist/index.html`: Landing page for direct installation and documentation.

---

## License

This project is licensed under the [MIT License](LICENSE).
