// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';

import { SupportedLocale, TRANSLATIONS } from '../../src/lang/translations';

export function getTestTranslation(
  key: string,
  parameters: Record<string, number | string> = {},
  locale: SupportedLocale = 'en',
): string {
  const template = TRANSLATIONS[key]?.[locale];
  assert.ok(template, `Missing ${locale} translation for ${key}`);
  for (const name of Object.keys(parameters)) {
    assert.ok(template.includes(`{${name}}`), `${locale} translation for ${key} must use {${name}}`);
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => (
    Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : placeholder
  ));
}

export function createTestLanguage(locale: SupportedLocale = 'en', nativeTranslations: Record<string, string> = {}) {
  return { translate: (key: string) => nativeTranslations[key] ?? TRANSLATIONS[key]?.[locale] ?? key };
}
