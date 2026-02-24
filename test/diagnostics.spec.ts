import test from 'node:test';
import assert from 'node:assert/strict';

import { collectContractDiagnostics, CONTRACT_MESSAGES } from '../src/diagnostics';
import { buildEventBindingCodeActions } from '../src/code-actions';
import { DEFAULT_SETTINGS } from '../src/settings';

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
        }
    };
}

test('component script contract is enforced for components when mode=forbid', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/components/Hero.zen',
        '<section><script>const x = 1;</script><h1>Hero</h1></section>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messageSet = diagnostics.map((item) => item.message);
    assert.ok(messageSet.includes(CONTRACT_MESSAGES.componentScript));
});

test('component script contract allows scripts when mode=allow', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/components/Hero.zen',
        '<section><script>const x = 1;</script><h1>Hero</h1></section>'
    );

    const diagnostics = collectContractDiagnostics(document, null, { componentScripts: 'allow' }, PROJECT_ROOT);
    const messageSet = diagnostics.map((item) => item.message);
    assert.ok(!messageSet.includes(CONTRACT_MESSAGES.componentScript));
});

test('route scripts are allowed by component script contract', () => {
    const document = doc(
        'file:///tmp/zenith-site/src/pages/index.zen',
        '<RootLayout><script>const x = 1;</script><h1>Home</h1></RootLayout>'
    );

    const diagnostics = collectContractDiagnostics(document, null, DEFAULT_SETTINGS, PROJECT_ROOT);
    const messageSet = diagnostics.map((item) => item.message);
    assert.ok(!messageSet.includes(CONTRACT_MESSAGES.componentScript));
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
