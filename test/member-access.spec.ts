/**
 * Unit tests for `parseMemberAccess`.
 *
 * Locks down the detector behavior independently of the LSP transport so the
 * completion orchestrator can rely on consistent receiver/prefix output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMemberAccess, isInStringLiteralOnLine } from '../src/member-access';

test('detects bare `count.` as member access with empty prefix', () => {
    const site = parseMemberAccess('count.');
    assert.deepEqual(site, { receiver: 'count', memberPrefix: '' });
});

test('detects `count.g` as member access with prefix `g`', () => {
    const site = parseMemberAccess('count.g');
    assert.deepEqual(site, { receiver: 'count', memberPrefix: 'g' });
});

test('detects `const x = count.` (boundary `=`)', () => {
    const site = parseMemberAccess('const x = count.');
    assert.deepEqual(site, { receiver: 'count', memberPrefix: '' });
});

test('detects `return count.` (boundary whitespace after keyword)', () => {
    const site = parseMemberAccess('return count.');
    assert.deepEqual(site, { receiver: 'count', memberPrefix: '' });
});

test('detects `foo(count.` (boundary `(`)', () => {
    const site = parseMemberAccess('foo(count.');
    assert.deepEqual(site, { receiver: 'count', memberPrefix: '' });
});

test('detects `[count.` (boundary `[`)', () => {
    const site = parseMemberAccess('[count.');
    assert.deepEqual(site, { receiver: 'count', memberPrefix: '' });
});

test('detects unknown receiver `thing.` (orchestrator decides receiver kind)', () => {
    const site = parseMemberAccess('thing.');
    assert.deepEqual(site, { receiver: 'thing', memberPrefix: '' });
});

test('rejects decimal literal `1.` (digit before `.` is not a receiver)', () => {
    assert.equal(parseMemberAccess('1.'), null);
});

test('rejects `0.5` and other numeric literal contexts', () => {
    assert.equal(parseMemberAccess('const x = 0.5'), null);
    assert.equal(parseMemberAccess('1.5'), null);
});

test('rejects bare `.` (no receiver)', () => {
    assert.equal(parseMemberAccess('.'), null);
    assert.equal(parseMemberAccess('   .'), null);
});

test('rejects empty input', () => {
    assert.equal(parseMemberAccess(''), null);
});

test('does not flag identifier with no trailing dot', () => {
    assert.equal(parseMemberAccess('count'), null);
    assert.equal(parseMemberAccess('return count'), null);
});

test('does not detect member access inside a string literal on the same line', () => {
    assert.equal(parseMemberAccess('const s = "count.'), null);
    assert.equal(parseMemberAccess("const s = 'count."), null);
    assert.equal(parseMemberAccess('const s = `count.'), null);
});

test('handles chained `obj.foo.` by returning rightmost identifier (resolved as unknown by caller)', () => {
    const site = parseMemberAccess('obj.foo.');
    assert.deepEqual(site, { receiver: 'foo', memberPrefix: '' });
});

test('handles ref-like names with underscores and dollar signs', () => {
    assert.deepEqual(parseMemberAccess('_el.'), { receiver: '_el', memberPrefix: '' });
    assert.deepEqual(parseMemberAccess('$signal.'), { receiver: '$signal', memberPrefix: '' });
    assert.deepEqual(parseMemberAccess('user_state.subs'), { receiver: 'user_state', memberPrefix: 'subs' });
});

test('boundary set includes operators and brackets', () => {
    assert.deepEqual(parseMemberAccess('a + count.'), { receiver: 'count', memberPrefix: '' });
    assert.deepEqual(parseMemberAccess('a * count.'), { receiver: 'count', memberPrefix: '' });
    assert.deepEqual(parseMemberAccess('!count.'), { receiver: 'count', memberPrefix: '' });
    assert.deepEqual(parseMemberAccess('?count.'), { receiver: 'count', memberPrefix: '' });
    assert.deepEqual(parseMemberAccess('{count.'), { receiver: 'count', memberPrefix: '' });
});

test('isInStringLiteralOnLine flags inside open quotes only', () => {
    assert.equal(isInStringLiteralOnLine('const x = "abc'), true);
    assert.equal(isInStringLiteralOnLine("const x = 'abc"), true);
    assert.equal(isInStringLiteralOnLine('const x = `abc'), true);
    assert.equal(isInStringLiteralOnLine('const x = "abc"'), false);
    assert.equal(isInStringLiteralOnLine('const x = 1'), false);
});

test('multi-line input only considers the current line for string detection', () => {
    const before = 'const greeting = "hello world"\ncount.';
    assert.deepEqual(parseMemberAccess(before), { receiver: 'count', memberPrefix: '' });
});
