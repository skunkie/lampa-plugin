// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export interface BuildLandingPageOptions {
  channel?: 'dev' | 'production';
  outDir?: string;
  repository?: string;
  version?: string;
}

export function buildLandingPage(options?: BuildLandingPageOptions): void;
