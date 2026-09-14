// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { resolveBuildCommit } from './build-metadata.mjs';
import { buildLandingPage, buildPluginBundles } from './build.mjs';

export function resolveBaseVersion(
  resolveTag = () => execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim(),
  resolvePackageJson = () => JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
) {
  try {
    const tag = resolveTag();
    if (tag) return tag.replace(/^v/, '');
  } catch {}

  try {
    return resolvePackageJson();
  } catch {
    return '1.0.0';
  }
}

export function resolveDevVersion(
  environment = process.env,
  resolveBase = resolveBaseVersion,
  resolveCommit = resolveBuildCommit,
) {
  const base = resolveBase();
  const commit = resolveCommit(environment);
  return `${base}-dev+${commit}`;
}

export async function assemblePagesSite({
  downloadRelease = (repo, targetDir) => {
    execFileSync('gh', ['release', 'download', '--repo', repo, '--pattern', 'torrplay*.js*', '--dir', targetDir], { stdio: 'inherit' });
    const tag = execFileSync('gh', ['release', 'view', '--repo', repo, '--json', 'tagName', '-q', '.tagName'], { encoding: 'utf8' }).trim();
    return tag.replace(/^v/, '');
  },
  environment = process.env,
  mode = 'dev',
  outDir = 'dist-pages',
  releaseVersion,
  repository = process.env.GITHUB_REPOSITORY || 'skunkie/lampa-plugin',
} = {}) {
  const devOutDir = join(outDir, 'dev');

  if (mode === 'release') {
    if (!releaseVersion) {
      throw new Error('Release version is required for release mode');
    }

    console.log(`[Pages] Building production release v${releaseVersion} at root (${outDir})...`);
    await buildPluginBundles({ outDir, version: releaseVersion });
    buildLandingPage({ channel: 'production', outDir, version: releaseVersion });

    const devVersion = `${releaseVersion}-dev+${resolveBuildCommit(environment)}`;
    console.log(`[Pages] Building development release v${devVersion} at ${devOutDir}...`);
    await buildPluginBundles({ outDir: devOutDir, version: devVersion });
    buildLandingPage({ channel: 'dev', outDir: devOutDir, version: devVersion });
  } else {
    const devVersion = resolveDevVersion(environment);
    console.log(`[Pages] Building development channel v${devVersion} at ${devOutDir}...`);
    await buildPluginBundles({ outDir: devOutDir, version: devVersion });
    buildLandingPage({ channel: 'dev', outDir: devOutDir, version: devVersion });

    console.log(`[Pages] Populating production root (${outDir}) from latest release...`);
    let prodVersion;
    try {
      prodVersion = downloadRelease(repository, outDir);
      console.log(`[Pages] Downloaded release assets for v${prodVersion}.`);
    } catch (err) {
      console.warn(`[Pages] Could not download latest release (${err.message}). Falling back to local build.`);
      prodVersion = resolveBaseVersion();
      await buildPluginBundles({ outDir, version: prodVersion });
    }

    buildLandingPage({ channel: 'production', outDir, version: prodVersion });
  }

  console.log(`[Pages] Complete Pages site assembled in ${outDir}!`);
}

export function parseCliArgs(args, environment = process.env) {
  let mode = environment.PAGES_MODE || 'dev';
  let outDir = environment.PAGES_OUT_DIR || 'dist-pages';
  let releaseVersion = environment.PLUGIN_VERSION;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && i + 1 < args.length) {
      mode = args[++i];
    } else if (args[i] === '--outdir' && i + 1 < args.length) {
      outDir = args[++i];
    } else if (args[i] === '--version' && i + 1 < args.length) {
      releaseVersion = args[++i] || undefined;
    }
  }

  return { mode, outDir, releaseVersion };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { mode, outDir, releaseVersion } = parseCliArgs(process.argv.slice(2));
  assemblePagesSite({ mode, outDir, releaseVersion }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
