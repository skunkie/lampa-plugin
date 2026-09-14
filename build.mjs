// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { resolveBuildMetadata } from './build-metadata.mjs';
import { generateLandingPage } from './landing-page.mjs';

export function createBuildOptions(version, buildCommit, buildDate) {
  const banner = `/**
 * TorrPlay Lampa Plugin v${version}
 * SPDX-FileCopyrightText: 2026 TorrPlay
 * SPDX-License-Identifier: MIT
 */`;

  return {
    banner: { js: banner },
    bundle: true,
    define: {
      __PLUGIN_BUILD_COMMIT__: JSON.stringify(buildCommit),
      __PLUGIN_BUILD_DATE__: JSON.stringify(buildDate),
      __PLUGIN_VERSION__: JSON.stringify(version),
    },
    entryPoints: ['src/index.ts'],
    format: 'iife',
    // Pinned to the oldest/most restrictive runtime this plugin supports. Only
    // down-levels syntax — newer runtime methods/APIs still need a polyfill or
    // must be avoided even if this target accepts the syntax that calls them.
    target: ['chrome79'],
  };
}

export function buildLandingPage({
  channel = 'production',
  outDir = 'dist',
  version = '0.0.0-dev',
} = {}) {
  const targetPath = join(outDir, 'index.html');
  console.log(`Generating landing page: ${targetPath}...`);
  const html = generateLandingPage(version, undefined, channel);
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const match of scriptMatches) {
    new Function(match[1]);
  }
  writeFileSync(targetPath, html);
}

export async function buildPluginBundles({
  buildCommit,
  buildDate,
  outDir = 'dist',
  version = '0.0.0-dev',
} = {}) {
  mkdirSync(outDir, { recursive: true });

  const resolvedMetadata = (buildCommit && buildDate)
    ? { buildCommit, buildDate }
    : resolveBuildMetadata(process.env);

  const commonOptions = createBuildOptions(
    version,
    resolvedMetadata.buildCommit,
    resolvedMetadata.buildDate,
  );

  const jsPath = join(outDir, 'torrplay.js');
  console.log(`Building unminified bundle: ${jsPath}...`);
  await esbuild.build({
    ...commonOptions,
    minify: false,
    outfile: jsPath,
    sourcemap: true,
  });

  const minJsPath = join(outDir, 'torrplay.min.js');
  console.log(`Building minified bundle: ${minJsPath}...`);
  await esbuild.build({
    ...commonOptions,
    minify: true,
    outfile: minJsPath,
    sourcemap: false,
  });
}

export async function build({
  channel = process.env.PLUGIN_CHANNEL || 'production',
  outDir = process.env.BUILD_OUT_DIR || 'dist',
  version = process.env.PLUGIN_VERSION || '0.0.0-dev',
} = {}) {
  mkdirSync(outDir, { recursive: true });
  await buildPluginBundles({ outDir, version });
  buildLandingPage({ channel, outDir, version });
  console.log('Build complete!');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
