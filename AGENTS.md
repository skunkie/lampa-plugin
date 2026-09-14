<!--
SPDX-FileCopyrightText: 2026 TorrPlay

SPDX-License-Identifier: MIT
-->

# Repository Agent Instructions

## Repository Overview

This repository contains the official [TorrPlay](https://github.com/torrplay/torrplay) plugin for the [Lampa](https://github.com/yumata/lampa) media client. The plugin is authored in TypeScript, adheres to strict linting and typechecking rules, and compiles into a standalone, bundle-free JavaScript file (`dist/torrplay.js` and `dist/torrplay.min.js`) suitable for execution across web browsers, Android TV, Tizen, and WebOS.

## Repository Structure & Module Organization

The codebase is organized into domain-driven modules under `src/` and mirrored under `tests/`:

```text
src/
├── api/
│   ├── auth.ts              # AuthenticationManager: Basic auth, Bearer JWT login, and playback tokens
│   ├── http-client.ts       # Unified HTTP transport with Lampa.Reguest adapter and fetch fallback
│   └── torrplay.ts          # TorrPlayApi: Pure /api/ and /api/v1/ endpoints client
├── engine/
│   ├── file-parser.ts       # Torrent file sorting, video detection, and season/episode/timeline resolution
│   └── torrplay-engine.ts   # Playback routing, parser integration, file resolution, and Lampa.Player hand-off
├── instances/
│   └── instance-manager.ts  # Multi-instance CRUD, latency benchmarking, auto selection, and failover
├── lang/
│   └── translations.ts      # TRANSLATIONS table and translate()/initTranslations() helpers
├── providers/
│   ├── parser-hook.ts       # Lampa native torrent parser interception and result injection
│   ├── provider-manager.ts  # ProviderManager: Jackett/Prowlarr provider CRUD and legacy key sync
│   └── provider-search.ts   # Aggregated multi-provider search, dedupe, and ranking
├── types/
│   ├── lampa.d.ts           # External Lampa ambient API interfaces (alphabetically sorted)
│   ├── provider.ts          # Search provider domain models and response types (alphabetically sorted)
│   └── torrplay.ts          # TorrPlay domain models and response types (alphabetically sorted)
├── ui/
│   ├── catalog-choice.ts    # Movie card details button and parser context menu injection
│   ├── play-dialog.ts       # Pre-playback options modal (storage type and database persistence)
│   ├── preload-modal.ts     # Preload progress polling, native fullscreen loading UI, and stats
│   ├── provider-settings.ts # ProviderSettingsUi: Search provider pool manager and action modals
│   ├── settings.ts          # SettingsUi: Instance pool manager, parameters, and action modals
│   ├── sidebar.ts           # SidebarManager: Main menu button and native TorrServer visibility toggling
│   └── torrplay-torrents.ts # TorrPlayTorrentsComponent: Database torrents browser and file manager
├── utils/
│   ├── storage-obfuscation.ts # Storage credential obfuscation codec with reversible cipher
│   └── uuid.ts              # RFC 4122 v4 UUID generator with older TV runtime fallback
└── index.ts                 # Plugin lifecycle bootstrap and Lampa ready event listeners
```

## Core Architectural Rules & Constraints

1. **Pure API Surface (`/api/` and `/api/v1/` only)**:
   - All communication with TorrPlay instances must exclusively use `/api/` (e.g., `/api/system/health`) and `/api/v1/` endpoints.
   - Never call legacy TorrServer compatibility routes (e.g., `/torrents`, `/stream/{filename}`, `/play/...`, `/cache`, `/echo`, `/viewed`) or qBittorrent endpoints.
   - Health checks and latency benchmarking must use the lightweight, unauthenticated `GET /api/system/health` route.
   - This restriction scopes traffic to TorrPlay instances specifically. It does not limit integration with unrelated third-party services (e.g. Jackett, Prowlarr, or other industry-standard search/indexer APIs), which may use whatever endpoints and protocols those services define.

2. **Multi-Instance Pool with Latency Preference**:
   - Support arbitrary numbers of TorrPlay instances, configured via Lampa settings and stored in `Lampa.Storage`.
   - Each instance tracks connectivity status and round-trip ping time.
   - In "Auto" mode, instances are pinged in parallel, and traffic routes to the reachable instance with the lowest latency.
   - If an active instance becomes unresponsive or encounters network failures, automatic failover selects the next best reachable instance with notification to the user.

3. **Storage Type & Database Persistence**:
   - Configurable per playback or default via settings:
     - Storage type: `memory` (RAM) or `file` (Disk).
     - Save to Database: `true` or `false`.
   - An optional "Ask before play" modal prompts the user for storage type and persistence before adding the torrent.
   - `POST /api/v1/torrents` is the server's persisting create call and has no request field to opt out of persistence — calling it always saves the torrent to the database. Persistence is therefore controlled entirely by which endpoint the plugin calls, not by a request value: `save_to_db: true` uses `POST /api/v1/torrents`; `save_to_db: false` uses `GET /api/v1/torrents/{hash}` (optionally with a `magnet` query parameter to bootstrap-by-magnet), which loads the torrent for playback without ever persisting it. Do not issue automatic post-playback `DELETE` requests.

4. **Preload Before Player Hand-off**:
   - Before launching video playback in `Lampa.Player`, initiate preloading via `PUT /api/v1/torrents/{hash}/preload`.
   - Display Lampa's native fullscreen media loading screen (`Lampa.Loading.start(..., { media })`), showing movie backdrop, buffer progress percentage, loaded bytes vs. target bytes, download speed (in Mbit/s), and peer stats.
   - Hand off to `Lampa.Player.play()` once the buffer reaches readiness or threshold (>= 95%).
   - Cancel preloading via `DELETE /api/v1/torrents/{hash}/preload` if dismissed by the user.
   - Unconditionally set `torrent: true` and `continue_play: true` on the player item and every entry of the playlist handed to `Lampa.Player.playlist()` — these are the flags Lampa's own player reads to exempt playback from VAST preroll ads, and TorrPlay playback is always genuinely torrent playback, so there is no configurable "prevent ads" setting.

5. **Authentication & Token Management**:
   - Support `none`, `basic`, and `bearer` authentication modes per instance.
   - For Bearer auth: acquire JWT access token via `POST /oauth/token` (`application/x-www-form-urlencoded`) and refresh before expiration or upon HTTP 401.
   - For streaming routes: obtain a playback token via `POST /api/v1/tokens` (`{"scope": "playback"}`) for Basic and Bearer auth, appending `&token={token}` to the stream URL.

6. **Lampa Settings & Instance Configuration**:
   - All TorrPlay instance nodes (URLs, authentication, and credentials) are configured exclusively through the Instance Pool, ensuring a single source of truth without redundant standalone instance inputs.
   - Action items (managing instance pool, latency tests) must use `type: 'button'` with `onChange` listeners (never `type: 'static'`, and without redundant click listeners in `onRender`).
   - Instance pool management and instance actions must be TV-control friendly, using `Lampa.Select` and `Lampa.Input` for full D-pad remote compatibility without modal stacking.
   - The TorrPlay settings folder is registered with `before: 'tmdb'`, never `after: 'server'`/`after: 'parser'` — Lampa removes both the `server` and `parser` settings folders entirely when `torrents_use` is disabled (the exact condition TorrPlay users are in), and inserting relative to a component id that doesn't exist in the DOM silently no-ops, dropping TorrPlay's own settings folder too. Anchor only to a component that is never conditionally removed.

7. **Sidebar & Database Torrents (`torrplay_torrents`)**:
   - Add a dedicated "TorrPlay" entry to Lampa's main sidebar menu, positioned as the second item (right after whichever item the menu list currently has first), since native items are always appended to the end and never displace it.
   - Register custom component `torrplay_torrents` (`Lampa.Component.add`) to list torrents retrieved via `GET /api/v1/torrents`, supporting direct playback, multi-file selection, movie card details navigation (`title_card`), dynamic mark/unmark viewed toggle (`torrents_view`), storage switching (`PATCH /api/v1/torrents/{hash}`), and database deletion (`DELETE /api/v1/torrents/{hash}`).
   - Do not hook or monkey-patch the legacy `Lampa.Torserver` API (`.my`, `.add`, `.remove`, `.ip`, etc.). TorrPlay's own sidebar entry and `torrplay_torrents` component are the sole, self-contained surface for browsing and managing TorrPlay's database — native TorrServer integration is intentionally left untouched.
   - In "Always TorrPlay" mode (`torrplay_playback_mode: 'torrplay'`), hide native TorrServer entry points (sidebar item, settings folder, torrent-view button) via the `torrplay--hide-torrserver` body class instead of intercepting their handlers.

8. **Torrent Card Player Choice, Routing, & Context Menu Actions**:
   - Provide a clean context menu (`torrent` event on `onlong`) on torrent cards:
     - "Play via TorrPlay" at the top for immediate streaming.
     - "Save to TorrPlay" for persistent library database storage.
     - Dynamic viewed toggle: present only "Mark as viewed" if unviewed, or "Remove mark" if already viewed.
     - Strip native TorrServer `tomy: true` in "Always TorrPlay" mode (`torrplay_playback_mode: 'torrplay'`).
   - Intercept `Lampa.Torrent.start` to route playback according to configurable playback mode (`torrplay_playback_mode`: `ask`, `torrplay`, `context`) seamlessly through Lampa's native playback actions.

9. **Torrent Search Provider Pool (Jackett/Prowlarr)**:
   - Support arbitrary numbers of Jackett and Prowlarr search providers, configured and persisted independently from the TorrPlay instance pool via `ProviderManager` (`src/providers/provider-manager.ts`), with a TV-friendly `Lampa.Select`-based pool manager (`src/ui/provider-settings.ts`, "Manage Search Providers").
   - Sync each provider's URL/API key into Lampa's own stock `jackett_url`/`jackett_key` and `prowlarr_url`/`prowlarr_key` storage keys, so third-party extensions relying on those keys keep working.
   - `ProviderSearch.search()` (`src/providers/provider-search.ts`) queries all enabled providers concurrently, tolerates individual provider failures/timeouts without aborting the aggregate search, deduplicates results using the same fingerprint strategy as Lampa's own `resultKey` (prefer magnet URI, else hash/size/tracker/title), and ranks the merged results by seeder count descending.
   - `ParserHook` (`src/providers/parser-hook.ts`) wraps `Lampa.Parser.get` to route torrent search through the provider pool only when TorrPlay is enabled **and** at least one provider is configured; otherwise it delegates to the original native parser (or reports an error if none exists, since Lampa deletes its own native parser UI when `torrents_use = false`, leaving no native path to fall back to). Unlike `Lampa.Torserver`, this is the one native Lampa entry point TorrPlay intentionally overrides, because there is no non-hook alternative for restoring search under that condition.

10. **TypeScript & Bundling**:
    - Written cleanly in TypeScript under `src/`.
    - Bundled using `esbuild` into standalone IIFE JavaScript in `dist/`.
    - **JavaScript Compatibility Floor**: the build target (`build.mjs`, `target: ['chrome79']`) is pinned to LG webOS TV 6.x's bundled Chromium (79) — the oldest/most restrictive runtime this plugin supports among its stated platforms (Android TV, Tizen, WebOS).
      - `esbuild`'s `target` only down-levels **syntax** (optional chaining `?.`, nullish coalescing `??`, logical assignment `||=`/`&&=`/`??=`, class fields, etc.) to an older equivalent. It does **not** polyfill missing **runtime** methods/APIs — calling one that doesn't exist on the target engine throws at runtime regardless of the build target.
      - Do not use runtime APIs that postdate Chromium 79 (2019-era V8) without adding an explicit polyfill first: `Array.prototype.at`, `String.prototype.at`, `String.prototype.replaceAll`, `Promise.any`, `Object.hasOwn`, `structuredClone`, `Array.prototype.findLast`/`findLastIndex`, `Array.prototype.group`/`groupBy`. `Promise.allSettled`, `Array.prototype.flat`/`flatMap`, `globalThis`, and `Object.fromEntries` are all fine (Chromium ≤76).
      - When in doubt, check a candidate API's browser support against Chromium 79 (Chrome 79, released December 2019) before using it — this list of examples is illustrative, not exhaustive.

11. **Alphabetical Ordering of Interface & Struct Properties**:
    - All interface properties, type literal members, and struct property definitions should be sorted alphabetically by key name.
    - Maintains uniform code organization and predictability across all TorrPlay repositories (matching `torrplay/client` and OpenAPI specifications).

## Known Lampa Native API Quirks

- `Lampa.Modal.close()` throws when no modal is currently open. Call it only through a guarded wrapper (see `TorrPlayEngine.closeModalSafely`), except at a call site where a modal opened by that same code path is guaranteed to exist.
- `Lampa.Loading.start()` does not support being called a second time without an intervening `stop()` — doing so corrupts its internal state. Always stop an active loading screen before another one (e.g. the preload progress screen) starts.
- A player item handed to `Lampa.Player.play()` must never be self-referential (e.g. its own `.playlist` array containing that same item). Lampa persists watch history via `JSON.stringify`, which cannot serialize circular structures.
- `Lampa.Controller.enabled()?.name` is not a reliable signal for "has focus returned to my component" — in some environments it never reports a component's own controller name again after another overlay (e.g. Settings) has been focused, even once that overlay is closed. Do not gate recurring background work (e.g. polling) on this or on DOM-geometry heuristics for "is something else open" — components that need to protect against stealing focus during a genuine overlay should check controller state locally at the point of the focus-affecting call itself (see `TorrPlayTorrentsComponent.renderTorrents`/`renderEmptyState`), not use it to skip the work entirely.
- On Android, `Lampa.Reguest.prototype.native` (the `AndroidJS.httpReq` bridge) ignores the intended HTTP verb entirely: per the app's own `AndroidJS.kt`/`Http.java`, it issues a `GET` when the request has no body and a `POST` when it does, regardless of what `type` was requested. A `PUT`/`PATCH`/`DELETE` therefore reaches the TorrPlay server as a plain `POST`/`GET` and 404s against the real (differently-methoded) route. `requestHttp` (`src/api/http-client.ts`) works around this by sending those verbs through the native path as `POST` with an `X-HTTP-Method-Override` header (and, for a bodyless `DELETE`, a forced non-empty body so the bridge doesn't pick `GET` instead) — the TorrPlay server rewrites the method from that header before routing. The non-native (`.silent()`/ajax) transport is unaffected and keeps sending the real verb.

## Naming & Code Style Conventions

- Follow standard TypeScript naming conventions consistently:
  - Use `PascalCase` for classes, interfaces, type aliases, and enums.
  - Use `camelCase` for functions, methods, variables, parameters, and internal object properties.
  - Use `UPPER_SNAKE_CASE` only for immutable module-level constants.
  - Use `kebab-case` for source and test filenames.
- Choose clear, descriptive names based on domain behavior. Avoid ambiguous abbreviations, single-letter identifiers outside small conventional scopes, Hungarian notation, and names that repeat obvious type information.
- Name booleans with predicates such as `is`, `has`, `can`, `should`, or `needs`. Name event handlers with `handle...` or `on...`, and name constructors or factories with verbs such as `create...` or `build...`.
- Treat acronyms as words in identifiers (`TorrPlayApi`, `instanceUrl`, `httpClient`) while preserving their conventional uppercase spelling in user-facing prose (`API`, `URL`, `HTTP`).
- Include units when a numeric value would otherwise be ambiguous, such as `timeoutMs`, `sizeBytes`, or `speedMbps`.
- Preserve field names defined by external APIs and wire formats, including required `snake_case` JSON properties. Use idiomatic TypeScript names for internal application state and map explicitly at the boundary when necessary.
- Do not copy vague, misspelled, or legacy names from Lampa internals into plugin-owned identifiers. Keep required Lampa names only at integration boundaries and wrap them with clearly named functions, types, or adapters where practical.
- Reuse established TorrPlay and Lampa terminology instead of introducing synonyms for the same concept. Keep names consistent across implementation, tests, settings labels, notifications, and documentation.
- Apply these conventions to all new code and improve nonconforming names in touched code when doing so is safe and does not create unrelated churn.

## Code Comments

- Default to no comments. Only add one when the *why* is genuinely non-obvious: a hidden constraint, a subtle invariant, or behavior that would otherwise surprise a reader.
- Do not narrate bug history in comments — no references to a specific error message, a prior regression, "this used to crash", or how an issue was found and fixed. That narrative belongs in the commit message, not the source; comments rot as the codebase evolves while commit history stays accurate.
- Rely on regression tests, not comments, to prevent a fixed bug from resurfacing. A test that reproduces the original failure is durable; a comment warning "don't do X, it broke before" is not enforced and will be forgotten or contradicted by the next edit.
- Make a comment's explanation self-contained rather than pointing to AGENTS.md or another external doc for the reason. Docs and code can be edited independently and drift out of sync, silently turning "(see AGENTS.md)" into a dead pointer; a reference to another function or type in the same file is fine, since it moves and changes together with the comment.
- This applies beyond source comments: other project documentation (README.md, etc.) should also explain things in its own words rather than citing "AGENTS.md" or a specific rule number by name, for the same reason — the two files are edited independently and a rule can be renumbered, reworded, or removed without the citing text being updated to match.

## Testing & Quality Standards


- **Mandatory Test Coverage**:
  - Every new feature, bugfix, refactor, or logic change **must be covered with tests** under the `tests/` directory.
  - Maintain comprehensive coverage for:
    - **Authentication**: Bearer login, Basic auth, header resolution, and token refresh in `tests/auth.test.ts`.
    - **HTTP Transport**: `Lampa.Reguest` delegation, `fetch` fallback, status error mapping, and network error handling in `tests/http-client.test.ts`.
    - **API Interactions**: Health checks, torrent additions, metadata fetching, preload control, database listing (`getTorrents`), torrent deletion (`deleteTorrent`), and stream URL generation in `tests/torrplay-api.test.ts`.
    - **Instance Management**: Instance CRUD, primary instance synchronization, concurrent latency benchmarking, latency-based auto selection, and automatic failover in `tests/instance-manager.test.ts`.
    - **Search Providers**: Provider CRUD, legacy Lampa key sync, and health checks in `tests/provider-manager.test.ts`; aggregated multi-provider search, dedupe, and ranking in `tests/provider-search.test.ts`; provider pool settings UI in `tests/provider-ui.test.ts`.
    - **Native Parser Integration**: Lampa torrent parser interception and result injection in `tests/parser-hook.test.ts`.
    - **Engine & Playback**: Playback mode resolution, prompt dialogs, database persistence, and player routing in `tests/torrplay-engine.test.ts`.
    - **Preload & Loading UI**: Progress percentage calculation, buffer threshold hand-off, peer and speed stats, and cancelation lifecycle in `tests/preload.test.ts`.
    - **Playback Dialog**: Pre-playback options dialog, TV remote button activation, and controller restoration on Back in `tests/play-dialog.test.ts`.
    - **UI & Settings**: Settings parameter registration, TV-friendly instance pool management, password masking, add/delete confirmation dialogs, URL validation, sidebar integration, TorrPlay torrents component lifecycle, and card rendering in `tests/ui.test.ts`.
    - **Localization**: Translation key completeness, alphabetical ordering, and fallback behavior in `tests/lang.test.ts`.
    - **Utilities**: Storage credential obfuscation in `tests/storage-obfuscation.test.ts`, and identifier generation in `tests/uuid.test.ts`.
    - **Versioning**: `PLUGIN_VERSION` and `package.json` version consistency in `tests/version.test.ts`.
- **Test Runner**:
  - Tests are written with Node's native test runner (`node:test` and `node:assert/strict`) executed through `tsx`:
    ```bash
    npm test
    ```
  - All tests must pass cleanly before any code is committed.


## Commit Messages & History Hygiene

- **Conventional Commits**: Use `type(scope): concise imperative summary`.
  - Common types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `ci`.
  - Common scopes: `api`, `auth`, `instances`, `engine`, `ui`, `types`, `build`, `pages`, `test`, `utils`.
- **Subject Formatting**: Keep the subject concise, lowercase after the colon, and without a trailing period.
- **Body Requirements**: For non-trivial commits, add a blank line followed by `-` bullets. Write each bullet as a complete sentence ending with a period. Describe observable behavior and key technical decisions rather than listing files edited.
- **Atomic Commits**: Each commit should be self-contained, leaving the build, tests, typechecks, and linters green.

Example:

```text
feat(instances): add parallel latency benchmark for auto-selection

- Ping all configured TorrPlay instances concurrently using /api/system/health.
- Record millisecond round-trip response times and sort instances by latency.
- Automatically route playback and metadata requests to the lowest-latency node.
- Add toast notification when failover engages due to node downtime.
```

## Quality Verification & Commands

Before committing any changes, all checks must pass cleanly without warnings or errors:

- **Unit Testing**:
  ```bash
  npm test
  ```
- **Type Checking**:
  ```bash
  npm run typecheck
  ```
- **Linting**:
  ```bash
  npm run lint
  ```
  Auto-fix formatting and lint issues where possible:
  ```bash
  npm run lint:fix
  ```
- **Build Verification**:
  ```bash
  npm run build
  ```
  Ensure both `dist/torrplay.js`, `dist/torrplay.min.js`, and `dist/index.html` build without errors.
