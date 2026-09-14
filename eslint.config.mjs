// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import esX from 'eslint-plugin-es-x';
import perfectionist from 'eslint-plugin-perfectionist';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const localPlugin = {
  rules: {
    'empty-block-spacing': {
      meta: {
        type: 'layout',
        fixable: 'whitespace',
        messages: { unexpectedSpace: 'Unexpected whitespace inside empty block.' },
        schema: [],
      },
      create(context) {
        return {
          BlockStatement(node) {
            if (node.body.length !== 0) return;
            const src = context.sourceCode;
            const open = src.getFirstToken(node);
            const close = src.getLastToken(node);
            if (open.range[1] === close.range[0]) return;
            context.report({
              node,
              messageId: 'unexpectedSpace',
              fix: fixer => fixer.replaceTextRange([open.range[1], close.range[0]], ''),
            });
          },
        };
      },
    },
  },
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.mjs', 'build.mjs'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@stylistic': stylistic,
      '@stylistic/ts': stylistic,
      'local': localPlugin,
      'es-x': esX,
      'perfectionist': perfectionist,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/ts/arrow-parens': ['error', 'as-needed'],
      '@stylistic/ts/comma-spacing': ['error', { 'before': false, 'after': true }],
      '@stylistic/ts/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'comma',
            requireLast: false,
          },
          singleline: {
            delimiter: 'comma',
            requireLast: false,
          },
        },
      ],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
      'prefer-const': 'error',
      'local/empty-block-spacing': 'error',
      // Runtime APIs that postdate the project's build target and that esbuild's
      // `target` option cannot polyfill. Deliberately narrower than the plugin's
      // bundled `no-new-in-esYYYY` configs, which also flag syntax (class fields,
      // logical assignment, top-level await) that esbuild already down-levels and
      // is fine to use in source.
      'es-x/no-array-prototype-at': 'error',
      'es-x/no-array-prototype-findlast-findlastindex': 'error',
      'es-x/no-map-groupby': 'error',
      'es-x/no-object-groupby': 'error',
      'es-x/no-object-hasown': 'error',
      'es-x/no-promise-any': 'error',
      'es-x/no-string-prototype-at': 'error',
      'es-x/no-string-prototype-replaceall': 'error',
      'perfectionist/sort-interfaces': ['error', { type: 'alphabetical', ignoreCase: false }],
      'perfectionist/sort-object-types': ['error', { type: 'alphabetical', ignoreCase: false }],
    },
  },
  {
    files: ['landing/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
    },
  },
  {
    // Lampa exposes a highly dynamic, unversioned JavaScript API. Keep its remaining
    // escape hatches isolated to the ambient boundary while application code stays strict.
    files: ['src/types/lampa.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Test doubles intentionally replace globals, constructors, and private static state.
    // Their loose casts should not weaken the production rule or require file-wide disables.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
