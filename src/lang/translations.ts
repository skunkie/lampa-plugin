// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export type SupportedLocale = 'en' | 'ru';

export const TRANSLATIONS: Record<string, Record<SupportedLocale, string>> = {
  torrplay_about_build_commit: {
    en: 'Commit',
    ru: 'Коммит',
  },
  torrplay_about_build_date: {
    en: 'Build Date',
    ru: 'Дата сборки',
  },
  torrplay_about_descr: {
    en: 'View the installed plugin version and build info',
    ru: 'Посмотреть версию плагина и информацию о сборке',
  },
  torrplay_about_name: {
    en: 'About Plugin',
    ru: 'О плагине',
  },
  torrplay_about_title: {
    en: 'About TorrPlay',
    ru: 'О TorrPlay',
  },
  torrplay_about_unknown: {
    en: 'Unknown',
    ru: 'Неизвестно',
  },
  torrplay_about_version: {
    en: 'Version',
    ru: 'Версия',
  },
  torrplay_active_auto_badge: {
    en: ' [Active (Auto)]',
    ru: ' [Активный (Авто)]',
  },
  torrplay_active_badge: {
    en: ' [Active]',
    ru: ' [Активный]',
  },
  torrplay_add_instance: {
    en: 'Add Instance',
    ru: 'Добавить инстанс',
  },
  torrplay_add_instance_descr: {
    en: 'Add a new TorrPlay instance to the pool',
    ru: 'Добавить новый инстанс TorrPlay в пул',
  },
  torrplay_already_saved: {
    en: 'Already in TorrPlay',
    ru: 'Уже в TorrPlay',
  },
  torrplay_already_saved_descr: {
    en: 'Available in the TorrPlay database',
    ru: 'Доступен в базе TorrPlay',
  },
  torrplay_auth_basic_descr: {
    en: 'HTTP Basic authentication',
    ru: 'Аутентификация HTTP Basic',
  },
  torrplay_auth_bearer_descr: {
    en: 'OAuth2 JWT authentication',
    ru: 'Аутентификация OAuth2 JWT',
  },
  torrplay_auth_mode: {
    en: 'Authentication Mode',
    ru: 'Тип аутентификации',
  },
  torrplay_auth_none: {
    en: 'None',
    ru: 'Без авторизации',
  },
  torrplay_auth_none_descr: {
    en: 'No credentials required',
    ru: 'Учетные данные не требуются',
  },
  torrplay_back: {
    en: 'Back',
    ru: 'Назад',
  },
  torrplay_back_to_instances: {
    en: 'Return to instance list',
    ru: 'Вернуться к списку инстансов',
  },
  torrplay_back_to_settings: {
    en: 'Return to TorrPlay settings',
    ru: 'Вернуться в настройки TorrPlay',
  },
  torrplay_btn_start_play: {
    en: 'Start Playback',
    ru: 'Воспроизвести',
  },
  torrplay_btn_subtitle: {
    en: 'Torrents via TorrPlay',
    ru: 'Торренты через TorrPlay',
  },
  torrplay_cancel: {
    en: 'Cancel',
    ru: 'Отмена',
  },
  torrplay_change_active: {
    en: 'Change Active Instance',
    ru: 'Изменить активный инстанс',
  },
  torrplay_change_active_descr: {
    en: 'Choose which instance handles playback',
    ru: 'Выберите инстанс для обработки воспроизведения',
  },
  torrplay_choice_torrserver: {
    en: 'TorrServer / Default',
    ru: 'TorrServer / По умолчанию',
  },
  torrplay_choice_torrserver_descr: {
    en: 'Stream via standard Lampa torrent player',
    ru: 'Воспроизведение через стандартный плеер',
  },
  torrplay_confirm_add_name: {
    en: 'Add {name}',
    ru: 'Добавить {name}',
  },
  torrplay_confirm_add_title: {
    en: 'Confirm Instance',
    ru: 'Подтверждение инстанса',
  },
  torrplay_confirm_delete_descr: {
    en: 'This also removes its saved credentials',
    ru: 'Сохраненные учетные данные также будут удалены',
  },
  torrplay_confirm_delete_name: {
    en: 'Delete {name}',
    ru: 'Удалить {name}',
  },
  torrplay_confirm_delete_title: {
    en: 'Delete Instance?',
    ru: 'Удалить инстанс?',
  },
  torrplay_current_value: {
    en: 'Current: {value}',
    ru: 'Текущее значение: {value}',
  },
  torrplay_delete_instance: {
    en: 'Delete Instance',
    ru: 'Удалить инстанс',
  },
  torrplay_delete_instance_descr: {
    en: 'Remove this instance from pool',
    ru: 'Удалить инстанс из пула',
  },
  torrplay_desc: {
    en: 'Native TorrPlay client for torrent streaming',
    ru: 'Клиент TorrPlay для потоковой передачи торрентов',
  },
  torrplay_disable_downloader: {
    en: 'Disable Downloader',
    ru: 'Отключить загрузчик',
  },
  torrplay_discard_instance: {
    en: 'Discard this instance',
    ru: 'Отменить добавление',
  },
  torrplay_edit_name: {
    en: 'Edit Name',
    ru: 'Изменить название',
  },
  torrplay_edit_password: {
    en: 'Edit Password',
    ru: 'Изменить пароль',
  },
  torrplay_edit_url: {
    en: 'Edit Instance URL',
    ru: 'Изменить URL инстанса',
  },
  torrplay_edit_username: {
    en: 'Edit Username',
    ru: 'Изменить имя пользователя',
  },
  torrplay_empty_conn_error: {
    en: 'Unable to load database torrents: {msg}<br>Please check your instance connection.',
    ru: 'Не удалось загрузить торренты из базы: {msg}<br>Проверьте подключение к инстансу.',
  },
  torrplay_empty_conn_error_title: {
    en: 'TorrPlay: Connection Error',
    ru: 'TorrPlay: Ошибка подключения',
  },
  torrplay_empty_db: {
    en: 'No torrents found in TorrPlay database',
    ru: 'В базе данных TorrPlay нет торрентов',
  },
  torrplay_empty_no_instances: {
    en: 'No TorrPlay instances are configured.<br>Please add an instance in Settings → TorrPlay → Manage Instance Pool.',
    ru: 'Нет настроенных инстансов TorrPlay.<br>Добавьте инстанс в Настройки → TorrPlay → Управление пулом инстансов.',
  },
  torrplay_empty_no_instances_title: {
    en: 'TorrPlay: No Instances Configured',
    ru: 'TorrPlay: Инстансы не настроены',
  },
  torrplay_empty_unreachable: {
    en: 'All configured TorrPlay instances are unreachable.<br>Please check instance status in Settings → TorrPlay → Manage Instance Pool.',
    ru: 'Все настроенные инстансы TorrPlay недоступны.<br>Проверьте статус в Настройки → TorrPlay → Управление пулом инстансов.',
  },
  torrplay_empty_unreachable_title: {
    en: 'TorrPlay: Instances Unreachable',
    ru: 'TorrPlay: Инстансы недоступны',
  },
  torrplay_enable_downloader: {
    en: 'Enable Downloader',
    ru: 'Включить загрузчик',
  },
  torrplay_enabled_descr: {
    en: 'Handle torrent playback and streaming via TorrPlay',
    ru: 'Воспроизведение и стриминг торрентов через TorrPlay',
  },
  torrplay_enabled_name: {
    en: 'Enable TorrPlay',
    ru: 'Включить TorrPlay',
  },
  torrplay_global_search_descr: {
    en: 'Include torrent provider results in Lampa global search',
    ru: 'Показывать результаты провайдеров в общем поиске Lampa',
  },
  torrplay_global_search_name: {
    en: 'Show Torrents in Global Search',
    ru: 'Торренты в общем поиске',
  },
  torrplay_hint_storage_requires_save: {
    en: 'Disk storage requires Save to Database',
    ru: 'Дисковое хранилище требует сохранения в базе',
  },
  torrplay_instance_url_placeholder: {
    en: 'Instance URL (e.g. http://192.168.1.100:8090)',
    ru: 'URL инстанса (например, http://192.168.1.100:8090)',
  },
  torrplay_invalid_credentials_noty: {
    en: 'TorrPlay: Saved credentials for {names} could not be read. Please re-enter the password in Settings.',
    ru: 'TorrPlay: Не удалось прочитать сохраненные учетные данные для {names}. Введите пароль заново в Настройках.',
  },
  torrplay_keep_instance: {
    en: 'Keep this instance',
    ru: 'Оставить инстанс',
  },
  torrplay_label_persistence: {
    en: 'Database Persistence:',
    ru: 'Сохранение в базе:',
  },
  torrplay_label_storage: {
    en: 'Storage Type:',
    ru: 'Тип хранилища:',
  },
  torrplay_manage_pool_descr: {
    en: 'Configure instances, credentials, active instance, and latency benchmarks',
    ru: 'Настройка инстансов, авторизации, активного сервера и проверка задержки',
  },
  torrplay_manage_pool_name: {
    en: 'Manage Instance Pool',
    ru: 'Управление пулом инстансов',
  },
  torrplay_manage_providers_descr: {
    en: 'Configure Jackett/Prowlarr search providers used to find torrents',
    ru: 'Настройка провайдеров поиска Jackett/Prowlarr для поиска торрентов',
  },
  torrplay_manage_providers_name: {
    en: 'Manage Search Providers',
    ru: 'Управление провайдерами поиска',
  },
  torrplay_menu_card_descr: {
    en: 'Open movie card details',
    ru: 'Открыть карточку фильма',
  },
  torrplay_menu_delete: {
    en: 'Delete from TorrPlay',
    ru: 'Удалить из TorrPlay',
  },
  torrplay_menu_delete_descr: {
    en: 'Remove torrent and cached data',
    ru: 'Удалить торрент и кэшированные данные',
  },
  torrplay_menu_switch_disk: {
    en: 'Switch to Disk',
    ru: 'Переключить на диск',
  },
  torrplay_menu_switch_disk_descr: {
    en: 'Currently cached in RAM',
    ru: 'Сейчас кэшируется в оперативной памяти',
  },
  torrplay_menu_switch_ram: {
    en: 'Switch to RAM',
    ru: 'Переключить на оперативную память',
  },
  torrplay_menu_switch_ram_descr: {
    en: 'Currently stored on disk',
    ru: 'Сейчас сохранено на диске',
  },
  torrplay_noty_added: {
    en: 'Added {name} to pool',
    ru: 'Инстанс {name} добавлен в пул',
  },
  torrplay_noty_added_db: {
    en: 'TorrPlay: "{title}" added to database!',
    ru: 'TorrPlay: «{title}» добавлен в базу!',
  },
  torrplay_noty_cannot_delete_only: {
    en: 'Cannot delete the only instance in pool',
    ru: 'Нельзя удалить единственный инстанс в пуле',
  },
  torrplay_noty_connected: {
    en: 'Connected! Latency: {latency} ms',
    ru: 'Подключено! Задержка: {latency} мс',
  },
  torrplay_noty_delete_failed: {
    en: 'Failed to delete: {msg}',
    ru: 'Не удалось удалить: {msg}',
  },
  torrplay_noty_deleted: {
    en: 'Deleted {name}',
    ru: 'Инстанс {name} удален',
  },
  torrplay_noty_deleted_from_tp: {
    en: 'Torrent deleted from TorrPlay',
    ru: 'Торрент удален из TorrPlay',
  },
  torrplay_noty_downloader_disabled: {
    en: 'Downloader disabled on {name}',
    ru: 'Загрузчик отключен на {name}',
  },
  torrplay_noty_downloader_enabled: {
    en: 'Downloader enabled on {name}',
    ru: 'Загрузчик включен на {name}',
  },
  torrplay_noty_downloader_failed: {
    en: 'Failed to update downloader: {msg}',
    ru: 'Не удалось переключить загрузчик: {msg}',
  },
  torrplay_noty_duplicate_url: {
    en: 'An instance with this URL already exists',
    ru: 'Инстанс с таким URL уже существует',
  },
  torrplay_noty_error: {
    en: 'TorrPlay: {msg}',
    ru: 'TorrPlay: {msg}',
  },
  torrplay_noty_failed_connect: {
    en: 'Failed to connect to {url}',
    ru: 'Не удалось подключиться к {url}',
  },
  torrplay_noty_failover: {
    en: 'TorrPlay: {failed} offline → Switched to {next} ({latency} ms)',
    ru: 'TorrPlay: {failed} офлайн → Переключено на {next} ({latency} мс)',
  },
  torrplay_noty_hash_required: {
    en: 'TorrPlay: Valid magnet link or info hash is required',
    ru: 'TorrPlay: Требуется корректная magnet-ссылка или инфо-хэш',
  },
  torrplay_noty_no_instances: {
    en: 'Add an instance to the pool first',
    ru: 'Сначала добавьте инстанс в пул',
  },
  torrplay_noty_no_video: {
    en: 'No video files found in torrent',
    ru: 'В торренте не найдены видеофайлы',
  },
  torrplay_noty_offline_warning: {
    en: 'Warning: Instance is offline or unreachable',
    ru: 'Внимание: инстанс офлайн или недоступен',
  },
  torrplay_noty_online: {
    en: 'Instance online! Latency: {latency} ms',
    ru: 'Инстанс онлайн! Задержка: {latency} мс',
  },
  torrplay_noty_pinging_all: {
    en: 'Pinging all TorrPlay instances...',
    ru: 'Проверка всех инстансов TorrPlay...',
  },
  torrplay_noty_preload_timeout: {
    en: 'Preload timed out',
    ru: 'Время ожидания предзагрузки истекло',
  },
  torrplay_noty_save_error: {
    en: 'TorrPlay Save Error: {msg}',
    ru: 'Ошибка сохранения в TorrPlay: {msg}',
  },
  torrplay_noty_selected_active: {
    en: 'Selected {name} as active instance',
    ru: 'Инстанс {name} выбран активным',
  },
  torrplay_noty_storage_failed: {
    en: 'Failed to update storage path: {msg}',
    ru: 'Не удалось обновить путь к хранилищу: {msg}',
  },
  torrplay_noty_storage_switch_failed: {
    en: 'Failed to switch storage: {msg}',
    ru: 'Не удалось переключить хранилище: {msg}',
  },
  torrplay_noty_storage_switched: {
    en: 'Storage switched to {storage}',
    ru: 'Хранилище переключено на {storage}',
  },
  torrplay_noty_storage_updated: {
    en: 'Updated storage path on {name}',
    ru: 'Путь к хранилищу обновлен на {name}',
  },
  torrplay_noty_testing: {
    en: 'Testing {url}...',
    ru: 'Проверка {url}...',
  },
  torrplay_noty_url_updated: {
    en: 'Instance URL updated',
    ru: 'URL инстанса обновлен',
  },
  torrplay_noty_valid_url: {
    en: 'Enter a valid HTTP or HTTPS instance URL',
    ru: 'Укажите корректный HTTP или HTTPS URL инстанса',
  },
  torrplay_opt_dont_save: {
    en: 'Do Not Save (Temporary)',
    ru: 'Не сохранять (временно)',
  },
  torrplay_opt_remember: {
    en: "Remember choice (don't ask again)",
    ru: 'Запомнить выбор (больше не спрашивать)',
  },
  torrplay_opt_save_db: {
    en: 'Save to Database',
    ru: 'Сохранить в базу',
  },
  torrplay_options_title: {
    en: 'TorrPlay Options',
    ru: 'Параметры TorrPlay',
  },
  torrplay_play_title: {
    en: 'Play: {title}',
    ru: 'Воспроизведение: {title}',
  },
  torrplay_play_via: {
    en: 'Play via TorrPlay',
    ru: 'Смотреть через TorrPlay',
  },
  torrplay_play_via_descr: {
    en: 'Stream via active TorrPlay instance',
    ru: 'Воспроизведение через активный инстанс',
  },
  torrplay_playback_mode_ask: {
    en: 'Ask Before Play (TorrPlay / TorrServer)',
    ru: 'Спрашивать перед просмотром (TorrPlay / TorrServer)',
  },
  torrplay_playback_mode_context: {
    en: 'Manual (Context Menu & Button)',
    ru: 'Вручную (кнопка и меню)',
  },
  torrplay_playback_mode_descr: {
    en: 'How to handle torrent playback selection in Lampa',
    ru: 'Способ выбора плеера при открытии торрентов',
  },
  torrplay_playback_mode_name: {
    en: 'Player in Catalog & Cards',
    ru: 'Плеер в каталоге и карточках',
  },
  torrplay_playback_mode_torrplay: {
    en: 'Always TorrPlay',
    ru: 'Всегда TorrPlay',
  },
  torrplay_pool_auto_mode: {
    en: 'Auto Mode',
    ru: 'Автоматический режим',
  },
  torrplay_pool_manual_mode: {
    en: 'Manual Mode',
    ru: 'Ручной режим',
  },
  torrplay_pool_title: {
    en: 'TorrPlay Pool ({mode})',
    ru: 'Пул TorrPlay ({mode})',
  },
  torrplay_preload_descr: {
    en: 'Buffer pieces before opening the player',
    ru: 'Буферизация частей перед запуском плеера',
  },
  torrplay_preload_name: {
    en: 'Preload Stream',
    ru: 'Предзагрузка потока',
  },
  torrplay_provider_add: {
    en: 'Add Provider',
    ru: 'Добавить провайдера',
  },
  torrplay_provider_add_descr: {
    en: 'Add a new Jackett or Prowlarr search provider',
    ru: 'Добавить новый провайдер поиска Jackett или Prowlarr',
  },
  torrplay_provider_confirm_delete_descr: {
    en: 'This also removes its saved API key',
    ru: 'Сохраненный API-ключ также будет удален',
  },
  torrplay_provider_delete: {
    en: 'Delete Provider',
    ru: 'Удалить провайдера',
  },
  torrplay_provider_delete_descr: {
    en: 'Remove this provider from the pool',
    ru: 'Удалить провайдера из пула',
  },
  torrplay_provider_disable: {
    en: 'Disable Provider',
    ru: 'Отключить провайдера',
  },
  torrplay_provider_disable_descr: {
    en: 'Exclude this provider from search',
    ru: 'Исключить провайдера из поиска',
  },
  torrplay_provider_edit_api_key: {
    en: 'Edit API Key',
    ru: 'Изменить API-ключ',
  },
  torrplay_provider_enable: {
    en: 'Enable Provider',
    ru: 'Включить провайдера',
  },
  torrplay_provider_enable_descr: {
    en: 'Include this provider in search',
    ru: 'Включить провайдера в поиск',
  },
  torrplay_provider_invalid_credentials_noty: {
    en: 'TorrPlay: Saved API keys for {names} could not be read. Please re-enter them in Settings.',
    ru: 'TorrPlay: Не удалось прочитать сохраненные API-ключи для {names}. Введите их заново в Настройках.',
  },
  torrplay_provider_noty_added: {
    en: 'Added {name} to pool',
    ru: 'Провайдер {name} добавлен в пул',
  },
  torrplay_provider_noty_deleted: {
    en: 'Deleted {name}',
    ru: 'Провайдер {name} удален',
  },
  torrplay_provider_noty_pinging_all: {
    en: 'Testing all search providers...',
    ru: 'Проверка всех провайдеров поиска...',
  },
  torrplay_provider_pool_title: {
    en: 'Torrent Search Providers',
    ru: 'Провайдеры поиска торрентов',
  },
  torrplay_provider_switch_type: {
    en: 'Switch Provider Type',
    ru: 'Изменить тип провайдера',
  },
  torrplay_provider_test_all: {
    en: 'Test All Providers',
    ru: 'Проверить всех провайдеров',
  },
  torrplay_provider_test_all_descr: {
    en: 'Test latency across all providers',
    ru: 'Проверить задержку всех провайдеров',
  },
  torrplay_save_to: {
    en: 'Save to TorrPlay',
    ru: 'Сохранить в TorrPlay',
  },
  torrplay_save_to_db_ask: {
    en: 'Ask Before Play',
    ru: 'Спрашивать перед просмотром',
  },
  torrplay_save_to_db_descr: {
    en: 'Save torrent in TorrPlay database or stream temporarily',
    ru: 'Сохранять торрент в базе TorrPlay или воспроизводить временно',
  },
  torrplay_save_to_db_false: {
    en: 'Do Not Save',
    ru: 'Не сохранять',
  },
  torrplay_save_to_db_name: {
    en: 'Database Persistence',
    ru: 'Сохранение в базе данных',
  },
  torrplay_save_to_db_true: {
    en: 'Save to Database',
    ru: 'Сохранять в базу',
  },
  torrplay_save_to_descr: {
    en: 'Save torrent to instance for later playback',
    ru: 'Сохранить на инстансе для последующего просмотра',
  },
  torrplay_select_active_title: {
    en: 'Select Active Instance',
    ru: 'Выбор активного инстанса',
  },
  torrplay_selection_mode_auto: {
    en: 'Auto (Lowest Latency)',
    ru: 'Авто (наименьшая задержка)',
  },
  torrplay_selection_mode_descr: {
    en: 'Auto-route to lowest-latency instance or use manually selected active instance',
    ru: 'Автоматический выбор по наименьшей задержке или вручную',
  },
  torrplay_selection_mode_manual: {
    en: 'Manual Selection',
    ru: 'Выбор вручную',
  },
  torrplay_selection_mode_name: {
    en: 'Instance Pool Selection',
    ru: 'Выбор инстанса в пуле',
  },
  torrplay_settings_name: {
    en: 'TorrPlay',
    ru: 'TorrPlay',
  },
  torrplay_status_checking: {
    en: 'Checking...',
    ru: 'Проверка...',
  },
  torrplay_status_disabled: {
    en: 'Disabled',
    ru: 'Отключено',
  },
  torrplay_status_enabled: {
    en: 'Enabled',
    ru: 'Включено',
  },
  torrplay_status_not_set: {
    en: '(not set)',
    ru: '(не задан)',
  },
  torrplay_status_offline: {
    en: 'Offline',
    ru: 'Офлайн',
  },
  torrplay_status_unknown: {
    en: 'Unknown',
    ru: 'Неизвестно',
  },
  torrplay_storage_path: {
    en: 'File Storage Path',
    ru: 'Путь к файловому хранилищу',
  },
  torrplay_storage_type_ask: {
    en: 'Ask Before Play',
    ru: 'Спрашивать перед просмотром',
  },
  torrplay_storage_type_descr: {
    en: 'Where TorrPlay caches pieces during playback',
    ru: 'Где кэшировать части торрента при воспроизведении',
  },
  torrplay_storage_type_disk: {
    en: 'Disk',
    ru: 'Диск',
  },
  torrplay_storage_type_name: {
    en: 'Storage Type',
    ru: 'Тип хранилища',
  },
  torrplay_storage_type_ram: {
    en: 'RAM',
    ru: 'Оперативная память',
  },
  torrplay_test_all: {
    en: 'Test All Instances',
    ru: 'Проверить все инстансы',
  },
  torrplay_test_all_descr: {
    en: 'Test latency across all pool instances',
    ru: 'Проверить задержку всех инстансов в пуле',
  },
  torrplay_test_conn: {
    en: 'Test Connection',
    ru: 'Проверить подключение',
  },
  torrplay_test_conn_descr: {
    en: 'Ping health endpoint and measure response time',
    ru: 'Проверить статус и измерить время ответа',
  },
  torrplay_value_none: {
    en: '(none)',
    ru: '(нет)',
  },
};

/**
 * Registers all plugin translations in Lampa.Lang if available.
 */
export function initTranslations(): void {
  if (typeof Lampa !== 'undefined' && Lampa.Lang && typeof Lampa.Lang.add === 'function') {
    Lampa.Lang.add(TRANSLATIONS);
  }
}

/**
 * Translates a given key with optional parameter substitution and English fallback.
 */
export function translate(
  key: string,
  fallback?: string,
  parameters?: Record<string, number | string>
): string {
  let result = fallback ?? key;

  if (typeof Lampa !== 'undefined' && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
    const translated = Lampa.Lang.translate(key);
    if (translated && translated !== key) {
      result = translated;
    }
  }

  if (parameters) {
    Object.keys(parameters).forEach(param => {
      result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), String(parameters[param]));
    });
  }

  return result;
}
