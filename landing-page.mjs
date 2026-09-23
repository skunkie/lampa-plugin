// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const PLACEHOLDERS = {
  BRAND_BADGE: '{{BRAND_BADGE}}',
  CHANNEL_BANNER: '{{CHANNEL_BANNER}}',
  CHANNEL_MOBILE_LINK: '{{CHANNEL_MOBILE_LINK}}',
  CHANNEL_NAV_LINK: '{{CHANNEL_NAV_LINK}}',
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

export function generateLandingPage(
  pluginVersion,
  sourceDirectory = new URL('./landing/', import.meta.url),
  channel = 'production',
) {
  const template = readFileSync(new URL('index.html', sourceDirectory), 'utf8');
  const styles = readFileSync(new URL('styles.css', sourceDirectory), 'utf8').trim();
  const script = readFileSync(new URL('script.js', sourceDirectory), 'utf8').trim();

  const isDev = channel === 'dev';

  const brandBadge = isDev
    ? `<span class="brand-badge brand-badge-dev" title="v${escapeHtml(pluginVersion)}">v${escapeHtml(pluginVersion)}</span>`
    : `<span class="brand-badge" title="v${escapeHtml(pluginVersion)}">v${escapeHtml(pluginVersion)}</span>`;

  const channelNavLink = isDev
    ? '<a href="../" class="nav-channel-pill nav-links-desktop" data-i18n="navProdChannel">Stable Release ↗</a>'
    : '<a href="./dev/" class="nav-channel-pill nav-links-desktop" data-i18n="navDevChannel">Dev Channel ↗</a>';

  const channelMobileLink = isDev
    ? '<a href="../" class="mobile-nav-link" onclick="closeMobileMenu()" data-i18n="navProdChannel">Stable Release ↗</a>'
    : '<a href="./dev/" class="mobile-nav-link" onclick="closeMobileMenu()" data-i18n="navDevChannel">Dev Channel ↗</a>';

  const channelBanner = isDev
    ? `\n  <aside class="channel-banner">
    <div class="channel-banner-inner">
      <span class="channel-banner-badge" data-i18n="channelBannerBadge">Dev Preview</span>
      <span data-i18n-html="channelBannerText">You are viewing the development channel. For general use, switch to the <a href="../">stable release</a>.</span>
    </div>
  </aside>\n`
    : '';

  let html = replaceRequired(template, PLACEHOLDERS.STYLES, styles);
  html = replaceRequired(html, PLACEHOLDERS.SCRIPT, script);
  html = replaceRequired(html, PLACEHOLDERS.PLUGIN_VERSION, escapeHtml(pluginVersion));
  html = replaceRequired(html, PLACEHOLDERS.BRAND_BADGE, brandBadge);
  html = replaceRequired(html, PLACEHOLDERS.CHANNEL_NAV_LINK, channelNavLink);
  html = replaceRequired(html, PLACEHOLDERS.CHANNEL_MOBILE_LINK, channelMobileLink);
  html = replaceRequired(html, PLACEHOLDERS.CHANNEL_BANNER, channelBanner);

  const unresolvedPlaceholder = html.match(/\{\{[A-Z_]+\}\}/);
  if (unresolvedPlaceholder) {
    throw new Error(`Landing page contains unresolved placeholder ${unresolvedPlaceholder[0]}`);
  }

  return html;
}
