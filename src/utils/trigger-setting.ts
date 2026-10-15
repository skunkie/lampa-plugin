// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

// Lampa's Storage.get() funnels every read through `value || fallback || ''` and turns the
// stored strings 'true'/'false' back into booleans. A raw boolean false would therefore read
// back as the caller's fallback, and a key that was never written (or was cleared) reads back
// as this empty string. Writing the strings Lampa's own settings toggles write keeps both
// reads honest.
const UNSET_TRIGGER_SETTING = '';

export function isTriggerSettingEnabled(value: unknown): boolean {
  return value === true || value === 'true';
}

export function isTriggerSettingUnset(key: string): boolean {
  return Lampa.Storage.get<boolean | string>(key, UNSET_TRIGGER_SETTING) === UNSET_TRIGGER_SETTING;
}

export function readTriggerSetting(key: string, fallback = false): boolean {
  const value = Lampa.Storage.get<boolean | string>(key, UNSET_TRIGGER_SETTING);
  return value === UNSET_TRIGGER_SETTING ? fallback : isTriggerSettingEnabled(value);
}

export function writeTriggerSetting(key: string, value: boolean): void {
  Lampa.Storage.set(key, value ? 'true' : 'false');
}

export function clearTriggerSetting(key: string): void {
  Lampa.Storage.set(key, UNSET_TRIGGER_SETTING);
}
