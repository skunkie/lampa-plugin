// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

/**
 * Lampa hands search sources a URI-encoded query; a malformed escape falls back to the raw text.
 */
export function decodeSearchQuery(query: string): string {
  try {
    return decodeURIComponent(query);
  } catch {
    return query;
  }
}
