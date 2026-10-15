// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';

export function getLandingPageMarkup(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}

function getAttribute(attributes: string, name: string): string | undefined {
  return attributes.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

export function assertLandingPageChannel(html: string, channel: 'dev' | 'production'): void {
  const markup = getLandingPageMarkup(html);
  const isDev = channel === 'dev';
  const expectedKey = isDev ? 'navProdChannel' : 'navDevChannel';
  const expectedUrl = isDev ? '../' : './dev/';
  const links = [...markup.matchAll(/<a\b([^>]*)>[\s\S]*?<\/a>/g)]
    .map(([, attributes]) => attributes)
    .filter(attributes => ['navDevChannel', 'navProdChannel'].includes(getAttribute(attributes, 'data-i18n') || ''));

  assert.equal(links.length, 2, 'Desktop and mobile channel links must be present');
  for (const attributes of links) {
    assert.equal(getAttribute(attributes, 'data-i18n'), expectedKey);
    assert.equal(getAttribute(attributes, 'href'), expectedUrl);
  }
  assert.equal(links.filter(attributes => getAttribute(attributes, 'class')?.split(/\s+/).includes('nav-channel-pill')).length, 1);
  assert.equal(links.filter(attributes => getAttribute(attributes, 'class')?.split(/\s+/).includes('mobile-nav-link')).length, 1);

  const banners = [...markup.matchAll(/<aside\b([^>]*)>([\s\S]*?)<\/aside>/g)]
    .filter(([, attributes]) => getAttribute(attributes, 'class')?.split(/\s+/).includes('channel-banner'));
  assert.equal(banners.length, isDev ? 1 : 0);
  if (isDev) {
    const content = banners[0][2];
    assert.match(content, /<span\b[^>]*data-i18n="channelBannerBadge"[^>]*>[\s\S]*?<\/span>/);
    assert.match(content, /<span\b[^>]*data-i18n-html="channelBannerText"[^>]*>[\s\S]*?<\/span>/);
    assert.match(content, /<a\b[^>]*href="\.\.\/"[^>]*>/);
  }
}
