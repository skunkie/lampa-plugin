// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { execFileSync } from 'node:child_process';

export function resolveBuildCommit(
  environment,
  resolveLocalCommit = () => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
) {
  if (environment.GITHUB_SHA) return environment.GITHUB_SHA.slice(0, 7);

  try {
    return resolveLocalCommit();
  } catch {
    return 'unknown';
  }
}

export function resolveBuildMetadata(
  environment,
  createDate = () => new Date(),
  resolveLocalCommit,
) {
  return {
    buildCommit: resolveBuildCommit(environment, resolveLocalCommit),
    buildDate: createDate().toISOString(),
  };
}
