// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveBuildCommit, resolveBuildMetadata } from '../build-metadata.mjs';

describe('Build Metadata', () => {
  it('prefers and abbreviates the GitHub commit', () => {
    const commit = resolveBuildCommit(
      { GITHUB_SHA: '1234567890abcdef' },
      () => {
        throw new Error('local Git must not be queried');
      },
    );

    assert.equal(commit, '1234567');
  });

  it('uses the local Git commit outside GitHub Actions', () => {
    assert.equal(resolveBuildCommit({}, () => 'abcdef0'), 'abcdef0');
  });

  it('uses unknown when the local Git commit cannot be resolved', () => {
    const commit = resolveBuildCommit({}, () => {
      throw new Error('Git unavailable');
    });

    assert.equal(commit, 'unknown');
  });

  it('generates an ISO build date with the resolved commit', () => {
    const metadata = resolveBuildMetadata(
      {},
      () => new Date('2026-09-15T12:34:56.789Z'),
      () => 'abcdef0',
    );

    assert.deepEqual(metadata, {
      buildCommit: 'abcdef0',
      buildDate: '2026-09-15T12:34:56.789Z',
    });
  });
});
