// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeSearchQuery } from '../src/utils/search-query';

describe('Search Query Decoding', () => {
  it('decodes URI-encoded Unicode queries', () => {
    assert.equal(decodeSearchQuery(encodeURIComponent('Фильм 2026')), 'Фильм 2026');
  });

  it('falls back to the raw text when a percent escape is malformed', () => {
    assert.equal(decodeSearchQuery('100%'), '100%');
    assert.equal(decodeSearchQuery('ubuntu %E0%A4%A'), 'ubuntu %E0%A4%A');
  });
});
