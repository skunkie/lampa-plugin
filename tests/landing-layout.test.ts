// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { generateLandingPage } from '../landing-page.mjs';

interface LayoutCase {
  channel: 'dev' | 'production',
  language: 'en' | 'ru',
  version: string,
  widthPx: number
}

interface LayoutResult extends LayoutCase {
  badgeWidthPx: number,
  canCloseMenu: boolean,
  canOpenMenu: boolean,
  hasBadgeClipping: boolean,
  hasBrandOverlap: boolean,
  hasContainedControls: boolean,
  hasDocumentOverflow: boolean,
  hasRepositoryLabel: boolean,
  isDesktopNavigationVisible: boolean,
  isMenuToggleVisible: boolean,
  isNavbarAligned: boolean
}

const CHROME_EXECUTABLE = process.env.CHROME_BIN || 'google-chrome';

function measureNavbarLayouts(cases: LayoutCase[]): LayoutResult[] {
  const directory = mkdtempSync(join(tmpdir(), 'torrplay-layout-'));
  try {
    const frames = cases.map(testCase => {
      const html = generateLandingPage(testCase.version, undefined, testCase.channel);
      const escapedHtml = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<iframe style="width:${testCase.widthPx}px;height:600px;border:0" srcdoc="${escapedHtml}"></iframe>`;
    }).join('');
    const fixture = `<!doctype html><pre id="results"></pre>${frames}<script>
      window.addEventListener('load', function () {
        var cases = ${JSON.stringify(cases)};
        var results = Array.from(document.querySelectorAll('iframe')).map(function (frame, index) {
          var testCase = cases[index];
          var page = frame.contentWindow;
          page.setLanguage(testCase.language);
          var pageDocument = page.document;
          var navbar = pageDocument.querySelector('.navbar-container').getBoundingClientRect();
          var brand = pageDocument.querySelector('.brand').getBoundingClientRect();
          var actions = pageDocument.querySelector('.nav-actions').getBoundingClientRect();
          var content = pageDocument.querySelector('.prerequisite-card').getBoundingClientRect();
          var badge = pageDocument.querySelector('.brand-badge');
          var isDesktopNavigationVisible = page.getComputedStyle(pageDocument.querySelector('.nav-links-desktop')).display !== 'none';
          var menu = pageDocument.querySelector('.nav-mobile-menu');
          var toggle = pageDocument.getElementById('mobile-menu-toggle');
          var toggleStyle = page.getComputedStyle(toggle);
          var toggleBounds = toggle.getBoundingClientRect();
          var isMenuToggleVisible = toggleStyle.display !== 'none' && toggleStyle.visibility === 'visible'
            && Number(toggleStyle.opacity) > 0 && toggleBounds.width > 0 && toggleBounds.height > 0;
          var canOpenMenu = false;
          if (isMenuToggleVisible) {
            toggle.click();
            canOpenMenu = page.getComputedStyle(menu).display !== 'none';
            toggle.click();
          }
          return Object.assign({}, testCase, {
            badgeWidthPx: badge.getBoundingClientRect().width,
            canCloseMenu: page.getComputedStyle(menu).display === 'none',
            canOpenMenu: canOpenMenu,
            hasBadgeClipping: badge.scrollWidth > badge.clientWidth + 1,
            hasBrandOverlap: brand.right > actions.left,
            hasContainedControls: brand.left >= navbar.left && actions.right <= navbar.right + 1,
            hasDocumentOverflow: pageDocument.documentElement.scrollWidth > pageDocument.documentElement.clientWidth,
            hasRepositoryLabel: !!pageDocument.querySelector('.nav-gh-pill').getAttribute('aria-label'),
            isDesktopNavigationVisible: isDesktopNavigationVisible,
            isMenuToggleVisible: isMenuToggleVisible,
            isNavbarAligned: Math.abs(navbar.left - content.left) < 1 && Math.abs(navbar.right - content.right) < 1
          });
        });
        document.getElementById('results').textContent = JSON.stringify(results);
      });
    </script>`;
    const fixturePath = join(directory, 'layout.html');
    writeFileSync(fixturePath, fixture);
    const rendered = execFileSync(CHROME_EXECUTABLE, [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      `--user-data-dir=${join(directory, 'profile')}`,
      '--virtual-time-budget=2000',
      '--dump-dom',
      pathToFileURL(fixturePath).href,
    ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30_000 });
    const json = rendered.match(/<pre id="results">([^<]+)<\/pre>/)?.[1];
    assert.ok(json, 'Chrome must return layout measurements for every page');
    return JSON.parse(json) as LayoutResult[];
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

describe('Landing page navbar layout', () => {
  it('keeps the version visible and navigation within the content width in both languages and channels', t => {
    const cases: LayoutCase[] = [];
    for (const channel of ['production', 'dev'] as const) {
      for (const language of ['en', 'ru'] as const) {
        for (const widthPx of [390, 430, 768, 1080, 1081, 1440]) {
          cases.push({ channel, language, version: channel === 'dev' ? '10.20.30-dev+abcdef1' : '10.20.30', widthPx });
        }
      }
    }

    let results: LayoutResult[];
    try {
      results = measureNavbarLayouts(cases);
    } catch (error) {
      const { code, path } = error as NodeJS.ErrnoException;
      if (!process.env.CHROME_BIN && code === 'ENOENT' && path === CHROME_EXECUTABLE) {
        t.skip('google-chrome was not found; set CHROME_BIN to a Chrome or Chromium executable');
        return;
      }
      throw error;
    }
    assert.equal(results.length, cases.length);
    for (const [index, result] of results.entries()) {
      const testCase = cases[index];
      const label = `${testCase.channel}/${testCase.language}/${testCase.widthPx}px`;
      assert.deepEqual({ channel: result.channel, language: result.language, version: result.version, widthPx: result.widthPx }, testCase);
      assert.equal(result.hasDocumentOverflow, false, `${label}: page must not scroll horizontally`);
      assert.equal(result.hasBrandOverlap, false, `${label}: brand must not overlap navigation`);
      assert.equal(result.hasContainedControls, true, `${label}: controls must remain inside the navbar`);
      assert.equal(result.hasRepositoryLabel, true, `${label}: repository link must retain its accessible label`);
      assert.equal(result.canCloseMenu, true, `${label}: compact menu must close`);
      if (testCase.widthPx > 420) {
        assert.ok(result.badgeWidthPx >= 32, `${label}: version badge must remain readable`);
      }
      if (result.isDesktopNavigationVisible) {
        assert.equal(result.hasBadgeClipping, false, `${label}: desktop version must fit without truncation`);
        assert.equal(result.isNavbarAligned, true, `${label}: desktop navbar must align with content`);
      } else {
        assert.equal(result.isMenuToggleVisible, true, `${label}: compact menu button must be visible and have nonzero dimensions`);
        assert.equal(result.canOpenMenu, true, `${label}: compact navigation must remain accessible`);
      }
    }
  });
});
