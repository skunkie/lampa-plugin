// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { translate } from '../lang/translations';
import { PlayOptions, TorrentStorage } from '../types/torrplay';

export const SAVE_TO_DATABASE_STORAGE_KEY = 'torrplay_save_to_db';
export const STORAGE_TYPE_STORAGE_KEY = 'torrplay_storage_type';

export class PlayDialog {
  public static async resolveOptions(title?: string): Promise<PlayOptions | null> {
    const rawStorage = Lampa.Storage.get<unknown>(STORAGE_TYPE_STORAGE_KEY, 'memory');
    const rawSaveToDb = Lampa.Storage.get<unknown>(SAVE_TO_DATABASE_STORAGE_KEY, 'false');

    const savedStorageType = String(rawStorage ?? 'memory');
    const isAskStorage = savedStorageType === 'ask';

    const isAskDatabase = rawSaveToDb === 'ask' || String(rawSaveToDb) === 'ask';
    const isSaveToDatabase = !isAskDatabase &&
      rawSaveToDb !== false && rawSaveToDb !== 'false' && rawSaveToDb !== 0 && rawSaveToDb !== '0';

    // If neither setting is set to "ask", return directly
    if (!isAskStorage && !isAskDatabase) {
      return {
        saveToDb: isSaveToDatabase,
        // Disk storage is only meaningful for a persisted torrent; the server
        // always loads a non-persisted (Do Not Save) torrent into memory.
        storage: (isSaveToDatabase && savedStorageType === 'file' ? 'file' : 'memory') as TorrentStorage,
      };
    }

    return new Promise<PlayOptions | null>(resolve => {
      let currentStorage: TorrentStorage = savedStorageType === 'file' ? 'file' : 'memory';
      let shouldSaveToDatabase = isSaveToDatabase;
      if (!shouldSaveToDatabase) {
        currentStorage = 'memory';
      }
      let shouldRememberChoice = false;
      let isSettled = false;
      const returnController = Lampa.Controller?.enabled?.().name || 'content';

      const defaultTitle = translate('torrplay_options_title', 'TorrPlay Options');
      const storageLabel = translate('torrplay_label_storage', 'Storage Type:');
      const persistenceLabel = translate('torrplay_label_persistence', 'Database Persistence:');
      const ramText = translate('torrplay_storage_type_ram', 'RAM');
      const diskText = translate('torrplay_storage_type_disk', 'Disk');
      const saveDbText = translate('torrplay_opt_save_db', 'Save to Database');
      const dontSaveText = translate('torrplay_opt_dont_save', 'Do Not Save (Temporary)');
      const rememberText = translate('torrplay_opt_remember', "Remember choice (don't ask again)");
      const playText = translate('torrplay_btn_start_play', 'Start Playback');
      const storageHintText = translate('torrplay_hint_storage_requires_save', 'Disk storage requires Save to Database');

      const rootElement = $(`
        <div class="torrplay-options-modal" style="padding: 1.5em; font-size: 1.1em;">
          <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 1em; color: #fff;">
            ${title ? Lampa.Utils.clearHtmlTags(title) : defaultTitle}
          </div>

          <div style="margin-bottom: 1.2em;">
            <div style="color: #aaa; margin-bottom: 0.4em;">${storageLabel}</div>
            <div class="torrplay-opt-storage selector" style="display: inline-block; padding: 0.5em 1em; border-radius: 0.4em; background: #2a2a2a; color: #fff; cursor: pointer;">
              ${currentStorage === 'memory' ? ramText : diskText}
            </div>
            <div class="torrplay-opt-storage-hint" style="display: none; margin-top: 0.4em; color: #888; font-size: 0.85em;">
              ${storageHintText}
            </div>
          </div>

          <div style="margin-bottom: 1.2em;">
            <div style="color: #aaa; margin-bottom: 0.4em;">${persistenceLabel}</div>
            <div class="torrplay-opt-savedb selector" style="display: inline-block; padding: 0.5em 1em; border-radius: 0.4em; background: #2a2a2a; color: #fff; cursor: pointer;">
              ${shouldSaveToDatabase ? saveDbText : dontSaveText}
            </div>
          </div>

          <div style="margin-bottom: 1.5em;">
            <div class="torrplay-opt-remember selector" style="display: flex; align-items: center; cursor: pointer; color: #ccc;">
              <input type="checkbox" style="margin-right: 0.6em; width: 1.2em; height: 1.2em; pointer-events: none;" />
              ${rememberText}
            </div>
          </div>

          <div>
            <div class="torrplay-btn-play selector" style="display: inline-block; padding: 0.7em 2em; border-radius: 0.4em; background: #e50914; color: #fff; font-weight: bold; cursor: pointer;">
              ${playText}
            </div>
          </div>
        </div>
      `);

      const storageButton = rootElement.find('.torrplay-opt-storage');
      const storageHint = rootElement.find('.torrplay-opt-storage-hint');
      const saveToDatabaseButton = rootElement.find('.torrplay-opt-savedb');
      const rememberChoiceControl = rootElement.find('.torrplay-opt-remember');
      const rememberChoiceCheckbox = rootElement.find('.torrplay-opt-remember input');
      const playButton = rootElement.find('.torrplay-btn-play');

      const updateStorageAvailability = () => {
        storageButton.text(currentStorage === 'memory' ? ramText : diskText);
        if (shouldSaveToDatabase) {
          storageButton.addClass('selector').removeClass('torrplay-opt-disabled').css({ cursor: 'pointer', opacity: 1 });
          storageHint.css('display', 'none');
        } else {
          storageButton.removeClass('selector').addClass('torrplay-opt-disabled').css({ cursor: 'default', opacity: 0.4 });
          storageHint.css('display', 'block');
        }
      };

      updateStorageAvailability();

      storageButton.on('hover:enter', () => {
        if (!shouldSaveToDatabase) return;
        currentStorage = currentStorage === 'memory' ? 'file' : 'memory';
        updateStorageAvailability();
      });

      saveToDatabaseButton.on('hover:enter', () => {
        shouldSaveToDatabase = !shouldSaveToDatabase;
        saveToDatabaseButton.text(shouldSaveToDatabase ? saveDbText : dontSaveText);
        if (!shouldSaveToDatabase) {
          currentStorage = 'memory';
        }
        updateStorageAvailability();
      });

      rememberChoiceControl.on('hover:enter', () => {
        shouldRememberChoice = !shouldRememberChoice;
        rememberChoiceCheckbox.prop('checked', shouldRememberChoice);
      });

      const closeDialog = (result: PlayOptions | null) => {
        if (isSettled) return;
        isSettled = true;
        Lampa.Modal.close();
        Lampa.Controller.toggle(returnController);
        resolve(result);
      };

      playButton.on('hover:enter', () => {
        if (shouldRememberChoice) {
          Lampa.Storage.set(STORAGE_TYPE_STORAGE_KEY, currentStorage);
          Lampa.Storage.set(SAVE_TO_DATABASE_STORAGE_KEY, shouldSaveToDatabase ? 'true' : 'false');
        }
        closeDialog({ saveToDb: shouldSaveToDatabase, storage: currentStorage });
      });

      Lampa.Modal.open({
        html: rootElement,
        mask: true,
        onBack: () => {
          closeDialog(null);
        },
        size: 'medium',
        title: 'TorrPlay',
      });
    });
  }
}
