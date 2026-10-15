// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { Torrent, TorrPlayInstance } from '../types/torrplay';

export const DATABASE_SEARCH_ENABLED_STORAGE_KEY = 'torrplay_database_search';

/** Lists the saved torrents matching query, best match first, as the instance ranks them. */
export async function searchDatabaseTorrents(instance: TorrPlayInstance, query: string): Promise<Torrent[]> {
  const response = await TorrPlayApi.getTorrents(instance, { fuzzy: true, saved: true, search: query });
  return response.torrents || [];
}
