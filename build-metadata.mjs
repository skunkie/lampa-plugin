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

export const DEFAULT_REPOSITORY = 'torrplay/lampa-plugin';

export function parseGitHubRepository(remoteUrl) {
  const match = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?github\.com(?::\d+\/|[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(remoteUrl.trim());
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export function resolveRepository(
  environment,
  resolveOriginUrl = () => execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
) {
  if (environment.GITHUB_REPOSITORY) return environment.GITHUB_REPOSITORY;

  try {
    return parseGitHubRepository(resolveOriginUrl()) || DEFAULT_REPOSITORY;
  } catch {
    return DEFAULT_REPOSITORY;
  }
}
