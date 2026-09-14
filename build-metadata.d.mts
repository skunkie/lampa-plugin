// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export interface BuildMetadata {
  buildCommit: string,
  buildDate: string
}

export type BuildEnvironment = Record<string, string | undefined>;

export function resolveBuildCommit(
  environment: BuildEnvironment,
  resolveLocalCommit?: () => string,
): string;

export function resolveBuildMetadata(
  environment: BuildEnvironment,
  createDate?: () => Date,
  resolveLocalCommit?: () => string,
): BuildMetadata;
