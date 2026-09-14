// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { generateLandingPage } from '../landing-page.mjs';

describe('Landing Page', () => {
  it('generates a deterministic self-contained page', () => {
    const first = generateLandingPage('1.2.3');
    const second = generateLandingPage('1.2.3');

    assert.equal(first, second);
    assert.match(first, /TorrPlay Lampa Plugin v1\.2\.3/);
    assert.match(first, /torrplay\.min\.js/);
    assert.match(first, /torrplay\.js/);
    assert.match(first, /Торрент-стриминг для/);
    assert.match(first, /<style>[\s\S]+:root/);
    assert.match(first, /<script>[\s\S]+var i18n/);
    assert.match(first, /@media \(max-width: 860px\)[\s\S]+\.nav-mobile-toggle/);
    assert.match(first, /\.code-input \{[\s\S]+min-width: 0/);
    assert.match(first, /@media \(max-width: 420px\)[\s\S]+\.brand-badge/);
    assert.match(first, /This plugin is a client for Lampa/);
    assert.match(first, /Плагин работает как клиент Lampa/);
    assert.match(first, /Jackett &amp; Prowlarr Search|Jackett & Prowlarr Search/);
    assert.match(first, /Поиск через Jackett и Prowlarr/);
    assert.equal((first.match(/class="feature-card(?: feature-card-wide)?"/g) || []).length, 7);
    assert.doesNotMatch(first, /\{\{[A-Z_]+\}\}/);
  });

  it('escapes the version before inserting it into HTML and JavaScript strings', () => {
    const html = generateLandingPage('<1&"\'>');

    assert.match(html, /v&lt;1&amp;&quot;&#39;&gt;/);
    assert.doesNotMatch(html, /v<1&"'>/);
  });

  it('rejects a template missing a required placeholder', () => {
    const directory = mkdtempSync(join(tmpdir(), 'torrplay-landing-'));
    try {
      writeFileSync(join(directory, 'index.html'), '{{LANDING_STYLES}}{{PLUGIN_VERSION}}');
      writeFileSync(join(directory, 'styles.css'), 'body {}');
      writeFileSync(join(directory, 'script.js'), 'void 0;');

      assert.throws(
        () => generateLandingPage('1.0.0', new URL(`file://${directory}/`)),
        /missing required placeholder \{\{LANDING_SCRIPT\}\}/,
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
