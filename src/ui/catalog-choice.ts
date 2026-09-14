// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayEngine } from '../engine/torrplay-engine';
import { translate } from '../lang/translations';

interface CatalogFullEvent {
  body?: LampaDomElement | HTMLElement,
  data?: { movie?: LampaMovie },
  link?: { items?: Array<{ emit(eventName: string): void }> },
  object?: { card?: LampaMovie, movie?: LampaMovie },
  type: string
}

interface CatalogTorrentMenuItem extends LampaSelectItem {
  mark?: boolean,
  tomy?: boolean,
  unmark?: boolean
}

interface CatalogTorrentEvent {
  card?: LampaMovie,
  element: LampaTorrentItem,
  menu?: CatalogTorrentMenuItem[],
  movie?: LampaMovie,
  type: string
}

const TORRPLAY_BUTTON_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10"/>
  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
</svg>
`.trim();

export class CatalogChoice {
  private static isRegistered = false;

  public static init(): void {
    if (this.isRegistered) return;
    this.isRegistered = true;

    if (typeof Lampa === 'undefined' || !Lampa.Listener) return;

    // Hook into Movie Card Details (inject TorrPlay into Sources / button bar)
    Lampa.Listener.follow('full', (event: CatalogFullEvent) => {
      if (!TorrPlayEngine.isEnabled()) return;
      if (event.type !== 'complite' || !event.body) return;

      const globalJquery = (globalThis as typeof globalThis & { $?: LampaJQuery }).$;
      const jquery = typeof globalJquery !== 'undefined' ? globalJquery : window.$;
      if (typeof jquery === 'undefined') return;

      const body = typeof (event.body as LampaDomElement | undefined)?.find === 'function'
        ? event.body as LampaDomElement
        : jquery(event.body);
      if (!body || typeof body.find !== 'function') return;

      if (body.find('.view--torrplay').length) return;

      const subtitle = translate('torrplay_btn_subtitle', 'Torrents via TorrPlay');
      const buttonHtml = `
        <div class="full-start__button selector view--torrplay" data-subtitle="${subtitle}">
          ${TORRPLAY_BUTTON_ICON}
          <span>TorrPlay</span>
        </div>
      `.trim();

      const button = jquery(buttonHtml);

      button.on('hover:enter', () => {
        const movie = event.data?.movie || event.object?.movie || event.object?.card;
        if (!movie) return;

        const title = movie.title || movie.name || '';
        const originalTitle = movie.original_title || movie.original_name || title;
        const year = ((movie.first_air_date || movie.release_date || '0000') + '').slice(0, 4);

        const combinations: Record<string, string> = {
          df: originalTitle,
          df_lg: `${originalTitle} ${title}`.trim(),
          df_lg_year: `${originalTitle} ${title} ${year}`.trim(),
          df_year: `${originalTitle} ${year}`.trim(),
          lg: title,
          lg_df: `${title} ${originalTitle}`.trim(),
          lg_df_year: `${title} ${originalTitle} ${year}`.trim(),
          lg_year: `${title} ${year}`.trim(),
        };

        const parseLang = (typeof Lampa !== 'undefined' && Lampa.Storage?.field?.('parse_lang')) || 'df';
        const searchQuery = combinations[parseLang] || title || originalTitle;

        const movieWithTorrPlay = { ...movie, torrplay: true };

        if (typeof Lampa !== 'undefined' && Lampa.Activity) {
          Lampa.Activity.push({
            component: 'torrents',
            movie: movieWithTorrPlay,
            page: 1,
            search: searchQuery,
            search_one: title,
            search_two: originalTitle,
            title: 'TorrPlay',
            torrplay: true,
            url: '',
          });
        }
      });

      const isAlwaysTorrPlay = TorrPlayEngine.isEnabled() && TorrPlayEngine.getPlaybackMode() === 'torrplay';
      const container = body.find('.buttons--container');
      const target = body.find('.view--torrent');
      if (isAlwaysTorrPlay && target.length) {
        target.addClass('hide');
        target.removeClass('selector');
      }

      if (container.length) {
        container.prepend(button);
      } else if (target.length) {
        target.before(button);
      }

      if (event.link && Array.isArray(event.link.items) && event.link.items[0]) {
        event.link.items[0].emit('groupButtons');
      }
    });

    // Hook into Torrent Cards (Parser / Search results)
    Lampa.Listener.follow('torrent', (event: CatalogTorrentEvent) => {
      if (!TorrPlayEngine.isEnabled()) return;

      if (event.type === 'onlong' && event.menu && Array.isArray(event.menu)) {
        const isAlwaysTorrPlay = TorrPlayEngine.getPlaybackMode() === 'torrplay';
        const viewedList: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
        const isViewed = Boolean(
          event.element?.viewed ||
          (event.element?.hash && viewedList.includes(event.element.hash))
        );

        // Dynamic state toggle for mark/unmark viewed:
        // If already viewed, retain only "unmark"; if unviewed, retain only "mark".
        const nativeItems = event.menu.filter(menuItem => {
          if (isAlwaysTorrPlay && menuItem.tomy) return false;
          if (isViewed && menuItem.mark) return false;
          if (!isViewed && menuItem.unmark) return false;
          return true;
        });

        event.menu.length = 0;

        const movie =
          event.movie ||
          event.card ||
          (typeof Lampa !== 'undefined' && Lampa.Activity?.active?.()?.movie) ||
          (typeof Lampa !== 'undefined' && Lampa.Activity?.active?.()?.card);

        // Structured hierarchy: Play -> Save -> Native actions (Library/Mark)
        event.menu.push({
          onSelect: () => {
            TorrPlayEngine.playTorrentDirect(event.element, movie);
          },
          subtitle: translate('torrplay_play_via_descr', 'Stream via active TorrPlay instance'),
          title: translate('torrplay_play_via', 'Play via TorrPlay'),
        });

        event.menu.push({
          onSelect: () => {
            TorrPlayEngine.saveToDatabase(event.element, movie);
          },
          subtitle: translate('torrplay_save_to_descr', 'Save torrent to instance for later playback'),
          title: translate('torrplay_save_to', 'Save to TorrPlay'),
        });

        event.menu.push(...nativeItems);
      }
    });
  }
}
