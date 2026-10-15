// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

var i18n = {
  en: {
    badgeDev: 'Development build',
    badgeRecommended: 'Production build',
    btnCopied: 'Copied!',
    btnCopy: 'Copy URL',
    bundlesTag: 'Files',
    bundlesTitle: 'Plugin Bundles',
    channelBannerBadge: 'Dev Preview',
    channelBannerText: 'You are viewing the development channel. For general use, switch to the <a href="../">stable release</a>.',
    copyManually: 'Copy this plugin URL manually:',
    featAuthDesc: 'OAuth2 JWT for API control, with short-lived scoped tokens for video stream URLs.',
    featAuthTitle: 'Bearer & Basic Auth',
    featDbDesc: 'Browse database torrents with poster badges, select multi-file episodes, and sync with the Lampa sidebar.',
    featDbTitle: 'Database Torrents',
    featPoolDesc: 'Pings all TorrPlay instances in parallel, routes to the lowest latency, and fails over if one drops.',
    featPoolTitle: 'Multi-Instance Pool',
    featPreloadDesc: 'Buffers torrent stream pieces to a readiness threshold before handing off to the player, with poster art and speed stats.',
    featPreloadTitle: 'Preload Buffering',
    featSearchDesc: 'Searches all enabled providers concurrently, tolerates individual failures, removes duplicates, and sorts by seeder count.',
    featSearchTitle: 'Jackett & Prowlarr Search',
    featStorageDesc: 'Stream in RAM to avoid writing to disk, or use disk storage for large library torrents.',
    featStorageTitle: 'RAM & Disk Storage',
    featTvDesc: 'Native Lampa dialogs, masked password entry, and D-pad navigation on Android TV, Tizen, and WebOS.',
    featTvTitle: 'TV Remote Support',
    featuresTag: 'Features',
    featuresTitle: 'Features',
    footer: 'TorrPlay is open-source under the <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: none;">MIT License</a>.',
    heroSubtitle: 'A Lampa plugin for playing torrents, with buffering and a multi-instance pool.',
    heroTitle: 'Torrent Streaming for <span class="hero-title-gradient">Lampa</span>',
    installTag: 'Setup',
    installTitle: 'How to Install in Lampa',
    labelLanguage: 'Toggle language',
    labelMenu: 'Toggle mobile menu',
    labelRepository: 'GitHub Repository',
    labelTheme: 'Toggle Dark/Light Mode',
    navBundles: 'Bundles',
    navDevChannel: 'Dev Channel ↗',
    navDocs: 'Documentation ↗',
    navFeatures: 'Features',
    navInstall: 'Install',
    navProdChannel: 'Stable Release ↗',
    navTorrPlay: 'TorrPlay ↗',
    pageDescription: 'TorrPlay plugin for the Lampa media client. Stream torrents on Android TV, Tizen, and WebOS.',
    pageTitle: 'TorrPlay Lampa Plugin v' + '{{PLUGIN_VERSION}}',
    prerequisiteLink: 'Set up TorrPlay ↗',
    prerequisiteTag: 'Prerequisite',
    prerequisiteText: 'This plugin is a client for Lampa. Torrent streaming requires a running, self-hosted TorrPlay application. Set up TorrPlay first, then connect the plugin to it.',
    prerequisiteTitle: 'TorrPlay Application Required',
    step1: 'Open <strong>Lampa</strong> on your TV or device, navigate to <strong>Settings</strong> &rarr; <strong>Extensions</strong>.',
    step2: 'Click <strong>Add Plugin</strong>.',
    step3: 'Paste the copied <strong>Production URL</strong> (<code>torrplay.min.js</code>) and confirm.',
    step4: 'Restart Lampa. A dedicated <strong>TorrPlay</strong> entry will appear in <strong>Settings</strong> and the main sidebar.'
  },
  ru: {
    badgeDev: 'Сборка для разработки',
    badgeRecommended: 'Стабильная сборка',
    btnCopied: 'Скопировано!',
    btnCopy: 'Копировать URL',
    bundlesTag: 'Файлы',
    bundlesTitle: 'Файлы плагина',
    channelBannerBadge: 'Сборка для разработки',
    channelBannerText: 'Вы просматриваете сборку для разработки. Для стабильной работы перейдите на <a href="../">стабильную версию</a>.',
    copyManually: 'Скопируйте URL плагина вручную:',
    featAuthDesc: 'OAuth2 JWT для API и временные токены для ссылок видеопотока.',
    featAuthTitle: 'Аутентификация Bearer и Basic',
    featDbDesc: 'Просмотр раздач с постерами, выбор отдельных серий и синхронизация с боковым меню Lampa.',
    featDbTitle: 'База данных торрентов',
    featPoolDesc: 'Параллельная проверка задержки всех инстансов TorrPlay, выбор самого быстрого и переключение при сбое.',
    featPoolTitle: 'Пул инстансов',
    featPreloadDesc: 'Накопление буфера до порога готовности перед передачей в плеер, с постером и статистикой скорости.',
    featPreloadTitle: 'Предзагрузка',
    featSearchDesc: 'Параллельный опрос всех включенных провайдеров, устойчивость к сбоям отдельных источников, удаление дубликатов и сортировка по числу сидов.',
    featSearchTitle: 'Поиск через Jackett и Prowlarr',
    featStorageDesc: 'Потоковое воспроизведение из оперативной памяти без записи на диск или хранение на диске для больших раздач.',
    featStorageTitle: 'Оперативная память и диск',
    featTvDesc: 'Нативные диалоги Lampa, скрытый ввод паролей и навигация стрелками на Android TV, Tizen и WebOS.',
    featTvTitle: 'Поддержка пульта ТВ',
    featuresTag: 'Возможности',
    featuresTitle: 'Возможности',
    footer: 'TorrPlay — проект с открытым исходным кодом под <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: none;">лицензией MIT</a>.',
    heroSubtitle: 'Плагин для воспроизведения торрентов в Lampa с предзагрузкой и пулом инстансов.',
    heroTitle: 'Торрент-стриминг для <span class="hero-title-gradient">Lampa</span>',
    installTag: 'Установка',
    installTitle: 'Как установить в Lampa',
    labelLanguage: 'Сменить язык',
    labelMenu: 'Открыть или закрыть меню',
    labelRepository: 'Репозиторий на GitHub',
    labelTheme: 'Сменить светлую или темную тему',
    navBundles: 'Сборки',
    navDevChannel: 'Разработка ↗',
    navDocs: 'Документация ↗',
    navFeatures: 'Возможности',
    navInstall: 'Установка',
    navProdChannel: 'Стабильная версия ↗',
    navTorrPlay: 'TorrPlay ↗',
    pageDescription: 'Плагин TorrPlay для медиаплеера Lampa. Стриминг торрентов на Android TV, Tizen и WebOS.',
    pageTitle: 'Плагин TorrPlay для Lampa v' + '{{PLUGIN_VERSION}}',
    prerequisiteLink: 'Установить TorrPlay ↗',
    prerequisiteTag: 'Требование',
    prerequisiteText: 'Плагин работает как клиент Lampa. Для просмотра торрентов нужен запущенный инстанс TorrPlay, развернутый на вашем сервере. Сначала установите и настройте TorrPlay, затем подключите к нему плагин.',
    prerequisiteTitle: 'Требуется приложение TorrPlay',
    step1: 'Откройте <strong>Lampa</strong> на ТВ или устройстве, перейдите в <strong>Настройки</strong> &rarr; <strong>Расширения</strong>.',
    step2: 'Нажмите <strong>Добавить плагин</strong>.',
    step3: 'Вставьте скопированный <strong>URL стабильной сборки</strong> (<code>torrplay.min.js</code>) и подтвердите.',
    step4: 'Перезапустите Lampa. Раздел <strong>TorrPlay</strong> появится в <strong>Настройках</strong> и в боковом меню.'
  }
};

(function () {
  var isFileProtocol = window.location.protocol === 'file:';
  var origin = window.location.origin || '';
  var pathname = (window.location.pathname || '').replace(/\/[^/]*$/, '');
  var baseUrl = isFileProtocol
    ? 'https://your-domain.example.com/dist'
    : (origin + pathname).replace(/\/+$/, '');

  var minInput = document.getElementById('url-min');
  var devInput = document.getElementById('url-dev');
  if (minInput) minInput.value = baseUrl + '/torrplay.min.js';
  if (devInput) devInput.value = baseUrl + '/torrplay.js';

  var lang = document.documentElement.getAttribute('data-lang') || 'en';
  setLanguage(lang);
  updateThemeIcons();
})();

function toggleTheme() {
  var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  try {
    localStorage.setItem('torrplay-theme', newTheme);
  } catch {}
  updateThemeIcons();
}

function updateThemeIcons() {
  var theme = document.documentElement.getAttribute('data-theme') || 'dark';
  var sunIcon = document.getElementById('theme-icon-sun');
  var moonIcon = document.getElementById('theme-icon-moon');
  if (sunIcon && moonIcon) {
    if (theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }
}

function toggleLanguage() {
  var currentLang = document.documentElement.getAttribute('data-lang') || 'en';
  var newLang = currentLang === 'en' ? 'ru' : 'en';
  setLanguage(newLang);
  try {
    localStorage.setItem('torrplay-lang', newLang);
  } catch {}
}

function setLanguage(lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('data-lang', lang);
  var languageButton = document.getElementById('lang-toggle');
  if (languageButton) {
    languageButton.textContent = lang === 'en' ? 'RU' : 'EN';
  }

  var dictionary = i18n[lang] || i18n.en;

  document.querySelectorAll('[data-docs-url]').forEach(function (element) {
    var path = lang === 'ru' ? '/blob/HEAD/README.ru.md' : '#readme';
    element.setAttribute('href', element.getAttribute('data-docs-url') + path);
  });

  var titleElement = document.getElementById('page-title');
  if (titleElement && dictionary.pageTitle) titleElement.textContent = dictionary.pageTitle;

  var descriptionElement = document.getElementById('page-description');
  if (descriptionElement && dictionary.pageDescription) descriptionElement.setAttribute('content', dictionary.pageDescription);

  document.querySelectorAll('[data-i18n]').forEach(function (element) {
    var key = element.getAttribute('data-i18n');
    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });

  document.querySelectorAll('[data-i18n-html]').forEach(function (element) {
    var key = element.getAttribute('data-i18n-html');
    if (dictionary[key]) {
      element.innerHTML = dictionary[key];
    }
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(function (element) {
    var key = element.getAttribute('data-i18n-aria');
    if (dictionary[key]) {
      element.setAttribute('aria-label', dictionary[key]);
    }
  });
}

function toggleMobileMenu() {
  var menu = document.getElementById('mobile-menu');
  var hamburgerIcon = document.getElementById('hamburger-icon');
  var closeIcon = document.getElementById('close-icon');
  if (!menu) return;
  var isOpen = menu.classList.contains('active');
  if (isOpen) {
    closeMobileMenu();
  } else {
    menu.classList.add('active');
    if (hamburgerIcon) hamburgerIcon.style.display = 'none';
    if (closeIcon) closeIcon.style.display = 'block';
  }
}

function closeMobileMenu() {
  var menu = document.getElementById('mobile-menu');
  var hamburgerIcon = document.getElementById('hamburger-icon');
  var closeIcon = document.getElementById('close-icon');
  if (menu) menu.classList.remove('active');
  if (hamburgerIcon) hamburgerIcon.style.display = 'block';
  if (closeIcon) closeIcon.style.display = 'none';
}

document.addEventListener('click', function (e) {
  var navbar = document.querySelector('.navbar');
  if (navbar && !navbar.contains(e.target)) {
    closeMobileMenu();
  }
});

function renderCopyButton(button, isCopied) {
  var currentLang = document.documentElement.getAttribute('data-lang') || 'en';
  var dictionary = i18n[currentLang] || i18n.en;
  var key = isCopied ? 'btnCopied' : 'btnCopy';
  var icon = isCopied
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  button.innerHTML = icon + '<span class="copy-text" data-i18n="' + key + '">' + dictionary[key] + '</span>';
}

function copyUrl(inputId, buttonId) {
  var input = document.getElementById(inputId);
  var button = document.getElementById(buttonId);
  if (!input || !button) return;

  var urlText = input.value;

  var showSuccess = function () {
    button.classList.add('copied');
    renderCopyButton(button, true);
    setTimeout(function () {
      button.classList.remove('copied');
      renderCopyButton(button, false);
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(urlText).then(showSuccess).catch(function () {
      fallbackCopy(input, showSuccess);
    });
  } else {
    fallbackCopy(input, showSuccess);
  }
}

function fallbackCopy(inputElement, callback) {
  inputElement.select();
  inputElement.setSelectionRange(0, 99999);
  try {
    if (document.execCommand('copy')) {
      callback();
      return;
    }
  } catch {}
  var currentLang = document.documentElement.getAttribute('data-lang') || 'en';
  var dictionary = i18n[currentLang] || i18n.en;
  prompt(dictionary.copyManually, inputElement.value);
}
