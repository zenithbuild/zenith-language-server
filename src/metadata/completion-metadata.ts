/**
 * Static completion catalogs surfaced by the language server.
 *
 * Audited against framework runtime exports
 * (`framework/packages/runtime/src/index.js`) and the Zenith agent contract
 * (`AGENTS.md`). Forbidden stale entries deliberately removed:
 * `zenOnMount`, `zenOnDestroy`, `zenOnUpdate`, `zenRef`, `zenState`
 * (React-tuple form), `useFetch`, `useRoute`, `useRouter`.
 */

import { CompletionItemKind } from 'vscode-languageserver/node';

export interface CompletionEntry {
    name: string;
    doc: string;
    snippet: string;
    kind: CompletionItemKind;
}

/**
 * Reactive/lifecycle entries surfaced inside `<script>` blocks.
 */
export const LIFECYCLE_HOOKS: CompletionEntry[] = [
    {
        name: 'state',
        doc: 'Declare a reactive local variable in a Zenith `.zen` script.\n\nReads use the plain identifier; writes use ordinary assignment (e.g. `count += 1`).',
        snippet: 'state ${1:name} = ${2:initial}',
        kind: CompletionItemKind.Keyword
    },
    {
        name: 'zenMount',
        doc: 'Run a callback once when the host element mounts.\n\nThe context exposes `cleanup(disposer)` for tearing down listeners and timers.',
        snippet: 'zenMount((ctx) => {\n\t$0\n})',
        kind: CompletionItemKind.Function
    },
    {
        name: 'zenEffect',
        doc: 'Reactive effect that re-runs when its tracked signal/state dependencies change.',
        snippet: 'zenEffect((ctx) => {\n\t$0\n})',
        kind: CompletionItemKind.Function
    }
];

/**
 * Platform/runtime primitives surfaced inside `<script>` blocks.
 */
export const PLATFORM_PRIMITIVES: CompletionEntry[] = [
    {
        name: 'zenWindow',
        doc: 'SSR-safe `window` access. Returns `null` outside the browser. Use instead of the global `window`.',
        snippet: 'zenWindow()',
        kind: CompletionItemKind.Function
    },
    {
        name: 'zenDocument',
        doc: 'SSR-safe `document` access. Returns `null` outside the browser. Use instead of the global `document`.',
        snippet: 'zenDocument()',
        kind: CompletionItemKind.Function
    },
    {
        name: 'zenOn',
        doc: 'Add an event listener returning a disposer suitable for `ctx.cleanup(...)`.\n\nForbidden alternative: calling `addEventListener` directly in `.zen` scripts.',
        snippet: "zenOn(${1:target}, '${2:event}', ${3:handler})",
        kind: CompletionItemKind.Function
    },
    {
        name: 'zenResize',
        doc: 'Subscribe to window resize updates. Returns a disposer suitable for `ctx.cleanup(...)`.',
        snippet: 'zenResize(({ w, h }) => {\n\t$0\n})',
        kind: CompletionItemKind.Function
    },
    {
        name: 'collectRefs',
        doc: 'Collect multiple refs into a deterministic array of attached elements. Use instead of `querySelectorAll` for multi-node operations.',
        snippet: 'collectRefs(${1:refA}, ${2:refB})',
        kind: CompletionItemKind.Function
    },
    {
        name: 'signal',
        doc: 'Create a reactive signal with explicit `.get()` / `.set(value)` / `.subscribe(fn)` methods.\n\nThere is no `.value` property — that pattern belongs to other frameworks.',
        snippet: 'const ${1:count} = signal(${2:0});\nfunction ${3:increment}() {\n\t${1:count}.set(${1:count}.get() + 1);\n}\n$0',
        kind: CompletionItemKind.Function
    },
    {
        name: 'ref',
        doc: 'Create a Zenith ref for a DOM node (or stable value). Access via `.current`. Do not use `.value`.',
        snippet: 'ref<${1:HTMLElement}>()',
        kind: CompletionItemKind.Function
    }
];

export interface HtmlElementMetadata {
    tag: string;
    doc: string;
    attrs?: string;
    selfClosing?: boolean;
}

/**
 * Common HTML elements offered as template-context completion.
 */
export const HTML_ELEMENTS: HtmlElementMetadata[] = [
    { tag: 'div', doc: 'Generic container element' },
    { tag: 'span', doc: 'Inline container element' },
    { tag: 'p', doc: 'Paragraph element' },
    { tag: 'a', doc: 'Anchor/link element', attrs: 'href="$1"' },
    { tag: 'button', doc: 'Button element', attrs: 'on:click={$1}' },
    { tag: 'input', doc: 'Input element', attrs: 'type="$1"', selfClosing: true },
    { tag: 'img', doc: 'Image element', attrs: 'src="$1" alt="$2"', selfClosing: true },
    { tag: 'h1', doc: 'Heading level 1' },
    { tag: 'h2', doc: 'Heading level 2' },
    { tag: 'h3', doc: 'Heading level 3' },
    { tag: 'h4', doc: 'Heading level 4' },
    { tag: 'h5', doc: 'Heading level 5' },
    { tag: 'h6', doc: 'Heading level 6' },
    { tag: 'ul', doc: 'Unordered list' },
    { tag: 'ol', doc: 'Ordered list' },
    { tag: 'li', doc: 'List item' },
    { tag: 'nav', doc: 'Navigation section' },
    { tag: 'header', doc: 'Header section' },
    { tag: 'footer', doc: 'Footer section' },
    { tag: 'main', doc: 'Main content' },
    { tag: 'section', doc: 'Generic section' },
    { tag: 'article', doc: 'Article content' },
    { tag: 'aside', doc: 'Sidebar content' },
    { tag: 'form', doc: 'Form element' },
    { tag: 'label', doc: 'Form label', attrs: 'for="$1"' },
    { tag: 'select', doc: 'Dropdown select' },
    { tag: 'option', doc: 'Select option', attrs: 'value="$1"' },
    { tag: 'textarea', doc: 'Multi-line text input' },
    { tag: 'table', doc: 'Table element' },
    { tag: 'thead', doc: 'Table header group' },
    { tag: 'tbody', doc: 'Table body group' },
    { tag: 'tr', doc: 'Table row' },
    { tag: 'th', doc: 'Table header cell' },
    { tag: 'td', doc: 'Table data cell' },
    { tag: 'br', doc: 'Line break', selfClosing: true },
    { tag: 'hr', doc: 'Horizontal rule', selfClosing: true },
    { tag: 'strong', doc: 'Strong emphasis (bold)' },
    { tag: 'em', doc: 'Emphasis (italic)' },
    { tag: 'code', doc: 'Inline code' },
    { tag: 'pre', doc: 'Preformatted text' },
    { tag: 'blockquote', doc: 'Block quotation' },
    {
        tag: 'slot',
        doc: 'Single implicit slot. Marks the position where a parent component\'s inner markup is inlined at compile time. There are no named slots and no `children` prop; the slot is the only inlining point.\n\nExample:\n```html\n<!-- inside Card.zen template -->\n<div class="card">\n  <slot></slot>\n</div>\n\n<!-- at call site -->\n<Card>Hello</Card>\n```',
        selfClosing: true
    }
];

/**
 * Common HTML attributes offered inside open tags.
 *
 * `className` is intentionally absent — the canonical Zenith attribute is
 * `class`. `children` is intentionally absent — children are inlined through
 * the single implicit `<slot />`, never via a `children` prop.
 */
export const HTML_ATTRIBUTES = [
    'id', 'class', 'style', 'title', 'href', 'src', 'alt', 'type', 'name', 'value',
    'placeholder', 'disabled', 'checked', 'readonly', 'required', 'hidden'
] as const;

/**
 * DOM events offered for `on:<event>` bindings.
 */
export const DOM_EVENTS = [
    'click', 'change', 'input', 'submit', 'keydown', 'keyup', 'keypress',
    'focus', 'blur', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave'
] as const;
