// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveFileIndex, selectVideoFiles } from '../src/engine/file-parser';

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

describe('File Parser (selectVideoFiles)', () => {
  it('keeps video files in natural order and tolerates missing file lists', () => {
    const files = [
      { name: 'readme.txt', path: 'readme.txt' },
      { name: 'Show.S01E10.MKV', path: 'Show.S01E10.MKV' },
      { name: 'Show.S01E2.mp4', path: 'Show.S01E2.mp4' },
    ];
    assert.deepEqual(selectVideoFiles(files).map(file => file.name), ['Show.S01E2.mp4', 'Show.S01E10.MKV']);
    assert.deepEqual(selectVideoFiles(undefined), []);
  });

  it('detects video files by path first, matching the playlist the engine builds', () => {
    const files = [
      { name: 'Episode 1', path: 'Show/ep1.mkv' },
      { name: 'notes.mkv', path: 'Show/notes.txt' },
    ];
    assert.deepEqual(selectVideoFiles(files).map(file => file.path), ['Show/ep1.mkv']);
  });
});
