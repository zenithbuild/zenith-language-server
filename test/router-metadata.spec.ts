/**
 * Router catalog metadata aligned with framework packages/router/index.d.ts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CORE_MODULES } from '../src/metadata/core-imports';
import { ROUTER_FUNCTIONS } from '../src/router';

test('zenNavigationShell signature matches framework router index.d.ts (ref first)', () => {
    const shell = ROUTER_FUNCTIONS.find((fn) => fn.name === 'zenNavigationShell');
    assert.ok(shell, 'ROUTER_FUNCTIONS must include zenNavigationShell');
    assert.match(shell.signature, /zenNavigationShell\s*\(\s*ref\s*:/);
    assert.ok(
        shell.signature.includes('options?: NavigationShellOptions | null'),
        'signature must include optional nullable options per router index.d.ts'
    );
    assert.ok(
        !shell.signature.includes('zenNavigationShell(options?'),
        'must not document stale zenNavigationShell(options?) overload'
    );

    const core = CORE_MODULES['@zenithbuild/router']?.exports.find((e) => e.name === 'zenNavigationShell');
    assert.ok(core, 'CORE_MODULES must include zenNavigationShell');
    assert.equal(
        core.signature,
        shell.signature,
        'router catalog and core-imports zenNavigationShell signatures must match'
    );
});
