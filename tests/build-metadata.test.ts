// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_REPOSITORY, parseGitHubRepository, resolveBuildCommit, resolveBuildMetadata, resolveRepository } from '../build-metadata.mjs';

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

  it('prefers the GitHub Actions repository', () => {
    const repository = resolveRepository(
      { GITHUB_REPOSITORY: 'fork-owner/lampa-plugin' },
      () => 'https://github.com/other/repo.git',
    );

    assert.equal(repository, 'fork-owner/lampa-plugin');
  });

  it('derives the repository from the origin remote outside GitHub Actions', () => {
    assert.equal(resolveRepository({}, () => 'https://github.com/fork-owner/my-plugin.git\n'), 'fork-owner/my-plugin');
    assert.equal(resolveRepository({}, () => 'git@github.com:fork-owner/my.plugin.git'), 'fork-owner/my.plugin');
    assert.equal(resolveRepository({}, () => 'ssh://git@github.com/fork-owner/my-plugin'), 'fork-owner/my-plugin');
    assert.equal(resolveRepository({}, () => 'ssh://git@github.com:22/fork-owner/my-plugin.git'), 'fork-owner/my-plugin');
    assert.equal(resolveRepository({}, () => 'HTTPS://GitHub.com/Fork-Owner/My-Plugin.git'), 'Fork-Owner/My-Plugin');
    assert.equal(resolveRepository({}, () => 'https://user:token@github.com/fork-owner/my-plugin'), 'fork-owner/my-plugin');
  });

  it('falls back to the default repository without a GitHub origin remote', () => {
    assert.equal(resolveRepository({}, () => 'https://gitlab.com/fork-owner/my-plugin.git'), DEFAULT_REPOSITORY);
    assert.equal(resolveRepository({}, () => {
      throw new Error('No remote');
    }), DEFAULT_REPOSITORY);
    assert.equal(DEFAULT_REPOSITORY, 'torrplay/lampa-plugin');
  });

  it('rejects remote URLs that do not name a repository on GitHub', () => {
    assert.equal(parseGitHubRepository('https://github.com/fork-owner'), undefined);
    assert.equal(parseGitHubRepository(''), undefined);
    assert.equal(parseGitHubRepository('https://notgithub.com/fork-owner/my-plugin'), undefined);
    assert.equal(parseGitHubRepository('https://gitlab.com/mirror/github.com/fork-owner/my-plugin.git'), undefined);
  });
});
