"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server.ts
var path5 = __toESM(require("path"));
var import_node7 = require("vscode-languageserver/node");
var import_vscode_languageserver_textdocument = require("vscode-languageserver-textdocument");

// src/project.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var ZENITH_CONFIG_CANDIDATES = [
  "zenith.config.ts",
  "zenith.config.js",
  "zenith.config.mjs",
  "zenith.config.cjs",
  "zenith.config.json"
];
function hasZenithConfig(dir) {
  return ZENITH_CONFIG_CANDIDATES.some((fileName) => fs.existsSync(path.join(dir, fileName)));
}
function hasZenithCliDependency(dir) {
  const packageJsonPath = path.join(dir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(raw);
    const deps = [
      pkg.dependencies || {},
      pkg.devDependencies || {},
      pkg.peerDependencies || {},
      pkg.optionalDependencies || {}
    ];
    return deps.some((group) => Object.prototype.hasOwnProperty.call(group, "@zenithbuild/cli"));
  } catch {
    return false;
  }
}
function hasZenithStructure(dir) {
  const srcDir = path.join(dir, "src");
  if (fs.existsSync(srcDir)) {
    const hasPages = fs.existsSync(path.join(srcDir, "pages"));
    const hasLayouts = fs.existsSync(path.join(srcDir, "layouts"));
    if (hasPages || hasLayouts) {
      return true;
    }
  }
  const appDir = path.join(dir, "app");
  if (fs.existsSync(appDir)) {
    const hasPages = fs.existsSync(path.join(appDir, "pages"));
    const hasLayouts = fs.existsSync(path.join(appDir, "layouts"));
    if (hasPages || hasLayouts) {
      return true;
    }
  }
  return false;
}
function findNearestByRule(startPath, predicate) {
  let current = path.resolve(startPath);
  if (!fs.existsSync(current)) {
    current = path.dirname(current);
  }
  while (!fs.existsSync(current) && current !== path.dirname(current)) {
    current = path.dirname(current);
  }
  if (!fs.existsSync(current)) {
    return null;
  }
  if (!fs.statSync(current).isDirectory()) {
    current = path.dirname(current);
  }
  while (current !== path.dirname(current)) {
    if (predicate(current)) {
      return current;
    }
    current = path.dirname(current);
  }
  if (predicate(current)) {
    return current;
  }
  return null;
}
function findFallbackRoot(startPath) {
  return findNearestByRule(startPath, (dir) => {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return true;
    }
    if (hasZenithStructure(dir)) {
      return true;
    }
    return false;
  });
}
function detectProjectRoot(startPath, workspaceFolders2 = []) {
  const localConfigRoot = findNearestByRule(startPath, hasZenithConfig);
  if (localConfigRoot) {
    return localConfigRoot;
  }
  const localCliRoot = findNearestByRule(startPath, hasZenithCliDependency);
  if (localCliRoot) {
    return localCliRoot;
  }
  const localStructureRoot = findNearestByRule(startPath, hasZenithStructure);
  if (localStructureRoot) {
    return localStructureRoot;
  }
  const absoluteStart = path.resolve(startPath);
  const matchingWorkspaceFolders = workspaceFolders2.map((workspacePath) => path.resolve(workspacePath)).filter((workspacePath) => absoluteStart === workspacePath || absoluteStart.startsWith(`${workspacePath}${path.sep}`)).sort((a, b) => b.length - a.length);
  for (const workspaceRoot of matchingWorkspaceFolders) {
    if (hasZenithConfig(workspaceRoot)) {
      return workspaceRoot;
    }
    if (hasZenithCliDependency(workspaceRoot)) {
      return workspaceRoot;
    }
    if (hasZenithStructure(workspaceRoot)) {
      return workspaceRoot;
    }
  }
  return findFallbackRoot(startPath);
}
function extractPropsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const props = [];
    const propsMatch = content.match(/(?:interface|type)\s+Props\s*[={]\s*\{([^}]+)\}/);
    if (propsMatch && propsMatch[1]) {
      const propNames = propsMatch[1].match(/([a-zA-Z_$][a-zA-Z0-9_$?]*)\s*[?:]?\s*:/g);
      if (propNames) {
        for (const p of propNames) {
          const name = p.replace(/[?:\s]/g, "");
          if (name && !props.includes(name)) {
            props.push(name);
          }
        }
      }
    }
    return props;
  } catch {
    return [];
  }
}
function discoverZenFiles(dir, type) {
  const result = /* @__PURE__ */ new Map();
  if (!fs.existsSync(dir)) {
    return result;
  }
  function scanDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith(".zen")) {
        const name = path.basename(entry.name, ".zen");
        const props = extractPropsFromFile(fullPath);
        result.set(name, {
          name,
          filePath: fullPath,
          type,
          props
        });
      }
    }
  }
  scanDir(dir);
  return result;
}
function buildProjectGraph(root) {
  const srcDir = fs.existsSync(path.join(root, "src")) ? path.join(root, "src") : path.join(root, "app");
  const layouts = discoverZenFiles(path.join(srcDir, "layouts"), "layout");
  const components = discoverZenFiles(path.join(srcDir, "components"), "component");
  const pages = discoverZenFiles(path.join(srcDir, "pages"), "page");
  return {
    root,
    layouts,
    components,
    pages
  };
}
function resolveComponent(graph, name) {
  if (graph.layouts.has(name)) {
    return graph.layouts.get(name);
  }
  if (graph.components.has(name)) {
    return graph.components.get(name);
  }
  return void 0;
}

// src/completion.ts
var path2 = __toESM(require("path"));
var import_node5 = require("vscode-languageserver/node");

// src/metadata/directive-metadata.ts
var DIRECTIVES = {
  "zen:if": {
    name: "zen:if",
    category: "control-flow",
    description: "Compile-time conditional directive. Conditionally renders the element based on a boolean expression.",
    syntax: 'zen:if="condition"',
    placement: ["element", "component"],
    example: '<div zen:if="isVisible">Conditionally rendered</div>'
  },
  "zen:for": {
    name: "zen:for",
    category: "iteration",
    description: "Compile-time iteration directive. Repeats the element for each item in a collection.",
    syntax: 'zen:for="item in items" or zen:for="item, index in items"',
    placement: ["element", "component"],
    example: '<li zen:for="item in items">{item.name}</li>',
    createsScope: true,
    scopeVariables: ["item", "index"]
  },
  "zen:effect": {
    name: "zen:effect",
    category: "reactive-effect",
    description: "Compile-time reactive effect directive. Attaches a side effect to the element lifecycle.",
    syntax: 'zen:effect="expression"',
    placement: ["element", "component"],
    example: `<div zen:effect="console.log('rendered')">Content</div>`
  },
  "zen:show": {
    name: "zen:show",
    category: "conditional-visibility",
    description: "Compile-time visibility directive. Toggles element visibility without removing from DOM.",
    syntax: 'zen:show="condition"',
    placement: ["element", "component"],
    example: '<div zen:show="isOpen">Toggle visibility</div>'
  }
};
function isDirective(name) {
  return name in DIRECTIVES;
}
function getDirective(name) {
  return DIRECTIVES[name];
}
function getDirectiveNames() {
  return Object.keys(DIRECTIVES);
}
function canPlaceDirective(directiveName, elementType) {
  const directive = DIRECTIVES[directiveName];
  if (!directive)
    return false;
  if (elementType === "slot")
    return false;
  return directive.placement.includes(elementType);
}
function parseForExpression(expression) {
  const match = expression.match(/^\s*([a-zA-Z_$][\w$]*)(?:\s*,\s*([a-zA-Z_$][\w$]*))?\s+in\s+(.+)\s*$/);
  if (!match)
    return null;
  return {
    itemVar: match[1],
    indexVar: match[2],
    source: match[3].trim()
  };
}

// src/metadata/completion-metadata.ts
var import_node = require("vscode-languageserver/node");
var LIFECYCLE_HOOKS = [
  {
    name: "state",
    doc: "Declare a reactive local variable in a Zenith `.zen` script.\n\nReads use the plain identifier; writes use ordinary assignment (e.g. `count += 1`).",
    snippet: "state ${1:name} = ${2:initial}",
    kind: import_node.CompletionItemKind.Keyword
  },
  {
    name: "zenMount",
    doc: "Run a callback once when the host element mounts.\n\nThe context exposes `cleanup(disposer)` for tearing down listeners and timers.",
    snippet: "zenMount((ctx) => {\n	$0\n})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zenEffect",
    doc: "Reactive effect that re-runs when its tracked signal/state dependencies change.",
    snippet: "zenEffect((ctx) => {\n	$0\n})",
    kind: import_node.CompletionItemKind.Function
  }
];
var PLATFORM_PRIMITIVES = [
  {
    name: "signal",
    doc: "Zenith signal: create a reactive signal with explicit `.get()` / `.set(value)` / `.subscribe(fn)` methods.\n\nThere is no `.value` property \u2014 that pattern belongs to other frameworks.",
    snippet: "const ${1:count} = signal(${2:0});\nfunction ${3:increment}() {\n	${1:count}.set(${1:count}.get() + 1);\n}\n$0",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "state",
    doc: "**Runtime** plain-object store imported from `zenith`: `.get()` / `.set(patch | updater)` / `.subscribe`. Distinct from declarative `state name = initial` (keyword completion above).",
    snippet: "state(${1:{ count: 0 }})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "ref",
    doc: "Create a Zenith ref for a DOM node (or stable value). Access via `.current`. Do not use `.value`.",
    snippet: "ref<${1:HTMLElement}>()",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zeneffect",
    doc: "Low-level effect primitive: auto-tracked callback or explicit `(dependencies[], effect)`. Prefer `zenEffect` in `.zen` unless you need explicit dependency lists.",
    snippet: "zeneffect((ctx) => {\n	$0\n})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "effect",
    doc: "Alias of `zeneffect` (bundled runtime export). Prefer `zenEffect` / `zeneffect` in new code.",
    snippet: "effect((ctx) => {\n	$0\n})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "mount",
    doc: "Alias of `zenMount` (bundled runtime export). Prefer `zenMount` in `.zen` scripts.",
    snippet: "mount((ctx) => {\n	$0\n})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zenPresence",
    doc: "Ref-owned presence controller for enter/exit transitions. Call `.mount()` inside `zenMount`, drive `.setPresent(...)` from reactive state.",
    snippet: "zenPresence(${1:ref})$0",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "presence",
    doc: "Alias of `zenPresence`.",
    snippet: "presence(${1:ref})$0",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "hydrate",
    doc: "Client bootstrap for hydrating a compiled Zenith payload. Advanced integration surface used outside typical `.zen` components.",
    snippet: "hydrate($0)",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zenWindow",
    doc: "SSR-safe `window` access. Returns `null` outside the browser. Use instead of the global `window`.",
    snippet: "zenWindow()",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zenDocument",
    doc: "SSR-safe `document` access. Returns `null` outside the browser. Use instead of the global `document`.",
    snippet: "zenDocument()",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zenOn",
    doc: "Add an event listener returning a disposer suitable for `ctx.cleanup(...)`.\n\nForbidden alternative: calling `addEventListener` directly in `.zen` scripts.",
    snippet: "zenOn(${1:target}, '${2:event}', ${3:handler})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "zenResize",
    doc: "Subscribe to window resize updates. Returns a disposer suitable for `ctx.cleanup(...)`.",
    snippet: "zenResize(({ w, h }) => {\n	$0\n})",
    kind: import_node.CompletionItemKind.Function
  },
  {
    name: "collectRefs",
    doc: "Collect multiple refs into a deterministic array of attached elements. Use instead of `querySelectorAll` for multi-node operations.",
    snippet: "collectRefs(${1:refA}, ${2:refB})",
    kind: import_node.CompletionItemKind.Function
  }
];
var HTML_ELEMENTS = [
  { tag: "div", doc: "Generic container element" },
  { tag: "span", doc: "Inline container element" },
  { tag: "p", doc: "Paragraph element" },
  { tag: "a", doc: "Anchor/link element", attrs: 'href="$1"' },
  { tag: "button", doc: "Button element", attrs: "on:click={$1}" },
  { tag: "input", doc: "Input element", attrs: 'type="$1"', selfClosing: true },
  { tag: "img", doc: "Image element", attrs: 'src="$1" alt="$2"', selfClosing: true },
  { tag: "h1", doc: "Heading level 1" },
  { tag: "h2", doc: "Heading level 2" },
  { tag: "h3", doc: "Heading level 3" },
  { tag: "h4", doc: "Heading level 4" },
  { tag: "h5", doc: "Heading level 5" },
  { tag: "h6", doc: "Heading level 6" },
  { tag: "ul", doc: "Unordered list" },
  { tag: "ol", doc: "Ordered list" },
  { tag: "li", doc: "List item" },
  { tag: "nav", doc: "Navigation section" },
  { tag: "header", doc: "Header section" },
  { tag: "footer", doc: "Footer section" },
  { tag: "main", doc: "Main content" },
  { tag: "section", doc: "Generic section" },
  { tag: "article", doc: "Article content" },
  { tag: "aside", doc: "Sidebar content" },
  { tag: "form", doc: "Form element" },
  { tag: "label", doc: "Form label", attrs: 'for="$1"' },
  { tag: "select", doc: "Dropdown select" },
  { tag: "option", doc: "Select option", attrs: 'value="$1"' },
  { tag: "textarea", doc: "Multi-line text input" },
  { tag: "table", doc: "Table element" },
  { tag: "thead", doc: "Table header group" },
  { tag: "tbody", doc: "Table body group" },
  { tag: "tr", doc: "Table row" },
  { tag: "th", doc: "Table header cell" },
  { tag: "td", doc: "Table data cell" },
  { tag: "br", doc: "Line break", selfClosing: true },
  { tag: "hr", doc: "Horizontal rule", selfClosing: true },
  { tag: "strong", doc: "Strong emphasis (bold)" },
  { tag: "em", doc: "Emphasis (italic)" },
  { tag: "code", doc: "Inline code" },
  { tag: "pre", doc: "Preformatted text" },
  { tag: "blockquote", doc: "Block quotation" },
  {
    tag: "slot",
    doc: 'Single implicit slot. Marks the position where a parent component\'s inner markup is inlined at compile time. There are no named slots and no `children` prop; the slot is the only inlining point.\n\nExample:\n```html\n<!-- inside Card.zen template -->\n<div class="card">\n  <slot></slot>\n</div>\n\n<!-- at call site -->\n<Card>Hello</Card>\n```',
    selfClosing: true
  }
];
var HTML_ATTRIBUTES = [
  "id",
  "class",
  "style",
  "title",
  "href",
  "src",
  "alt",
  "type",
  "name",
  "value",
  "placeholder",
  "disabled",
  "checked",
  "readonly",
  "required",
  "hidden"
];
var DOM_EVENTS = [
  // Prefer pointer events where applicable (Zenith agent contract).
  "click",
  "change",
  "input",
  "submit",
  "keydown",
  "keyup",
  "keypress",
  "pointerdown",
  "pointerup",
  "pointermove",
  "pointercancel",
  "pointerenter",
  "pointerleave",
  "focus",
  "blur",
  "mouseover",
  "mouseout",
  "mouseenter",
  "mouseleave",
  // Compiler-supported aliases (normalized at compile time).
  "hoverin",
  "hoverout",
  "doubleclick",
  "esc"
];

// src/metadata/core-imports.ts
var CORE_MODULES = {
  "zenith": {
    module: "zenith",
    description: "Core Zenith runtime primitives.",
    exports: [
      {
        name: "signal",
        kind: "function",
        description: "Create a reactive signal. Returns an object with explicit `.get()` / `.set(value)` / `.subscribe(fn)` methods. There is no `.value` property.",
        signature: "signal<T>(initialValue: T): { get(): T; set(next: T): T; subscribe(fn: (value: T) => void): () => void }"
      },
      {
        name: "state",
        kind: "function",
        description: "Runtime plain-object store. Reads via `.get()`, writes via `.set(patch | (prev) => next)`. For declarative reactive locals in `.zen` scripts prefer the compiler form `state name = initial`.",
        signature: "state<T extends Record<string, unknown>>(initial: T): { get(): Readonly<T>; set(patch: Partial<T> | ((prev: Readonly<T>) => T)): Readonly<T> }"
      },
      {
        name: "ref",
        kind: "function",
        description: "Create a Zenith ref for DOM nodes (and stable values). Access via `.current`. Forbidden patterns: `.value`, Vue-style reactive wrappers.",
        signature: "ref<T>(initialValue?: T): { current: T | null }"
      },
      {
        name: "zenEffect",
        kind: "function",
        description: "Reactive effect that re-runs when its tracked signal/state dependencies change. Provides a context with `cleanup`, `timeout`, `raf`, `debounce` helpers.",
        signature: "zenEffect(effect: (ctx: EffectContext) => void | (() => void), options?: EffectOptions): void"
      },
      {
        name: "zenMount",
        kind: "function",
        description: "Run a callback once when the host element mounts. Provides a context with `cleanup(disposer)` for tearing down listeners and timers.",
        signature: "zenMount(callback: (ctx: { cleanup(disposer: () => void): void }) => void | (() => void)): void"
      },
      {
        name: "zenWindow",
        kind: "function",
        description: "SSR-safe `window` access. Returns `null` outside the browser. Use instead of the global `window`.",
        signature: "zenWindow(): Window | null"
      },
      {
        name: "zenDocument",
        kind: "function",
        description: "SSR-safe `document` access. Returns `null` outside the browser. Use instead of the global `document`.",
        signature: "zenDocument(): Document | null"
      },
      {
        name: "zenOn",
        kind: "function",
        description: "Add an event listener that is SSR-safe and returns a disposer suitable for `ctx.cleanup(...)`. Forbidden alternative: calling `addEventListener` directly in `.zen` scripts.",
        signature: "zenOn<T extends Event>(target: EventTarget | null, eventName: string, handler: (event: T) => void, options?: AddEventListenerOptions): () => void"
      },
      {
        name: "zenResize",
        kind: "function",
        description: "Subscribe to window resize updates. Returns a disposer suitable for `ctx.cleanup(...)`.",
        signature: "zenResize(handler: (size: { w: number; h: number }) => void): () => void"
      },
      {
        name: "collectRefs",
        kind: "function",
        description: "Collect multiple Zenith refs into a deterministic array of attached elements. Use instead of `querySelectorAll` for multi-node operations.",
        signature: "collectRefs<T extends Element>(...refs: { current: T | null }[]): T[]"
      },
      {
        name: "zeneffect",
        kind: "function",
        description: "Low-level effect primitive from `zenith`: auto-tracked `(effect)` or explicit `(dependencies[], effect)`. Prefer `zenEffect` unless dependency lists are required.",
        signature: "zeneffect(effect: (ctx: EffectContext) => void | (() => void), options?: EffectOptions): void\nzeneffect<T>(dependencies: unknown[], effect: (ctx: EffectContext) => void | (() => void)): void"
      },
      {
        name: "effect",
        kind: "function",
        description: "Alias of `zeneffect` (bundled runtime export).",
        signature: "effect: typeof zeneffect"
      },
      {
        name: "mount",
        kind: "function",
        description: "Alias of `zenMount` (bundled runtime export).",
        signature: "mount: typeof zenMount"
      },
      {
        name: "zenPresence",
        kind: "function",
        description: "Ref-owned presence controller for enter/exit transitions. Typically call `.mount()` inside `zenMount` and drive `.setPresent(...)` from reactive state.",
        signature: "zenPresence(ref: { current?: Element | null }, options?: { timeoutMs?: number; onPhaseChange?: (phase: string, ctx: unknown) => void } | null): { mount(): () => void; destroy(): void; getPhase(): string; setPresent(nextPresent: boolean): void }"
      },
      {
        name: "presence",
        kind: "function",
        description: "Alias of `zenPresence`.",
        signature: "presence: typeof zenPresence"
      },
      {
        name: "hydrate",
        kind: "function",
        description: "Client bootstrap entry that hydrates compiled Zenith payload output. Advanced runtime integration surface.",
        signature: "hydrate(payload: unknown): void"
      }
    ]
  },
  "zenith:server-contract": {
    module: "zenith:server-contract",
    description: 'Server-side route handler primitives and result helpers used inside `<script server lang="ts">` blocks and `page.guard.ts` / `page.load.ts` files.',
    exports: [
      {
        name: "allow",
        kind: "function",
        description: "Result helper that allows the request to continue. Returned from `guard(ctx)`.",
        signature: "allow(): RouteResult"
      },
      {
        name: "redirect",
        kind: "function",
        description: "Result helper that redirects to the given location. Returned from `guard(ctx)` or `load(ctx)`.",
        signature: "redirect(location: string, status?: number): RouteResult"
      },
      {
        name: "deny",
        kind: "function",
        description: "Result helper that denies the request with an optional status and message.",
        signature: "deny(status?: number, message?: string): RouteResult"
      },
      {
        name: "data",
        kind: "function",
        description: "Result helper that returns a payload to the route component as `data`. Returned from `load(ctx)` or `action(ctx)`. A plain object returned from `load` is treated as `data(payload)`.",
        signature: "data<T>(payload: T): RouteResult<T>"
      },
      {
        name: "invalid",
        kind: "function",
        description: "Result helper for invalid action inputs (validation failures, etc.).",
        signature: "invalid(reason: string, details?: Record<string, unknown>): RouteResult"
      },
      {
        name: "json",
        kind: "function",
        description: "Result helper for JSON responses from `action(ctx)`.",
        signature: "json<T>(payload: T, init?: { status?: number; headers?: Record<string, string> }): RouteResult<T>"
      },
      {
        name: "text",
        kind: "function",
        description: "Result helper for plain text responses from `action(ctx)`.",
        signature: "text(body: string, init?: { status?: number; headers?: Record<string, string> }): RouteResult"
      },
      {
        name: "download",
        kind: "function",
        description: "Result helper for downloadable file responses from `action(ctx)`.",
        signature: "download(body: BodyInit, filename: string, init?: { status?: number; headers?: Record<string, string> }): RouteResult"
      },
      {
        name: "withMiddleware",
        kind: "function",
        description: "Compose route-local middleware around `guard(ctx)`, `load(ctx)`, or `action(ctx)`. Middleware composes left-to-right as declared.",
        signature: "withMiddleware<H>(handler: H, ...middleware: Array<(h: H) => H>): H"
      }
    ]
  },
  "@zenithbuild/router": {
    module: "@zenithbuild/router",
    description: "Shipped Zenith router package. Use `navigate()` for programmatic navigation and `<ZenLink>` (imported from `@zenithbuild/router/ZenLink.zen`) for anchor-based soft navigation.",
    exports: [
      {
        name: "createRouter",
        kind: "function",
        description: "Bootstrap a router instance over a route table and a container element. Typically called once at app entry.",
        signature: "createRouter(config: { routes: Route[]; container: HTMLElement }): { start(): Promise<void>; destroy(): void }"
      },
      {
        name: "navigate",
        kind: "function",
        description: "Navigate to a path. Performs the canonical Zenith soft-navigation flow (guard \u2192 load \u2192 render). Falls back to a hard navigation when the router cannot safely mirror server truth.",
        signature: "navigate(path: string): Promise<void>"
      },
      {
        name: "refreshCurrentRoute",
        kind: "function",
        description: "Re-resolve and re-render the current route. Useful after mutating server-side data that should be re-fetched by `load`.",
        signature: "refreshCurrentRoute(): Promise<void>"
      },
      {
        name: "back",
        kind: "function",
        description: "Go back one entry in the navigation history.",
        signature: "back(): void"
      },
      {
        name: "forward",
        kind: "function",
        description: "Go forward one entry in the navigation history.",
        signature: "forward(): void"
      },
      {
        name: "getCurrentPath",
        kind: "function",
        description: "Read the current route path. Returns the active URL pathname without query/hash.",
        signature: "getCurrentPath(): string"
      },
      {
        name: "onRouteChange",
        kind: "function",
        description: "Subscribe to navigation completion events. Returns a disposer.",
        signature: "onRouteChange(listener: (event: { path: string; routeId: string; params: Record<string, string> }) => void): () => void"
      },
      {
        name: "on",
        kind: "function",
        description: "Subscribe to a router lifecycle event (e.g. `route:beforeleave`, `route:enter`, `route:error`). Returns a disposer.",
        signature: "on(event: string, listener: (payload: unknown) => void): () => void"
      },
      {
        name: "off",
        kind: "function",
        description: "Remove a previously registered router lifecycle listener.",
        signature: "off(event: string, listener: (payload: unknown) => void): void"
      },
      {
        name: "setAdvisoryRoutePolicy",
        kind: "function",
        description: "Configure client-side advisory behavior (deny handling, login redirect, 403 path). Security remains server-authoritative; this only shapes navigation UX.",
        signature: "setAdvisoryRoutePolicy(policy: AdvisoryRoutePolicy): void"
      },
      {
        name: "zenNavigationShell",
        kind: "function",
        description: "Mount a navigation-shell controller that observes phase transitions (`idle` \u2192 `leaving` \u2192 `swapping` \u2192 `entering`) for chrome animations and skeletons.",
        signature: "zenNavigationShell(ref: { current?: Element | null }, options?: NavigationShellOptions | null): NavigationShellController"
      },
      {
        name: "matchRoute",
        kind: "function",
        description: "Match a path against a static route table. Returns the matched route and extracted params, or `null`.",
        signature: "matchRoute(routes: Route[], path: string): { route: Route; params: Record<string, string> } | null"
      }
    ]
  },
  "@zenithbuild/router/ZenLink.zen": {
    module: "@zenithbuild/router/ZenLink.zen",
    description: 'Default-exports the canonical `<ZenLink>` anchor component. Renders a real `<a data-zen-link="true" href="...">` and opts into Zenith soft navigation. Imported as `import ZenLink from "@zenithbuild/router/ZenLink.zen"`.',
    exports: [
      {
        name: "ZenLink",
        kind: "component",
        description: "Default export: the `<ZenLink>` component. Props: `href` (required), `class`, `target`, `rel`, `id`, `title`, `ariaLabel`, `ariaCurrent`, `ariaDisabled`, `elementRef`, `onClick`, `onHoverIn`, `onHoverOut`, `onFocus`, `onBlur`. Children are inlined into the single implicit slot.",
        signature: '<ZenLink href="/path">label</ZenLink>'
      }
    ]
  }
};
function getCoreModule(moduleName) {
  return CORE_MODULES[moduleName];
}
function getCoreExport(moduleName, exportName) {
  const module2 = CORE_MODULES[moduleName];
  if (!module2)
    return void 0;
  return module2.exports.find((e) => e.name === exportName);
}
function isCoreModule(moduleName) {
  return moduleName in CORE_MODULES;
}

// src/metadata/plugin-imports.ts
var PLUGIN_MODULES = {
  "zenith:content": {
    module: "zenith:content",
    description: "Content collections plugin for Zenith. Provides type-safe content management for Markdown, MDX, and JSON files.",
    exports: [
      {
        name: "zenCollection",
        kind: "function",
        description: "Define a content collection with schema validation.",
        signature: "zenCollection<T>(options: { name: string; schema: T }): Collection<T>"
      },
      {
        name: "getCollection",
        kind: "function",
        description: "Get all entries from a content collection.",
        signature: "getCollection(name: string): Promise<CollectionEntry[]>"
      },
      {
        name: "getEntry",
        kind: "function",
        description: "Get a single entry from a content collection.",
        signature: "getEntry(collection: string, slug: string): Promise<CollectionEntry | undefined>"
      },
      {
        name: "useZenOrder",
        kind: "function",
        description: "Hook to sort collection entries by frontmatter order field.",
        signature: "useZenOrder(entries: CollectionEntry[]): CollectionEntry[]"
      }
    ],
    required: false
  },
  "zenith:image": {
    module: "zenith:image",
    description: "Image optimization plugin for Zenith.",
    exports: [
      {
        name: "Image",
        kind: "function",
        description: "Optimized image component with automatic format conversion and lazy loading.",
        signature: "Image({ src: string; alt: string; width?: number; height?: number })"
      },
      {
        name: "getImage",
        kind: "function",
        description: "Get optimized image metadata.",
        signature: "getImage(src: string, options?: ImageOptions): Promise<ImageMetadata>"
      }
    ],
    required: false
  }
};
function getPluginModule(moduleName) {
  return PLUGIN_MODULES[moduleName];
}
function getPluginExport(moduleName, exportName) {
  const module2 = PLUGIN_MODULES[moduleName];
  if (!module2)
    return void 0;
  return module2.exports.find((e) => e.name === exportName);
}
function isPluginModule(moduleName) {
  return moduleName.startsWith("zenith:");
}
function isKnownPluginModule(moduleName) {
  return moduleName in PLUGIN_MODULES;
}

// src/imports.ts
function isZenithTrackedModule(moduleName) {
  if (moduleName === "zenith")
    return true;
  if (moduleName.startsWith("zenith/"))
    return true;
  if (moduleName.startsWith("zenith:"))
    return true;
  if (moduleName === "@zenithbuild/router")
    return true;
  if (moduleName.startsWith("@zenithbuild/router/"))
    return true;
  return false;
}
function parseZenithImports(script) {
  const imports = [];
  const lines = script.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const importMatch = line.match(/import\s+(type\s+)?(?:\{([^}]+)\}|(\*\s+as\s+\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const isType = !!importMatch[1];
      const namedImports = importMatch[2];
      const namespaceImport = importMatch[3];
      const defaultImport = importMatch[4];
      const moduleName = importMatch[5];
      if (isZenithTrackedModule(moduleName)) {
        const specifiers = [];
        if (namedImports) {
          const parts = namedImports.split(",");
          for (const part of parts) {
            const cleaned = part.trim().split(/\s+as\s+/)[0].trim();
            if (cleaned)
              specifiers.push(cleaned);
          }
        } else if (namespaceImport) {
          specifiers.push(namespaceImport.trim());
        } else if (defaultImport) {
          specifiers.push(defaultImport);
        }
        imports.push({
          module: moduleName,
          specifiers,
          isType,
          line: i + 1
        });
      }
    }
    const sideEffectMatch = line.match(/import\s+['"]([^'"]+)['"]/);
    if (sideEffectMatch && !importMatch) {
      const moduleName = sideEffectMatch[1];
      if (isZenithTrackedModule(moduleName)) {
        imports.push({
          module: moduleName,
          specifiers: [],
          isType: false,
          line: i + 1
        });
      }
    }
  }
  return imports;
}
function resolveModule(moduleName) {
  if (isCoreModule(moduleName)) {
    return {
      module: moduleName,
      kind: "core",
      metadata: getCoreModule(moduleName),
      isKnown: true
    };
  }
  if (isPluginModule(moduleName)) {
    return {
      module: moduleName,
      kind: "plugin",
      metadata: getPluginModule(moduleName),
      isKnown: isKnownPluginModule(moduleName)
    };
  }
  return {
    module: moduleName,
    kind: "external",
    isKnown: false
  };
}
function resolveExport(moduleName, exportName) {
  if (isCoreModule(moduleName)) {
    return getCoreExport(moduleName, exportName);
  }
  if (isKnownPluginModule(moduleName)) {
    return getPluginExport(moduleName, exportName);
  }
  return void 0;
}
function hasRouterImport(imports) {
  return imports.some(
    (i) => i.module === "@zenithbuild/router" || i.module.startsWith("@zenithbuild/router/")
  );
}
function hasZenLinkImport(imports) {
  return imports.some(
    (i) => i.module === "@zenithbuild/router/ZenLink.zen" || i.module === "@zenithbuild/router" && i.specifiers.includes("ZenLink")
  );
}
function getAllModules() {
  const modules = [];
  for (const [name, meta] of Object.entries(CORE_MODULES)) {
    modules.push({
      module: name,
      kind: "core",
      description: meta.description
    });
  }
  for (const [name, meta] of Object.entries(PLUGIN_MODULES)) {
    modules.push({
      module: name,
      kind: "plugin",
      description: meta.description
    });
  }
  return modules;
}
function getModuleExports(moduleName) {
  const coreModule = getCoreModule(moduleName);
  if (coreModule)
    return coreModule.exports;
  const pluginModule = getPluginModule(moduleName);
  if (pluginModule)
    return pluginModule.exports;
  return [];
}

// src/router.ts
var ROUTER_FUNCTIONS = [
  {
    name: "createRouter",
    description: "Bootstrap a router instance over a route table and a container element. Typically called once at app entry.",
    signature: "createRouter(config: { routes: Route[]; container: HTMLElement }): { start(): Promise<void>; destroy(): void }"
  },
  {
    name: "navigate",
    description: "Navigate to a path. Runs the canonical Zenith soft-navigation flow (guard \u2192 load \u2192 render). Falls back to hard navigation when the router cannot mirror server truth.",
    signature: "navigate(path: string): Promise<void>"
  },
  {
    name: "refreshCurrentRoute",
    description: "Re-resolve and re-render the current route. Useful after mutating server-side data that should be re-fetched by `load`.",
    signature: "refreshCurrentRoute(): Promise<void>"
  },
  {
    name: "back",
    description: "Go back one entry in the navigation history.",
    signature: "back(): void"
  },
  {
    name: "forward",
    description: "Go forward one entry in the navigation history.",
    signature: "forward(): void"
  },
  {
    name: "getCurrentPath",
    description: "Read the current route path. Returns the active URL pathname without query/hash.",
    signature: "getCurrentPath(): string"
  },
  {
    name: "onRouteChange",
    description: "Subscribe to navigation completion events. Returns a disposer.",
    signature: "onRouteChange(listener: (event: { path: string; routeId: string; params: Record<string, string> }) => void): () => void"
  },
  {
    name: "on",
    description: "Subscribe to a router lifecycle event (e.g. `route:beforeleave`, `route:enter`, `route:error`). Returns a disposer.",
    signature: "on(event: string, listener: (payload: unknown) => void): () => void"
  },
  {
    name: "off",
    description: "Remove a previously registered router lifecycle listener.",
    signature: "off(event: string, listener: (payload: unknown) => void): void"
  },
  {
    name: "setAdvisoryRoutePolicy",
    description: "Configure client-side advisory behavior (deny handling, login redirect, 403 path). Security remains server-authoritative; this only shapes navigation UX.",
    signature: "setAdvisoryRoutePolicy(policy: AdvisoryRoutePolicy): void"
  },
  {
    name: "zenNavigationShell",
    description: "Mount a navigation-shell controller that observes phase transitions (`idle` \u2192 `leaving` \u2192 `swapping` \u2192 `entering`) for chrome animations and skeletons.",
    signature: "zenNavigationShell(ref: { current?: Element | null }, options?: NavigationShellOptions | null): NavigationShellController"
  },
  {
    name: "matchRoute",
    description: "Match a path against a static route table. Returns the matched route and extracted params, or `null`.",
    signature: "matchRoute(routes: Route[], path: string): { route: Route; params: Record<string, string> } | null"
  }
];
var ZENLINK_PROPS = [
  {
    name: "href",
    type: "string",
    required: true,
    description: 'Anchor href. Renders as a real `<a href="...">` with `data-zen-link="true"`.'
  },
  {
    name: "class",
    type: "string",
    required: false,
    description: "CSS class applied to the rendered anchor."
  },
  {
    name: "target",
    type: "string",
    required: false,
    description: "Standard anchor `target` attribute (e.g. `_blank`)."
  },
  {
    name: "rel",
    type: "string",
    required: false,
    description: "Standard anchor `rel` attribute (e.g. `noopener noreferrer`)."
  },
  {
    name: "id",
    type: "string",
    required: false,
    description: "Element id."
  },
  {
    name: "title",
    type: "string",
    required: false,
    description: "Tooltip / accessible title for the anchor."
  },
  {
    name: "ariaLabel",
    type: "string",
    required: false,
    description: "Accessible label (rendered as `aria-label`)."
  },
  {
    name: "ariaCurrent",
    type: "string",
    required: false,
    description: "Current-link indicator (rendered as `aria-current`, e.g. `page`)."
  },
  {
    name: "ariaDisabled",
    type: "string",
    required: false,
    description: "Disabled indicator (rendered as `aria-disabled`)."
  },
  {
    name: "elementRef",
    type: "Ref<HTMLAnchorElement>",
    required: false,
    description: "Forwarded ref that receives the underlying `<a>` element after mount."
  },
  {
    name: "onClick",
    type: "(event: MouseEvent) => void",
    required: false,
    description: "Click handler. Use to intercept navigation when needed."
  },
  {
    name: "onHoverIn",
    type: "(event: PointerEvent) => void",
    required: false,
    description: "Pointer-enter handler (Zenith `on:hoverin` alias)."
  },
  {
    name: "onHoverOut",
    type: "(event: PointerEvent) => void",
    required: false,
    description: "Pointer-leave handler (Zenith `on:hoverout` alias)."
  },
  {
    name: "onFocus",
    type: "(event: FocusEvent) => void",
    required: false,
    description: "Focus handler."
  },
  {
    name: "onBlur",
    type: "(event: FocusEvent) => void",
    required: false,
    description: "Blur handler."
  }
];
function getRouterFunction(name) {
  return ROUTER_FUNCTIONS.find((fn) => fn.name === name);
}
function isRouterFunction(name) {
  return ROUTER_FUNCTIONS.some((fn) => fn.name === name);
}

// src/member-access.ts
var RECEIVER_BOUNDARY = /[\s;({\[,=+\-*/%&|<>!?:`.]/;
var MEMBER_ACCESS_PATTERN = /([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)?$/;
function parseMemberAccess(before) {
  if (before.length === 0) {
    return null;
  }
  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = before.slice(lineStart);
  if (isInStringLiteralOnLine(currentLine)) {
    return null;
  }
  const trimmed = before.replace(/\s+$/, "");
  if (trimmed.length === 0) {
    return null;
  }
  const match = trimmed.match(MEMBER_ACCESS_PATTERN);
  if (!match) {
    return null;
  }
  const receiver = match[1];
  const memberPrefix = match[2] ?? "";
  const matchStart = trimmed.length - match[0].length;
  if (matchStart > 0) {
    const boundaryChar = trimmed[matchStart - 1];
    if (!RECEIVER_BOUNDARY.test(boundaryChar)) {
      return null;
    }
  }
  return { receiver, memberPrefix };
}
function isInStringLiteralOnLine(lineBefore) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  for (let i = 0; i < lineBefore.length; i++) {
    const c = lineBefore[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && c === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && c === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && c === "`") {
      inTemplate = !inTemplate;
    }
  }
  return inSingle || inDouble || inTemplate;
}

// src/extractors.ts
function extractStates(script) {
  const states = /* @__PURE__ */ new Map();
  const statePattern = /state\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;\n]+)/g;
  let match;
  while ((match = statePattern.exec(script)) !== null) {
    if (match[1] && match[2]) {
      states.set(match[1], match[2].trim());
    }
  }
  return states;
}
function extractFunctions(script) {
  const functions = [];
  const funcPattern = /(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g;
  let match;
  while ((match = funcPattern.exec(script)) !== null) {
    if (match[2]) {
      functions.push({
        name: match[2],
        params: match[3] || "",
        isAsync: !!match[1]
      });
    }
  }
  const arrowPattern = /(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(async\s+)?\([^)]*\)\s*=>/g;
  while ((match = arrowPattern.exec(script)) !== null) {
    if (match[1]) {
      functions.push({
        name: match[1],
        params: "",
        isAsync: !!match[2]
      });
    }
  }
  return functions;
}
function extractLoopVariables(text) {
  const vars = [];
  const loopPattern = /zen:for\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = loopPattern.exec(text)) !== null) {
    const parsed = parseForExpression(match[1]);
    if (parsed) {
      vars.push(parsed.itemVar);
      if (parsed.indexVar)
        vars.push(parsed.indexVar);
    }
  }
  return vars;
}
function getScriptContent(text) {
  const match = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  return match ? match[1] : "";
}
function getPositionContext(text, offset) {
  const before = text.substring(0, offset);
  const scriptOpens = (before.match(/<script[^>]*>/gi) || []).length;
  const scriptCloses = (before.match(/<\/script>/gi) || []).length;
  const inScript = scriptOpens > scriptCloses;
  const styleOpens = (before.match(/<style[^>]*>/gi) || []).length;
  const styleCloses = (before.match(/<\/style>/gi) || []).length;
  const inStyle = styleOpens > styleCloses;
  const lastTagOpen = before.lastIndexOf("<");
  const lastTagClose = before.lastIndexOf(">");
  const inTag = lastTagOpen > lastTagClose;
  const lastBraceOpen = before.lastIndexOf("{");
  const lastBraceClose = before.lastIndexOf("}");
  const inExpression = lastBraceOpen > lastBraceClose && !inScript && !inStyle;
  const inTemplate = !inScript && !inStyle;
  const afterLastTag = before.substring(lastTagOpen);
  const quoteMatch = afterLastTag.match(/=["'][^"']*$/);
  const inAttributeValue = inTag && !!quoteMatch;
  let tagName = null;
  if (inTag) {
    const tagMatch = before.substring(lastTagOpen).match(/<\/?([A-Za-z][A-Za-z0-9-]*)/);
    if (tagMatch) {
      tagName = tagMatch[1];
    }
  }
  const wordMatch = before.match(/[a-zA-Z_$:@][a-zA-Z0-9_$:-]*$/);
  let currentWord = wordMatch ? wordMatch[0] : "";
  if (inTag && !inAttributeValue && currentWord === ":" && /\bon:$/.test(before)) {
    currentWord = "on:";
  }
  const afterAt = before.endsWith("@") || currentWord.startsWith("@");
  const afterColon = before.endsWith(":") || currentWord.startsWith(":") && !currentWord.startsWith(":");
  const memberAccess = inScript || inExpression ? parseMemberAccess(before) : null;
  return {
    inScript,
    inStyle,
    inTag,
    inExpression,
    inTemplate,
    inAttributeValue,
    tagName,
    currentWord,
    afterAt,
    afterColon,
    memberAccess
  };
}

// src/extractors-bindings.ts
var BINDING_PATTERNS = [
  {
    kind: "signal",
    pattern: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*signal\s*(?:<[^>]*>)?\s*\(/g
  },
  {
    kind: "runtimeState",
    pattern: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*state\s*(?:<[^>]*>)?\s*\(/g
  },
  {
    kind: "ref",
    pattern: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*ref\s*(?:<[^>]*>)?\s*\(/g
  }
];
function extractBindings(script) {
  const bindings = /* @__PURE__ */ new Map();
  for (const { kind, pattern } of BINDING_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(script)) !== null) {
      bindings.set(match[1], kind);
    }
  }
  return bindings;
}
function resolveReceiverKind(name, bindings, states) {
  const binding = bindings.get(name);
  if (binding) {
    return binding;
  }
  if (states.has(name)) {
    return "declarativeState";
  }
  return "unknown";
}

// src/metadata/receiver-members.ts
var import_node3 = require("vscode-languageserver/node");

// src/metadata/completion-branding.ts
var import_node2 = require("vscode-languageserver/node");
var DOC_PATHS = {
  reactivity: "docs/documentation/reactivity/reactivity-model.md",
  effectsVsMount: "docs/documentation/reactivity/effects-vs-mount.md",
  domEnv: "docs/documentation/reactivity/dom-and-environment.md",
  events: "docs/documentation/syntax/events.md"
};
function zenithSortText(rank, label) {
  return `!${String(rank).padStart(2, "0")}_${label}`;
}
function zenithDetail(surface, signature) {
  return `Zenith ${surface}: ${signature}`;
}
function withDocsLine(body, docPath) {
  const trimmed = body.trimEnd();
  return `${trimmed}

**Docs:** \`${docPath}\``;
}
function markdownDoc(body, docPath) {
  const value = docPath ? withDocsLine(body, docPath) : body;
  return { kind: import_node2.MarkupKind.Markdown, value };
}
function shouldPreselectSignal(currentWord) {
  const w = currentWord.toLowerCase();
  return w.length >= 2 && w.startsWith("sig");
}
function shouldPreselectDeclarativeState(currentWord) {
  const w = currentWord.toLowerCase();
  if (!w || w.startsWith("sig")) {
    return false;
  }
  return w === "s" || w.startsWith("st") || w.startsWith("sta");
}
function memberSortText(index, label) {
  return zenithSortText(index, label);
}
function memberPreselect(label, memberPrefix) {
  const p = memberPrefix.toLowerCase();
  if (!p) {
    return label === "get";
  }
  return label.toLowerCase().startsWith(p);
}

// src/metadata/receiver-members.ts
var SIGNAL_MEMBERS = [
  {
    label: "get",
    detail: zenithDetail("Signal.get()", "T"),
    documentation: "Read the current signal value. Registers a reactive dependency when called inside `zenEffect`.",
    insertText: "get()"
  },
  {
    label: "set",
    detail: zenithDetail("Signal.set(nextValue: T)", "T"),
    documentation: "Update the signal value and notify subscribers. This is **Zenith Signal.set**, not `setTimeout` or generic object assignment.",
    insertText: "set(${0:next})",
    snippet: true
  },
  {
    label: "subscribe",
    detail: zenithDetail("Signal.subscribe(fn)", "() => void"),
    documentation: "Subscribe to value changes. Returns an unsubscribe function suitable for `ctx.cleanup(...)`.",
    insertText: "subscribe(${0:fn})",
    snippet: true
  }
];
var RUNTIME_STATE_MEMBERS = [
  {
    label: "get",
    detail: zenithDetail("State.get()", "Readonly<T>"),
    documentation: "Read the current frozen state snapshot. Registers a reactive dependency when called inside `zenEffect`.",
    insertText: "get()"
  },
  {
    label: "set",
    detail: zenithDetail("State.set(patch)", "Readonly<T>"),
    documentation: "Patch or replace the runtime state object. Returns the new frozen snapshot.",
    insertText: "set(${0:patch})",
    snippet: true
  },
  {
    label: "subscribe",
    detail: zenithDetail("State.subscribe(fn)", "() => void"),
    documentation: "Subscribe to state changes. Returns an unsubscribe function.",
    insertText: "subscribe(${0:fn})",
    snippet: true
  }
];
var REF_MEMBERS = [
  {
    label: "current",
    detail: zenithDetail("Ref.current", "T | null"),
    documentation: "DOM node or value held by the ref. Assigned by the runtime at mount; cleared to `null` on disposal. **Not** reactive.",
    insertText: "current"
  }
];
var MEMBERS_BY_KIND = {
  signal: SIGNAL_MEMBERS,
  runtimeState: RUNTIME_STATE_MEMBERS,
  ref: REF_MEMBERS,
  declarativeState: [],
  unknown: []
};
var DOC_BY_KIND = {
  signal: DOC_PATHS.reactivity,
  runtimeState: DOC_PATHS.reactivity,
  ref: DOC_PATHS.domEnv
};
function membersForReceiver(kind) {
  return MEMBERS_BY_KIND[kind];
}
function memberCompletionItems(kind, memberPrefix) {
  const prefix = memberPrefix.toLowerCase();
  const specs = membersForReceiver(kind).filter(
    (member) => !prefix || member.label.toLowerCase().startsWith(prefix)
  );
  const docPath = DOC_BY_KIND[kind];
  return specs.map((member, index) => ({
    label: member.label,
    kind: import_node3.CompletionItemKind.Method,
    detail: member.detail,
    documentation: markdownDoc(member.documentation, docPath),
    insertText: member.insertText,
    insertTextFormat: member.snippet ? import_node3.InsertTextFormat.Snippet : import_node3.InsertTextFormat.PlainText,
    filterText: member.label,
    sortText: memberSortText(index, member.label),
    preselect: memberPreselect(member.label, memberPrefix)
  }));
}

// src/completion-script.ts
var import_node4 = require("vscode-languageserver/node");
var PRIMITIVE_DETAIL = {
  signal: {
    surface: "signal<T>(initial)",
    signature: "ZenithSignal<T>",
    docPath: DOC_PATHS.reactivity
  },
  state: {
    surface: "state<T>(initial)",
    signature: "StateStore<T>",
    docPath: DOC_PATHS.reactivity
  },
  ref: {
    surface: "ref<T>()",
    signature: "ZenithRef<T>",
    docPath: DOC_PATHS.domEnv
  },
  zenEffect: { surface: "zenEffect(effect)", signature: "void", docPath: DOC_PATHS.effectsVsMount },
  zeneffect: { surface: "zeneffect(...)", signature: "void", docPath: DOC_PATHS.effectsVsMount },
  effect: { surface: "effect(...)", signature: "void", docPath: DOC_PATHS.effectsVsMount },
  zenMount: { surface: "zenMount(callback)", signature: "void", docPath: DOC_PATHS.effectsVsMount },
  mount: { surface: "mount(callback)", signature: "void", docPath: DOC_PATHS.effectsVsMount },
  zenPresence: { surface: "zenPresence(ref)", signature: "PresenceController", docPath: DOC_PATHS.effectsVsMount },
  presence: { surface: "presence(ref)", signature: "PresenceController", docPath: DOC_PATHS.effectsVsMount },
  hydrate: { surface: "hydrate(payload)", signature: "void", docPath: DOC_PATHS.reactivity },
  zenWindow: { surface: "zenWindow()", signature: "Window | null", docPath: DOC_PATHS.domEnv },
  zenDocument: { surface: "zenDocument()", signature: "Document | null", docPath: DOC_PATHS.domEnv },
  zenOn: { surface: "zenOn(target, event, handler)", signature: "() => void", docPath: DOC_PATHS.domEnv },
  zenResize: { surface: "zenResize(handler)", signature: "() => void", docPath: DOC_PATHS.domEnv },
  collectRefs: { surface: "collectRefs(...refs)", signature: "Element[]", docPath: DOC_PATHS.domEnv }
};
function primitiveRank(name, currentWord) {
  const w = currentWord.toLowerCase();
  const n = name.toLowerCase();
  if (!w) {
    return 50;
  }
  if (n === w) {
    return 0;
  }
  if (n.startsWith(w)) {
    return name === "signal" && w.startsWith("sig") ? 0 : 5;
  }
  return 40;
}
function buildScriptCompletions(ctx, lineBefore, lineAfter, deps) {
  if (ctx.memberAccess) {
    return memberAccessCompletions(ctx, deps);
  }
  const completions = [];
  addLifecycleHooks(completions, ctx);
  addPlatformPrimitives(completions, ctx);
  addSsrSafeShortcuts(completions, ctx);
  if (deps.routerEnabled) {
    addRouterFunctions(completions, ctx);
  }
  addDeclaredFunctions(completions, ctx, deps.functions);
  addDeclarativeStates(completions, ctx, deps.states);
  addImportSpecifierCompletions(completions, ctx, lineBefore, lineAfter, deps.inServerScript);
  addImportPathModules(completions, lineBefore, deps.inServerScript);
  return completions;
}
function memberAccessCompletions(ctx, deps) {
  if (!ctx.memberAccess) {
    return [];
  }
  const kind = resolveReceiverKind(
    ctx.memberAccess.receiver,
    deps.bindings,
    deps.states
  );
  if (kind === "unknown" || kind === "declarativeState") {
    return [];
  }
  return memberCompletionItems(kind, ctx.memberAccess.memberPrefix);
}
function addLifecycleHooks(completions, ctx) {
  for (const hook of LIFECYCLE_HOOKS) {
    if (!matchesPrefix(hook.name, ctx.currentWord)) {
      continue;
    }
    const isState = hook.name === "state";
    const docPath = isState ? DOC_PATHS.reactivity : DOC_PATHS.effectsVsMount;
    completions.push({
      label: hook.name,
      kind: hook.kind,
      detail: isState ? zenithDetail("state name = initial", "declarative keyword") : zenithDetail(hook.name, "lifecycle hook"),
      documentation: markdownDoc(hook.doc, docPath),
      insertText: hook.snippet,
      insertTextFormat: import_node4.InsertTextFormat.Snippet,
      filterText: hook.name,
      sortText: zenithSortText(isState ? 2 : 10, hook.name),
      preselect: isState && shouldPreselectDeclarativeState(ctx.currentWord)
    });
  }
}
function addPlatformPrimitives(completions, ctx) {
  for (const prim of PLATFORM_PRIMITIVES) {
    if (!matchesPrefix(prim.name, ctx.currentWord)) {
      continue;
    }
    const meta = PRIMITIVE_DETAIL[prim.name];
    const detail = meta ? zenithDetail(meta.surface, meta.signature) : zenithDetail(prim.name, "platform primitive");
    const docPath = meta?.docPath ?? DOC_PATHS.reactivity;
    completions.push({
      label: prim.name,
      kind: prim.kind,
      detail,
      documentation: markdownDoc(prim.doc, docPath),
      insertText: prim.snippet,
      insertTextFormat: import_node4.InsertTextFormat.Snippet,
      filterText: prim.name,
      sortText: zenithSortText(primitiveRank(prim.name, ctx.currentWord), prim.name),
      preselect: prim.name === "signal" && shouldPreselectSignal(ctx.currentWord)
    });
  }
}
function addSsrSafeShortcuts(completions, ctx) {
  const lc = ctx.currentWord.toLowerCase();
  if (lc === "window" || lc.startsWith("wind")) {
    completions.push({
      label: "zenWindow",
      kind: import_node4.CompletionItemKind.Function,
      detail: zenithDetail("zenWindow()", "Window | null"),
      documentation: markdownDoc(
        "Use zenWindow() instead of window for SSR-safe access.",
        DOC_PATHS.domEnv
      ),
      insertText: "zenWindow()",
      filterText: "zenWindow",
      sortText: zenithSortText(5, "zenWindow")
    });
  }
  if (lc === "document" || lc.startsWith("doc")) {
    completions.push({
      label: "zenDocument",
      kind: import_node4.CompletionItemKind.Function,
      detail: zenithDetail("zenDocument()", "Document | null"),
      documentation: markdownDoc(
        "Use zenDocument() instead of document for SSR-safe access.",
        DOC_PATHS.domEnv
      ),
      insertText: "zenDocument()",
      filterText: "zenDocument",
      sortText: zenithSortText(5, "zenDocument")
    });
  }
}
function addRouterFunctions(completions, ctx) {
  for (const fn of ROUTER_FUNCTIONS) {
    if (!matchesPrefix(fn.name, ctx.currentWord)) {
      continue;
    }
    completions.push({
      label: fn.name,
      kind: import_node4.CompletionItemKind.Function,
      detail: "@zenithbuild/router",
      documentation: {
        kind: import_node4.MarkupKind.Markdown,
        value: `${fn.description}

**Signature:**
\`\`\`typescript
${fn.signature}
\`\`\``
      },
      insertText: `${fn.name}($0)`,
      insertTextFormat: import_node4.InsertTextFormat.Snippet,
      sortText: `0_${fn.name}`
    });
  }
}
function addDeclaredFunctions(completions, ctx, functions) {
  for (const func of functions) {
    if (!matchesPrefix(func.name, ctx.currentWord)) {
      continue;
    }
    completions.push({
      label: func.name,
      kind: import_node4.CompletionItemKind.Function,
      detail: `${func.isAsync ? "async " : ""}function ${func.name}(${func.params})`,
      insertText: `${func.name}($0)`,
      insertTextFormat: import_node4.InsertTextFormat.Snippet
    });
  }
}
function addDeclarativeStates(completions, ctx, states) {
  for (const [name, value] of states) {
    if (!matchesPrefix(name, ctx.currentWord)) {
      continue;
    }
    completions.push({
      label: name,
      kind: import_node4.CompletionItemKind.Variable,
      detail: `state ${name}`,
      documentation: `Current value: ${value}`
    });
  }
}
function addImportSpecifierCompletions(completions, ctx, lineBefore, lineAfter, inServerScript) {
  const specifierMatch = lineBefore.match(/import\s+(?:type\s+)?\{([^}]*)$/);
  if (!specifierMatch) {
    return;
  }
  const existing = new Set(
    specifierMatch[1].split(",").map((entry) => entry.trim().split(/\s+as\s+/)[0]?.trim()).filter(Boolean)
  );
  const moduleMatch = lineAfter.match(/^\s*\}\s+from\s+['"]([^'"]+)['"]/);
  const activeModule = moduleMatch ? moduleMatch[1] : null;
  if (!activeModule) {
    return;
  }
  if (activeModule === "zenith:server-contract" && !inServerScript) {
    return;
  }
  if (!getAllModules().some((mod) => mod.module === activeModule)) {
    return;
  }
  for (const exp of getModuleExports(activeModule)) {
    if (existing.has(exp.name)) {
      continue;
    }
    if (!matchesPrefix(exp.name, ctx.currentWord)) {
      continue;
    }
    completions.push({
      label: exp.name,
      kind: completionKindForExport(exp.kind),
      detail: activeModule,
      documentation: {
        kind: import_node4.MarkupKind.Markdown,
        value: exp.signature ? `${exp.description}

**Signature:**
\`\`\`typescript
${exp.signature}
\`\`\`` : exp.description
      },
      insertText: exp.name,
      sortText: `0_${exp.name}`
    });
  }
}
function addImportPathModules(completions, lineBefore, inServerScript) {
  const isImportPath = /from\s+['"][^'"]*$/.test(lineBefore) || /import\s+['"][^'"]*$/.test(lineBefore);
  if (!isImportPath) {
    return;
  }
  for (const mod of getAllModules()) {
    if (mod.module === "zenith:server-contract" && !inServerScript) {
      continue;
    }
    completions.push({
      label: mod.module,
      kind: import_node4.CompletionItemKind.Module,
      detail: mod.kind === "plugin" ? "Zenith Plugin" : "Zenith Core",
      documentation: mod.description,
      insertText: mod.module
    });
  }
}
function completionKindForExport(kind) {
  switch (kind) {
    case "function":
      return import_node4.CompletionItemKind.Function;
    case "component":
      return import_node4.CompletionItemKind.Class;
    case "type":
      return import_node4.CompletionItemKind.Interface;
    default:
      return import_node4.CompletionItemKind.Variable;
  }
}
function matchesPrefix(name, prefix) {
  return !prefix || name.toLowerCase().startsWith(prefix.toLowerCase());
}

// src/completion.ts
function provideCompletions(text, offset, graph) {
  const ctx = getPositionContext(text, offset);
  const script = getScriptContent(text);
  const states = extractStates(script);
  const functions = extractFunctions(script);
  const bindings = extractBindings(script);
  const imports = parseZenithImports(script);
  const routerEnabled = hasRouterImport(imports);
  const zenLinkAvailable = hasZenLinkImport(imports) || routerEnabled;
  const loopVariables = extractLoopVariables(text);
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = text.indexOf("\n", offset) === -1 ? text.length : text.indexOf("\n", offset);
  const lineBefore = text.substring(lineStart, offset);
  const lineAfter = text.substring(offset, lineEnd);
  const completions = [];
  if (ctx.inScript) {
    const scriptItems = buildScriptCompletions(ctx, lineBefore, lineAfter, {
      states,
      functions,
      bindings,
      routerEnabled,
      inServerScript: isServerScriptContext(text, offset)
    });
    for (const item of scriptItems) {
      completions.push(item);
    }
    if (ctx.memberAccess) {
      return completions;
    }
  }
  if (ctx.inExpression) {
    if (ctx.memberAccess) {
      const kind = resolveReceiverKind(ctx.memberAccess.receiver, bindings, states);
      if (kind !== "unknown" && kind !== "declarativeState") {
        return memberCompletionItems(kind, ctx.memberAccess.memberPrefix);
      }
      return [];
    }
    addExpressionContextCompletions(completions, ctx, states, functions, loopVariables);
  }
  if (ctx.inTemplate && !ctx.inExpression && !ctx.inAttributeValue) {
    addTemplateContextCompletions(completions, ctx, lineBefore, graph, zenLinkAvailable);
  }
  if (ctx.inTag && ctx.tagName && !ctx.inAttributeValue) {
    addTagContextCompletions(completions, ctx, graph, zenLinkAvailable);
  }
  if (ctx.inAttributeValue) {
    addAttributeValueCompletions(completions, lineBefore, functions);
  }
  return completions;
}
function addExpressionContextCompletions(completions, _ctx, states, functions, loopVariables) {
  for (const [name, value] of states) {
    completions.push({
      label: name,
      kind: import_node5.CompletionItemKind.Variable,
      detail: `state ${name}`,
      documentation: `Value: ${value}`,
      sortText: `0_${name}`
    });
  }
  for (const func of functions) {
    completions.push({
      label: func.name,
      kind: import_node5.CompletionItemKind.Function,
      detail: `${func.isAsync ? "async " : ""}function`,
      insertText: `${func.name}()`,
      sortText: `1_${func.name}`
    });
  }
  for (const loopVar of loopVariables) {
    completions.push({
      label: loopVar,
      kind: import_node5.CompletionItemKind.Variable,
      detail: "loop variable",
      sortText: `0_${loopVar}`
    });
  }
}
function addTemplateContextCompletions(completions, ctx, lineBefore, graph, zenLinkAvailable) {
  const closingPrefix = closingTagNamePrefix(lineBefore);
  if (closingPrefix !== null) {
    addClosingTagCompletions(completions, closingPrefix, graph, zenLinkAvailable);
    return;
  }
  const isAfterOpenBracket = !!lineBefore.match(/<\s*$/);
  const isTypingTag = ctx.currentWord.length > 0 && !ctx.inTag;
  if (graph && (isAfterOpenBracket || isTypingTag && /^[A-Z]/.test(ctx.currentWord))) {
    for (const [name, info] of graph.layouts) {
      if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        const propStr = info.props.length > 0 ? ` ${info.props[0]}="$1"` : "";
        completions.push({
          label: name,
          kind: import_node5.CompletionItemKind.Class,
          detail: "layout",
          documentation: {
            kind: import_node5.MarkupKind.Markdown,
            value: `**Layout** from \`${path2.basename(info.filePath)}\`

Props: ${info.props.join(", ") || "none"}`
          },
          insertText: isAfterOpenBracket ? `${name}${propStr}>$0</${name}>` : `<${name}${propStr}>$0</${name}>`,
          insertTextFormat: import_node5.InsertTextFormat.Snippet,
          sortText: `0_${name}`
        });
      }
    }
    for (const [name, info] of graph.components) {
      if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        completions.push({
          label: name,
          kind: import_node5.CompletionItemKind.Class,
          detail: "component",
          documentation: {
            kind: import_node5.MarkupKind.Markdown,
            value: `**Component** from \`${path2.basename(info.filePath)}\`

Props: ${info.props.join(", ") || "none"}`
          },
          insertText: isAfterOpenBracket ? `${name} $0/>` : `<${name} $0/>`,
          insertTextFormat: import_node5.InsertTextFormat.Snippet,
          sortText: `0_${name}`
        });
      }
    }
  }
  if (zenLinkAvailable && (isAfterOpenBracket || isTypingTag && ctx.currentWord.toLowerCase().startsWith("z"))) {
    completions.push({
      label: "ZenLink",
      kind: import_node5.CompletionItemKind.Class,
      detail: "@zenithbuild/router/ZenLink.zen",
      documentation: {
        kind: import_node5.MarkupKind.Markdown,
        value: '**ZenLink** \u2014 canonical soft-navigation anchor.\n\nRenders a real `<a data-zen-link="true" href="...">`. Children inline into the single implicit slot; there is no `children` prop.\n\n**Import:**\n```ts\nimport ZenLink from "@zenithbuild/router/ZenLink.zen";\n```\n\n**Props:** `href` (required), `class`, `target`, `rel`, `id`, `title`, `ariaLabel`, `ariaCurrent`, `ariaDisabled`, `elementRef`, `onClick`, `onHoverIn`, `onHoverOut`, `onFocus`, `onBlur`.'
      },
      insertText: isAfterOpenBracket ? 'ZenLink href="$1">$0</ZenLink>' : '<ZenLink href="$1">$0</ZenLink>',
      insertTextFormat: import_node5.InsertTextFormat.Snippet,
      sortText: "0_ZenLink"
    });
  }
  if (isAfterOpenBracket || isTypingTag && /^[a-z]/.test(ctx.currentWord)) {
    for (const el of HTML_ELEMENTS) {
      if (!ctx.currentWord || el.tag.startsWith(ctx.currentWord.toLowerCase())) {
        let snippet;
        if (el.selfClosing) {
          snippet = el.attrs ? `${el.tag} ${el.attrs} />` : `${el.tag} />`;
        } else {
          snippet = el.attrs ? `${el.tag} ${el.attrs}>$0</${el.tag}>` : `${el.tag}>$0</${el.tag}>`;
        }
        completions.push({
          label: el.tag,
          kind: import_node5.CompletionItemKind.Property,
          detail: "HTML",
          documentation: el.doc,
          insertText: isAfterOpenBracket ? snippet : `<${snippet}`,
          insertTextFormat: import_node5.InsertTextFormat.Snippet,
          sortText: `1_${el.tag}`
        });
      }
    }
  }
}
function closingTagNamePrefix(lineBefore) {
  const match = lineBefore.match(/<\/([A-Za-z0-9-]*)$/);
  return match ? match[1] : null;
}
function addClosingTagCompletions(completions, prefix, graph, zenLinkAvailable) {
  const tagNames = /* @__PURE__ */ new Set();
  for (const el of HTML_ELEMENTS) {
    if (!el.selfClosing) {
      tagNames.add(el.tag);
    }
  }
  if (graph) {
    for (const name of graph.layouts.keys())
      tagNames.add(name);
    for (const name of graph.components.keys())
      tagNames.add(name);
  }
  if (zenLinkAvailable) {
    tagNames.add("ZenLink");
  }
  const lowerPrefix = prefix.toLowerCase();
  for (const name of tagNames) {
    if (lowerPrefix && !name.toLowerCase().startsWith(lowerPrefix)) {
      continue;
    }
    completions.push({
      label: `/${name}`,
      kind: import_node5.CompletionItemKind.Property,
      detail: "closing tag",
      insertText: `${name}>`,
      sortText: `0_/${name}`
    });
  }
}
function addTagContextCompletions(completions, ctx, graph, zenLinkAvailable) {
  const elementType = ctx.tagName === "slot" ? "slot" : /^[A-Z]/.test(ctx.tagName) ? "component" : "element";
  for (const directiveName of getDirectiveNames()) {
    if (canPlaceDirective(directiveName, elementType)) {
      if (!ctx.currentWord || directiveName.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        const directive = getDirective(directiveName);
        if (directive) {
          completions.push({
            label: directive.name,
            kind: import_node5.CompletionItemKind.Keyword,
            detail: directive.category,
            documentation: {
              kind: import_node5.MarkupKind.Markdown,
              value: `${directive.description}

**Syntax:** \`${directive.syntax}\``
            },
            insertText: `${directive.name}="$1"`,
            insertTextFormat: import_node5.InsertTextFormat.Snippet,
            sortText: `0_${directive.name}`
          });
        }
      }
    }
  }
  if (!ctx.currentWord || ctx.currentWord.startsWith("on:") || ctx.currentWord === "on") {
    const inOnContext = ctx.currentWord.startsWith("on:") || ctx.currentWord === "on";
    let eventRank = 0;
    for (const event of DOM_EVENTS) {
      const label = `on:${event}`;
      completions.push({
        label,
        kind: import_node5.CompletionItemKind.Event,
        detail: zenithDetail("on:" + event, "event binding"),
        documentation: markdownDoc(
          `Canonical Zenith event binding: \`on:${event}={handler}\`. Not \`onClick\` or \`@click\`.`,
          DOC_PATHS.events
        ),
        insertText: `on:${event}={$1}`,
        insertTextFormat: import_node5.InsertTextFormat.Snippet,
        filterText: label,
        sortText: inOnContext ? zenithSortText(eventRank++, label) : `1_${label}`
      });
    }
  }
  if (ctx.afterColon || ctx.currentWord.startsWith(":")) {
    for (const attr of HTML_ATTRIBUTES) {
      completions.push({
        label: `:${attr}`,
        kind: import_node5.CompletionItemKind.Property,
        detail: "reactive binding",
        documentation: `Reactive binding for ${attr}`,
        insertText: `:${attr}="$1"`,
        insertTextFormat: import_node5.InsertTextFormat.Snippet,
        sortText: `1_:${attr}`
      });
    }
  }
  if (/^[A-Z]/.test(ctx.tagName) && graph) {
    const component = resolveComponent(graph, ctx.tagName);
    if (component) {
      for (const prop of component.props) {
        completions.push({
          label: prop,
          kind: import_node5.CompletionItemKind.Property,
          detail: `prop of <${ctx.tagName}>`,
          insertText: `${prop}={$1}`,
          insertTextFormat: import_node5.InsertTextFormat.Snippet,
          sortText: `0_${prop}`
        });
      }
    }
  }
  if (zenLinkAvailable && ctx.tagName === "ZenLink") {
    for (const prop of ZENLINK_PROPS) {
      if (!ctx.currentWord || prop.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        const stringLike = prop.type === "string" || prop.type.startsWith("Ref<");
        const insertText = stringLike ? `${prop.name}="$1"` : `${prop.name}={$1}`;
        completions.push({
          label: prop.name,
          kind: import_node5.CompletionItemKind.Property,
          detail: prop.required ? `${prop.type} (required)` : prop.type,
          documentation: prop.description,
          insertText,
          insertTextFormat: import_node5.InsertTextFormat.Snippet,
          sortText: prop.required ? `0_${prop.name}` : `1_${prop.name}`
        });
      }
    }
  }
  for (const attr of HTML_ATTRIBUTES) {
    if (!ctx.currentWord || attr.startsWith(ctx.currentWord.toLowerCase())) {
      completions.push({
        label: attr,
        kind: import_node5.CompletionItemKind.Property,
        detail: "HTML attribute",
        insertText: `${attr}="$1"`,
        insertTextFormat: import_node5.InsertTextFormat.Snippet,
        sortText: `3_${attr}`
      });
    }
  }
}
function addAttributeValueCompletions(completions, lineBefore, functions) {
  const eventMatch = lineBefore.match(/on:[a-zA-Z][a-zA-Z0-9_-]*=["'{][^"'{}]*$/);
  if (eventMatch) {
    for (const func of functions) {
      completions.push({
        label: func.name,
        kind: import_node5.CompletionItemKind.Function,
        detail: "function",
        insertText: func.name
      });
    }
  }
}
function isServerScriptContext(text, offset) {
  const before = text.slice(0, offset);
  const openScript = [...before.matchAll(/<script\b([^>]*)>/gi)];
  if (openScript.length === 0) {
    return false;
  }
  const lastOpen = openScript.at(-1);
  const lastOpenIndex = lastOpen.index ?? -1;
  const lastCloseIndex = before.lastIndexOf("</script>");
  if (lastOpenIndex < lastCloseIndex) {
    return false;
  }
  const attrs = lastOpen[1] ?? "";
  return /\bserver\b/i.test(attrs);
}

// src/hover.ts
var import_node6 = require("vscode-languageserver/node");
function provideHover(text, offset, graph) {
  const before = text.substring(0, offset);
  const after = text.substring(offset);
  const wordBefore = before.match(/[a-zA-Z0-9_$:@-]*$/)?.[0] || "";
  const wordAfter = after.match(/^[a-zA-Z0-9_$:-]*/)?.[0] || "";
  const word = wordBefore + wordAfter;
  if (!word)
    return null;
  const directiveHover = hoverDirective(word);
  if (directiveHover)
    return directiveHover;
  const routerHover = hoverRouterFunction(word);
  if (routerHover)
    return routerHover;
  const lifecycleHover = hoverLifecycle(word);
  if (lifecycleHover)
    return lifecycleHover;
  const platformHover = hoverPlatform(word);
  if (platformHover)
    return platformHover;
  const zenLinkHover = hoverZenLink(word, text);
  if (zenLinkHover)
    return zenLinkHover;
  const script = getScriptContent(text);
  const stateHover = hoverState(word, script);
  if (stateHover)
    return stateHover;
  const functionHover = hoverFunction(word, script);
  if (functionHover)
    return functionHover;
  const importHover = hoverImport(word, script);
  if (importHover)
    return importHover;
  if (graph) {
    const componentHover = hoverComponent(word, graph);
    if (componentHover)
      return componentHover;
  }
  return hoverHtmlElement(word);
}
function hoverDirective(word) {
  if (!isDirective(word))
    return null;
  const directive = getDirective(word);
  if (!directive)
    return null;
  const notes = directive.name === "zen:for" ? "- No runtime loop\n- Compiled into static DOM instructions\n- Creates scope: `item`, `index`" : "- Compile-time directive\n- No runtime assumptions\n- Processed at build time";
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### ${directive.name}

${directive.description}

**Syntax:** \`${directive.syntax}\`

**Notes:**
${notes}

**Example:**
\`\`\`html
${directive.example}
\`\`\``
    }
  };
}
function hoverRouterFunction(word) {
  if (!isRouterFunction(word))
    return null;
  const fn = getRouterFunction(word);
  if (!fn)
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### ${fn.name}

**@zenithbuild/router**

${fn.description}

**Signature:**
\`\`\`typescript
${fn.signature}
\`\`\``
    }
  };
}
function hoverLifecycle(word) {
  const hook = LIFECYCLE_HOOKS.find((h) => h.name === word);
  if (!hook)
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### ${hook.name}

${hook.doc}

\`\`\`typescript
${hook.snippet.replace(/\$\d/g, "").replace("$0", "// ...")}
\`\`\``
    }
  };
}
function hoverPlatform(word) {
  const matches = PLATFORM_PRIMITIVES.filter((p) => p.name === word);
  if (matches.length === 0)
    return null;
  const body = matches.map((p) => `### ${p.name}

${p.doc}`).join("\n\n---\n\n");
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: body
    }
  };
}
function hoverZenLink(word, text) {
  if (word !== "ZenLink")
    return null;
  const script = getScriptContent(text);
  const imports = parseZenithImports(script);
  if (!hasZenLinkImport(imports) && !hasRouterImport(imports))
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: '### `<ZenLink>`\n\n**@zenithbuild/router/ZenLink.zen**\n\nCanonical soft-navigation anchor. Renders a real `<a data-zen-link="true" href="...">`. Children are inlined through the single implicit slot \u2014 there is no `children` prop.\n\n**Import:**\n```ts\nimport ZenLink from "@zenithbuild/router/ZenLink.zen";\n```\n\n**Required props:**\n- `href` (string)\n\n**Optional props:**\n- `class`, `target`, `rel`, `id`, `title`\n- `ariaLabel`, `ariaCurrent`, `ariaDisabled`\n- `elementRef`\n- `onClick`, `onHoverIn`, `onHoverOut`, `onFocus`, `onBlur`\n\n**Not props on ZenLink:** `to`, `preload`, `replace`, `activeClass`, `children`.'
    }
  };
}
function hoverState(word, script) {
  const states = extractStates(script);
  if (!states.has(word))
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### state \`${word}\`

**Type:** inferred

**Initial value:** \`${states.get(word)}\``
    }
  };
}
function hoverFunction(word, script) {
  const functions = extractFunctions(script);
  const func = functions.find((f) => f.name === word);
  if (!func)
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### ${func.isAsync ? "async " : ""}function \`${func.name}\`

\`\`\`typescript
${func.isAsync ? "async " : ""}function ${func.name}(${func.params})
\`\`\``
    }
  };
}
function hoverImport(word, script) {
  const imports = parseZenithImports(script);
  for (const imp of imports) {
    if (imp.specifiers.includes(word)) {
      const exportMeta = resolveExport(imp.module, word);
      if (exportMeta) {
        const resolved = resolveModule(imp.module);
        const owner = resolved.kind === "plugin" ? "Plugin" : resolved.kind === "core" ? "Core" : "External";
        return {
          contents: {
            kind: import_node6.MarkupKind.Markdown,
            value: `### ${word}

**${owner}** (${imp.module})

${exportMeta.description}

**Signature:**
\`\`\`typescript
${exportMeta.signature || word}
\`\`\``
          }
        };
      }
    }
  }
  return null;
}
function hoverComponent(word, graph) {
  const component = resolveComponent(graph, word);
  if (!component)
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### ${component.type} \`<${component.name}>\`

**File:** \`${component.filePath}\`

**Props:** ${component.props.join(", ") || "none"}`
    }
  };
}
function hoverHtmlElement(word) {
  const htmlEl = HTML_ELEMENTS.find((e) => e.tag === word);
  if (!htmlEl)
    return null;
  return {
    contents: {
      kind: import_node6.MarkupKind.Markdown,
      value: `### HTML \`<${htmlEl.tag}>\`

${htmlEl.doc}`
    }
  };
}

// src/diagnostics.ts
var path4 = __toESM(require("path"));

// src/contracts.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
function stripImportSuffix(specifier) {
  const hashIndex = specifier.indexOf("#");
  const queryIndex = specifier.indexOf("?");
  let cutAt = -1;
  if (hashIndex >= 0 && queryIndex >= 0) {
    cutAt = Math.min(hashIndex, queryIndex);
  } else if (hashIndex >= 0) {
    cutAt = hashIndex;
  } else if (queryIndex >= 0) {
    cutAt = queryIndex;
  }
  return cutAt >= 0 ? specifier.slice(0, cutAt) : specifier;
}
function isLocalCssSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
}
function isCssContractImportSpecifier(specifier) {
  const normalized = stripImportSuffix(specifier).trim();
  if (!normalized) {
    return false;
  }
  if (normalized.endsWith(".css")) {
    return true;
  }
  if (normalized === "tailwindcss") {
    return true;
  }
  if (/^@[^/]+\/css(?:$|\/)/.test(normalized)) {
    return true;
  }
  return false;
}
function canonicalizePath(candidate) {
  try {
    return fs2.realpathSync.native(candidate);
  } catch {
    return path3.resolve(candidate);
  }
}
function resolveCssImportPath(importingFilePath, specifier, projectRoot) {
  const normalizedSpecifier = stripImportSuffix(specifier);
  const importingDir = path3.dirname(importingFilePath);
  const rootCanonical = canonicalizePath(projectRoot);
  const unresolvedTarget = normalizedSpecifier.startsWith("/") ? path3.join(rootCanonical, normalizedSpecifier.slice(1)) : path3.resolve(importingDir, normalizedSpecifier);
  const targetCanonical = canonicalizePath(unresolvedTarget);
  const relativeToRoot = path3.relative(rootCanonical, targetCanonical);
  const escapesProjectRoot = relativeToRoot.startsWith("..") || path3.isAbsolute(relativeToRoot);
  return {
    resolvedPath: targetCanonical,
    escapesProjectRoot
  };
}
function classifyZenithFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.endsWith(".zen")) {
    return "unknown";
  }
  if (normalized.includes("/src/pages/") || normalized.includes("/app/pages/")) {
    return "page";
  }
  if (normalized.includes("/src/layouts/") || normalized.includes("/app/layouts/")) {
    return "layout";
  }
  return "component";
}

// src/code-actions.ts
var EVENT_BINDING_DIAGNOSTIC_CODE = "zenith.event.binding.syntax";
var ZEN_DOM_QUERY = "ZEN-DOM-QUERY";
var ZEN_DOM_LISTENER = "ZEN-DOM-LISTENER";
var ZEN_DOM_WRAPPER = "ZEN-DOM-WRAPPER";
function buildEventBindingCodeActions(document, diagnostics) {
  const actions = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.code !== EVENT_BINDING_DIAGNOSTIC_CODE) {
      continue;
    }
    const data = diagnostic.data;
    if (!data || typeof data.replacement !== "string" || typeof data.title !== "string") {
      continue;
    }
    actions.push({
      title: data.title,
      kind: "quickfix",
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [document.uri]: [{
            range: diagnostic.range,
            newText: data.replacement
          }]
        }
      },
      isPreferred: true
    });
  }
  return actions;
}
function buildDomLintCodeActions(document, diagnostics) {
  const actions = [];
  const text = document.getText();
  for (const diagnostic of diagnostics) {
    const code = diagnostic.code;
    if (code !== ZEN_DOM_QUERY && code !== ZEN_DOM_LISTENER && code !== ZEN_DOM_WRAPPER) {
      continue;
    }
    const startOffset = document.offsetAt(diagnostic.range.start);
    const endOffset = document.offsetAt(diagnostic.range.end);
    const lineStart = text.lastIndexOf("\n", startOffset) + 1;
    const lineEnd = text.indexOf("\n", endOffset);
    const lineEndOffset = lineEnd === -1 ? text.length : lineEnd;
    const lineContent = text.substring(lineStart, lineEndOffset);
    if (code === ZEN_DOM_QUERY) {
      const insertPos = { line: diagnostic.range.start.line, character: 0 };
      actions.push({
        title: "Suppress with // zen-allow:dom-query <reason>",
        kind: "quickfix",
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [document.uri]: [{
              range: { start: insertPos, end: insertPos },
              newText: "// zen-allow:dom-query <reason>\n"
            }]
          }
        }
      });
      actions.push({
        title: "Convert to ref() (partial / TODO)",
        kind: "quickfix",
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [document.uri]: [{
              range: { start: insertPos, end: insertPos },
              newText: "// TODO: use ref<T>() + zenMount instead\nconst elRef = ref<HTMLElement>();\n"
            }]
          }
        }
      });
    } else if (code === ZEN_DOM_LISTENER) {
      const insertPos = { line: diagnostic.range.start.line, character: 0 };
      const lineRange = {
        start: document.positionAt(lineStart),
        end: document.positionAt(lineEndOffset)
      };
      const commentedLine = lineContent.replace(/^(\s*)/, "$1// ");
      actions.push({
        title: "Replace with zenOn template",
        kind: "quickfix",
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [document.uri]: [
              {
                range: { start: insertPos, end: insertPos },
                newText: "// zenOn(target, eventName, handler) - register disposer via ctx.cleanup\n// const off = zenOn(doc, 'keydown', handler); ctx.cleanup(off);\n"
              },
              {
                range: lineRange,
                newText: commentedLine
              }
            ]
          }
        }
      });
    } else if (code === ZEN_DOM_WRAPPER) {
      let newText = lineContent;
      if (lineContent.includes("window") && !lineContent.includes("zenWindow")) {
        newText = newText.replace(/\bwindow\b/g, "zenWindow()");
      }
      if (lineContent.includes("document") && !lineContent.includes("zenDocument")) {
        newText = newText.replace(/\bdocument\b/g, "zenDocument()");
      }
      if (lineContent.includes("globalThis.window")) {
        newText = newText.replace(/globalThis\.window/g, "zenWindow()");
      }
      if (lineContent.includes("globalThis.document")) {
        newText = newText.replace(/globalThis\.document/g, "zenDocument()");
      }
      if (newText !== lineContent) {
        actions.push({
          title: "Replace with zenWindow() / zenDocument()",
          kind: "quickfix",
          diagnostics: [diagnostic],
          edit: {
            changes: {
              [document.uri]: [{
                range: {
                  start: document.positionAt(lineStart),
                  end: document.positionAt(lineEndOffset)
                },
                newText
              }]
            }
          }
        });
      }
    }
  }
  return actions;
}
function buildWindowDocumentCodeActions(document, range) {
  const text = document.getText();
  const startOffset = document.offsetAt(range.start);
  const endOffset = document.offsetAt(range.end);
  const selected = text.substring(startOffset, endOffset);
  if (selected === "window") {
    return [{
      title: "Replace with zenWindow()",
      kind: "refactor",
      diagnostics: [],
      edit: {
        changes: {
          [document.uri]: [{ range, newText: "zenWindow()" }]
        }
      }
    }];
  }
  if (selected === "document") {
    return [{
      title: "Replace with zenDocument()",
      kind: "refactor",
      diagnostics: [],
      edit: {
        changes: {
          [document.uri]: [{ range, newText: "zenDocument()" }]
        }
      }
    }];
  }
  return [];
}

// src/diagnostics.ts
var COMPONENT_SCRIPT_CONTRACT_MESSAGE = "Zenith Contract Violation: Components are structural; move <script> to the parent route scope.";
var CSS_BARE_IMPORT_MESSAGE = "CSS import contract violation: bare CSS imports are not supported.";
var CSS_ESCAPE_MESSAGE = "CSS import contract violation: imported CSS path escapes project root.";
var DiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4
};
function uriToFilePath(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname);
  } catch {
    return decodeURIComponent(uri.replace("file://", ""));
  }
}
function stripScriptAndStylePreserveIndices(text) {
  return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => " ".repeat(match.length));
}
function getScriptBlocks(text) {
  const blocks = [];
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(text)) !== null) {
    const whole = match[0] || "";
    const content = match[1] || "";
    const localStart = whole.indexOf(content);
    const contentStartOffset = (match.index || 0) + Math.max(localStart, 0);
    blocks.push({ content, contentStartOffset });
  }
  return blocks;
}
function parseImportSpecifiers(scriptContent, scriptStartOffset) {
  const imports = [];
  const importPattern = /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;
  let match;
  while ((match = importPattern.exec(scriptContent)) !== null) {
    const statement = match[0] || "";
    const specifier = match[1] || "";
    const rel = statement.indexOf(specifier);
    const startOffset = scriptStartOffset + (match.index || 0) + Math.max(rel, 0);
    const endOffset = startOffset + specifier.length;
    imports.push({ specifier, startOffset, endOffset });
  }
  return imports;
}
function normalizeEventHandlerValue(rawValue) {
  let value = rawValue.trim();
  if (value.startsWith("{") && value.endsWith("}") || value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1).trim();
  }
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\(\)$/.test(value)) {
    value = value.slice(0, -2);
  }
  if (!value) {
    return "handler";
  }
  return value;
}
async function collectDiagnostics(document, graph, settings, projectRoot) {
  const diagnostics = [];
  const text = document.getText();
  const filePath = uriToFilePath(document.uri);
  let hasComponentScriptCompilerDiagnostic = false;
  try {
    process.env.ZENITH_CACHE = "1";
    const { compile } = await import("@zenithbuild/compiler");
    const result = await compile(text, filePath);
    const warnings = result.warnings ?? [];
    const domLintSeverity = settings.strictDomLints ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;
    for (const w of warnings) {
      const range = w.range;
      const startLine = (range?.start?.line ?? 1) - 1;
      const startChar = (range?.start?.column ?? 1) - 1;
      const endLine = (range?.end?.line ?? range?.start?.line ?? 1) - 1;
      const endChar = range?.end?.column ?? range?.start?.column ?? 1;
      diagnostics.push({
        severity: domLintSeverity,
        range: {
          start: { line: startLine, character: startChar },
          end: { line: endLine, character: endChar }
        },
        message: w.message ?? "DOM lint",
        source: "zenith-compiler",
        code: w.code
      });
    }
  } catch (error) {
    const message = String(error?.message || "Unknown compiler error");
    const isContractViolation = message.includes(COMPONENT_SCRIPT_CONTRACT_MESSAGE);
    if (isContractViolation) {
      hasComponentScriptCompilerDiagnostic = true;
    }
    if (!(settings.componentScripts === "allow" && isContractViolation)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: (error?.line || 1) - 1, character: (error?.column || 1) - 1 },
          end: { line: (error?.line || 1) - 1, character: (error?.column || 1) + 20 }
        },
        message: `[${error?.code || "compiler"}] ${message}${error?.hints ? "\n\nHints:\n" + error.hints.join("\n") : ""}`,
        source: "zenith-compiler"
      });
    }
  }
  diagnostics.push(
    ...collectContractDiagnostics(
      document,
      graph,
      settings,
      projectRoot,
      hasComponentScriptCompilerDiagnostic
    )
  );
  return diagnostics;
}
function collectContractDiagnostics(document, graph, settings, projectRoot, hasComponentScriptCompilerDiagnostic = false) {
  const diagnostics = [];
  const text = document.getText();
  const filePath = uriToFilePath(document.uri);
  collectComponentScriptDiagnostics(document, text, filePath, settings, diagnostics, hasComponentScriptCompilerDiagnostic);
  collectEventBindingDiagnostics(document, text, diagnostics);
  collectDirectiveDiagnostics(document, text, diagnostics);
  collectImportDiagnostics(document, text, diagnostics);
  collectCssImportContractDiagnostics(document, text, filePath, projectRoot, diagnostics);
  collectExpressionDiagnostics(document, text, diagnostics);
  collectComponentDiagnostics(document, text, graph, diagnostics);
  return diagnostics;
}
function collectComponentScriptDiagnostics(document, text, filePath, settings, diagnostics, hasComponentScriptCompilerDiagnostic) {
  if (settings.componentScripts !== "forbid") {
    return;
  }
  if (classifyZenithFile(filePath) !== "component") {
    return;
  }
  if (hasComponentScriptCompilerDiagnostic) {
    return;
  }
  const scriptTagMatch = /<script\b[^>]*>/i.exec(text);
  if (!scriptTagMatch || scriptTagMatch.index == null) {
    return;
  }
  diagnostics.push({
    severity: DiagnosticSeverity.Error,
    range: {
      start: document.positionAt(scriptTagMatch.index),
      end: document.positionAt(scriptTagMatch.index + scriptTagMatch[0].length)
    },
    message: COMPONENT_SCRIPT_CONTRACT_MESSAGE,
    source: "zenith-contract"
  });
}
function collectEventBindingDiagnostics(document, text, diagnostics) {
  const stripped = stripScriptAndStylePreserveIndices(text);
  const atEventPattern = /@([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g;
  let match;
  while ((match = atEventPattern.exec(stripped)) !== null) {
    const fullMatch = match[0] || "";
    const eventName = match[1] || "click";
    const rawHandler = match[2] || "{handler}";
    const handler = normalizeEventHandlerValue(rawHandler);
    const replacement = `on:${eventName}={${handler}}`;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: document.positionAt(match.index || 0),
        end: document.positionAt((match.index || 0) + fullMatch.length)
      },
      message: `Invalid event binding syntax. Use on:${eventName}={handler}.`,
      source: "zenith-contract",
      code: EVENT_BINDING_DIAGNOSTIC_CODE,
      data: {
        replacement,
        title: `Convert to ${replacement}`
      }
    });
  }
  const onEventPattern = /\bon([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g;
  while ((match = onEventPattern.exec(stripped)) !== null) {
    const fullMatch = match[0] || "";
    const eventName = match[1] || "click";
    const rawHandler = match[2] || "{handler}";
    const handler = normalizeEventHandlerValue(rawHandler);
    const replacement = `on:${eventName}={${handler}}`;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: document.positionAt(match.index || 0),
        end: document.positionAt((match.index || 0) + fullMatch.length)
      },
      message: `Invalid event binding syntax. Use on:${eventName}={handler}.`,
      source: "zenith-contract",
      code: EVENT_BINDING_DIAGNOSTIC_CODE,
      data: {
        replacement,
        title: `Convert to ${replacement}`
      }
    });
  }
}
function collectCssImportContractDiagnostics(document, text, filePath, projectRoot, diagnostics) {
  const scriptBlocks = getScriptBlocks(text);
  if (scriptBlocks.length === 0) {
    return;
  }
  const effectiveProjectRoot = projectRoot ? path4.resolve(projectRoot) : path4.dirname(filePath);
  for (const block of scriptBlocks) {
    const imports = parseImportSpecifiers(block.content, block.contentStartOffset);
    for (const imp of imports) {
      if (!isCssContractImportSpecifier(imp.specifier)) {
        continue;
      }
      if (!isLocalCssSpecifier(imp.specifier)) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: document.positionAt(imp.startOffset),
            end: document.positionAt(imp.endOffset)
          },
          message: CSS_BARE_IMPORT_MESSAGE,
          source: "zenith-contract"
        });
        continue;
      }
      const resolved = resolveCssImportPath(filePath, imp.specifier, effectiveProjectRoot);
      if (resolved.escapesProjectRoot) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: document.positionAt(imp.startOffset),
            end: document.positionAt(imp.endOffset)
          },
          message: CSS_ESCAPE_MESSAGE,
          source: "zenith-contract"
        });
      }
    }
  }
}
function collectComponentDiagnostics(document, text, graph, diagnostics) {
  if (!graph)
    return;
  const strippedText = text.replace(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/gi, (match2, _tag, content) => {
    return match2.replace(content, " ".repeat(content.length));
  });
  const componentPattern = /<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let match;
  while ((match = componentPattern.exec(strippedText)) !== null) {
    const componentName = match[1];
    if (componentName === "ZenLink")
      continue;
    const inLayouts = graph.layouts.has(componentName);
    const inComponents = graph.components.has(componentName);
    if (!inLayouts && !inComponents) {
      const startPos = document.positionAt((match.index || 0) + 1);
      const endPos = document.positionAt((match.index || 0) + 1 + componentName.length);
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: { start: startPos, end: endPos },
        message: `Unknown component: '<${componentName}>'. Ensure it exists in src/layouts/ or src/components/`,
        source: "zenith"
      });
    }
  }
}
function collectDirectiveDiagnostics(document, text, diagnostics) {
  const directivePattern = /(zen:(?:if|for|effect|show))\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = directivePattern.exec(text)) !== null) {
    const directiveName = match[1];
    const directiveValue = match[2];
    if (directiveName === "zen:for") {
      const parsed = parseForExpression(directiveValue);
      if (!parsed) {
        const startPos = document.positionAt(match.index || 0);
        const endPos = document.positionAt((match.index || 0) + (match[0] || "").length);
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: { start: startPos, end: endPos },
          message: 'Invalid zen:for syntax. Expected: "item in items" or "item, index in items"',
          source: "zenith"
        });
      }
    }
    if (!directiveValue.trim()) {
      const startPos = document.positionAt(match.index || 0);
      const endPos = document.positionAt((match.index || 0) + (match[0] || "").length);
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: startPos, end: endPos },
        message: `${directiveName} requires a value`,
        source: "zenith"
      });
    }
  }
  const slotForPattern = /<slot[^>]*zen:for/g;
  while ((match = slotForPattern.exec(text)) !== null) {
    const startPos = document.positionAt(match.index || 0);
    const endPos = document.positionAt((match.index || 0) + (match[0] || "").length);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: { start: startPos, end: endPos },
      message: "zen:for cannot be used on <slot> elements",
      source: "zenith"
    });
  }
}
function collectImportDiagnostics(document, text, diagnostics) {
  const scriptMatch = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch)
    return;
  const scriptContent = scriptMatch[1];
  const scriptStart = (scriptMatch.index || 0) + scriptMatch[0].indexOf(scriptContent);
  const imports = parseZenithImports(scriptContent);
  for (const imp of imports) {
    const resolved = resolveModule(imp.module);
    if (isPluginModule(imp.module) && !resolved.isKnown) {
      const importPattern = new RegExp(`import[^'"]*['"]${imp.module.replace(":", "\\:")}['"]`);
      const importMatch = scriptContent.match(importPattern);
      if (importMatch) {
        const importOffset = scriptStart + (importMatch.index || 0);
        const startPos = document.positionAt(importOffset);
        const endPos = document.positionAt(importOffset + importMatch[0].length);
        diagnostics.push({
          severity: DiagnosticSeverity.Information,
          range: { start: startPos, end: endPos },
          message: `Unknown plugin module: '${imp.module}'. Make sure the plugin is installed.`,
          source: "zenith"
        });
      }
    }
    if (resolved.isKnown && resolved.metadata) {
      const validExports = resolved.metadata.exports.map((e) => e.name);
      for (const specifier of imp.specifiers) {
        if (!validExports.includes(specifier)) {
          const specPattern = new RegExp(`\\b${specifier}\\b`);
          const specMatch = scriptContent.match(specPattern);
          if (specMatch) {
            const specOffset = scriptStart + (specMatch.index || 0);
            const startPos = document.positionAt(specOffset);
            const endPos = document.positionAt(specOffset + specifier.length);
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: { start: startPos, end: endPos },
              message: `'${specifier}' is not exported from '${imp.module}'`,
              source: "zenith"
            });
          }
        }
      }
    }
  }
}
function collectExpressionDiagnostics(document, text, diagnostics) {
  const expressionPattern = /\{([^}]+)\}/g;
  let match;
  while ((match = expressionPattern.exec(text)) !== null) {
    const expression = match[1];
    const offset = match.index || 0;
    if (expression.includes("eval(") || expression.includes("Function(")) {
      const startPos = document.positionAt(offset);
      const endPos = document.positionAt(offset + (match[0] || "").length);
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: startPos, end: endPos },
        message: "Dangerous pattern detected: eval() and Function() are not allowed in expressions",
        source: "zenith"
      });
    }
    if (/\bwith\s*\(/.test(expression)) {
      const startPos = document.positionAt(offset);
      const endPos = document.positionAt(offset + (match[0] || "").length);
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: startPos, end: endPos },
        message: "'with' statement is not allowed in expressions",
        source: "zenith"
      });
    }
    if (expression.includes(" as ") || expression.includes("<") && expression.includes(">")) {
      const startPos = document.positionAt(offset);
      const endPos = document.positionAt(offset + (match[0] || "").length);
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: startPos, end: endPos },
        message: "TypeScript syntax (type casting or generics) detected in runtime expression. Runtime code must be pure JavaScript.",
        source: "zenith"
      });
    }
  }
}

// src/settings.ts
var DEFAULT_SETTINGS = Object.freeze({
  componentScripts: "forbid",
  strictDomLints: false
});
function normalizeSettings(input) {
  const maybe = input || {};
  const mode = maybe.componentScripts === "allow" ? "allow" : "forbid";
  const strictDomLints = maybe.strictDomLints === true;
  return { componentScripts: mode, strictDomLints };
}

// src/server.ts
var connection = (0, import_node7.createConnection)(import_node7.ProposedFeatures.all);
var documents = new import_node7.TextDocuments(import_vscode_languageserver_textdocument.TextDocument);
var projectGraphs = /* @__PURE__ */ new Map();
var workspaceFolders = [];
var globalSettings = DEFAULT_SETTINGS;
function getProjectGraph(docUri) {
  const filePath = docUri.replace("file://", "");
  const projectRoot = detectProjectRoot(path5.dirname(filePath), workspaceFolders);
  if (!projectRoot) {
    return null;
  }
  if (!projectGraphs.has(projectRoot)) {
    projectGraphs.set(projectRoot, buildProjectGraph(projectRoot));
  }
  return projectGraphs.get(projectRoot) || null;
}
function invalidateProjectGraph(uri) {
  const filePath = uri.replace("file://", "");
  const projectRoot = detectProjectRoot(path5.dirname(filePath), workspaceFolders);
  if (projectRoot) {
    projectGraphs.delete(projectRoot);
  }
}
connection.onInitialize((params) => {
  workspaceFolders = (params.workspaceFolders || []).map((folder) => folder.uri.replace("file://", ""));
  if (workspaceFolders.length === 0 && params.rootUri) {
    workspaceFolders = [params.rootUri.replace("file://", "")];
  }
  return {
    capabilities: {
      textDocumentSync: import_node7.TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ["{", "<", '"', "'", "=", ".", " ", ":", "(", "@"]
      },
      hoverProvider: true,
      codeActionProvider: true
    }
  };
});
connection.onInitialized(() => {
  connection.client.register(import_node7.DidChangeConfigurationNotification.type);
});
connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document)
    return [];
  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const graph = getProjectGraph(params.textDocument.uri);
  return provideCompletions(text, offset, graph);
});
connection.onCompletionResolve((item) => item);
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document)
    return null;
  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const graph = getProjectGraph(params.textDocument.uri);
  return provideHover(text, offset, graph);
});
connection.onCodeAction((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }
  const eventActions = buildEventBindingCodeActions(document, params.context.diagnostics);
  const domLintActions = buildDomLintCodeActions(document, params.context.diagnostics);
  const windowDocActions = buildWindowDocumentCodeActions(document, params.range);
  return [...eventActions, ...domLintActions, ...windowDocActions];
});
var DEBOUNCE_MS = 150;
var validationTimeouts = /* @__PURE__ */ new Map();
var validationIds = /* @__PURE__ */ new Map();
documents.onDidChangeContent((change) => {
  const uri = change.document.uri;
  const existing = validationTimeouts.get(uri);
  if (existing)
    clearTimeout(existing);
  validationTimeouts.set(
    uri,
    setTimeout(() => {
      validationTimeouts.delete(uri);
      validateDocument(change.document);
    }, DEBOUNCE_MS)
  );
});
documents.onDidSave((event) => {
  validateDocument(event.document);
});
documents.onDidOpen((event) => {
  validateDocument(event.document);
});
async function validateDocument(document) {
  const uri = document.uri;
  const id = (validationIds.get(uri) ?? 0) + 1;
  validationIds.set(uri, id);
  const graph = getProjectGraph(uri);
  const filePath = uri.replace("file://", "");
  const projectRoot = detectProjectRoot(path5.dirname(filePath), workspaceFolders);
  const diagnostics = await collectDiagnostics(document, graph, globalSettings, projectRoot);
  if (validationIds.get(uri) !== id)
    return;
  connection.sendDiagnostics({ uri, diagnostics });
}
connection.onDidChangeConfiguration((change) => {
  const config = change.settings?.zenith ?? change.settings;
  globalSettings = normalizeSettings(config);
  for (const doc of documents.all()) {
    validateDocument(doc);
  }
});
connection.onDidChangeWatchedFiles((params) => {
  for (const change of params.changes) {
    invalidateProjectGraph(change.uri);
  }
  for (const doc of documents.all()) {
    validateDocument(doc);
  }
});
documents.listen(connection);
connection.listen();
