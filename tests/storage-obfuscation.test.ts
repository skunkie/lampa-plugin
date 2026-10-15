// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deobfuscateCredential, obfuscateCredential } from '../src/utils/storage-obfuscation';

describe('Storage Credential Obfuscation', () => {
  it('handles empty and undefined inputs safely', () => {
    assert.equal(obfuscateCredential(''), '');
    assert.equal(obfuscateCredential(undefined), '');
    assert.equal(deobfuscateCredential(''), '');
    assert.equal(deobfuscateCredential(undefined), '');
  });

  it('obfuscates with enc:v1: prefix and recovers original text', () => {
    const rawPassword = 'super-secret-password-123!@#';
    const obfuscated = obfuscateCredential(rawPassword);

    assert.ok(obfuscated.startsWith('enc:v1:'));
    assert.notEqual(obfuscated, rawPassword);
    assert.equal(obfuscated.includes(rawPassword), false);

    const recovered = deobfuscateCredential(obfuscated);
    assert.equal(recovered, rawPassword);
  });

  it('handles complex unicode, spaces, and special symbols', () => {
    const testCases = [
      'pass with spaces',
      'пароль_на_русском_123',
      'complex!@#$%^&*()_+~`-={}|[]\\:";\'<>?,./',
      'emoji🔑🔒🛡️stream',
    ];

    for (const testCase of testCases) {
      const obfuscated = obfuscateCredential(testCase);
      assert.ok(obfuscated.startsWith('enc:v1:'));
      assert.equal(deobfuscateCredential(obfuscated), testCase);
    }
  });

  it('rejects un-obfuscated or non-prefixed credentials', () => {
    const rawPlainPassword = 'legacyPlainPassword';
    assert.equal(deobfuscateCredential(rawPlainPassword), '');
  });
});
