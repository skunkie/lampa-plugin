// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { v4 as createUuidV4 } from 'uuid';

/**
 * Generates an RFC 4122 compliant UUID v4 string with fallback support for older TV runtimes.
 */
export function generateUuid(): string {
  try {
    return createUuidV4();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, placeholder => {
      const randomValue = (Math.random() * 16) | 0;
      const uuidValue = placeholder === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
      return uuidValue.toString(16);
    });
  }
}
