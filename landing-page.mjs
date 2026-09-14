// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const PLACEHOLDERS = {
  PLUGIN_VERSION: '{{PLUGIN_VERSION}}',
  SCRIPT: '{{LANDING_SCRIPT}}',
  STYLES: '{{LANDING_STYLES}}',
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceRequired(source, placeholder, replacement) {
  if (!source.includes(placeholder)) {
    throw new Error(`Landing page template is missing required placeholder ${placeholder}`);
  }
  return source.split(placeholder).join(replacement);
}

export function generateLandingPage(pluginVersion, sourceDirectory = new URL('./landing/', import.meta.url)) {
  const template = readFileSync(new URL('index.html', sourceDirectory), 'utf8');
  const styles = readFileSync(new URL('styles.css', sourceDirectory), 'utf8').trim();
  const script = readFileSync(new URL('script.js', sourceDirectory), 'utf8').trim();

  let html = replaceRequired(template, PLACEHOLDERS.STYLES, styles);
  html = replaceRequired(html, PLACEHOLDERS.SCRIPT, script);
  html = replaceRequired(html, PLACEHOLDERS.PLUGIN_VERSION, escapeHtml(pluginVersion));

  const unresolvedPlaceholder = html.match(/\{\{[A-Z_]+\}\}/);
  if (unresolvedPlaceholder) {
    throw new Error(`Landing page contains unresolved placeholder ${unresolvedPlaceholder[0]}`);
  }

  return html;
}
