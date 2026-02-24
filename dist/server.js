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
var import_node = require("vscode-languageserver/node");
var import_vscode_languageserver_textdocument = require("vscode-languageserver-textdocument");
var path4 = __toESM(require("path"));

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
    const usagePatterns = content.matchAll(/\{(title|lang|className|children|href|src|alt|id|name)\}/g);
    for (const match of usagePatterns) {
      if (match[1] && !props.includes(match[1])) {
        props.push(match[1]);
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
  if (!directive) return false;
  if (elementType === "slot") return false;
  return directive.placement.includes(elementType);
}
function parseForExpression(expression) {
  const match = expression.match(/^\s*([a-zA-Z_$][\w$]*)(?:\s*,\s*([a-zA-Z_$][\w$]*))?\s+in\s+(.+)\s*$/);
  if (!match) return null;
  return {
    itemVar: match[1],
    indexVar: match[2],
    source: match[3].trim()
  };
}

// src/metadata/core-imports.ts
var CORE_MODULES = {
  "zenith": {
    module: "zenith",
    description: "Core Zenith runtime primitives and lifecycle hooks.",
    exports: [
      {
        name: "zenEffect",
        kind: "function",
        description: "Reactive effect that re-runs when dependencies change.",
        signature: "zenEffect(callback: () => void | (() => void)): void"
      },
      {
        name: "zenOnMount",
        kind: "function",
        description: "Called when component is mounted to the DOM.",
        signature: "zenOnMount(callback: () => void | (() => void)): void"
      },
      {
        name: "zenOnDestroy",
        kind: "function",
        description: "Called when component is removed from the DOM.",
        signature: "zenOnDestroy(callback: () => void): void"
      },
      {
        name: "zenOnUpdate",
        kind: "function",
        description: "Called after any state update causes a re-render.",
        signature: "zenOnUpdate(callback: () => void): void"
      },
      {
        name: "zenRef",
        kind: "function",
        description: "Create a reactive reference.",
        signature: "zenRef<T>(initial: T): { value: T }"
      },
      {
        name: "zenState",
        kind: "function",
        description: "Create reactive state.",
        signature: "zenState<T>(initial: T): [T, (value: T) => void]"
      },
      {
        name: "zenMemo",
        kind: "function",
        description: "Memoize a computed value.",
        signature: "zenMemo<T>(compute: () => T): T"
      },
      {
        name: "zenBatch",
        kind: "function",
        description: "Batch multiple state updates.",
        signature: "zenBatch(callback: () => void): void"
      },
      {
        name: "zenUntrack",
        kind: "function",
        description: "Run code without tracking dependencies.",
        signature: "zenUntrack<T>(callback: () => T): T"
      }
    ]
  },
  "zenith/router": {
    module: "zenith/router",
    description: "File-based SPA router for Zenith framework.",
    exports: [
      {
        name: "ZenLink",
        kind: "component",
        description: "Declarative navigation component for routes.",
        signature: '<ZenLink to="/path" preload?>{children}</ZenLink>'
      },
      {
        name: "useRoute",
        kind: "function",
        description: "Provides reactive access to the current route. Must be called at top-level script scope.",
        signature: "useRoute(): { path: string; params: Record<string, string>; query: Record<string, string> }"
      },
      {
        name: "useRouter",
        kind: "function",
        description: "Provides programmatic navigation methods.",
        signature: "useRouter(): { navigate: (to: string, options?: { replace?: boolean }) => void; back: () => void; forward: () => void }"
      },
      {
        name: "navigate",
        kind: "function",
        description: "Navigate to a route programmatically.",
        signature: "navigate(to: string, options?: { replace?: boolean }): void"
      },
      {
        name: "prefetch",
        kind: "function",
        description: "Prefetch a route for faster navigation.",
        signature: "prefetch(path: string): Promise<void>"
      },
      {
        name: "isActive",
        kind: "function",
        description: "Check if a route is currently active.",
        signature: "isActive(path: string, exact?: boolean): boolean"
      },
      {
        name: "getRoute",
        kind: "function",
        description: "Get the current route state.",
        signature: "getRoute(): { path: string; params: Record<string, string>; query: Record<string, string> }"
      }
    ]
  }
};
function getCoreModule(moduleName) {
  return CORE_MODULES[moduleName];
}
function getCoreExport(moduleName, exportName) {
  const module2 = CORE_MODULES[moduleName];
  if (!module2) return void 0;
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
  if (!module2) return void 0;
  return module2.exports.find((e) => e.name === exportName);
}
function isPluginModule(moduleName) {
  return moduleName.startsWith("zenith:");
}
function isKnownPluginModule(moduleName) {
  return moduleName in PLUGIN_MODULES;
}

// src/imports.ts
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
      if (moduleName.startsWith("zenith") || moduleName.startsWith("zenith:")) {
        const specifiers = [];
        if (namedImports) {
          const parts = namedImports.split(",");
          for (const part of parts) {
            const cleaned = part.trim().split(/\s+as\s+/)[0].trim();
            if (cleaned) specifiers.push(cleaned);
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
      if (moduleName.startsWith("zenith") || moduleName.startsWith("zenith:")) {
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
  return imports.some((i) => i.module === "zenith/router");
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

// src/router.ts
var ROUTER_HOOKS = {
  useRoute: {
    name: "useRoute",
    owner: "Router Hook (zenith/router)",
    description: "Provides reactive access to the current route state.",
    restrictions: "Must be called at top-level script scope.",
    returns: "{ path: string; params: Record<string, string>; query: Record<string, string> }",
    signature: "useRoute(): RouteState"
  },
  useRouter: {
    name: "useRouter",
    owner: "Router Hook (zenith/router)",
    description: "Provides programmatic navigation methods.",
    restrictions: "Must be called at top-level script scope.",
    returns: "{ navigate, back, forward, go }",
    signature: "useRouter(): Router"
  }
};
var ZENLINK_PROPS = [
  {
    name: "to",
    type: "string",
    required: true,
    description: "The route path to navigate to."
  },
  {
    name: "preload",
    type: "boolean",
    required: false,
    description: "Whether to prefetch the route on hover."
  },
  {
    name: "replace",
    type: "boolean",
    required: false,
    description: "Whether to replace the current history entry instead of pushing a new one."
  },
  {
    name: "class",
    type: "string",
    required: false,
    description: "CSS class to apply to the link."
  },
  {
    name: "activeClass",
    type: "string",
    required: false,
    description: "CSS class to apply when the link is active."
  }
];
var ROUTE_FIELDS = [
  {
    name: "path",
    type: "string",
    description: 'The current route path (e.g., "/blog/my-post").'
  },
  {
    name: "params",
    type: "Record<string, string>",
    description: 'Dynamic route parameters (e.g., { slug: "my-post" }).'
  },
  {
    name: "query",
    type: "Record<string, string>",
    description: 'Query string parameters (e.g., { page: "1" }).'
  }
];
function getRouterHook(name) {
  return ROUTER_HOOKS[name];
}
function isRouterHook(name) {
  return name in ROUTER_HOOKS;
}

// src/diagnostics.ts
var path3 = __toESM(require("path"));

// src/contracts.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
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
    return path2.resolve(candidate);
  }
}
function resolveCssImportPath(importingFilePath, specifier, projectRoot) {
  const normalizedSpecifier = stripImportSuffix(specifier);
  const importingDir = path2.dirname(importingFilePath);
  const rootCanonical = canonicalizePath(projectRoot);
  const unresolvedTarget = normalizedSpecifier.startsWith("/") ? path2.join(rootCanonical, normalizedSpecifier.slice(1)) : path2.resolve(importingDir, normalizedSpecifier);
  const targetCanonical = canonicalizePath(unresolvedTarget);
  const relativeToRoot = path2.relative(rootCanonical, targetCanonical);
  const escapesProjectRoot = relativeToRoot.startsWith("..") || path2.isAbsolute(relativeToRoot);
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
    await compile(text, filePath);
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
  const effectiveProjectRoot = projectRoot ? path3.resolve(projectRoot) : path3.dirname(filePath);
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
  if (!graph) return;
  const strippedText = text.replace(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/gi, (match2, _tag, content) => {
    return match2.replace(content, " ".repeat(content.length));
  });
  const componentPattern = /<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let match;
  while ((match = componentPattern.exec(strippedText)) !== null) {
    const componentName = match[1];
    if (componentName === "ZenLink") continue;
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
  if (!scriptMatch) return;
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
  componentScripts: "forbid"
});
function normalizeSettings(input) {
  const maybe = input || {};
  const mode = maybe.componentScripts === "allow" ? "allow" : "forbid";
  return { componentScripts: mode };
}

// src/server.ts
var connection = (0, import_node.createConnection)(import_node.ProposedFeatures.all);
var documents = new import_node.TextDocuments(import_vscode_languageserver_textdocument.TextDocument);
var projectGraphs = /* @__PURE__ */ new Map();
var workspaceFolders = [];
var globalSettings = DEFAULT_SETTINGS;
var LIFECYCLE_HOOKS = [
  { name: "state", doc: "Declare a reactive state variable", snippet: "state ${1:name} = ${2:value}", kind: import_node.CompletionItemKind.Keyword },
  { name: "zenOnMount", doc: "Called when component is mounted to the DOM", snippet: "zenOnMount(() => {\n	$0\n})", kind: import_node.CompletionItemKind.Function },
  { name: "zenOnDestroy", doc: "Called when component is removed from the DOM", snippet: "zenOnDestroy(() => {\n	$0\n})", kind: import_node.CompletionItemKind.Function },
  { name: "zenOnUpdate", doc: "Called after any state update causes a re-render", snippet: "zenOnUpdate(() => {\n	$0\n})", kind: import_node.CompletionItemKind.Function },
  { name: "zenEffect", doc: "Reactive effect that re-runs when dependencies change", snippet: "zenEffect(() => {\n	$0\n})", kind: import_node.CompletionItemKind.Function },
  { name: "useFetch", doc: "Fetch data with caching and SSG support", snippet: 'useFetch("${1:url}")', kind: import_node.CompletionItemKind.Function }
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
  { tag: "slot", doc: "Zenith slot for child content" }
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
  "click",
  "change",
  "input",
  "submit",
  "keydown",
  "keyup",
  "keypress",
  "focus",
  "blur",
  "mouseover",
  "mouseout",
  "mouseenter",
  "mouseleave"
];
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
      if (parsed.indexVar) vars.push(parsed.indexVar);
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
  const currentWord = wordMatch ? wordMatch[0] : "";
  const afterAt = before.endsWith("@") || currentWord.startsWith("@");
  const afterColon = before.endsWith(":") || currentWord.startsWith(":") && !currentWord.startsWith(":");
  return { inScript, inStyle, inTag, inExpression, inTemplate, inAttributeValue, tagName, currentWord, afterAt, afterColon };
}
function getProjectGraph(docUri) {
  const filePath = docUri.replace("file://", "");
  const projectRoot = detectProjectRoot(path4.dirname(filePath), workspaceFolders);
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
  const projectRoot = detectProjectRoot(path4.dirname(filePath), workspaceFolders);
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
      textDocumentSync: import_node.TextDocumentSyncKind.Incremental,
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
  connection.client.register(import_node.DidChangeConfigurationNotification.type);
});
connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const ctx = getPositionContext(text, offset);
  const completions = [];
  const graph = getProjectGraph(params.textDocument.uri);
  const script = getScriptContent(text);
  const states = extractStates(script);
  const functions = extractFunctions(script);
  const imports = parseZenithImports(script);
  const routerEnabled = hasRouterImport(imports);
  const loopVariables = extractLoopVariables(text);
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const lineBefore = text.substring(lineStart, offset);
  if (ctx.inScript) {
    for (const hook of LIFECYCLE_HOOKS) {
      if (!ctx.currentWord || hook.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        completions.push({
          label: hook.name,
          kind: hook.kind,
          detail: hook.name === "state" ? "Zenith State" : "Zenith Lifecycle",
          documentation: { kind: import_node.MarkupKind.Markdown, value: hook.doc },
          insertText: hook.snippet,
          insertTextFormat: import_node.InsertTextFormat.Snippet,
          sortText: `0_${hook.name}`,
          preselect: hook.name === "state" && ctx.currentWord.startsWith("s")
        });
      }
    }
    if (routerEnabled) {
      for (const hook of Object.values(ROUTER_HOOKS)) {
        if (!ctx.currentWord || hook.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
          completions.push({
            label: hook.name,
            kind: import_node.CompletionItemKind.Function,
            detail: hook.owner,
            documentation: { kind: import_node.MarkupKind.Markdown, value: `${hook.description}

**Returns:** \`${hook.returns}\`` },
            insertText: `${hook.name}()`,
            sortText: `0_${hook.name}`
          });
        }
      }
    }
    for (const func of functions) {
      if (!ctx.currentWord || func.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        completions.push({
          label: func.name,
          kind: import_node.CompletionItemKind.Function,
          detail: `${func.isAsync ? "async " : ""}function ${func.name}(${func.params})`,
          insertText: `${func.name}($0)`,
          insertTextFormat: import_node.InsertTextFormat.Snippet
        });
      }
    }
    for (const [name, value] of states) {
      if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
        completions.push({
          label: name,
          kind: import_node.CompletionItemKind.Variable,
          detail: `state ${name}`,
          documentation: `Current value: ${value}`
        });
      }
    }
    const isImportPath = /from\s+['"][^'"]*$/.test(lineBefore) || /import\s+['"][^'"]*$/.test(lineBefore);
    if (isImportPath) {
      for (const mod of getAllModules()) {
        completions.push({
          label: mod.module,
          kind: import_node.CompletionItemKind.Module,
          detail: mod.kind === "plugin" ? "Zenith Plugin" : "Zenith Core",
          documentation: mod.description,
          insertText: mod.module
        });
      }
    }
  }
  if (ctx.inExpression) {
    for (const [name, value] of states) {
      completions.push({
        label: name,
        kind: import_node.CompletionItemKind.Variable,
        detail: `state ${name}`,
        documentation: `Value: ${value}`,
        sortText: `0_${name}`
      });
    }
    for (const func of functions) {
      completions.push({
        label: func.name,
        kind: import_node.CompletionItemKind.Function,
        detail: `${func.isAsync ? "async " : ""}function`,
        insertText: `${func.name}()`,
        sortText: `1_${func.name}`
      });
    }
    for (const loopVar of loopVariables) {
      completions.push({
        label: loopVar,
        kind: import_node.CompletionItemKind.Variable,
        detail: "loop variable",
        sortText: `0_${loopVar}`
      });
    }
    if (routerEnabled) {
      for (const field of ROUTE_FIELDS) {
        completions.push({
          label: `route.${field.name}`,
          kind: import_node.CompletionItemKind.Property,
          detail: field.type,
          documentation: field.description,
          sortText: `2_route_${field.name}`
        });
      }
    }
  }
  if (ctx.inTemplate && !ctx.inExpression && !ctx.inAttributeValue) {
    const isAfterOpenBracket = lineBefore.match(/<\s*$/);
    const isTypingTag = ctx.currentWord.length > 0 && !ctx.inTag;
    if (graph && (isAfterOpenBracket || isTypingTag && /^[A-Z]/.test(ctx.currentWord))) {
      for (const [name, info] of graph.layouts) {
        if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
          const propStr = info.props.length > 0 ? ` ${info.props[0]}="$1"` : "";
          completions.push({
            label: name,
            kind: import_node.CompletionItemKind.Class,
            detail: `layout`,
            documentation: { kind: import_node.MarkupKind.Markdown, value: `**Layout** from \`${path4.basename(info.filePath)}\`

Props: ${info.props.join(", ") || "none"}` },
            insertText: isAfterOpenBracket ? `${name}${propStr}>$0</${name}>` : `<${name}${propStr}>$0</${name}>`,
            insertTextFormat: import_node.InsertTextFormat.Snippet,
            sortText: `0_${name}`
          });
        }
      }
      for (const [name, info] of graph.components) {
        if (!ctx.currentWord || name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
          completions.push({
            label: name,
            kind: import_node.CompletionItemKind.Class,
            detail: `component`,
            documentation: { kind: import_node.MarkupKind.Markdown, value: `**Component** from \`${path4.basename(info.filePath)}\`

Props: ${info.props.join(", ") || "none"}` },
            insertText: isAfterOpenBracket ? `${name} $0/>` : `<${name} $0/>`,
            insertTextFormat: import_node.InsertTextFormat.Snippet,
            sortText: `0_${name}`
          });
        }
      }
    }
    if (routerEnabled && (isAfterOpenBracket || isTypingTag && ctx.currentWord.toLowerCase().startsWith("z"))) {
      completions.push({
        label: "ZenLink",
        kind: import_node.CompletionItemKind.Class,
        detail: "router component",
        documentation: { kind: import_node.MarkupKind.Markdown, value: "**Router Component** (zenith/router)\n\nDeclarative navigation component for routes.\n\n**Props:** to, preload, replace, class, activeClass" },
        insertText: isAfterOpenBracket ? 'ZenLink to="$1">$0</ZenLink>' : '<ZenLink to="$1">$0</ZenLink>',
        insertTextFormat: import_node.InsertTextFormat.Snippet,
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
            kind: import_node.CompletionItemKind.Property,
            detail: "HTML",
            documentation: el.doc,
            insertText: isAfterOpenBracket ? snippet : `<${snippet}>`,
            insertTextFormat: import_node.InsertTextFormat.Snippet,
            sortText: `1_${el.tag}`
          });
        }
      }
    }
  }
  if (ctx.inTag && ctx.tagName && !ctx.inAttributeValue) {
    const elementType = ctx.tagName === "slot" ? "slot" : /^[A-Z]/.test(ctx.tagName) ? "component" : "element";
    for (const directiveName of getDirectiveNames()) {
      if (canPlaceDirective(directiveName, elementType)) {
        if (!ctx.currentWord || directiveName.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
          const directive = getDirective(directiveName);
          if (directive) {
            completions.push({
              label: directive.name,
              kind: import_node.CompletionItemKind.Keyword,
              detail: directive.category,
              documentation: { kind: import_node.MarkupKind.Markdown, value: `${directive.description}

**Syntax:** \`${directive.syntax}\`` },
              insertText: `${directive.name}="$1"`,
              insertTextFormat: import_node.InsertTextFormat.Snippet,
              sortText: `0_${directive.name}`
            });
          }
        }
      }
    }
    if (!ctx.currentWord || ctx.currentWord.startsWith("on:") || ctx.currentWord === "on") {
      for (const event of DOM_EVENTS) {
        completions.push({
          label: `on:${event}`,
          kind: import_node.CompletionItemKind.Event,
          detail: "event binding",
          documentation: `Bind to ${event} event`,
          insertText: `on:${event}={$1}`,
          insertTextFormat: import_node.InsertTextFormat.Snippet,
          sortText: `1_on:${event}`
        });
      }
    }
    if (ctx.afterColon || ctx.currentWord.startsWith(":")) {
      for (const attr of HTML_ATTRIBUTES) {
        completions.push({
          label: `:${attr}`,
          kind: import_node.CompletionItemKind.Property,
          detail: "reactive binding",
          documentation: `Reactive binding for ${attr}`,
          insertText: `:${attr}="$1"`,
          insertTextFormat: import_node.InsertTextFormat.Snippet,
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
            kind: import_node.CompletionItemKind.Property,
            detail: `prop of <${ctx.tagName}>`,
            insertText: `${prop}={$1}`,
            insertTextFormat: import_node.InsertTextFormat.Snippet,
            sortText: `0_${prop}`
          });
        }
      }
    }
    if (routerEnabled && ctx.tagName === "ZenLink") {
      for (const prop of ZENLINK_PROPS) {
        if (!ctx.currentWord || prop.name.toLowerCase().startsWith(ctx.currentWord.toLowerCase())) {
          completions.push({
            label: prop.name,
            kind: import_node.CompletionItemKind.Property,
            detail: prop.required ? `${prop.type} (required)` : prop.type,
            documentation: prop.description,
            insertText: prop.name === "to" ? `${prop.name}="$1"` : `${prop.name}`,
            insertTextFormat: import_node.InsertTextFormat.Snippet,
            sortText: prop.required ? `0_${prop.name}` : `1_${prop.name}`
          });
        }
      }
    }
    for (const attr of HTML_ATTRIBUTES) {
      if (!ctx.currentWord || attr.startsWith(ctx.currentWord.toLowerCase())) {
        completions.push({
          label: attr,
          kind: import_node.CompletionItemKind.Property,
          detail: "HTML attribute",
          insertText: `${attr}="$1"`,
          insertTextFormat: import_node.InsertTextFormat.Snippet,
          sortText: `3_${attr}`
        });
      }
    }
  }
  if (ctx.inAttributeValue) {
    const eventMatch = lineBefore.match(/on:[a-zA-Z][a-zA-Z0-9_-]*=["'{][^"'{}]*$/);
    if (eventMatch) {
      for (const func of functions) {
        completions.push({
          label: func.name,
          kind: import_node.CompletionItemKind.Function,
          detail: "function",
          insertText: func.name
        });
      }
    }
  }
  return completions;
});
connection.onCompletionResolve((item) => {
  return item;
});
connection.onCodeAction((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }
  return buildEventBindingCodeActions(document, params.context.diagnostics);
});
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const before = text.substring(0, offset);
  const after = text.substring(offset);
  const wordBefore = before.match(/[a-zA-Z0-9_$:@-]*$/)?.[0] || "";
  const wordAfter = after.match(/^[a-zA-Z0-9_$:-]*/)?.[0] || "";
  const word = wordBefore + wordAfter;
  if (!word) return null;
  if (isDirective(word)) {
    const directive = getDirective(word);
    if (directive) {
      let notes = "";
      if (directive.name === "zen:for") {
        notes = "- No runtime loop\n- Compiled into static DOM instructions\n- Creates scope: `item`, `index`";
      } else {
        notes = "- Compile-time directive\n- No runtime assumptions\n- Processed at build time";
      }
      return {
        contents: {
          kind: import_node.MarkupKind.Markdown,
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
  }
  if (isRouterHook(word)) {
    const hook2 = getRouterHook(word);
    if (hook2) {
      return {
        contents: {
          kind: import_node.MarkupKind.Markdown,
          value: `### ${hook2.name}()

**${hook2.owner}**

${hook2.description}

**Restrictions:** ${hook2.restrictions}

**Returns:** \`${hook2.returns}\`

**Signature:**
\`\`\`typescript
${hook2.signature}
\`\`\``
        }
      };
    }
  }
  const hook = LIFECYCLE_HOOKS.find((h) => h.name === word);
  if (hook) {
    return {
      contents: {
        kind: import_node.MarkupKind.Markdown,
        value: `### ${hook.name}

${hook.doc}

\`\`\`typescript
${hook.snippet.replace(/\$\d/g, "").replace("$0", "// ...")}
\`\`\``
      }
    };
  }
  if (word === "ZenLink") {
    const script2 = getScriptContent(text);
    const imports2 = parseZenithImports(script2);
    if (hasRouterImport(imports2)) {
      return {
        contents: {
          kind: import_node.MarkupKind.Markdown,
          value: "### `<ZenLink>`\n\n**Router Component** (zenith/router)\n\nDeclarative navigation component for routes.\n\n**Props:**\n- `to` (string, required) - Route path\n- `preload` (boolean) - Prefetch on hover\n- `replace` (boolean) - Replace history entry\n- `class` (string) - CSS class\n- `activeClass` (string) - Class when active"
        }
      };
    }
  }
  const script = getScriptContent(text);
  const states = extractStates(script);
  if (states.has(word)) {
    return {
      contents: {
        kind: import_node.MarkupKind.Markdown,
        value: `### state \`${word}\`

**Type:** inferred

**Initial value:** \`${states.get(word)}\``
      }
    };
  }
  const functions = extractFunctions(script);
  const func = functions.find((f) => f.name === word);
  if (func) {
    return {
      contents: {
        kind: import_node.MarkupKind.Markdown,
        value: `### ${func.isAsync ? "async " : ""}function \`${func.name}\`

\`\`\`typescript
${func.isAsync ? "async " : ""}function ${func.name}(${func.params})
\`\`\``
      }
    };
  }
  const imports = parseZenithImports(script);
  for (const imp of imports) {
    if (imp.specifiers.includes(word)) {
      const exportMeta = resolveExport(imp.module, word);
      if (exportMeta) {
        const resolved = resolveModule(imp.module);
        const owner = resolved.kind === "plugin" ? "Plugin" : resolved.kind === "core" ? "Core" : "External";
        return {
          contents: {
            kind: import_node.MarkupKind.Markdown,
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
  const graph = getProjectGraph(params.textDocument.uri);
  if (graph) {
    const component = resolveComponent(graph, word);
    if (component) {
      return {
        contents: {
          kind: import_node.MarkupKind.Markdown,
          value: `### ${component.type} \`<${component.name}>\`

**File:** \`${component.filePath}\`

**Props:** ${component.props.join(", ") || "none"}`
        }
      };
    }
  }
  const htmlEl = HTML_ELEMENTS.find((e) => e.tag === word);
  if (htmlEl) {
    return {
      contents: {
        kind: import_node.MarkupKind.Markdown,
        value: `### HTML \`<${htmlEl.tag}>\`

${htmlEl.doc}`
      }
    };
  }
  return null;
});
documents.onDidChangeContent((change) => {
  validateDocument(change.document);
});
documents.onDidOpen((event) => {
  validateDocument(event.document);
});
async function validateDocument(document) {
  const graph = getProjectGraph(document.uri);
  const filePath = document.uri.replace("file://", "");
  const projectRoot = detectProjectRoot(path4.dirname(filePath), workspaceFolders);
  const diagnostics = await collectDiagnostics(document, graph, globalSettings, projectRoot);
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
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
