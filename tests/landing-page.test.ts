// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

import { generateLandingPage } from '../landing-page.mjs';
import { assertLandingPageChannel, getLandingPageMarkup } from './support/landing-page';

function createLandingPageHarness(channel: 'production' | 'dev' = 'production', language = 'en', repository?: string) {
  const html = generateLandingPage('1.2.3', undefined, channel, repository);
  const attributes: Record<string, string> = { 'data-lang': language, lang: language };
  const prompts: string[][] = [];
  const timers: (() => void)[] = [];
  const buttons = ['min', 'dev'].map(bundle => {
    const id = `btn-copy-${bundle}`;
    const markup = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([\\s\\S]*?)</button>`))?.[1];
    assert.ok(markup);
    return {
      classList: { add: () => {}, remove: () => {} },
      id,
      innerHTML: markup,
    };
  });
  const inputs = ['min', 'dev'].map(bundle => ({
    id: `url-${bundle}`,
    select: () => {},
    setSelectionRange: () => {},
    value: '',
  }));
  const ariaElements = [...html.matchAll(/data-i18n-aria="([^"]+)" aria-label="([^"]+)"/g)]
    .map(([, key, label]) => {
      const attributes: Record<string, string> = { 'aria-label': label, 'data-i18n-aria': key };
      return {
        getAttribute: (name: string) => attributes[name],
        setAttribute: (name: string, value: string) => { attributes[name] = value; },
      };
    });
  const documentationLinks = [...html.matchAll(/<a href="([^"]+)" data-docs-url="([^"]+)"/g)]
    .map(([, href, url]) => {
      const attributes: Record<string, string> = { 'data-docs-url': url, href };
      return {
        getAttribute: (name: string) => attributes[name],
        setAttribute: (name: string, value: string) => { attributes[name] = value; },
      };
    });
  const titleMatch = html.match(/<title\b[^>]*\bid="([^"]+)"[^>]*>([^<]*)<\/title>/);
  const descriptionMatch = html.match(/<meta\b[^>]*\bid="([^"]+)"[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/);
  assert.ok(titleMatch && descriptionMatch);
  const pageTitle = { id: titleMatch[1], textContent: titleMatch[2] };
  const descriptionAttributes: Record<string, string> = { content: descriptionMatch[2] };
  const pageDescription = {
    getAttribute: (name: string) => descriptionAttributes[name],
    id: descriptionMatch[1],
    setAttribute: (name: string, value: string) => { descriptionAttributes[name] = value; },
  };
  const context = {
    document: {
      addEventListener: () => {},
      documentElement: {
        getAttribute: (name: string) => attributes[name],
        setAttribute: (name: string, value: string) => { attributes[name] = value; },
      },
      execCommand: () => true,
      getElementById: (id: string) => [...buttons, ...inputs, pageDescription, pageTitle].find(element => element.id === id) || null,
      querySelectorAll: (selector: string) => {
        if (selector === '[data-docs-url]') return documentationLinks;
        if (selector === '[data-i18n-aria]') return ariaElements;
        if (selector !== '[data-i18n]') return [];
        return buttons.map(button => ({
          getAttribute: () => button.innerHTML.match(/data-i18n="([^"]+)"/)?.[1],
          set textContent(value: string) {
            button.innerHTML = button.innerHTML.replace(/(<span[^>]*>)[^<]*/, (_, tag: string) => tag + value);
          },
        }));
      },
    },
    navigator: { clipboard: undefined as undefined | { writeText: (value: string) => Promise<void> } },
    prompt: (message: string, value: string) => { prompts.push([message, value]); },
    setTimeout: (callback: () => void) => { timers.push(callback); },
    window: {
      isSecureContext: true,
      location: { origin: 'https://example.com', pathname: channel === 'dev' ? '/dev/' : '/', protocol: 'https:' },
    },
  };
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()?.[1];
  assert.ok(script);
  runInNewContext(script, context);
  const translations = runInNewContext('i18n', context) as Record<string, Record<string, string>>;
  return { ariaElements, buttons, context, documentationLinks, inputs, pageDescription, pageTitle, prompts, timers, translations };
}

function assertCopyButtonLabel(button: { innerHTML: string }, expectedLabel: string): void {
  const label = button.innerHTML.match(/<span\b[^>]*>([^<]*)<\/span>/)?.[1];
  assert.ok(expectedLabel);
  assert.equal(label, expectedLabel);
}

describe('Landing Page', () => {
  it('generates a deterministic self-contained page', () => {
    const first = generateLandingPage('1.2.3');
    const second = generateLandingPage('1.2.3');
    const markup = getLandingPageMarkup(first);

    assert.equal(first, second);
    assert.match(markup, /<title\b[^>]*id="page-title"[^>]*>[^<]*v1\.2\.3<\/title>/);
    assert.match(first, /torrplay\.min\.js/);
    assert.match(first, /torrplay\.js/);
    assert.match(first, /<style>[\s\S]+:root/);
    assert.match(first, /<script>[\s\S]+var i18n/);
    assert.match(first, /@media \(max-width: 1080px\)[\s\S]+\.nav-mobile-toggle/);
    assert.match(first, /\.code-input \{[\s\S]+min-width: 0/);
    assert.match(first, /@media \(max-width: 420px\)[\s\S]+\.brand-badge/);
    for (const key of ['prerequisiteTitle', 'prerequisiteText', 'featSearchTitle', 'featSearchDesc']) {
      assert.ok(markup.includes(`data-i18n="${key}"`));
    }
    const featureCards = markup.match(/class="feature-card(?: feature-card-wide)?"/g) || [];
    const featureTitles = markup.match(/<h3\b[^>]*data-i18n="[^"]+"[^>]*>/g) || [];
    assert.ok(featureCards.length > 0);
    assert.equal(featureCards.length, featureTitles.length);
    assert.doesNotMatch(first, /\{\{[A-Z_]+\}\}/);
  });

  it('escapes the version before inserting it into HTML and JavaScript strings', () => {
    const html = generateLandingPage('<1&"\'>');

    assert.match(html, /v&lt;1&amp;&quot;&#39;&gt;/);
    assert.doesNotMatch(html, /v<1&"'>/);
  });

  it('keeps setup instructions in the selected language', () => {
    const html = generateLandingPage('1.2.3');
    const installation = html.match(/<section id="installation">([\s\S]*?)<\/section>/)?.[1];
    assert.ok(installation);

    const elements = [...installation.matchAll(/data-i18n(-html)?="([^"]+)"[^>]*>([\s\S]*?)<\/(?:div|h2)>/g)]
      .map(([, htmlAttribute, key, content]) => ({
        getAttribute: () => key,
        innerHTML: htmlAttribute ? content : '',
        isHtml: Boolean(htmlAttribute),
        textContent: htmlAttribute ? '' : content,
      }));
    assert.equal(elements.length, 6);
    const fallbackContents = elements.map(element => element.isHtml ? element.innerHTML : element.textContent);

    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()?.[1];
    assert.ok(script);
    const context = {
      document: {
        addEventListener: () => {},
        documentElement: {
          getAttribute: () => 'en',
          setAttribute: () => {},
        },
        getElementById: () => null,
        querySelectorAll: (selector: string) => elements.filter(element => selector === (element.isHtml ? '[data-i18n-html]' : '[data-i18n]')),
      },
      window: { location: { origin: 'https://example.com', pathname: '/', protocol: 'https:' } },
    };
    runInNewContext(script, context);
    const translations = runInNewContext('i18n', context) as Record<string, Record<string, string>>;

    elements.forEach((element, index) => {
      assert.equal(fallbackContents[index], translations.en[element.getAttribute()], 'HTML fallback must match the English locale');
    });

    for (const language of ['en', 'ru', 'en']) {
      runInNewContext(`setLanguage('${language}')`, context);
      for (const element of elements) {
        const content = element.isHtml ? element.innerHTML : element.textContent;
        const expectedContent = translations[language][element.getAttribute()];
        assert.ok(expectedContent);
        assert.equal(content, expectedContent);
      }
    }
  });

  it('localizes accessibility labels and declares the selected document language', () => {
    const { ariaElements, context, translations } = createLandingPageHarness('production', 'ru');
    assert.equal(ariaElements.length, 4);

    for (const language of ['ru', 'en', 'ru']) {
      runInNewContext(`setLanguage('${language}')`, context);
      assert.equal(context.document.documentElement.getAttribute('lang'), language);
      for (const element of ariaElements) {
        const label = element.getAttribute('aria-label');
        const expectedLabel = translations[language][element.getAttribute('data-i18n-aria')];
        assert.ok(expectedLabel);
        assert.equal(label, expectedLabel);
      }
    }
  });

  it('provides matching translation keys in both locales', () => {
    for (const channel of ['production', 'dev'] as const) {
      const { translations } = createLandingPageHarness(channel);
      assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.ru).sort());
    }
  });

  it('keeps translation keys in alphabetical order in every locale', () => {
    const { translations } = createLandingPageHarness();
    for (const [language, dictionary] of Object.entries(translations)) {
      const keys = Object.keys(dictionary);
      assert.deepEqual(keys, [...keys].sort(), `${language} translation keys must be sorted alphabetically`);
    }
  });

  it('updates the page title and meta description when the language changes', () => {
    const { context, pageDescription, pageTitle, translations } = createLandingPageHarness();
    for (const language of ['ru', 'en', 'ru']) {
      runInNewContext(`setLanguage('${language}')`, context);
      const { pageDescription: expectedDescription, pageTitle: expectedTitle } = translations[language];
      assert.ok(expectedTitle && expectedDescription);
      assert.equal(pageTitle.textContent, expectedTitle);
      assert.match(pageTitle.textContent, /v1\.2\.3$/);
      assert.equal(pageDescription.getAttribute('content'), expectedDescription);
    }
  });

  it('localizes desktop and mobile documentation links on load and language changes', () => {
    for (const channel of ['production', 'dev'] as const) {
      for (const repository of ['torrplay/lampa-plugin', 'fork-owner/my-plugin']) {
        for (const initialLanguage of ['en', 'ru']) {
          const { context, documentationLinks } = createLandingPageHarness(channel, initialLanguage, repository);
          assert.equal(documentationLinks.length, 2);
          for (const [index, language] of [initialLanguage, 'ru', 'en', 'ru', 'unknown'].entries()) {
            if (index > 0) runInNewContext(`setLanguage('${language}')`, context);
            const path = language === 'ru' ? '/blob/HEAD/README.ru.md' : '#readme';
            for (const link of documentationLinks) {
              assert.equal(link.getAttribute('href'), `https://github.com/${repository}${path}`);
            }
          }
        }
      }
    }
  });

  it('updates both copy buttons when language changes during and after the success message', () => {
    const { buttons, context, timers, translations } = createLandingPageHarness();
    for (const button of buttons) {
      const inputId = button.id.replace('btn-copy-', 'url-');
      runInNewContext(`setLanguage('en'); copyUrl('${inputId}', '${button.id}')`, context);
      assertCopyButtonLabel(button, translations.en.btnCopied);
      runInNewContext("setLanguage('ru')", context);
      assertCopyButtonLabel(button, translations.ru.btnCopied);
      timers.shift()?.();
      assertCopyButtonLabel(button, translations.ru.btnCopy);
      runInNewContext("setLanguage('en')", context);
      assertCopyButtonLabel(button, translations.en.btnCopy);
    }
  });

  it('uses the current locale when an asynchronous clipboard write finishes', async () => {
    const { buttons, context, timers, translations } = createLandingPageHarness();
    const copiedUrls: string[] = [];
    let finishCopy = () => {};
    context.navigator.clipboard = {
      writeText: (value: string) => {
        copiedUrls.push(value);
        return new Promise<void>(resolve => { finishCopy = resolve; });
      },
    };
    runInNewContext("copyUrl('url-min', 'btn-copy-min'); setLanguage('ru')", context);
    finishCopy();
    await Promise.resolve();
    assert.deepEqual(copiedUrls, ['https://example.com/torrplay.min.js']);
    assertCopyButtonLabel(buttons[0], translations.ru.btnCopied);
    runInNewContext("setLanguage('en')", context);
    timers.shift()?.();
    assertCopyButtonLabel(buttons[0], translations.en.btnCopy);
  });

  it('localizes the manual-copy prompt when the fallback fails or throws', () => {
    for (const language of ['en', 'ru']) {
      for (const shouldThrow of [false, true]) {
        const { buttons, context, inputs, prompts, timers, translations } = createLandingPageHarness('production', language);
        const initialMarkup = buttons[0].innerHTML;
        context.document.execCommand = () => {
          if (shouldThrow) throw new Error('Clipboard unavailable');
          return false;
        };
        runInNewContext("copyUrl('url-min', 'btn-copy-min')", context);
        assert.deepEqual(prompts, [[
          translations[language].copyManually,
          inputs[0].value,
        ]]);
        assert.equal(timers.length, 0);
        assert.equal(buttons[0].innerHTML, initialMarkup);
      }
    }
  });

  it('uses the current locale if a rejected clipboard write falls back to manual copying', async () => {
    const { context, prompts, translations } = createLandingPageHarness();
    context.navigator.clipboard = { writeText: () => Promise.reject(new Error('Clipboard unavailable')) };
    context.document.execCommand = () => false;
    runInNewContext("copyUrl('url-dev', 'btn-copy-dev'); setLanguage('ru')", context);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(prompts, [[translations.ru.copyManually, 'https://example.com/torrplay.js']]);
  });

  it('renders production channel with link to dev and no warning banner', () => {
    const html = generateLandingPage('1.2.3', undefined, 'production');

    assertLandingPageChannel(html, 'production');
    assert.match(getLandingPageMarkup(html), /class="brand-badge" title="v1\.2\.3">v1\.2\.3<\/span>/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  });

  it('renders dev channel with link to production and dev warning banner', () => {
    const html = generateLandingPage('1.2.3-dev+ba5c007', undefined, 'dev');

    assertLandingPageChannel(html, 'dev');
    assert.match(getLandingPageMarkup(html), /class="brand-badge brand-badge-dev" title="v1\.2\.3-dev\+ba5c007">v1\.2\.3-dev\+ba5c007<\/span>/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  });

  it('links to the default repository', () => {
    const html = generateLandingPage('1.2.3');

    assert.match(html, /href="https:\/\/github\.com\/torrplay\/lampa-plugin#readme"/);
    assert.match(html, /href="https:\/\/github\.com\/torrplay\/lampa-plugin" target="_blank" rel="noopener" class="nav-gh-pill/);
  });

  it('links every repository reference to the given repository', () => {
    const html = generateLandingPage('1.2.3', undefined, 'production', 'fork-owner/my-plugin');

    assert.equal((html.match(/https:\/\/github\.com\/fork-owner\/my-plugin/g) || []).length, 6);
    assert.doesNotMatch(html, /github\.com\/torrplay\/lampa-plugin/);
  });

  it('escapes the repository before inserting it into HTML', () => {
    const html = generateLandingPage('1.2.3', undefined, 'production', 'owner/"><script>');

    assert.match(html, /github\.com\/owner\/&quot;&gt;&lt;script&gt;/);
    assert.doesNotMatch(html, /owner\/"><script>/);
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
