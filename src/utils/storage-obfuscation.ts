// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

const STORAGE_OBFUSCATION_PREFIX = 'enc:v1:';
const STORAGE_SALT = 'TorrPlay$SecSalt@2026';

function utf8ToBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'binary').toString('base64');
  }
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let index = 0;
  while (index < str.length) {
    const char1 = str.charCodeAt(index++);
    const char2 = str.charCodeAt(index++);
    const char3 = str.charCodeAt(index++);

    const enc1 = char1 >> 2;
    const enc2 = ((char1 & 3) << 4) | (isNaN(char2) ? 0 : char2 >> 4);
    const enc3 = isNaN(char2) ? 64 : ((char2 & 15) << 2) | (isNaN(char3) ? 0 : char3 >> 6);
    const enc4 = isNaN(char2) || isNaN(char3) ? 64 : char3 & 63;

    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }
  return output;
}

function base64ToUtf8(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('binary');
  }
  if (typeof atob === 'function') {
    return atob(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let index = 0;
  const input = str.replace(/[^A-Za-z0-9+/=]/g, '');
  while (index < input.length) {
    const enc1 = chars.indexOf(input.charAt(index++));
    const enc2 = chars.indexOf(input.charAt(index++));
    const enc3 = chars.indexOf(input.charAt(index++));
    const enc4 = chars.indexOf(input.charAt(index++));

    const char1 = (enc1 << 2) | (enc2 >> 4);
    const char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const char3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(char1);
    if (enc3 !== 64 && enc3 !== -1) {
      output += String.fromCharCode(char2);
    }
    if (enc4 !== 64 && enc4 !== -1) {
      output += String.fromCharCode(char3);
    }
  }
  return output;
}

function xorTransform(input: string, key: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    result += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Obfuscates a sensitive string before storing in local storage.
 * Returns an enc:v1: prefixed Base64 string.
 */
export function obfuscateCredential(plainText?: string): string {
  if (!plainText) return '';
  try {
    const masked = xorTransform(unescape(encodeURIComponent(plainText)), STORAGE_SALT);
    return `${STORAGE_OBFUSCATION_PREFIX}${utf8ToBase64(masked)}`;
  } catch {
    return '';
  }
}

/**
 * Deobfuscates an enc:v1: prefixed credential string back into plain text.
 * Returns empty string if the stored value is missing or does not have the expected prefix.
 */
export function deobfuscateCredential(storedValue?: string): string {
  if (!storedValue || !storedValue.startsWith(STORAGE_OBFUSCATION_PREFIX)) {
    return '';
  }
  try {
    const rawBase64 = storedValue.slice(STORAGE_OBFUSCATION_PREFIX.length);
    const unmasked = xorTransform(base64ToUtf8(rawBase64), STORAGE_SALT);
    return decodeURIComponent(escape(unmasked));
  } catch {
    return '';
  }
}
