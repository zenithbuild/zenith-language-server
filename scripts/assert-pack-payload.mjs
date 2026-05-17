#!/usr/bin/env node
/**
 * Asserts that the npm-publish payload for @zenithbuild/language-server
 * includes all editor-critical assets. Runs `npm pack --dry-run --json`
 * and verifies the bin shim, the built server bundle, the README, the
 * LICENSE, and the Neovim verification doc.
 *
 * Exits non-zero on any missing required asset. Intended to run via
 * `npm run verify:pack` and as part of `prepublishOnly`.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
    'bin/zenith-language-server.js',
    'dist/server.js',
    'docs/manual-neovim-verification.md',
    'README.md',
    'LICENSE'
];

const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf8'
});

if (result.status !== 0) {
    console.error('npm pack --dry-run failed:');
    console.error(result.stderr || result.stdout);
    process.exit(1);
}

let payload;
try {
    payload = JSON.parse(result.stdout);
} catch (err) {
    console.error('Could not parse npm pack JSON output:', err);
    console.error(result.stdout);
    process.exit(1);
}

if (!Array.isArray(payload) || payload.length === 0 || !Array.isArray(payload[0].files)) {
    console.error('Unexpected npm pack payload shape:', payload);
    process.exit(1);
}

const tarballFiles = payload[0].files.map((f) => f.path);
const missing = REQUIRED_FILES.filter((rel) => !tarballFiles.includes(rel));

if (missing.length > 0) {
    console.error('\n[verify:pack] Missing required files in npm tarball:');
    for (const f of missing) {
        console.error(`  - ${f}`);
    }
    console.error('\nReceived tarball file list:');
    for (const f of tarballFiles) {
        console.error(`  ${f}`);
    }
    process.exit(1);
}

console.log(`[verify:pack] OK (${tarballFiles.length} files, all required assets present)`);
