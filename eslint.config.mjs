/*
 * Copyright (C) 2026 Domestone S.r.l.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
// Lint of the app, the Windows app, the MCP server and the tests: the recommended rules of ESLint, run with
// `npx eslint src/js desktop mcp tests e2e`.
import js from '@eslint/js';
import globals from 'globals';

// Modules of the app, published as globals in the page (and on `global` in Node).
const APP = Object.fromEntries(['AITools', 'AIReview', 'AppCore', 'ASSETS', 'Charts', 'Checks', 'DEFAULT_STATE', 'Geo', 'Geocode', 'I18N', 'MapView', 'Maps',
  'MCA', 'Method', 'Profiles', 'Providers', 'References', 'Report', 'Review', 'Taxonomy', 'UI_I18N', 'ValestaStore', 'Workflow', 'Zip'].map((n) => [n, 'readonly']));

export default [
  { ignores: ['dist/**', '**/node_modules/**', 'native/**', 'dev/**', 'tools/**', 'desktop/app/**', 'desktop/build/**'] },
  js.configs.recommended,
  {
    // App modules: plain scripts (UMD), loaded together in the page or with require() in Node.
    files: ['src/js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser, ...globals.node, ...APP } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
  },
  {
    files: ['mcp/**/*.js', 'tests/**/*.js', 'desktop/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...APP } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
  },
  {
    // End-to-end tests: Node, plus the page code passed to the browser (page.evaluate, waitForFunction).
    files: ['e2e/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser, ...APP } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
  },
];
