// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { assemblePagesSite, parseCliArgs, resolveBaseVersion, resolveDevVersion } from '../build-pages.mjs';

describe('Pages Deployment Assembly', () => {
  it('resolves base version from git tag when available', () => {
    const version = resolveBaseVersion(() => 'v1.2.3');
    assert.equal(version, '1.2.3');
  });

  it('falls back to package.json version when git tag fails', () => {
    const version = resolveBaseVersion(
      () => {
        throw new Error('No tag');
      },
      () => '1.0.1',
    );
    assert.equal(version, '1.0.1');
  });

  it('resolves dev version adhering to SemVer format', () => {
    const devVersion = resolveDevVersion(
      {},
      () => '1.2.3',
      () => 'abcdef1',
    );
    assert.equal(devVersion, '1.2.3-dev+abcdef1');
  });

  it('assembles pages site in release mode', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pages-test-release-'));
    try {
      await assemblePagesSite({
        environment: { GITHUB_SHA: '1234567890abcdef' },
        mode: 'release',
        outDir: tempDir,
        releaseVersion: '2.0.0',
      });

      assert.ok(existsSync(join(tempDir, 'index.html')));
      assert.ok(existsSync(join(tempDir, 'torrplay.js')));
      assert.ok(existsSync(join(tempDir, 'torrplay.min.js')));
      assert.ok(existsSync(join(tempDir, 'dev', 'index.html')));
      assert.ok(existsSync(join(tempDir, 'dev', 'torrplay.js')));
      assert.ok(existsSync(join(tempDir, 'dev', 'torrplay.min.js')));

      const rootHtml = readFileSync(join(tempDir, 'index.html'), 'utf8');
      assert.match(rootHtml, /v2\.0\.0/);
      assert.match(rootHtml, /Dev Channel ↗/);
      assert.doesNotMatch(rootHtml, /class="channel-banner"/);

      const devHtml = readFileSync(join(tempDir, 'dev', 'index.html'), 'utf8');
      assert.match(devHtml, /v2\.0\.0-dev\+1234567/);
      assert.match(devHtml, /Stable Release ↗/);
      assert.match(devHtml, /class="channel-banner"/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('assembles pages site in dev mode with mocked release download', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pages-test-dev-'));
    try {
      await assemblePagesSite({
        downloadRelease: (_repo: string, targetDir: string) => {
          // Mock release download by creating dummy production assets
          const dummyBanner = '// Mock release';
          writeFileSync(join(targetDir, 'torrplay.js'), dummyBanner);
          writeFileSync(join(targetDir, 'torrplay.min.js'), dummyBanner);
          return '1.9.9';
        },
        environment: { GITHUB_SHA: 'abcdef1234567890' },
        mode: 'dev',
        outDir: tempDir,
      });

      assert.ok(existsSync(join(tempDir, 'index.html')));
      assert.ok(existsSync(join(tempDir, 'torrplay.js')));
      assert.ok(existsSync(join(tempDir, 'torrplay.min.js')));
      assert.ok(existsSync(join(tempDir, 'dev', 'index.html')));
      assert.ok(existsSync(join(tempDir, 'dev', 'torrplay.js')));
      assert.ok(existsSync(join(tempDir, 'dev', 'torrplay.min.js')));

      const rootHtml = readFileSync(join(tempDir, 'index.html'), 'utf8');
      assert.match(rootHtml, /v1\.9\.9/);
      assert.match(rootHtml, /Dev Channel ↗/);

      const devHtml = readFileSync(join(tempDir, 'dev', 'index.html'), 'utf8');
      assert.match(devHtml, /-dev\+abcdef1/);
      assert.match(devHtml, /Stable Release ↗/);
      assert.match(devHtml, /class="channel-banner"/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('falls back to local build in dev mode when release download fails', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pages-test-dev-fallback-'));
    try {
      await assemblePagesSite({
        downloadRelease: () => {
          throw new Error('Download failed');
        },
        environment: { GITHUB_SHA: 'fedcba0987654321' },
        mode: 'dev',
        outDir: tempDir,
      });

      assert.ok(existsSync(join(tempDir, 'index.html')));
      assert.ok(existsSync(join(tempDir, 'torrplay.js')));
      assert.ok(existsSync(join(tempDir, 'dev', 'index.html')));
      assert.ok(existsSync(join(tempDir, 'dev', 'torrplay.js')));
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('rejects release mode without a release version', async () => {
    await assert.rejects(
      () => assemblePagesSite({ mode: 'release' }),
      /Release version is required for release mode/,
    );
  });

  it('parses CLI arguments and environment variables correctly', () => {
    const defaults = parseCliArgs([], {});
    assert.deepEqual(defaults, {
      mode: 'dev',
      outDir: 'dist-pages',
      releaseVersion: undefined,
    });

    const parsed = parseCliArgs(
      ['--mode', 'release', '--outdir', 'custom-dist', '--version', '1.2.3'],
      {},
    );
    assert.deepEqual(parsed, {
      mode: 'release',
      outDir: 'custom-dist',
      releaseVersion: '1.2.3',
    });

    const fromEnv = parseCliArgs([], {
      PAGES_MODE: 'release',
      PAGES_OUT_DIR: 'env-dist',
      PLUGIN_VERSION: '2.0.0',
    });
    assert.deepEqual(fromEnv, {
      mode: 'release',
      outDir: 'env-dist',
      releaseVersion: '2.0.0',
    });
  });
});
