---
name: russian-technical-translation
description: Guidelines and principles for translating and writing natural, idiomatic Russian technical documentation for software and developer tools. Use this skill whenever writing, translating, or reviewing Russian documentation (content/ru/) to avoid mechanical translation, English grammatical calques, and awkward passive phrasing.
---

<!--
SPDX-FileCopyrightText: 2026 TorrPlay

SPDX-License-Identifier: MIT
-->

# Russian Technical Translation Skill

This skill provides principles, terminology, and editorial guidelines for writing and translating documentation and UI copy into natural, technically fluent Russian.

## Core Objective

Documentation and UI copy in Russian must read as if originally authored by an experienced Russian-speaking systems engineer or technical writer. It must **never** feel like a mechanical, word-for-word translation (calque) from English.

---

## 1. Major Anti-Patterns of Mechanical Translation

### A. Overuse of Passive Voice & Copula Verbs ("является", "быть")

- **Mechanical:** `TorrPlay является приложением для потоковой передачи торрентов.`
- **Natural:** `TorrPlay — приложение для потоковой передачи торрентов.`
- **Mechanical:** `Этот токен может быть использован внешними плеерами.`
- **Natural:** `Этот токен используют внешние плееры.` / `Токен подходит для внешних плееров.`

### B. Long Chains of Genitive Case (Нанизывание родительного падежа)

- **Mechanical:** `Процесс генерации токена аутентификации пользователя для получения доступа к потоку...`
- **Natural:** `Создание токена доступа к потоку...`

### C. Bureaucratic & Wordy Calques (Канцелярит и буквализм)

| Mechanical Translation    | Natural Russian                                             | Context / Rationale                                                                                               |
| :------------------------ | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| в целях обеспечения       | чтобы / для                                                 | Simplify bureaucratic fluff                                                                                       |
| при осуществлении запуска | при запуске                                                 | Avoid split verbs with "осуществление"                                                                            |
| данный / соответствующий  | этот / нужный / omit                                        | Avoid unnecessary demonstratives                                                                                  |
| в экземпляре включена     | в TorrPlay включена                                         | "Экземпляр" is often a clunky calque for "instance"                                                               |
| позволяет вам выполнять   | позволяет выполнять / вы можете                             | Avoid literal "allows you to"                                                                                     |
| предоставляет возможность | умеет / поддерживает / позволяет                            | Avoid pompous phrases                                                                                             |
| под капотом               | внутри / на уровне движка                                   | "Under the hood" calque                                                                                           |
| бесшовный / бесшовно      | плавно / без разрывов / напрямую                            | Overused corporate buzzword                                                                                       |
| обогащение / обогатить    | добавление / загрузка / обновление                          | Avoid "обогащение" and its derivatives (calque of "enrich/enrichment")                                            |
| медиа-маршруты            | эндпоинты стриминга / запросы к видеопотокам или плейлистам | Literal calque of "media routes"; specify actual endpoints or operations                                          |
| прямо из / прямо в        | из / в / внутри / omit                                      | Unnecessary emphatic particle calqued from "directly from / right in"; avoid unless critical to distinguish paths |
| конечная точка            | эндпоинт / маршрут API                                      | Literal calque of "endpoint"; use standard developer terminology                                                  |
| бандл приложения          | пакет приложения                                            | Calque of macOS "application bundle"                                                                              |
| построен на базе          | написан на / разработан на                                  | Wordy calque of "built on top of"                                                                                 |
| уровень severity          | уровень важности                                            | Mixed-language calque for log severity level                                                                      |
| нативная поддержка        | встроенная поддержка                                        | Calque of "native support" when referring to browser/platform built-in features                                   |
| ридеры (потоков)          | потоки чтения / воспроизведения                             | Literal calque of stream "readers" (io.Reader)                                                                    |

### D. Clunky Prepositional Phrases

- **Mechanical:** `В случае если вы забыли пароль...`
- **Natural:** `Если вы забыли пароль...`
- **Mechanical:** `При нажатии на кнопку в веб-интерфейсе авторизованного пользователя сгенерированная ссылка содержит...`
- **Natural:** `Если нажать кнопку в веб-интерфейсе после входа, ссылка сразу содержит...`

### E. Pronoun Usage & Capitalization of "вы"

- **Never capitalize «Вы» / «Ваш»** with an uppercase «В» in technical documentation or UI copy. Uppercase «Вы» is an outdated 19th-century epistolary convention or overly aggressive marketing tone. Always write lowercase `вы`, `вас`, `вам`, `ваш`.
- **Omit unnecessary personal pronouns**:
  - **Mechanical:** `Откройте ваши настройки и укажите ваш URL сервера.`
  - **Natural:** `Откройте настройки и укажите URL сервера.`

### F. Letter «Ё» Policy

- Maintain consistent letter usage across all pages: use `е` consistently in technical documentation and UI strings.
- Retain `ё` only when necessary to prevent semantic ambiguity (e.g. `все` vs `всё`, `узнаем` vs `узнаём`).

### G. Colloquial Developer Slang (Разговорный жаргон)

Documentation must maintain a professional and polished technical tone. Avoid spoken/chat developer slang:

- **Colloquial:** `бинарник` → **Professional:** `исполняемый файл` / `бинарный файл`
- **Colloquial:** `либа` → **Professional:** `библиотека`
- **Colloquial:** `тулза` → **Professional:** `утилита` / `инструмент`
- **Colloquial:** `конфа` → **Professional:** `конфигурация` / `настройки`
- **Colloquial:** `репа` → **Professional:** `репозиторий`
- **Colloquial:** `деплоить` → **Professional:** `развёртывать`
- **Colloquial:** `фича` → **Professional:** `возможность` / `функция`

---

## 2. Technical Terminology Standards

Use established Russian IT terminology while preserving English technical terms where standard:

| Concept / English Term    | Standard Russian                             | Notes / Avoid                                                         |
| :------------------------ | :------------------------------------------- | :-------------------------------------------------------------------- |
| **Authentication**        | Аутентификация                               | Not "авторизация" (keep authentication vs authorization distinct)     |
| **Authorization**         | Авторизация                                  | Granting permissions / access control                                 |
| **Playback Token**        | Токен воспроизведения / делегированный токен | Natural and concise                                                   |
| **Streaming**             | Потоковая передача / стриминг                | Both are acceptable; avoid archaic "вещание" unless broadcast context |
| **Memory Storage**        | Хранилище в оперативной памяти              | Clear distinction from disk storage                                   |
| **File Storage**          | Файловое хранилище                           | Persistent disk storage                                               |
| **Background Downloader** | Фоновый загрузчик                            | Natural Russian noun phrase                                           |
| **Drop-in replacement**   | Полная замена / прямая совместимость         | Translate function, not idiom                                         |
| **Endpoint**              | Эндпоинт / маршрут API                       | Avoid literal calque "конечная точка"                                 |
| **Least privilege**       | Принцип наименьших привилегий                | Standard security terminology                                         |

---

## 3. TV Client & UI Localization Guidelines (Lampa Specifics)

Lampa runs on TV platforms (Android TV, Tizen, WebOS) where screen real estate is limited, navigation is driven by D-pad remotes, and users read from a distance of several meters.

### A. Extreme Brevity in UI Copy

- **Action Buttons**: Prefer concise infinitives or clear noun phrases.
  - *Good:* `Воспроизвести`, `Сохранить`, `Удалить`, `Тест подключения`.
  - *Too wordy:* `Начать воспроизведение видео`, `Сохранить в базу данных TorrPlay`.
- **Subtitles & Badges**: Keep under one line of text (~30–45 characters). Avoid wrapping across multiple lines in settings and select dialogs.
- **Toast Notifications (`Lampa.Noty`)**: Keep short, direct, and factual.
  - *Good:* `Инстанс онлайн (12 мс)`
  - *Too wordy:* `Проверка подключения успешно завершена, задержка составляет 12 миллисекунд.`

### B. Lampa & TorrPlay UI Vocabulary

| UI Concept / English     | Preferred Russian           | Lampa Context / Notes                                                 |
| :----------------------- | :-------------------------- | :-------------------------------------------------------------------- |
| **Instance Pool**        | Пул инстансов / Пул серверов| Settings component and instance manager                               |
| **Active Instance**      | Активный инстанс            | Badge and menu selection in pool                                      |
| **Latency / Ping**       | Задержка / Пинг             | Millisecond response time (`мс`)                                      |
| **Preload / Buffering**  | Предзагрузка / Буферизация  | Fullscreen loading screen before player hand-off                      |
| **Catalog**              | Каталог                     | Movie and show cards                                                  |
| **Context Menu**         | Контекстное меню            | Invoked via long-press on torrent cards                               |
| **Database Persistence** | Сохранение в базу           | Toggle / option for persistent torrent records                        |
| **Ask Before Play**      | Спрашивать перед просмотром | Modal prompt for storage type or player choice                        |
| **RAM (storage type)**   | Оперативная память          | Settings values, menu actions; never bare `RAM` or the `ОЗУ` initialism |

---

## 4. Typography, Units & Formatting Standards

- **Units of Measurement**: Always put a non-breaking space between the number and the unit.
  - `100 мс` (not `100мс` or `100 ms`)
  - `15 Мбит/с` (not `15Mbps`, `15Мбит/с` or `15 Мб/с`)
  - `4 ГБ` / `700 МБ` (not `4гб` or `700мб`)
- **Quotation Marks**:
  - Use Russian typographic angle quotes («ёлочки») in prose: `«TorrPlay»`.
  - If nested quotes are needed, use inner quotes („лапки“): `«кнопка „TorrPlay“ в карточке»`.
  - In technical identifiers and UI code strings, standard quotes (`"..."` / `'...'`) are acceptable.
- **Dashes & Hyphens**:
  - Em-dash (`—`) with surrounding spaces for definitions and parenthetical statements: `TorrPlay — клиент для Lampa`.
  - Hyphen (`-`) without spaces for compound words: `интернет-соединение`, `D-pad`.

---

## 5. Code, Command & Placeholder Rules

- **Code, commands, flags, parameters, and snippets are NEVER translated into Russian.**
- All shell commands (`curl`, `docker`, CLI flags), JSON keys, and placeholder tokens (`your-username`, `your-password`, `your-jwt-token`, `YOUR_API_KEY`) remain in English across all Russian pages.
- Explanatory comments inside shell snippets may be in Russian, provided they are concise and natural.

---

## 6. Self-Review Checklist

When translating or editing a Russian document or UI string:

1. **Read Aloud Test:** Read the sentences aloud. Do they flow naturally in Russian syntax, or do they feel like English sentences with Russian words substituted in?
2. **Eliminate Wordiness:** Cut words like `является`, `данный`, `осуществление`, `в целях`.
3. **No Capitalized «Вы»:** Verify that all occurrences of `вы`, `вам`, `ваш` are lowercase, and unnecessary pronouns are removed.
4. **UI Brevity Check:** Are button labels, card subtitles, and toast notifications concise enough for TV screens and remote navigation?
5. **Consistency with Units & Typography:** Are spaces preserved before units (`100 мс`, `15 Мбит/с`)? Are em-dashes (`—`) used correctly?
6. **Code Isolation:** Are all CLI commands, JSON keys, endpoints, and placeholders untouched in English?
