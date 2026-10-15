// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { isTorrentViewed, setTorrentViewed } from '../engine/engine-utils';
import { ProviderSearchResult } from '../types/provider';

export type MediaTagKind = 'audio' | 'channels' | 'resolution' | 'subtitle' | 'video';

export interface MediaTag {
  kind: MediaTagKind,
  value: string
}

/**
 * A search tab row as Lampa's global search hands it around: `results` is the list Lampa
 * counts and passes back on selection, and `params.createInstance` builds what it renders.
 */
export interface ProviderResultRowData {
  params?: { createInstance: (row: ProviderResultRowData) => ProviderResultRow },
  result: ProviderSearchResult,
  results: LampaParserResultItem[]
}

interface ProviderResultRowHandlers {
  onBack?: () => void,
  onDown?: () => void,
  onInstance?: (item: SelectableResult, playbackItem: LampaParserResultItem) => void,
  onUp?: () => void
}

interface SelectableResult {
  use(handlers: { onEnter?: () => void }): void
}

interface ViewedMenuItem extends LampaSelectItem {
  mark?: boolean,
  unmark?: boolean
}

const AUDIO_NAME_MAX_LENGTH = 20;
const CONTROLLER_NAME = 'torrplay_provider_result';
const SUBTITLE_TAG_LIMIT = 4;

const RESOLUTION_LABELS: Record<number, string> = {
  1080: 'FHD',
  1440: '2K',
  2160: '4K',
  360: 'SD',
  480: 'SD',
  720: 'HD',
};

function describeResolution(height: number): string {
  return RESOLUTION_LABELS[height] || `${height}p`;
}

function resolutionFromWidth(width: number): number {
  if (width >= 3830) return 2160;
  if (width >= 2550) return 1440;
  if (width >= 1910) return 1080;
  if (width >= 1014) return 720;
  if (width >= 710) return 480;
  if (width >= 630) return 360;
  return 0;
}

/**
 * Prepares text for Lampa's template filling, which inserts each value into HTML through a
 * plain string replacement: markup is dropped, the characters HTML would read as markup are
 * escaped, `$` is doubled so the replacement keeps it literally, and `{` is written as an
 * entity so text such as `{size}` is not filled by a later value.
 */
function toTemplateText(text: string): string {
  const withoutMarkup = Lampa.Utils?.clearHtmlTags ? Lampa.Utils.clearHtmlTags(text) : text;
  return withoutMarkup
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\$/g, '$$$$');
}

/**
 * Formats a release date through Lampa's date formatter, which reads only the text before the
 * first letter `t` and so misreads anything but a plain `YYYY-MM-DD` date. The date is parsed
 * here and handed over in that form, in local time.
 */
function formatPublishedDate(value?: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return Lampa.Utils.parseTime(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`).full;
}

function shortenText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function translateLampa(key: string, fallback: string): string {
  const translated = typeof Lampa !== 'undefined' ? Lampa.Lang?.translate(key) : '';
  return translated && translated !== key ? translated : fallback;
}

function describeAudioStream(stream: LampaFfprobeStream, voices: string[]): string {
  const language = (stream.tags?.language || '').toUpperCase();
  let name = stream.tags?.title || stream.tags?.handler_name || '';
  const matchedVoice = voices.find(voice => name.toLowerCase().includes(voice.toLowerCase()));
  if (matchedVoice) voices.splice(voices.indexOf(matchedVoice), 1);

  const parts: string[] = [];
  if (language) parts.push(language);
  if (name && language !== 'ENG') {
    name = matchedVoice || name;
    const lowerName = name.toLowerCase();
    if (lowerName.includes('dub') || lowerName === 'd') {
      name = translateLampa('torrent_parser_voice_dubbing', 'Dubbing');
    }
    parts.push(shortenText(name.charAt(0).toUpperCase() + name.slice(1), AUDIO_NAME_MAX_LENGTH));
  }
  return parts.join(' - ');
}

/**
 * Summarises the release's quality, video, audio and subtitle streams as the short tags
 * shown under a torrent title, most significant first and without duplicates.
 */
export function buildMediaTags(result: ProviderSearchResult): MediaTag[] {
  const streams = result.ffprobe || [];
  const tags: MediaTag[] = [];
  const video = streams.find(stream => stream.codec_type === 'video');

  if (result.info?.quality) {
    tags.push({ kind: 'resolution', value: describeResolution(result.info.quality) });
  } else if (video?.width) {
    const height = resolutionFromWidth(video.width);
    if (height) tags.push({ kind: 'resolution', value: describeResolution(height) });
  }
  if (video?.width && video.height) tags.push({ kind: 'video', value: `${video.width}x${video.height}` });

  if (streams.some(stream => stream.codec_type === 'audio' && stream.channels === 8)) {
    tags.push({ kind: 'channels', value: '7.1' });
  }
  if (streams.some(stream => stream.codec_type === 'audio' && stream.channels === 6)) {
    tags.push({ kind: 'channels', value: '5.1' });
  }

  const remainingVoices = [...(result.info?.voices || [])];
  streams
    .filter(stream => stream.codec_type === 'audio' && stream.tags)
    .forEach(stream => {
      const description = describeAudioStream(stream, remainingVoices);
      if (description) tags.push({ kind: 'audio', value: description });
    });
  remainingVoices.forEach(voice => tags.push({ kind: 'audio', value: voice }));

  const subtitleLanguages = streams
    .filter(stream => stream.codec_type === 'subtitle' && stream.tags?.language)
    .map(stream => (stream.tags?.language || '').toUpperCase())
    .filter((language, index, languages) => languages.indexOf(language) === index);
  subtitleLanguages
    .slice(0, SUBTITLE_TAG_LIMIT)
    .forEach(language => tags.push({ kind: 'subtitle', value: language }));
  if (subtitleLanguages.length > SUBTITLE_TAG_LIMIT) {
    tags.push({ kind: 'subtitle', value: `+${subtitleLanguages.length - SUBTITLE_TAG_LIMIT}` });
  }

  return tags.filter((tag, index) => tags.findIndex(other => other.kind === tag.kind && other.value === tag.value) === index);
}

/**
 * One provider result shown as a full-width torrent row in the global search tab, laid out
 * with Lampa's own torrent row template. Lampa's search tab stacks its rows vertically and
 * moves focus between them, so each result is a row of its own and the tab's result count
 * equals the number of torrents found.
 */
export class ProviderResultRow {
  private container: HTMLElement | null = null;
  private handlers: ProviderResultRowHandlers = {};
  private onEnter: (() => void) | null = null;
  private rowElement: LampaDomElement | null = null;

  public constructor(private readonly data: ProviderResultRowData) {}

  private get playbackItem(): LampaParserResultItem {
    return this.data.results[0];
  }

  public use(handlers: ProviderResultRowHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public create(): void {
    const { result } = this.data;
    const publishedDate = formatPublishedDate(result.publishedAt);
    const row = Lampa.Template.get('torrent', {
      date: toTemplateText(publishedDate),
      grabs: result.leechers,
      seeds: result.seeders,
      size: result.sizeBytes ? Lampa.Utils.bytesToSize(result.sizeBytes) : '',
      title: toTemplateText(result.title),
      tracker: toTemplateText(result.tracker || ''),
    }) as LampaDomElement;

    row.find('.bitrate').remove();
    if (!publishedDate) row.find('.torrent-item__date').remove();
    if (!result.sizeBytes) row.find('.torrent-item__size').remove();

    const tags = buildMediaTags(result);
    if (tags.length > 0) {
      const tagList = row.find('.torrent-item__ffprobe');
      tags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = `m-${tag.kind}`;
        tagElement.textContent = tag.value;
        tagList.append(tagElement);
      });
      tagList.removeClass('hide');
    }

    row.on('hover:enter', () => this.onEnter?.());
    row.on('hover:long', () => this.showActions());

    // Each row sits in a wrapper of its own, so Lampa's spacing between neighbouring torrent rows
    // never applies; the wrapper takes the list's side padding and the gap below each row.
    this.container = document.createElement('div');
    this.container.className = 'torrent-list';
    this.container.style.paddingBottom = '1em';
    this.container.append(row[0]);
    this.rowElement = row;
    this.updateViewedMarker();

    this.handlers.onInstance?.({ use: handlers => { this.onEnter = handlers.onEnter || null; } }, this.playbackItem);
    Lampa.Listener.send('torrent', { element: this.playbackItem, item: row, type: 'render' });
  }

  public render(asElement?: boolean): HTMLElement | LampaDomElement {
    const container = this.container || document.createElement('div');
    const jquery = (globalThis as typeof globalThis & { $?: LampaJQuery }).$;
    return asElement || !jquery ? container : jquery(container);
  }

  public toggle(): void {
    Lampa.Controller.add(CONTROLLER_NAME, {
      back: () => this.handlers.onBack?.(),
      down: () => this.handlers.onDown?.(),
      left: () => {},
      link: this,
      right: () => {},
      toggle: () => {
        this.updateViewedMarker();
        Lampa.Controller.collectionSet(this.container);
        Lampa.Controller.collectionFocus(this.rowElement?.[0] || false, this.container);
      },
      up: () => this.handlers.onUp?.(),
    });
    Lampa.Controller.toggle(CONTROLLER_NAME);
  }

  public destroy(): void {
    this.container?.remove();
    this.container = null;
    this.rowElement = null;
  }

  private updateViewedMarker(): void {
    if (!this.rowElement) return;
    const hash = this.playbackItem.hash;
    const shouldShow = isTorrentViewed(hash);
    this.playbackItem.viewed = shouldShow;
    const marker = this.rowElement.find('.torrent-item__viewed');
    if (shouldShow && marker.length === 0) {
      this.rowElement.append(`<div class="torrent-item__viewed">${Lampa.Template.get('icon_viewed', {}, true)}</div>`);
    } else if (!shouldShow && marker.length > 0) {
      marker.remove();
    }
  }

  private showActions(): void {
    const returnController = Lampa.Controller.enabled?.()?.name || CONTROLLER_NAME;
    const menu: ViewedMenuItem[] = [
      {
        mark: true,
        subtitle: translateLampa('torrent_parser_label_descr', 'Mark torrent as viewed'),
        title: translateLampa('torrent_parser_label_title', 'Label'),
      },
      {
        subtitle: translateLampa('torrent_parser_label_cancel_descr', 'Remove view label'),
        title: translateLampa('torrent_parser_label_cancel_title', 'Remove label'),
        unmark: true,
      },
    ];

    // Search results belong to no catalog card, so the torrent's own title stands in for one, as it
    // does when the row is played; without it, actions would take the card of the page behind search.
    Lampa.Listener.send('torrent', {
      element: this.playbackItem,
      item: this.rowElement,
      menu,
      movie: { title: this.playbackItem.Title },
      type: 'onlong',
    });

    Lampa.Select.show({
      items: menu,
      onBack: () => Lampa.Controller.toggle(returnController),
      onSelect: (selectedItem: ViewedMenuItem) => {
        if (selectedItem.mark || selectedItem.unmark) {
          setTorrentViewed(this.playbackItem.hash, Boolean(selectedItem.mark));
          this.updateViewedMarker();
        }
        Lampa.Controller.toggle(returnController);
      },
      title: translateLampa('title_action', 'Action'),
    });
  }
}

export function attachRowFactory(row: ProviderResultRowData): void {
  row.params = { createInstance: data => new ProviderResultRow(data) };
}
