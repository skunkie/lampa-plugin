// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PLUGIN_VERSION } from '../src/index';

describe('Version Management', () => {
  it('falls back to a valid SemVer version when built outside the release workflow', () => {
    const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
    assert.match(PLUGIN_VERSION, semverRegex, `PLUGIN_VERSION "${PLUGIN_VERSION}" should be valid SemVer`);
  });
});
