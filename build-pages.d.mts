// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export interface AssemblePagesOptions {
  downloadRelease?: (repository: string, targetDir: string) => string;
  environment?: Record<string, string | undefined>;
  mode?: 'dev' | 'release';
  outDir?: string;
  releaseVersion?: string;
  repository?: string;
}

export function assemblePagesSite(options?: AssemblePagesOptions): Promise<void>;
export function parseCliArgs(
  args: string[],
  environment?: Record<string, string | undefined>,
): {
  mode: string,
  outDir: string,
  releaseVersion: string | undefined,
};
export function resolveBaseVersion(resolveTag?: () => string, resolvePackageJson?: () => string): string;
export function resolveDevVersion(
  environment?: Record<string, string | undefined>,
  resolveBase?: () => string,
  resolveCommit?: (env: Record<string, string | undefined>) => string,
): string;
