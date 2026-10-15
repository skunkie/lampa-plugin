// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { PLUGIN_BUILD_COMMIT, PLUGIN_BUILD_DATE, PLUGIN_VERSION } from '../src/index';

describe('Version Management', () => {
  it('keeps the source fallback version consistent with package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

    assert.match(PLUGIN_VERSION, semverRegex, `PLUGIN_VERSION "${PLUGIN_VERSION}" should be valid SemVer`);
    assert.equal(PLUGIN_VERSION, packageJson.version);
  });

  it('uses empty build metadata fallbacks outside a generated bundle', () => {
    assert.equal(PLUGIN_BUILD_COMMIT, '');
    assert.equal(PLUGIN_BUILD_DATE, '');
  });
});
