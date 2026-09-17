// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

interface LampaStorage {
  field(key: string): any,
  get<T = any>(key: string, defaultValue?: T): T,
  listener?: {
    follow(event: string, callback: (event: any) => void): void,
    remove(event: string, callback: (event: any) => void): void
  },
  set(key: string, value: any, noSync?: boolean): void
}

declare global {
  interface LampaActivityState extends LampaMovie {
    component?: string,
    page?: number,
    search?: string,
    title?: string,
    url?: string
  }

  interface LampaApiSeasonEpisode {
    air_date?: string,
    episode_number: number,
    name?: string,
    runtime?: number,
    still_path?: string
  }

  interface LampaApiSeasonData {
    episodes?: LampaApiSeasonEpisode[]
  }

  interface LampaComponentActivity extends LampaActivityState {
    loader(isLoading: boolean): void,
    toggle(): void
  }

  interface LampaComponentOptions {
    activity?: LampaComponentActivity
  }

  interface LampaDomElement {
    [index: number]: HTMLElement,
    addClass(className: string): LampaDomElement,
    after(element: unknown): LampaDomElement,
    append(element: unknown): LampaDomElement,
    attr(name: string): string,
    attr(name: string, value: string): LampaDomElement,
    before(element: unknown): LampaDomElement,
    children(selector?: string): LampaDomElement,
    css(name: string, value: string | number): LampaDomElement,
    css(styles: Record<string, string | number>): LampaDomElement,
    empty(): LampaDomElement,
    find(selector: string): LampaDomElement,
    first(): LampaDomElement,
    length: number,
    on(eventName: string, callback: (event: LampaDomEvent) => void): LampaDomElement,
    prepend(element: unknown): LampaDomElement,
    prop(name: 'checked'): boolean,
    prop(name: 'checked', value: boolean): LampaDomElement,
    prop(name: string): unknown,
    remove(): LampaDomElement,
    removeClass(className: string): LampaDomElement,
    text(): string,
    text(value: string): LampaDomElement,
    toggleClass(className: string, state?: boolean): LampaDomElement
  }

  interface LampaJQuery {
    (value: unknown): LampaDomElement
  }

  interface LampaDomEvent {
    currentTarget?: HTMLElement,
    preventDefault?: () => void,
    target?: HTMLElement
  }

  interface LampaEmptyState {
    destroy?(): void,
    render(): LampaDomElement,
    start?(): void
  }

  // Media-info streams that jacred-style Jackett instances attach to each result.
  // Lampa reads them straight off the parser item to render per-torrent resolution,
  // channel and audio/subtitle-track tags, and `tags` arrives with inconsistent key
  // casing (language/LANGUAGE, title/TITLE, handler_name/HANDLER_NAME).
  interface LampaFfprobeStream {
    channel_layout?: string,
    channels?: number,
    codec_long_name?: string,
    codec_name?: string,
    codec_type?: string,
    height?: number,
    tags?: Record<string, string>,
    width?: number
  }

  interface LampaMovie {
    [key: string]: unknown,
    backdrop_path?: string,
    background_image?: string,
    card?: unknown,
    first_air_date?: string,
    genres?: Array<{ id: number, name: string }>,
    id?: number | string,
    img?: string,
    movie?: unknown,
    name?: string,
    number_of_seasons?: number,
    original_language?: string,
    original_name?: string,
    original_title?: string,
    poster?: string,
    poster_path?: string,
    profile_path?: string,
    release_date?: string,
    source?: string,
    title?: string,
    torrplay?: boolean
  }

  interface LampaNavigator {
    canmove?: (direction: 'up' | 'down' | 'left' | 'right') => boolean,
    focused?: (element: HTMLElement) => void,
    getFocusedElement?: () => HTMLElement | null,
    move(direction: 'up' | 'down' | 'left' | 'right'): void
  }

  interface LampaParserData {
    Results: LampaParserResultItem[]
  }

  interface LampaParserParams {
    clarification?: boolean,
    from_search?: boolean,
    global?: boolean,
    movie?: LampaMovie,
    other?: boolean,
    search?: string
  }

  interface LampaParserResultItem {
    checked_at: number,
    ffprobe?: LampaFfprobeStream[],
    hash: string,
    info?: { quality?: number, voices?: string[] },
    languages?: string[],
    Link?: string,
    MagnetUri: string,
    Peers: number,
    PublishDate: string,
    PublisTime: number,
    Seeders: number,
    size: string,
    Size?: number,
    source_rank: number,
    Title: string,
    Tracker?: string,
    viewed: boolean
  }

  interface LampaPlayerItem extends LampaPlaylistItem {
    ad?: boolean,
    card?: LampaMovie,
    continue_play?: boolean,
    first_title?: string,
    movie?: LampaMovie,
    no_ad?: boolean,
    timeline?: unknown,
    torrent?: boolean,
    url?: string | ((callback?: () => void) => void)
  }

  interface LampaPlaylistItem {
    episode?: number | null,
    file_index?: number,
    fname?: string,
    id?: number,
    img?: string,
    path?: string,
    season?: number | null,
    size?: string,
    title?: string,
    torrent_hash?: string
  }

  interface LampaScrollView {
    append(element: LampaDomElement): void,
    clear?(): void,
    destroy(): void,
    minus(): void,
    nopadding?(): void,
    render(js?: boolean): LampaDomElement,
    reset?(): void,
    update(element: LampaDomElement, immediate?: boolean): void
  }

  interface LampaSelectItem<T = unknown> {
    action?: string,
    data?: T,
    ghost?: boolean,
    noenter?: boolean,
    onSelect?: (element: LampaDomElement, selectedItem: LampaSelectItem<T>) => void,
    selected?: boolean,
    subtitle?: string,
    title: string
  }

  interface LampaStorageChangeEvent {
    name: string,
    value?: unknown
  }

  interface LampaTorrentItem extends LampaMovie {
    hash?: string,
    Hash?: string,
    info_hash?: string,
    InfoHash?: string,
    link?: string,
    Link?: string,
    MagnetUri?: string,
    Title?: string,
    url?: string,
    viewed?: boolean
  }
}

interface LampaSettingsParam {
  component: string,
  field: {
    description?: string,
    name: string
  },
  onChange?: (value?: any) => void,
  onRender?: (item: any) => void,
  param: {
    default?: any,
    name?: string,
    placeholder?: string,
    type: 'trigger' | 'select' | 'input' | 'static' | 'button' | 'title',
    values?: Record<string, string> | string[] | string
  }
}

interface LampaSettingsComponent {
  after?: string,
  before?: string,
  component: string,
  icon: string,
  name: string
}

interface LampaSettingsApi {
  addComponent(component: LampaSettingsComponent): void,
  addParam(param: LampaSettingsParam): void,
  allComponents(): Record<string, LampaSettingsComponent>,
  allParams(): Record<string, LampaSettingsParam[]>,
  getParam(component: string): LampaSettingsParam[],
  removeComponent(name: string): void
}

interface LampaListener {
  follow(event: string, callback: (eventData: any) => void): void,
  send(event: string, eventData: any): void
}

interface LampaModalOptions {
  html: any,
  mask?: boolean,
  onBack?: () => void,
  size?: 'small' | 'medium' | 'large' | 'full',
  title?: string
}

interface LampaModal {
  close(): void,
  open(options: LampaModalOptions): void,
  scroll(): { render(js?: boolean): any },
  title(title: string): void,
  update(html: any): void
}

interface LampaController {
  add(name: string, controller: any): void,
  back(): void,
  collectionAppend(item: any): void,
  collectionFocus(focus: any, element: any): void,
  collectionSet(element: any): void,
  enabled(): { name: string },
  listener?: LampaListener,
  toggle(name: string): void
}

interface LampaPlayer {
  callback(callback: () => void): void,
  listener?: LampaListener,
  opened(): boolean,
  play(item: any): void,
  playlist(list: any[]): void
}

interface LampaNoty {
  show(text: string, options?: { time?: number }): void
}

interface LampaUtils {
  bytesToSize(bytes: number, speed?: boolean): string,
  cardImgBackground(cardData: any): string,
  clearHtmlTags(text: string): string,
  createInstance(cls: any, ...args: any[]): any,
  hash(str: string): string,
  parseTime(value: string): { full: string },
  pathToNormalTitle(str: string, keepExt?: boolean): string
}

interface LampaApi {
  img(path?: string, size?: string): string,
  seasons(
    tv: { id?: number | string },
    seasonNumbers: number[],
    onComplete: (data: Record<string, LampaApiSeasonData>) => void
  ): void
}

interface LampaTemplate {
  add(name: string, html: string): void,
  get(name: string, templateData?: any): any,
  js(name: string, templateData?: any): any,
  string(name: string): string
}

interface LampaTorrent {
  back(callback?: () => void): void,
  open(hash: string, movie?: any): void,
  opened(callback: () => void): void,
  start(element: any, movie?: any): void
}

interface LampaSelectOptions {
  items: Array<{
    [key: string]: any,
    action?: string,
    data?: any,
    onSelect?: (element: any, selectedItem: any) => void,
    selected?: boolean,
    subtitle?: string,
    title: string
  }>,
  onBack?: () => void,
  onSelect?: (selectedItem: any) => void,
  title: string
}

interface LampaInputOptions {
  free?: boolean,
  nosave?: boolean,
  password?: boolean,
  title: string,
  value: string
}

interface LampaLoading {
  setProgress(percent: number, progressData?: {
    [key: string]: any,
    active_peers?: number,
    connected_seeders?: number,
    download_speed?: number,
    leechers?: number,
    seeders?: number,
    speed?: string,
    total_peers?: number
  }): void,
  start(onCancel: () => void, text?: string, loadingData?: any): void,
  stop(): void
}

interface LampaPlatform {
  any(): boolean,
  is(platform: string): boolean,
  tv(): boolean
}

interface LampaActivity {
  active?(): any,
  all?(): any[],
  backward(): void,
  mixState(state?: string): void,
  push(params: {
    [key: string]: any,
    component: string,
    movie?: any,
    page?: number,
    search?: string,
    title?: string,
    url?: string
  }): void,
  replace(params: any): void
}

interface LampaMenu {
  addButton(svgIcon: string, title: string, action: () => void): any,
  addElement(element: any, action?: () => void): any,
  close(): void,
  open(): void,
  opened(): boolean,
  toggle(): void
}

interface LampaNamespace {
  Activity: LampaActivity,
  Android?: any,
  Api?: LampaApi,
  Arrays: {
    decodeJson(json: any, fallback: any): any,
    extend(target: any, source: any): any,
    remove(array: any[], item: any): void
  },
  Background: {
    change(url: string): void
  },
  Card: any,
  Component: {
    add(name: string, component: any): void,
    create(name: string, object: any): any,
    get(name: string): any
  },
  Controller: LampaController,
  Empty: any,
  Favorite: any,
  Head?: {
    title(title: string): void
  },
  Input: {
    edit(options: LampaInputOptions, callback: (value: string) => void): void
  },
  Lang?: {
    add(data: Record<string, Record<string, string>>): void,
    translate(key: string, code?: string): string
  },
  Layer?: {
    update?(target?: any): void,
    visible?(target?: any): void
  },
  Listener: LampaListener,
  Loading: LampaLoading,
  Maker?: {
    get(name: string, data?: unknown): new (data: unknown) => unknown
  },
  Manifest: {
    app_digital?: number,
    plugins?: any
  },
  Menu: LampaMenu,
  Modal: LampaModal,
  Navigator: {
    canmove?: (direction: 'up' | 'down' | 'left' | 'right') => boolean,
    focused(element: any): void,
    move(direction: 'up' | 'down' | 'left' | 'right'): void
  },
  Notice?: any,
  Noty: LampaNoty,
  Params?: any,
  Parser?: {
    clear?(): void,
    get(params: LampaParserParams, onComplete: (data: LampaParserData) => void, onError?: (error?: unknown) => void): void
  },
  Platform: LampaPlatform,
  Player: LampaPlayer,
  Reguest?: any,
  Scroll: any,
  Search?: {
    addSource(source: unknown): void,
    removeSource(source: unknown): void
  },
  Select: {
    close(): void,
    show(options: LampaSelectOptions): void
  },
  Settings: any,
  SettingsApi: LampaSettingsApi,
  Storage: LampaStorage,
  Template: LampaTemplate,
  Timeline: any,
  TMDB?: any,
  Torrent: LampaTorrent,
  Torserver: any,
  Utils: LampaUtils
}

declare global {
  interface Window {
    $: LampaJQuery,
    appready?: boolean,
    jQuery: any,
    Lampa: LampaNamespace,
    Navigator?: LampaNavigator,
    plugin_torrplay_ready?: boolean
  }

  const $: LampaJQuery;
  const jQuery: any;
  const Lampa: LampaNamespace;
  const __PLUGIN_VERSION__: string | undefined;
  const __PLUGIN_BUILD_DATE__: string | undefined;
  const __PLUGIN_BUILD_COMMIT__: string | undefined;
}

export {};
