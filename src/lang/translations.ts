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
    en: 'Plugin version and build info',
    ru: 'Версия плагина и информация о сборке',
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
    ru: 'Без аутентификации',
  },
  torrplay_auth_none_descr: {
    en: 'No credentials required',
    ru: 'Учетные данные не требуются',
  },
  torrplay_auth_tag: {
    en: 'Auth: {mode}',
    ru: 'Аутентификация: {mode}',
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
  torrplay_card_file_count: {
    en: 'Files: {count}',
    ru: 'Файлов: {count}',
  },
  torrplay_change_active: {
    en: 'Change Active Instance',
    ru: 'Изменить активный инстанс',
  },
  torrplay_change_active_descr: {
    en: 'Choose which instance handles requests',
    ru: 'Выбрать инстанс для обработки запросов',
  },
  torrplay_choice_torrserver: {
    en: 'TorrServer',
    ru: 'TorrServer',
  },
  torrplay_choice_torrserver_descr: {
    en: 'Stream via TorrServer',
    ru: 'Воспроизведение через TorrServer',
  },
  torrplay_confirm_add_name: {
    en: 'Add {name}',
    ru: 'Добавить {name}',
  },
  torrplay_confirm_add_title: {
    en: 'Add Instance?',
    ru: 'Добавить инстанс?',
  },
  torrplay_confirm_delete_descr: {
    en: 'This also removes its saved credentials',
    ru: 'Сохраненные учетные данные тоже удалятся',
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
  torrplay_database_search_descr: {
    en: 'Show saved torrents in Lampa global search',
    ru: 'Сохраненные торренты в общем поиске Lampa',
  },
  torrplay_database_search_name: {
    en: 'TorrPlay Database in Global Search',
    ru: 'База TorrPlay в общем поиске',
  },
  torrplay_database_search_title: {
    en: 'TorrPlay Database',
    ru: 'База TorrPlay',
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
    en: 'TorrPlay client for torrent streaming',
    ru: 'Клиент TorrPlay для стриминга торрентов',
  },
  torrplay_disable_downloader: {
    en: 'Disable Background Downloader',
    ru: 'Отключить фоновый загрузчик',
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
    ru: 'В базе TorrPlay нет торрентов',
  },
  torrplay_empty_no_instances: {
    en: 'No TorrPlay instances are configured.<br>Please add an instance in Settings → TorrPlay → Manage Instance Pool.',
    ru: 'Нет настроенных инстансов TorrPlay.<br>Добавьте инстанс в Настройки → TorrPlay → Управление пулом инстансов.',
  },
  torrplay_empty_no_instances_title: {
    en: 'TorrPlay: No Instances Configured',
    ru: 'TorrPlay: Инстансы не настроены',
  },
  torrplay_empty_search: {
    en: 'No saved torrents match “{query}”',
    ru: 'Нет сохраненных торрентов по запросу «{query}»',
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
    en: 'Enable Background Downloader',
    ru: 'Включить фоновый загрузчик',
  },
  torrplay_enabled_descr: {
    en: 'Torrent playback and search via TorrPlay',
    ru: 'Просмотр и поиск торрентов через TorrPlay',
  },
  torrplay_enabled_name: {
    en: 'Enable TorrPlay',
    ru: 'Включить TorrPlay',
  },
  torrplay_hint_storage_requires_save: {
    en: 'Disk storage requires Save to Database',
    ru: 'Для хранения на диске нужно сохранение в базу',
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
    en: 'Database:',
    ru: 'Сохранение в базе:',
  },
  torrplay_label_storage: {
    en: 'Storage Type:',
    ru: 'Тип хранилища:',
  },
  torrplay_latency_ms: {
    en: '{latency} ms',
    ru: '{latency}\u00A0мс',
  },
  torrplay_manage_pool_descr: {
    en: 'Instances, authentication, and latency checks',
    ru: 'Инстансы, аутентификация и проверка задержки',
  },
  torrplay_manage_pool_name: {
    en: 'Manage Instance Pool',
    ru: 'Управление пулом инстансов',
  },
  torrplay_manage_providers_descr: {
    en: 'Configure Jackett and Prowlarr providers',
    ru: 'Настройка провайдеров Jackett и Prowlarr',
  },
  torrplay_manage_providers_name: {
    en: 'Manage Search Providers',
    ru: 'Управление провайдерами поиска',
  },
  torrplay_menu_delete: {
    en: 'Delete from TorrPlay',
    ru: 'Удалить из TorrPlay',
  },
  torrplay_menu_delete_descr: {
    en: 'Remove torrent and its downloaded data',
    ru: 'Удалить торрент и скачанные данные',
  },
  torrplay_menu_switch_disk: {
    en: 'Switch to Disk',
    ru: 'Переключить на диск',
  },
  torrplay_menu_switch_disk_descr: {
    en: 'Currently stored in RAM',
    ru: 'Сейчас хранится в оперативной памяти',
  },
  torrplay_menu_switch_ram: {
    en: 'Switch to RAM',
    ru: 'Переключить на оперативную память',
  },
  torrplay_menu_switch_ram_descr: {
    en: 'Currently stored on disk',
    ru: 'Сейчас хранится на диске',
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
    ru: 'Подключено! Задержка: {latency}\u00A0мс',
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
    en: 'Background downloader disabled on {name}',
    ru: 'Фоновый загрузчик отключен на {name}',
  },
  torrplay_noty_downloader_enabled: {
    en: 'Background downloader enabled on {name}',
    ru: 'Фоновый загрузчик включен на {name}',
  },
  torrplay_noty_downloader_failed: {
    en: 'Failed to update background downloader: {msg}',
    ru: 'Не удалось переключить фоновый загрузчик: {msg}',
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
    ru: 'TorrPlay: {failed} недоступен → переключено на {next} ({latency}\u00A0мс)',
  },
  torrplay_noty_hash_required: {
    en: 'TorrPlay: Valid magnet link or info hash is required',
    ru: 'TorrPlay: Требуется корректная magnet-ссылка или инфо-хеш',
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
    ru: 'Внимание: инстанс недоступен',
  },
  torrplay_noty_online: {
    en: 'Instance online! Latency: {latency} ms',
    ru: 'Инстанс доступен! Задержка: {latency}\u00A0мс',
  },
  torrplay_noty_pinging_all: {
    en: 'Checking all TorrPlay instances...',
    ru: 'Проверка всех инстансов TorrPlay...',
  },
  torrplay_noty_preload_evicted: {
    en: 'Preload was stopped to free memory',
    ru: 'Предзагрузка остановлена, чтобы освободить память',
  },
  torrplay_noty_preload_failed: {
    en: 'Preload failed: not enough memory or the torrent stopped receiving data',
    ru: 'Предзагрузка не удалась: не хватило памяти или торрент перестал получать данные',
  },
  torrplay_noty_preload_rejected: {
    en: 'TorrPlay refused to preload this file',
    ru: 'TorrPlay отказался предзагружать этот файл',
  },
  torrplay_noty_preload_timeout: {
    en: 'Preload stopped: no data is arriving',
    ru: 'Предзагрузка прервана: данные не поступают',
  },
  torrplay_noty_preload_unauthorized: {
    en: 'TorrPlay rejected the credentials for {name}. Check them in Settings.',
    ru: 'TorrPlay отклонил учетные данные для {name}. Проверьте их в настройках.',
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
    ru: 'Тип хранилища изменен: {storage}',
  },
  torrplay_noty_storage_updated: {
    en: 'Updated storage path on {name}',
    ru: 'Путь к хранилищу на {name} обновлен',
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
    en: 'Playback Options',
    ru: 'Параметры воспроизведения',
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
    en: 'TorrPlay or TorrServer when a torrent starts',
    ru: 'TorrPlay или TorrServer при запуске торрента',
  },
  torrplay_playback_mode_name: {
    en: 'Torrent Playback',
    ru: 'Воспроизведение торрентов',
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
  torrplay_provider_add: {
    en: 'Add Provider',
    ru: 'Добавить провайдер',
  },
  torrplay_provider_add_descr: {
    en: 'Add a Jackett or Prowlarr provider',
    ru: 'Добавить провайдер Jackett или Prowlarr',
  },
  torrplay_provider_confirm_delete_descr: {
    en: 'This also removes its saved API key',
    ru: 'Сохраненный API-ключ также будет удален',
  },
  torrplay_provider_delete: {
    en: 'Delete Provider',
    ru: 'Удалить провайдер',
  },
  torrplay_provider_delete_descr: {
    en: 'Remove this provider from the pool',
    ru: 'Удалить провайдер из пула',
  },
  torrplay_provider_disable: {
    en: 'Disable Provider',
    ru: 'Отключить провайдер',
  },
  torrplay_provider_disable_descr: {
    en: 'Exclude this provider from search',
    ru: 'Исключить провайдер из поиска',
  },
  torrplay_provider_edit_api_key: {
    en: 'Edit API Key',
    ru: 'Изменить API-ключ',
  },
  torrplay_provider_enable: {
    en: 'Enable Provider',
    ru: 'Включить провайдер',
  },
  torrplay_provider_enable_descr: {
    en: 'Include this provider in search',
    ru: 'Включить провайдер в поиск',
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
  torrplay_provider_search_descr: {
    en: 'Results in a separate tab',
    ru: 'Результаты в отдельной вкладке',
  },
  torrplay_provider_search_name: {
    en: 'Show in Global Search',
    ru: 'Показывать в общем поиске',
  },
  torrplay_provider_search_title: {
    en: 'Jackett / Prowlarr',
    ru: 'Jackett / Prowlarr',
  },
  torrplay_provider_switch_type: {
    en: 'Switch Provider Type',
    ru: 'Изменить тип провайдера',
  },
  torrplay_provider_test_all: {
    en: 'Test All Providers',
    ru: 'Проверить все провайдеры',
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
    en: 'Save torrents to the TorrPlay database',
    ru: 'Сохранять торренты в базе TorrPlay',
  },
  torrplay_save_to_db_false: {
    en: 'Never',
    ru: 'Никогда',
  },
  torrplay_save_to_db_name: {
    en: 'Save to Database',
    ru: 'Сохранение в базе',
  },
  torrplay_save_to_db_true: {
    en: 'Always',
    ru: 'Всегда',
  },
  torrplay_save_to_descr: {
    en: 'Save torrent to the database for later',
    ru: 'Сохранить в базу для последующего просмотра',
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
    en: 'Lowest latency or a manually chosen instance',
    ru: 'Выбор по наименьшей задержке или вручную',
  },
  torrplay_selection_mode_manual: {
    en: 'Manual Selection',
    ru: 'Выбор вручную',
  },
  torrplay_selection_mode_name: {
    en: 'Instance Selection',
    ru: 'Выбор инстанса',
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
    ru: '(не задано)',
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
    en: 'Where to keep the torrent during playback',
    ru: 'Место хранения торрента при просмотре',
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
    en: 'Check availability and measure latency',
    ru: 'Проверить доступность и задержку',
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
