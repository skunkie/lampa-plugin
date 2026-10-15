// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  clearTriggerSetting,
  isTriggerSettingEnabled,
  isTriggerSettingUnset,
  readTriggerSetting,
  writeTriggerSetting,
} from '../src/utils/trigger-setting';

// Mirrors Lampa's Storage.get(): every read goes through `value || fallback || ''`, and the
// strings 'true'/'false' come back as booleans.
function lampaStorageGet(storageMap: Map<string, unknown>, key: string, fallback: unknown): unknown {
  const value = storageMap.get(key) || fallback || '';
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

describe('Trigger Settings', () => {
  const storageMap = new Map<string, unknown>();

  beforeEach(() => {
    storageMap.clear();
    (globalThis as any).Lampa = {
      Storage: {
        get: (key: string, fallback: unknown) => lampaStorageGet(storageMap, key, fallback),
        set: (key: string, value: unknown) => storageMap.set(key, value),
      },
    };
  });

  it('accepts both the boolean and the stored string form of an enabled toggle', () => {
    assert.equal(isTriggerSettingEnabled(true), true);
    assert.equal(isTriggerSettingEnabled('true'), true);
    assert.equal(isTriggerSettingEnabled(false), false);
    assert.equal(isTriggerSettingEnabled('false'), false);
    assert.equal(isTriggerSettingEnabled(''), false);
  });

  it('writes the string form so a disabled toggle reads back as false, not as the fallback', () => {
    writeTriggerSetting('key', false);

    assert.equal(storageMap.get('key'), 'false');
    assert.equal(readTriggerSetting('key', true), false);
    assert.equal(isTriggerSettingUnset('key'), false);
  });

  it('reads an enabled toggle as true', () => {
    writeTriggerSetting('key', true);

    assert.equal(storageMap.get('key'), 'true');
    assert.equal(readTriggerSetting('key'), true);
  });

  it('falls back only for a toggle that was never written or was cleared', () => {
    assert.equal(isTriggerSettingUnset('key'), true);
    assert.equal(readTriggerSetting('key'), false);
    assert.equal(readTriggerSetting('key', true), true);

    writeTriggerSetting('key', true);
    clearTriggerSetting('key');

    assert.equal(isTriggerSettingUnset('key'), true);
    assert.equal(readTriggerSetting('key', true), true);
  });
});
