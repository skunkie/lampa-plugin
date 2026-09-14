<!--
SPDX-FileCopyrightText: 2026 TorrPlay

SPDX-License-Identifier: MIT
-->

# Contributing

Thanks for helping with the TorrPlay Lampa plugin. This page covers what a
change needs before it can be merged. Taking part is governed by the [code of
conduct](CODE_OF_CONDUCT.md).

The plugin is a single, dependency-free script that runs inside Lampa on
Android TV, Tizen, webOS and desktop browsers, and it talks to TorrPlay
instances only through their `/api/` and `/api/v1/` endpoints. A change that
adds a runtime dependency, relies on a legacy TorrServer route, or only works
on a recent browser engine is unlikely to be accepted.

## Before you start

For anything larger than a small fix, open an issue first so the approach can
be agreed before you write it. The issue forms ask for what a report needs:
the plugin version, the device and Lampa build, the settings involved, and
what happened.

A problem in the TorrPlay server itself belongs in the
[TorrPlay repository](https://github.com/torrplay/torrplay/issues) instead.

Report a security problem privately to a maintainer rather than in a public
issue.

## Setting up

You need Node.js 20 or newer and npm, plus [reuse](https://reuse.software/).
Install the dependencies with `npm install`. The checks a change has to pass
are:

```bash
npm test
npm run typecheck
npm run lint
npm run coverage
npm run build
reuse lint
```

`npm run build` writes `dist/torrplay.js`, `dist/torrplay.min.js` and the
landing page `dist/index.html`. To try a change on a device, serve `dist/`
and add the script's URL as a plugin in Lampa.

## Making a change

- **Keep it cohesive.** One change and the refactors and tests it needs make
  one commit, even across several modules. Split changes only when each part
  is meaningful alone and leaves the repository working.
- **Add tests.** Every bug fix, refactor and feature comes with tests under
  `tests/`, written with `node:test` and `node:assert/strict`, that cover its
  edge cases and error paths. For a bug fix, include a test that fails
  without the fix. `npm run coverage` fails below the thresholds set in
  `package.json`.
- **Stay within the runtime floor.** The bundle targets Chromium 79, the
  oldest engine among the supported TVs. The build down-levels syntax but
  does not polyfill missing methods, so check a newer runtime API against
  that version before using it.
- **Keep it remote-friendly.** Menus and inputs use `Lampa.Select` and
  `Lampa.Input` so every action works with a TV remote's D-pad.
- **Translate every string.** A user-facing string goes in
  `src/lang/translations.ts` with both English and Russian text, keys in
  alphabetical order.
- **Use invented sample data.** Titles in tests and documentation are made
  up, such as "Test Movie 2026", never the names of real films, series or
  releases, and no real magnet links, info hashes or tracker URLs.
- **Follow the surrounding code.** Standard TypeScript naming applies, files
  are `kebab-case`, interface members and object literal keys are sorted
  alphabetically (case-sensitively, enforced by the linter), and boolean
  names read as predicates. Field names defined by an external API or by
  Lampa keep their own spelling.
- **Comment sparingly.** Add a comment only for a reason the code cannot show.
  History of a bug belongs in the commit message, not the source.
- **Keep the docs true.** A change to behavior or a setting updates
  `README.md` in the same change. Documentation states current behavior,
  without contrasting it with an earlier design.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): summary`, with a scope such as `api`, `auth`, `instances`,
`engine`, `ui` or `build`, and none for a change that genuinely spans
several. Keep the subject imperative, lowercase after the colon, and without
a trailing period.

A non-trivial commit adds a body after a blank line, written as `-` bullets
that are each a complete sentence ending in a period. Describe observable
behavior and important implementation decisions, not a file-by-file list of
edits.

```text
feat(instances): add parallel latency benchmark for auto-selection

- Ping all configured TorrPlay instances concurrently using /api/system/health.
- Route playback and metadata requests to the lowest-latency instance.
- Notify the user when failover engages because an instance stopped responding.
```

The release notes are generated from commit subjects, so a subject is worth
writing for a reader who has not seen the change. Every commit should build
and pass the checks above on its own.

## Pull requests

- Describe what the change does and why, and link the issue it closes.
- Run the checks above first. CI runs the npm checks only after a merge to
  `main`, so a pull request is not checked for you.
- Keep review comments and replies about the work, and push follow-up commits
  rather than rewriting history while a review is in progress. When history is
  rewritten before merging, keep each commit's author and committer dates
  identical.

## License

The plugin is MIT licensed. By contributing you agree that your contribution
is provided under the same license. Every file carries an SPDX copyright and
license header, or is covered by `REUSE.toml`, and `reuse lint` fails when one
does not, so a new file needs its header.
