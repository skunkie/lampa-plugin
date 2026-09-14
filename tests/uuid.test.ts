// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateUuid } from '../src/utils/uuid';

describe('UUID Generator', () => {
  it('generates valid RFC 4122 v4 UUID strings', () => {
    const uuid = generateUuid();
    const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(uuid, v4Regex, `Generated UUID ${uuid} should match RFC 4122 v4 pattern`);
  });

  it('generates unique identifiers across multiple invocations', () => {
    const set = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      set.add(generateUuid());
    }
    assert.equal(set.size, count, 'All generated UUIDs should be unique');
  });
});
