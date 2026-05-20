import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompilerFailureDiagnostic, collectDiagnostics, collectContractDiagnostics, CONTRACT_MESSAGES } from '../src/diagnostics';
import { buildEventBindingCodeActions, buildRuntimeImportCodeActions } from '../src/code-actions';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings';

const PROJECT_ROOT = '/tmp/zenith-site';

function doc(uri: string, content: string) {
    return {
        uri,
        getText() {
            return content;
        },
        positionAt(offset: number) {
            const bounded = Math.max(0, Math.min(offset, content.length));
            const before = content.slice(0, bounded);
            const lines = before.split('\n');
            return {
                line: lines.length - 1,
                character: lines[lines.length - 1]?.length || 0
            };
        },
        offsetAt(position: { line: number; character: number }) {
            const lines = content.split('\n');
            let offset = 0;
            for (let line = 0; line < position.line; line++) {
                offset += (lines[line]?.length || 0) + 1;
            }
            return offset + position.character;
        }
    };
}

test('component files with script tags do not receive stale structural component-script diagnostics', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/components/Hero.zen',
        '<section><script lang="ts">const x = 1;</script><h1>Hero</h1></section>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messageSet = diagnostics.map((item) => item.message);
    assert.ok(!messageSet.some((message) => message.includes('Components are structural; move <script>')));
});

test('layout files with script tags do not receive stale structural component-script diagnostics', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/layouts/MainLayout.zen',
        '<script lang="ts">const x = 1;</script><slot />'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messageSet = diagnostics.map((item) => item.message);
    assert.ok(!messageSet.some((message) => message.includes('Components are structural; move <script>')));
});

test('page files with script tags do not receive stale structural component-script diagnostics', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<RootLayout><script lang="ts">const x = 1;</script><h1>Home</h1></RootLayout>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messageSet = diagnostics.map((item) => item.message);
    assert.ok(!messageSet.some((message) => message.includes('Components are structural; move <script>')));
});

test('event binding diagnostics flag onclick and @click and provide quick fixes', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<button onclick="submitForm">Save</button><button @click={submitForm}>Save</button>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT)
        .filter((item) => String(item.code || '') === 'zenith.event.binding.syntax');

    assert.equal(diagnostics.length, 2);
    assert.equal(diagnostics[0]?.data?.replacement, 'on:click={submitForm}');
    assert.equal(diagnostics[1]?.data?.replacement, 'on:click={submitForm}');

    const actions = buildEventBindingCodeActions(document, diagnostics);
    assert.equal(actions.length, 2);
    assert.equal(actions[0]?.title, 'Convert to on:click={submitForm}');
});

test('css import contract flags bare imports and path escapes', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<RootLayout><script>import \"tailwindcss\"; import \"../../../../outside.css\";</script></RootLayout>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messages = diagnostics.map((item) => item.message);
    assert.ok(messages.includes(CONTRACT_MESSAGES.cssBareImport));
    assert.ok(messages.includes(CONTRACT_MESSAGES.cssEscape));
});

test('css import contract allows local precompiled css with suffixes', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<RootLayout><script>import \"../styles/output.css?v=1#hash\";</script></RootLayout>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messages = diagnostics.map((item) => item.message);
    assert.ok(!messages.includes(CONTRACT_MESSAGES.cssBareImport));
    assert.ok(!messages.includes(CONTRACT_MESSAGES.cssEscape));
});

test('ZEN-DOM-QUERY diagnostic appears for querySelector and severity maps with strictDomLints', async () => {
    const document = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<script lang="ts">\nconst el = document.querySelector(".foo");\n</script>\n<div class="foo">hi</div>'
    );

    const settingsDefault = normalizeSettings({ strictDomLints: false });
    const diagnosticsDefault = await collectDiagnostics(document, null, settingsDefault, PROJECT_ROOT);
    const queryDefault = diagnosticsDefault.filter((d) => d.code === 'ZEN-DOM-QUERY');
    assert.ok(queryDefault.length >= 1, `expected ZEN-DOM-QUERY diagnostic, got: ${JSON.stringify(diagnosticsDefault.map((d) => d.code))}`);
    assert.equal(queryDefault[0]?.severity, 2, 'ZEN-DOM-QUERY should be Warning (2) when strictDomLints=false');

    const settingsStrict = normalizeSettings({ strictDomLints: true });
    const diagnosticsStrict = await collectDiagnostics(document, null, settingsStrict, PROJECT_ROOT);
    const queryStrict = diagnosticsStrict.filter((d) => d.code === 'ZEN-DOM-QUERY');
    assert.ok(queryStrict.length >= 1, `expected ZEN-DOM-QUERY diagnostic in strict mode, got: ${JSON.stringify(diagnosticsStrict.map((d) => d.code))}`);
    assert.equal(queryStrict[0]?.severity, 1, 'ZEN-DOM-QUERY should be Error (1) when strictDomLints=true');
});

test('compiler unavailable errors map to controlled diagnostic without raw module error text', () => {
    const unavailable = buildCompilerFailureDiagnostic({
        code: 'ERR_MODULE_NOT_FOUND',
        message: 'Cannot find package \'@zenithbuild/compiler\' imported from /path/server.js',
        stack: 'Error [ERR_MODULE_NOT_FOUND]: Cannot find package\n    at /path/server.js:1:1'
    });

    assert.equal(unavailable.code, 'ZENITH-COMPILER-UNAVAILABLE');
    assert.equal(unavailable.severity, 2, 'compiler unavailable should be a warning');
    assert.equal(unavailable.message, CONTRACT_MESSAGES.compilerUnavailable);
    assert.ok(!unavailable.message.includes('ERR_MODULE_NOT_FOUND'));
    assert.ok(!unavailable.message.includes('/path/server.js'));
    assert.ok(!unavailable.message.includes(' at '));
});

test('zenith:runtime import gets precise guidance while other unknown plugin imports keep generic message', () => {
    const runtimeDocument = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<script lang="ts">import { signal } from "zenith:runtime";</script>'
    );

    const runtimeDiagnostics = collectContractDiagnostics(runtimeDocument, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const runtimeDiagnostic = runtimeDiagnostics.find((item) => item.message.includes('zenith:runtime'));
    const runtimeMessage = runtimeDiagnostic?.message;
    assert.equal(
        runtimeMessage,
        'Unknown Zenith import "zenith:runtime"; use "zenith" or omit the import if compiler-injected primitives are available.'
    );

    assert.ok(runtimeDiagnostic, 'expected zenith:runtime diagnostic');
    const actions = buildRuntimeImportCodeActions(runtimeDocument, [runtimeDiagnostic]);
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.title, 'Replace "zenith:runtime" with "zenith"');
    const edit = actions[0]?.edit.changes[runtimeDocument.uri]?.[0];
    assert.equal(edit?.newText, 'zenith');
    assert.equal(
        runtimeDocument.getText().slice(
            runtimeDocument.offsetAt(edit!.range.start),
            runtimeDocument.offsetAt(edit!.range.end)
        ),
        'zenith:runtime'
    );

    const genericDocument = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<script lang="ts">import { foo } from "zenith:unknown-plugin";</script>'
    );

    const genericDiagnostics = collectContractDiagnostics(genericDocument, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const genericMessage = genericDiagnostics.find((item) => item.message.includes('Unknown plugin module'))?.message;
    assert.equal(genericMessage, "Unknown plugin module: 'zenith:unknown-plugin'. Make sure the plugin is installed.");
});
