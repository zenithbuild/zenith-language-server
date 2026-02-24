import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
    stripImportSuffix,
    isCssContractImportSpecifier,
    isLocalCssSpecifier,
    resolveCssImportPath
} from '../src/contracts';

test('stripImportSuffix removes query/hash suffixes deterministically', () => {
    assert.equal(stripImportSuffix('./styles/output.css?v=1#hash'), './styles/output.css');
    assert.equal(stripImportSuffix('./styles/output.css#hash?v=1'), './styles/output.css');
    assert.equal(stripImportSuffix('./styles/output.css'), './styles/output.css');
});

test('css contract identifies local and bare css import shapes', () => {
    assert.equal(isCssContractImportSpecifier('./styles/output.css?v=1'), true);
    assert.equal(isCssContractImportSpecifier('tailwindcss'), true);
    assert.equal(isCssContractImportSpecifier('@scope/css'), true);
    assert.equal(isLocalCssSpecifier('./styles/output.css'), true);
    assert.equal(isLocalCssSpecifier('../styles/output.css#hash'), true);
    assert.equal(isLocalCssSpecifier('/src/styles/output.css'), true);
    assert.equal(isLocalCssSpecifier('tailwindcss'), false);
});

test('resolveCssImportPath flags project-root traversal escape', () => {
    const projectRoot = path.join('/tmp', 'zenith-site');
    const importer = path.join(projectRoot, 'src', 'pages', 'index.zen');

    const ok = resolveCssImportPath(importer, '../styles/output.css?v=1#hash', projectRoot);
    assert.equal(ok.escapesProjectRoot, false);

    const escaped = resolveCssImportPath(importer, '../../../../outside.css', projectRoot);
    assert.equal(escaped.escapesProjectRoot, true);
});
