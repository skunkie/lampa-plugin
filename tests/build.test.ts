// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { buildLandingPage } from '../build.mjs';

describe('Build', () => {
  it('builds the landing page for the repository the build environment names', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'build-test-landing-'));
    const previousRepository = process.env.GITHUB_REPOSITORY;
    process.env.GITHUB_REPOSITORY = 'fork-owner/my-plugin';
    try {
      buildLandingPage({ outDir: tempDir, version: '1.2.3' });

      const html = readFileSync(join(tempDir, 'index.html'), 'utf8');
      assert.equal((html.match(/https:\/\/github\.com\/fork-owner\/my-plugin/g) || []).length, 6);
    } finally {
      if (previousRepository === undefined) delete process.env.GITHUB_REPOSITORY;
      else process.env.GITHUB_REPOSITORY = previousRepository;
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
