// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

/**
 * Extracts movie data from explicit context or currently active Lampa activity.
 */
export function resolveMovieContext(movieContext?: unknown): LampaMovie | undefined {
  const isObject = (item: unknown): item is Record<string, unknown> =>
    Boolean(item && typeof item === 'object');

  const isMovieLike = (item: unknown): item is LampaMovie => {
    if (!isObject(item) || typeof item.find === 'function' || typeof item.attr === 'function') return false;
    return Boolean(
      item.id !== undefined ||
      item.title ||
      item.name ||
      item.original_title ||
      item.original_name ||
      item.poster_path ||
      item.poster ||
      item.img
    );
  };

  const unwrap = (item: unknown): LampaMovie | undefined => {
    if (!isObject(item)) return undefined;
    if (isMovieLike(item.card)) return item.card;
    if (isMovieLike(item.movie)) return item.movie;
    if (isMovieLike(item)) return item;
    return undefined;
  };

  const direct = unwrap(movieContext);
  if (direct) return direct;

  if (typeof Lampa !== 'undefined' && Lampa.Activity) {
    const active = Lampa.Activity.active?.();
    const activeMovie = unwrap(active?.movie) || unwrap(active?.card) || unwrap(active);
    if (activeMovie && activeMovie.id !== undefined) return activeMovie;

    if (typeof Lampa.Activity.all === 'function') {
      const activities = Lampa.Activity.all() || [];
      for (let i = activities.length - 1; i >= 0; i--) {
        const act = activities[i];
        const stackMovie = unwrap(act?.movie) || unwrap(act?.card) || unwrap(act);
        if (stackMovie && stackMovie.id !== undefined) return stackMovie;
      }
    }

    if (activeMovie) return activeMovie;
  }

  return undefined;
}

/**
 * Resolves an absolute, downloadable poster URL for TorrPlay database and preload screens.
 */
export function resolvePosterUrl(torrentItem?: { img?: string, poster?: string }, movieContext?: unknown): string {
  const movie = resolveMovieContext(movieContext);

  const candidates: Array<string | undefined | null> = [
    torrentItem?.poster,
    torrentItem?.img,
    movie?.poster_path,
    movie?.poster,
    movie?.img,
    movie?.backdrop_path,
    movie?.background_image,
    movie?.profile_path,
  ];

  let rawPoster = '';
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (
        trimmed &&
        !trimmed.includes('img_broken') &&
        !trimmed.startsWith('./') &&
        !trimmed.startsWith('data:image/svg+xml;base64,PHN2Zy')
      ) {
        rawPoster = trimmed;
        break;
      }
    }
  }

  if (!rawPoster) return '';

  if (rawPoster.startsWith('//')) {
    return `https:${rawPoster}`;
  }

  if (
    rawPoster.startsWith('http://') ||
    rawPoster.startsWith('https://') ||
    rawPoster.startsWith('data:image/')
  ) {
    return rawPoster;
  }

  if (typeof Lampa !== 'undefined' && Lampa.Api && typeof Lampa.Api.img === 'function') {
    try {
      const lampaImg = Lampa.Api.img(rawPoster, 'w500');
      if (
        typeof lampaImg === 'string' &&
        (lampaImg.startsWith('http://') || lampaImg.startsWith('https://'))
      ) {
        return lampaImg;
      }
    } catch {} // Lampa.Api.img is an optional API — failure falls through to the next resolver.
  }

  if (typeof Lampa !== 'undefined' && Lampa.TMDB && typeof Lampa.TMDB.img === 'function') {
    try {
      const tmdbImg = Lampa.TMDB.img(rawPoster, 'w500');
      if (
        typeof tmdbImg === 'string' &&
        (tmdbImg.startsWith('http://') || tmdbImg.startsWith('https://'))
      ) {
        return tmdbImg;
      }
    } catch {} // Lampa.TMDB.img is an optional API — failure falls through to the TMDB CDN URL fallback.
  }

  const cleanPath = rawPoster.startsWith('/') ? rawPoster : `/${rawPoster}`;
  return `https://image.tmdb.org/t/p/w500${cleanPath}`;
}
