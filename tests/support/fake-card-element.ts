// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export interface FakeImage {
  onerror?: () => void,
  onload?: () => void,
  src: string
}

/**
 * Stands in for the jQuery-wrapped markup of a saved torrent's card: it keeps the markup it was
 * built from, answers the parts the card code reads and changes, and records listeners, added
 * classes and prepended overlays.
 */
export class FakeCardElement {
  public readonly 0: { classList: { contains: (className: string) => boolean } };
  public readonly classes = new Set<string>();
  public readonly image: FakeImage = { src: '' };
  public isRemoved = false;
  public isViewed: boolean;
  public readonly listeners = new Map<string, () => void>();
  public readonly overlays: unknown[] = [];

  public constructor(public readonly markup: string) {
    this.isViewed = markup.includes('card__icon--viewed');
    this[0] = { classList: { contains: className => this.classes.has(className) } };
  }

  public append(): this {
    return this;
  }

  public addClass(className: string): this {
    this.classes.add(className);
    return this;
  }

  public find(selector: string): any {
    switch (selector) {
      case '.card__img':
        return { 0: this.image, attr: (name: string, value: string) => { (this.image as any)[name] = value; } };
      case '.card__icons-inner':
        return {
          append: () => { this.isViewed = true; },
          find: () => ({ length: this.isViewed ? 1 : 0 }),
          length: 1,
        };
      case '.card__icon--viewed':
        return { length: this.isViewed ? 1 : 0, remove: () => { this.isViewed = false; } };
      case '.card-watched':
        return { length: this.overlays.length };
      case '.card__view':
        return { prepend: (overlay: unknown) => this.overlays.push(overlay) };
      default:
        return { length: 0 };
    }
  }

  public on(eventName: string, callback: () => void): this {
    this.listeners.set(eventName, callback);
    return this;
  }

  public remove(): void {
    this.isRemoved = true;
  }

  public text(): this {
    return this;
  }
}

export function installFakeJquery(): FakeCardElement[] {
  const cards: FakeCardElement[] = [];
  (globalThis as any).$ = (markup: string) => {
    const card = new FakeCardElement(markup);
    cards.push(card);
    return card;
  };
  return cards;
}
