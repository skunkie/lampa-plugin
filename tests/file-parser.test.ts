// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveFileIndex } from '../src/engine/file-parser';

describe('File Parser', () => {
  it('resolves duplicate file paths by object identity before falling back to path matching', () => {
    const firstFile = { path: 'duplicate.mkv' };
    const secondFile = { path: 'duplicate.mkv' };
    const torrentFiles = [firstFile, secondFile];

    assert.equal(resolveFileIndex(torrentFiles, secondFile), 1);
    assert.equal(resolveFileIndex(torrentFiles, { path: 'duplicate.mkv' }), 0);
    assert.equal(resolveFileIndex(torrentFiles, { path: 'missing.mkv' }), -1);
  });
});
