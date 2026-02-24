import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectProjectRoot } from '../src/project';

function createTempDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('detectProjectRoot prefers nearest zenith.config.*', () => {
    const root = createTempDir('zenith-lsp-root-');
    const nested = path.join(root, 'apps', 'site', 'src', 'pages');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(root, 'zenith.config.ts'), 'export default {}\n');

    const detected = detectProjectRoot(path.join(nested, 'index.zen'));
    assert.equal(detected, root);
});

test('detectProjectRoot prefers nearest package.json with @zenithbuild/cli', () => {
    const root = createTempDir('zenith-lsp-pkg-');
    const nested = path.join(root, 'src', 'components');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ dependencies: { '@zenithbuild/cli': '^1.0.0' } }, null, 2)
    );

    const detected = detectProjectRoot(path.join(nested, 'Hero.zen'));
    assert.equal(detected, root);
});

test('detectProjectRoot falls back to matching workspace folder structure', () => {
    const workspace = createTempDir('zenith-lsp-workspace-');
    const siteRoot = path.join(workspace, 'site-a');
    const nested = path.join(siteRoot, 'src', 'pages', 'blog');
    fs.mkdirSync(nested, { recursive: true });

    const detected = detectProjectRoot(path.join(nested, 'first-post.zen'), [workspace, siteRoot]);
    assert.equal(detected, siteRoot);
});
