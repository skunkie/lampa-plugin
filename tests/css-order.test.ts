// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import stylelint from 'stylelint';

import { generateLandingPage } from '../landing-page.mjs';

function collectEmbeddedStyles(source: string): string[] {
  const snippets: string[] = [];
  for (const match of source.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    snippets.push(match[1]);
  }
  for (const match of source.matchAll(/\.textContent = `([\s\S]*?)`/g)) {
    snippets.push(match[1]);
  }
  for (const match of source.matchAll(/\bstyle=(?:"([^"]*)"|'([^']*)')/g)) {
    snippets.push(`.sample { ${match[1] ?? match[2]} }`);
  }
  return snippets;
}

describe('CSS declaration ordering', () => {
  const configFile = fileURLToPath(new URL('../stylelint.config.mjs', import.meta.url));

  it('keeps stylesheets and embedded styles in RECESS order', async () => {
    const snippets = collectEmbeddedStyles(generateLandingPage('1.2.3'));
    const sourceDirectory = new URL('../src/', import.meta.url);
    const files = fs.readdirSync(sourceDirectory, { encoding: 'utf8', recursive: true });
    for (const file of files.filter(file => file.endsWith('.ts'))) {
      snippets.push(...collectEmbeddedStyles(fs.readFileSync(new URL(file, sourceDirectory), 'utf8')));
    }
    assert.ok(snippets.some(code => code.includes(':root')));
    assert.ok(snippets.some(code => code.includes('.torrplay-active-dot')));

    for (const code of snippets) {
      const result = await stylelint.lint({ code, configFile });
      assert.equal(result.errored, false, JSON.stringify(result.results.map(result => result.warnings)));
    }
  });

  it('orders proprietary prefixed properties within their RECESS groups', async () => {
    const cases = [
      { anchor: 'background', property: '-webkit-font-smoothing', value: 'antialiased' },
      { anchor: 'background', property: '-moz-osx-font-smoothing', value: 'grayscale' },
      { anchor: 'font-family', property: '-webkit-line-clamp', value: '2' },
      { anchor: 'padding', property: '-webkit-box-orient', value: 'vertical' },
      { anchor: 'background', property: '-webkit-text-fill-color', value: 'white' },
    ];
    for (const { anchor, property, value } of cases) {
      const code = `.sample { ${anchor}: initial; ${property}: ${value}; }`;
      const result = await stylelint.lint({ code, configFile });
      assert.ok(result.results[0].warnings.some(warning => warning.rule === 'order/properties-order'), property);
      const fixed = await stylelint.lint({ code, configFile, fix: true });
      assert.equal(fixed.errored, false, property);
      assert.ok(fixed.code);
      assert.ok(fixed.code.indexOf(property) < fixed.code.indexOf(`${anchor}:`), property);
      const repeated = await stylelint.lint({ code: fixed.code, configFile });
      assert.equal(repeated.errored, false, property);
    }
  });

  it('rejects longhands before shorthands and preserves custom property order', async () => {
    const code = '.sample { --z: 1; --a: 2; font-size: 14px; font: inherit; border-color: red; border: 0; }';
    const result = await stylelint.lint({ code, configFile });
    assert.ok(result.results[0].warnings.some(warning => warning.rule === 'order/properties-order'));

    const fixed = await stylelint.lint({ code, configFile, fix: true });
    assert.equal(fixed.errored, false);
    assert.ok(fixed.code);
    assert.ok(fixed.code.indexOf('font:') < fixed.code.indexOf('font-size:'));
    assert.ok(fixed.code.indexOf('border:') < fixed.code.indexOf('border-color:'));
    assert.ok(fixed.code.indexOf('--z:') < fixed.code.indexOf('--a:'));
  });
});
