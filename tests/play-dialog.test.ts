// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  PlayDialog,
  SAVE_TO_DATABASE_STORAGE_KEY,
  STORAGE_TYPE_STORAGE_KEY,
} from '../src/ui/play-dialog';

describe('PlayDialog', () => {
  const controls = new Map<string, any>();
  const storage = new Map<string, any>();
  let activeController = '';
  let closeCount = 0;
  let modalOptions: any = null;

  beforeEach(() => {
    activeController = '';
    closeCount = 0;
    controls.clear();
    modalOptions = null;
    storage.clear();
    storage.set(SAVE_TO_DATABASE_STORAGE_KEY, 'ask');
    storage.set(STORAGE_TYPE_STORAGE_KEY, 'ask');

    const createControl = () => {
      const classes = new Set(['selector']);
      const listeners = new Map<string, () => void>();
      let isChecked = false;
      const control: any = {
        classes,
        listeners,
        addClass: (className: string) => { classes.add(className); return control; },
        css: () => control,
        on: (event: string, callback: () => void) => {
          listeners.set(event, callback);
          return control;
        },
        prop: (name: string, value?: boolean) => {
          if (name !== 'checked') return undefined;
          if (value !== undefined) {
            isChecked = value;
            return control;
          }
          return isChecked;
        },
        removeClass: (className: string) => { classes.delete(className); return control; },
        text: () => control,
      };
      return control;
    };

    (globalThis as any).$ = () => ({
      find: (selector: string) => {
        if (!controls.has(selector)) controls.set(selector, createControl());
        return controls.get(selector);
      },
    });
    (globalThis as any).Lampa = {
      Controller: {
        enabled: () => ({ name: 'content' }),
        toggle: (name: string) => {
          activeController = name;
        },
      },
      Modal: {
        close: () => {
          closeCount++;
        },
        open: (options: any) => {
          modalOptions = options;
        },
      },
      Storage: {
        get: (key: string, fallback: any) => storage.has(key) ? storage.get(key) : fallback,
        set: (key: string, value: any) => storage.set(key, value),
      },
      Utils: {
        clearHtmlTags: (value: string) => value,
      },
    };
  });

  it('closes once and restores the launching controller on Back', async () => {
    const resultPromise = PlayDialog.resolveOptions('Movie');

    assert.ok(modalOptions);
    modalOptions.onBack();
    modalOptions.onBack();

    assert.equal(await resultPromise, null);
    assert.equal(closeCount, 1);
    assert.equal(activeController, 'content');
  });

  it('uses one native activation handler for every modal control', async () => {
    const resultPromise = PlayDialog.resolveOptions('Movie');
    const selectors = [
      '.torrplay-opt-storage',
      '.torrplay-opt-savedb',
      '.torrplay-opt-remember',
      '.torrplay-btn-play',
    ];

    for (const selector of selectors) {
      const events = Array.from(controls.get(selector).listeners.keys());
      assert.deepEqual(events, ['hover:enter']);
    }

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();

    assert.deepEqual(await resultPromise, {
      saveToDb: false,
      storage: 'memory',
    });
    assert.equal(closeCount, 1);
    assert.equal(activeController, 'content');
  });

  it('toggles Remember choice through the focusable remote control', async () => {
    const resultPromise = PlayDialog.resolveOptions('Movie');
    const rememberControl = controls.get('.torrplay-opt-remember');
    const rememberCheckbox = controls.get('.torrplay-opt-remember input');

    rememberControl.listeners.get('hover:enter')();
    assert.equal(rememberCheckbox.prop('checked'), true);

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();
    await resultPromise;

    assert.equal(storage.get(STORAGE_TYPE_STORAGE_KEY), 'memory');
    assert.equal(storage.get(SAVE_TO_DATABASE_STORAGE_KEY), 'false');
  });

  it('removes disabled storage from D-pad navigation and restores it when enabled', async () => {
    const resultPromise = PlayDialog.resolveOptions('Movie');
    const storageControl = controls.get('.torrplay-opt-storage');
    const saveDbControl = controls.get('.torrplay-opt-savedb');

    assert.equal(storageControl.classes.has('selector'), false);
    assert.equal(storageControl.classes.has('torrplay-opt-disabled'), true);

    saveDbControl.listeners.get('hover:enter')();
    assert.equal(storageControl.classes.has('selector'), true);
    assert.equal(storageControl.classes.has('torrplay-opt-disabled'), false);

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();
    await resultPromise;
  });

  it('ignores storage toggle while Save to Database is off, and re-enables it once turned on', async () => {
    const resultPromise = PlayDialog.resolveOptions('Movie');
    assert.ok(modalOptions);

    const storageControl = controls.get('.torrplay-opt-storage');
    const saveDbControl = controls.get('.torrplay-opt-savedb');

    // Save to Database defaults to off (storage key is 'ask' in beforeEach) — toggling storage must be a no-op.
    storageControl.listeners.get('hover:enter')();
    saveDbControl.listeners.get('hover:enter')(); // turn Save to Database on
    storageControl.listeners.get('hover:enter')(); // now toggles memory -> file

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();

    assert.deepEqual(await resultPromise, {
      saveToDb: true,
      storage: 'file',
    });
  });

  it('forces storage back to memory when Save to Database is turned off after selecting file storage', async () => {
    const resultPromise = PlayDialog.resolveOptions('Movie');
    assert.ok(modalOptions);

    const storageControl = controls.get('.torrplay-opt-storage');
    const saveDbControl = controls.get('.torrplay-opt-savedb');

    saveDbControl.listeners.get('hover:enter')(); // turn Save to Database on
    storageControl.listeners.get('hover:enter')(); // memory -> file
    saveDbControl.listeners.get('hover:enter')(); // turn Save to Database back off

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();

    assert.deepEqual(await resultPromise, {
      saveToDb: false,
      storage: 'memory',
    });
  });

  it('defaults database persistence to false in Ask mode unless the user opts in', async () => {
    storage.set(SAVE_TO_DATABASE_STORAGE_KEY, 'ask');

    const resultPromise = PlayDialog.resolveOptions('Movie');
    assert.ok(modalOptions);

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();

    assert.deepEqual(await resultPromise, {
      saveToDb: false,
      storage: 'memory',
    });
  });

  it('bypasses modal and returns saveToDb=false when setting is false', async () => {
    storage.set(STORAGE_TYPE_STORAGE_KEY, 'memory');
    storage.set(SAVE_TO_DATABASE_STORAGE_KEY, 'false');

    const result = await PlayDialog.resolveOptions('Movie');
    assert.deepEqual(result, {
      saveToDb: false,
      storage: 'memory',
    });
    assert.equal(modalOptions, null);
  });

  it('bypasses modal and returns saveToDb=true when setting is true', async () => {
    storage.set(STORAGE_TYPE_STORAGE_KEY, 'file');
    storage.set(SAVE_TO_DATABASE_STORAGE_KEY, 'true');

    const result = await PlayDialog.resolveOptions('Movie');
    assert.deepEqual(result, {
      saveToDb: true,
      storage: 'file',
    });
    assert.equal(modalOptions, null);
  });

  it('initializes modal with shouldSaveToDatabase=false when database setting is false and storage is ask', async () => {
    storage.set(STORAGE_TYPE_STORAGE_KEY, 'ask');
    storage.set(SAVE_TO_DATABASE_STORAGE_KEY, 'false');

    const resultPromise = PlayDialog.resolveOptions('Movie');
    assert.ok(modalOptions);

    controls.get('.torrplay-btn-play').listeners.get('hover:enter')();
    assert.deepEqual(await resultPromise, {
      saveToDb: false,
      storage: 'memory',
    });
  });

  it('bypasses modal and defaults saveToDb to false when storage key is unset', async () => {
    storage.delete(STORAGE_TYPE_STORAGE_KEY);
    storage.delete(SAVE_TO_DATABASE_STORAGE_KEY);

    const result = await PlayDialog.resolveOptions('Movie');
    assert.deepEqual(result, {
      saveToDb: false,
      storage: 'memory',
    });
    assert.equal(modalOptions, null);
  });
});
