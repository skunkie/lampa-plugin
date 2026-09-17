// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { initTranslations, SupportedLocale, translate, TRANSLATIONS } from '../src/lang/translations';

describe('Localization & Translations', () => {
  beforeEach(() => {
    // Reset global Lampa mock
    delete (globalThis as any).Lampa;
  });

  it('contains valid and non-empty en and ru entries for every translation key', () => {
    const keys = Object.keys(TRANSLATIONS);
    assert.ok(keys.length > 0, 'TRANSLATIONS must have defined keys');

    for (const key of keys) {
      const entry = TRANSLATIONS[key];
      assert.ok(entry, `Key "${key}" must have an entry`);
      assert.ok(typeof entry.en === 'string' && entry.en.length > 0, `Key "${key}" must have non-empty en translation`);
      assert.ok(typeof entry.ru === 'string' && entry.ru.length > 0, `Key "${key}" must have non-empty ru translation`);
    }
  });

  it('strictly maintains alphabetical ordering of all TRANSLATIONS keys', () => {
    const keys = Object.keys(TRANSLATIONS);
    for (let i = 1; i < keys.length; i++) {
      assert.ok(
        keys[i] >= keys[i - 1],
        `Key "${keys[i]}" must be sorted alphabetically after "${keys[i - 1]}"`
      );
    }
  });

  it('registers dictionary with Lampa.Lang.add via initTranslations', () => {
    let addedDictionary: Record<string, Record<SupportedLocale, string>> | null = null;
    (globalThis as any).Lampa = {
      Lang: {
        add: (data: Record<string, Record<SupportedLocale, string>>) => {
          addedDictionary = data;
        },
      },
    };

    initTranslations();
    assert.deepEqual(addedDictionary, TRANSLATIONS, 'initTranslations must pass TRANSLATIONS to Lampa.Lang.add');
  });

  it('safely handles missing Lampa or Lampa.Lang during initTranslations', () => {
    assert.doesNotThrow(() => {
      initTranslations();
    });

    (globalThis as any).Lampa = {};
    assert.doesNotThrow(() => {
      initTranslations();
    });
  });

  it('returns fallback string or key when Lampa.Lang is unavailable', () => {
    const resultWithFallback = translate('torrplay_enabled_name', 'Enable TorrPlay');
    assert.equal(resultWithFallback, 'Enable TorrPlay');

    const resultWithoutFallback = translate('torrplay_unknown_key');
    assert.equal(resultWithoutFallback, 'torrplay_unknown_key');
  });

  it('uses Lampa.Lang.translate when available', () => {
    (globalThis as any).Lampa = {
      Lang: {
        translate: (key: string) => {
          if (key === 'torrplay_enabled_name') return 'Включить TorrPlay';
          return key;
        },
      },
    };

    const translated = translate('torrplay_enabled_name', 'Enable TorrPlay');
    assert.equal(translated, 'Включить TorrPlay');

    // Unknown key where translate returns key returns the fallback
    const fallbackUsed = translate('torrplay_nonexistent', 'Fallback Text');
    assert.equal(fallbackUsed, 'Fallback Text');
  });

  it('interpolates parameters correctly in translate', () => {
    (globalThis as any).Lampa = {
      Lang: {
        translate: (key: string) => {
          if (key === 'torrplay_noty_failover') {
            return 'TorrPlay: {failed} офлайн → Переключено на {next} ({latency} мс)';
          }
          return key;
        },
      },
    };

    const resultRu = translate(
      'torrplay_noty_failover',
      'TorrPlay: {failed} offline → Switched to {next} ({latency} ms)',
      { failed: 'Node A', latency: 42, next: 'Node B' }
    );
    assert.equal(resultRu, 'TorrPlay: Node A офлайн → Переключено на Node B (42 мс)');

    // Test with fallback when Lampa returns unchanged key
    delete (globalThis as any).Lampa;
    const resultEn = translate(
      'torrplay_noty_failover',
      'TorrPlay: {failed} offline → Switched to {next} ({latency} ms)',
      { failed: 'Node A', latency: 42, next: 'Node B' }
    );
    assert.equal(resultEn, 'TorrPlay: Node A offline → Switched to Node B (42 ms)');
  });
});
