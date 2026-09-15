// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'fs';

import { resolveBuildMetadata } from './build-metadata.mjs';
import { generateLandingPage } from './landing-page.mjs';

mkdirSync('dist', { recursive: true });

const version = process.env.PLUGIN_VERSION || '0.0.0-dev';
const { buildCommit, buildDate } = resolveBuildMetadata(process.env);

const banner = `/**
 * TorrPlay Lampa Plugin v${version}
 * SPDX-FileCopyrightText: 2026 TorrPlay
 * SPDX-License-Identifier: MIT
 */`;

const commonOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  // Pinned to the oldest/most restrictive runtime this plugin supports. Only
  // down-levels syntax — newer runtime methods/APIs still need a polyfill or
  // must be avoided even if this target accepts the syntax that calls them.
  target: ['chrome79'],
  format: 'iife',
  banner: { js: banner },
  define: {
    __PLUGIN_VERSION__: JSON.stringify(version),
    __PLUGIN_BUILD_DATE__: JSON.stringify(buildDate),
    __PLUGIN_BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
};

function buildLandingPage() {
  console.log('Generating landing page: dist/index.html...');
  const html = generateLandingPage(version);
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const match of scriptMatches) {
    new Function(match[1]);
  }
  writeFileSync('dist/index.html', html);
}

async function buildPluginBundles() {
  console.log('Building unminified bundle: dist/torrplay.js...');
  await esbuild.build({
    ...commonOptions,
    outfile: 'dist/torrplay.js',
    minify: false,
    sourcemap: true,
  });

  console.log('Building minified bundle: dist/torrplay.min.js...');
  await esbuild.build({
    ...commonOptions,
    outfile: 'dist/torrplay.min.js',
    minify: true,
    sourcemap: false,
  });
}

async function build() {
  await buildPluginBundles();
  buildLandingPage();

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
