// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

var i18n = {
  en: {
    pageTitle: 'TorrPlay Lampa Plugin v' + '{{PLUGIN_VERSION}}',
    pageDesc: 'TorrPlay plugin for the Lampa media client. Stream torrents on Android TV, Tizen, and WebOS.',
    navBundles: 'Bundles',
    navFeatures: 'Features',
    navInstall: 'Install',
    navDocs: 'Documentation ↗',
    navTorrPlay: 'TorrPlay ↗',
    heroTitle: 'Torrent Streaming for <span class="hero-title-gradient">Lampa</span>',
    heroSubtitle: 'A Lampa plugin for playing torrents, with buffering and a multi-instance pool.',
    prerequisiteTag: 'Prerequisite',
    prerequisiteTitle: 'TorrPlay Application Required',
    prerequisiteText: 'This plugin is a client for Lampa. Torrent streaming requires a running, self-hosted TorrPlay application. Set up TorrPlay first, then connect the plugin to it.',
    prerequisiteLink: 'Set up TorrPlay ↗',
    bundlesTag: 'Files',
    bundlesTitle: 'Plugin Bundles',
    badgeRecommended: 'Production build',
    badgeDev: 'Development build',
    btnCopy: 'Copy URL',
    btnCopied: 'Copied!',
    featuresTag: 'Features',
    featuresTitle: 'Features',
    featPoolTitle: 'Multi-Instance Pool',
    featPoolDesc: 'Pings all TorrPlay instances in parallel, routes to the lowest latency, and fails over if one drops.',
    featPreloadTitle: 'Preload Buffering',
    featPreloadDesc: 'Buffers torrent stream pieces to a readiness threshold before handing off to the player, with poster art and speed stats.',
    featDbTitle: 'Database Torrents',
    featDbDesc: 'Browse database torrents with poster badges, select multi-file episodes, and sync with the Lampa sidebar.',
    featStorageTitle: 'RAM & Disk Storage',
    featStorageDesc: 'Stream in RAM to avoid writing to disk, or use disk storage for large library torrents.',
    featAuthTitle: 'Bearer & Basic Auth',
    featAuthDesc: 'OAuth2 JWT for API control, with short-lived scoped tokens for video stream URLs.',
    featTvTitle: 'TV Remote Support',
    featTvDesc: 'Native Lampa dialogs, masked password entry, and D-pad navigation on Android TV, Tizen, and WebOS.',
    featSearchTitle: 'Jackett & Prowlarr Search',
    featSearchDesc: 'Searches all enabled providers concurrently, tolerates individual failures, removes duplicates, and sorts by seeder count.',
    installTag: 'Setup',
    installTitle: 'How to Install in Lampa',
    step1: 'Open <strong>Lampa</strong> on your TV or device, navigate to <strong>Settings</strong> (<code>Настройки</code>) &rarr; <strong>Extensions</strong> (<code>Расширения</code>).',
    step2: 'Click <strong>Add Plugin</strong> (<code>Добавить плагин</code>).',
    step3: 'Paste the copied <strong>Production URL</strong> (<code>torrplay.min.js</code>) and confirm.',
    step4: 'Restart Lampa. A dedicated <strong>TorrPlay</strong> entry will appear in <strong>Settings</strong> (<code>Настройки</code>) and the main sidebar.',
    channelBannerBadge: 'Dev Preview',
    channelBannerText: 'You are viewing the development channel. For general use, switch to the <a href="../">stable release</a>.',
    navDevChannel: 'Dev Channel ↗',
    navProdChannel: 'Stable Release ↗',
    footer: 'TorrPlay is open-source under the <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: none;">MIT License</a>.'
  },
  ru: {
    pageTitle: 'Плагин TorrPlay для Lampa v' + '{{PLUGIN_VERSION}}',
    pageDesc: 'Плагин TorrPlay для медиаплеера Lampa. Стриминг торрентов на Android TV, Tizen и WebOS.',
    navBundles: 'Сборки',
    navFeatures: 'Возможности',
    navInstall: 'Установка',
    navDocs: 'Документация ↗',
    navTorrPlay: 'TorrPlay ↗',
    channelBannerBadge: 'Dev-канал',
    channelBannerText: 'Вы просматриваете сборку для разработки. Для стабильной работы перейдите на <a href="../">стабильную версию</a>.',
    navDevChannel: 'Dev-сборка ↗',
    navProdChannel: 'Стабильная версия ↗',
    heroTitle: 'Торрент-стриминг для <span class="hero-title-gradient">Lampa</span>',
    heroSubtitle: 'Плагин для воспроизведения торрентов в Lampa с буферизацией и пулом инстансов.',
    prerequisiteTag: 'Требование',
    prerequisiteTitle: 'Требуется приложение TorrPlay',
    prerequisiteText: 'Плагин работает как клиент Lampa. Для просмотра торрентов нужен запущенный экземпляр приложения TorrPlay, развернутый на вашем сервере. Сначала установите и настройте TorrPlay, затем подключите к нему плагин.',
    prerequisiteLink: 'Установить TorrPlay ↗',
    bundlesTag: 'Файлы',
    bundlesTitle: 'Файлы плагина',
    badgeRecommended: 'Стабильная сборка',
    badgeDev: 'Сборка для разработки',
    btnCopy: 'Копировать URL',
    btnCopied: 'Скопировано!',
    featuresTag: 'Возможности',
    featuresTitle: 'Возможности',
    featPoolTitle: 'Пул инстансов',
    featPoolDesc: 'Параллельный пинг всех инстансов TorrPlay, выбор минимальной задержки и переключение при сбое.',
    featPreloadTitle: 'Буферизация перед запуском',
    featPreloadDesc: 'Накопление буфера до порога готовности перед передачей в плеер, с постером и статистикой скорости.',
    featDbTitle: 'База данных торрентов',
    featDbDesc: 'Просмотр раздач с постерами, выбор отдельных серий и синхронизация с боковым меню Lampa.',
    featStorageTitle: 'Хранилище в RAM и на диске',
    featStorageDesc: 'Потоковое воспроизведение через RAM без записи на диск или хранение на диске для больших раздач.',
    featAuthTitle: 'Аутентификация Bearer и Basic',
    featAuthDesc: 'OAuth2 JWT для API и временные токены для ссылок видеопотока.',
    featTvTitle: 'Поддержка пульта ТВ',
    featTvDesc: 'Нативные диалоги Lampa, скрытый ввод паролей и навигация стрелками на Android TV, Tizen и WebOS.',
    featSearchTitle: 'Поиск через Jackett и Prowlarr',
    featSearchDesc: 'Параллельный опрос всех включенных провайдеров, устойчивость к сбоям отдельных источников, удаление дубликатов и сортировка по числу сидов.',
    installTag: 'Установка',
    installTitle: 'Как установить в Lampa',
    step1: 'Откройте <strong>Lampa</strong> на ТВ или устройстве, перейдите в <strong>Настройки</strong> &rarr; <strong>Расширения</strong>.',
    step2: 'Нажмите <strong>Добавить плагин</strong>.',
    step3: 'Вставьте скопированный <strong>Production URL</strong> (<code>torrplay.min.js</code>) и подтвердите.',
    step4: 'Перезапустите Lampa. Раздел <strong>TorrPlay</strong> появится в <strong>Настройках</strong> и в боковом меню.',
    footer: 'TorrPlay — проект с открытым исходным кодом под <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: none;">лицензией MIT</a>.'
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
  document.documentElement.setAttribute('data-lang', lang);
  var langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.textContent = lang === 'en' ? 'RU' : 'EN';
  }

  var dict = i18n[lang] || i18n.en;

  var titleEl = document.getElementById('page-title');
  if (titleEl && dict.pageTitle) titleEl.textContent = dict.pageTitle;

  var descEl = document.getElementById('page-desc');
  if (descEl && dict.pageDesc) descEl.setAttribute('content', dict.pageDesc);

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-html');
    if (dict[key]) {
      el.innerHTML = dict[key];
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

function copyUrl(inputId, buttonId) {
  var input = document.getElementById(inputId);
  var button = document.getElementById(buttonId);
  if (!input || !button) return;

  var currentLang = document.documentElement.getAttribute('data-lang') || 'en';
  var dict = i18n[currentLang] || i18n.en;
  var urlText = input.value;

  var showSuccess = function () {
    button.classList.add('copied');
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>' + (dict.btnCopied || 'Copied!') + '</span>';
    setTimeout(function () {
      button.classList.remove('copied');
      button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span class="copy-text">' + (dict.btnCopy || 'Copy URL') + '</span>';
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
    document.execCommand('copy');
    callback();
      } catch {
    prompt('Copy this plugin URL manually:', inputElement.value);
  }
}
