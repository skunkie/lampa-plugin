<!--
SPDX-FileCopyrightText: 2026 TorrPlay

SPDX-License-Identifier: MIT
-->

# TorrPlay Lampa Plugin

[English](README.md) | [Русский](README.ru.md)

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
  - While TorrPlay is enabled, the **Show in Global Search** toggle under **Manage Search Providers** shows provider results in their own **Jackett / Prowlarr** tab of Lampa global search, with a count of torrents found and the full torrent list (date, tracker, seeders, size, quality, audio and subtitle tags) right in the tab. The separate **TorrPlay Database in Global Search** setting adds a tab of torrents saved in the TorrPlay database, also with a count of matches, shown with the same cards and file list as the TorrPlay library. Global search opened from the TorrPlay library starts on that tab.
  - Replaces Lampa's native torrent search while TorrPlay and at least one provider are enabled. Otherwise, it uses Lampa's native parser if available, or reports an error if no native parser exists.
- **Catalog & Torrent Card Playback Choice**:
  - Adds a **TorrPlay** action button directly inside movie/show catalog detail cards.
  - Adds **"Play via TorrPlay"** and **"Save to TorrPlay"** to the context menu (`long press`) of any torrent card.
  - Configurable playback choice: always use TorrPlay, ask between TorrPlay and TorrServer, or use TorrPlay only from the context menu and button.
- **Flexible Storage & Database Persistence**:
  - Configure storage type: **RAM (`memory`)** or **Disk (`file`)**. Disk storage requires saving the torrent to the database. Temporary playback uses RAM even when Disk is selected.
  - Configure persistence: **Always** save to the TorrPlay database or **Never** (stream temporarily).
  - Optional **"Ask Before Play"** prompt allows choosing storage and persistence per playback session with a "remember choice" option.
- **Comprehensive Authentication & Token Management**:
  - Supports `none`, `basic`, and `bearer` authentication modes per instance.
  - **Bearer Auth**: Automatically acquires JWT access tokens via `POST /oauth/token` and refreshes before expiration or upon HTTP 401.
  - **Playback Tokens**: Dynamically issues scoped tokens via `POST /api/v1/tokens` (`{"scope": "playback"}`) for authenticated media streaming.
- **Universal TV & Device Compatibility**: Bundled into a standalone, dependency-free JavaScript file compatible with Android TV, Tizen, WebOS, and desktop browsers.

---

## Installation in Lampa

1. Open **Lampa** on your device.
2. Navigate to **Settings** &rarr; **Extensions**.
3. Click **Add Plugin**.
4. Enter the direct URL to the compiled plugin:
   ```text
   https://your-domain.example.com/dist/torrplay.js
   ```
   *(Or host `dist/torrplay.min.js` locally or via a CDN / GitHub Pages)*.
5. Restart Lampa. A dedicated **TorrPlay** entry will appear in **Settings** and the main sidebar menu.

---

## Configuration

In Lampa, open **Settings** &rarr; **TorrPlay**:

| Setting | Description | Default |
|---|---|---|
| **Enable TorrPlay** | Toggle TorrPlay for torrent playback and search. Videos played through TorrPlay skip Lampa's pre-roll ad | `Enabled` |
| **TorrPlay Database in Global Search** | Include saved torrents from the active instance in Lampa global search | `Disabled` |
| **Instance Selection** | `Auto (Lowest Latency)` or `Manual Selection` | `Auto (Lowest Latency)` |
| **Manage Instance Pool** | Add/edit instances, configure credentials, test latency, select active instance | Action menu |
| **Manage Search Providers** | Add/edit Jackett and Prowlarr search providers, test latency. While TorrPlay and at least one provider are enabled, it also holds **Show in Global Search**, which shows provider results in their own Lampa global search tab and starts from Lampa's own torrent global search preference | Action menu |
| **Torrent Playback** | `Always TorrPlay`, `Manual (Context Menu & Button)`, or `Ask Before Play (TorrPlay / TorrServer)` | `Always TorrPlay` |
| **Storage Type** | `RAM`, `Disk`, or `Ask Before Play`. Disk requires saving to the database; temporary playback uses RAM | `RAM` |
| **Save to Database** | `Never`, `Always`, or `Ask Before Play` | `Never` |
| **About Plugin** | Plugin version and build info | Info |

---

## Security & Credential Storage

- **Client-Side Credential Obfuscation at Rest**: Stored passwords are automatically masked with a reversible obfuscation cipher (`enc:v1:` prefix) before saving to `Lampa.Storage` (`localStorage` / WebView storage). This prevents credentials from being exposed as plaintext strings during casual storage inspection, screen sharing, shoulder-surfing, or naive storage dumps.
  > [!NOTE]
  > Because client-side JavaScript plugins running in browser or TV WebViews lack a secure hardware enclave or native OS keystore, this mechanism provides defense-in-depth obfuscation to raise the bar against casual inspection, rather than cryptographic security against an attacker with full access to the device or client source code.
- **Ephemeral In-Memory Tokens**: Short-lived authentication tokens (OAuth2 Bearer JWT access tokens and scoped streaming playback tokens) are strictly held in runtime memory and are **never** serialized to disk or persistent storage.
- **Shared Device Guidance**: On shared televisions or multi-user profiles where local storage is accessible to other installed plugins or scripts, consider using TorrPlay instances with dedicated, restricted streaming credentials.

---

## Host App Integration

To ensure a smooth, uninterrupted streaming experience on Smart TVs:
- **Pre-Roll Suppression**: Every player item and playlist entry handed to `Lampa.Player` is tagged `continue_play: true`, and the playlist is handed over before playback starts. Lampa skips its VAST preroll ad for an item marked this way while that item is in the player's current playlist. Switching episodes empties that playlist, so TorrPlay puts it back before the next episode's ad check. Items are also tagged `torrent: true`, which only marks them as torrent playback.

## Development & Build

### Prerequisites

- [Node.js](https://nodejs.org/) 24.x starting at 24.18.0, or 26.4.0 and later
- `npm`
- Google Chrome or Chromium for the landing page layout tests. The tests use `google-chrome` by default; set `CHROME_BIN` to another Chrome or Chromium executable if needed. Without either, the layout tests are skipped.

### Installation

```bash
npm install
```

### Quality Verification

CSS declarations follow RECESS ordering through `stylelint-config-recess-order`. Tests check stylesheets, embedded style blocks, and inline styles; custom properties keep their chosen order.

The landing page layout test runs headless Chrome to check navbar alignment, version visibility, and navigation in both languages and release channels at mobile and desktop widths.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for what a change needs before it can be merged. Taking part is governed by the [code of conduct](CODE_OF_CONDUCT.md).

---

## License

This project is licensed under the [MIT License](LICENSE).
