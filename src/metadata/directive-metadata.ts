/**
 * Directive Metadata
 * 
 * Compile-time directive definitions for Zenith.
 * These are compiler directives, not runtime attributes.
 */

export interface DirectiveMetadata {
    name: string;
    category: 'control-flow' | 'iteration' | 'reactive-effect' | 'conditional-visibility';
    description: string;
    syntax: string;
    placement: ('element' | 'component')[];
    example: string;
    createsScope?: boolean;
    scopeVariables?: string[];
}

/**
 * All Zenith compiler directives
 * 
 * These are processed at compile-time and transformed into static DOM instructions.
 * The LSP must describe these directives without assuming runtime behavior.
 */
export const DIRECTIVES: Record<string, DirectiveMetadata> = {
    'zen:if': {
        name: 'zen:if',
        category: 'control-flow',
        description: 'Compile-time conditional directive. Conditionally renders the element based on a boolean expression.',
        syntax: 'zen:if="condition"',
        placement: ['element', 'component'],
        example: '<div zen:if="isVisible">Conditionally rendered</div>'
    },
    'zen:for': {
        name: 'zen:for',
        category: 'iteration',
        description: 'Compile-time iteration directive. Repeats the element for each item in a collection.',
        syntax: 'zen:for="item in items" or zen:for="item, index in items"',
        placement: ['element', 'component'],
        example: '<li zen:for="item in items">{item.name}</li>',
        createsScope: true,
        scopeVariables: ['item', 'index']
    },
    'zen:effect': {
        name: 'zen:effect',
        category: 'reactive-effect',
        description: 'Compile-time reactive effect directive. Attaches a side effect to the element lifecycle.',
        syntax: 'zen:effect="expression"',
        placement: ['element', 'component'],
        example: '<div zen:effect="console.log(\'rendered\')">Content</div>'
    },
    'zen:show': {
        name: 'zen:show',
        category: 'conditional-visibility',
        description: 'Compile-time visibility directive. Toggles element visibility without removing from DOM.',
        syntax: 'zen:show="condition"',
        placement: ['element', 'component'],
        example: '<div zen:show="isOpen">Toggle visibility</div>'
    }
};

/**
 * Check if a string is a valid directive name
 */
export function isDirective(name: string): name is keyof typeof DIRECTIVES {
    return name in DIRECTIVES;
}

/**
 * Get directive metadata by name
 */
export function getDirective(name: string): DirectiveMetadata | undefined {
    return DIRECTIVES[name];
}

/**
 * Get all directive names
 */
export function getDirectiveNames(): string[] {
    return Object.keys(DIRECTIVES);
}

/**
 * Check if a directive can be placed on a specific element type
 */
export function canPlaceDirective(directiveName: string, elementType: 'element' | 'component' | 'slot'): boolean {
    const directive = DIRECTIVES[directiveName];
    if (!directive) return false;
    
    // Directives cannot be placed on <slot>
    if (elementType === 'slot') return false;
    
    return directive.placement.includes(elementType as 'element' | 'component');
}

/**
 * Parse a zen:for expression to extract variables
 */
export function parseForExpression(expression: string): { itemVar: string; indexVar?: string; source: string } | null {
    // Match: "item in items" or "item, index in items"
    const match = expression.match(/^\s*([a-zA-Z_$][\w$]*)(?:\s*,\s*([a-zA-Z_$][\w$]*))?\s+in\s+(.+)\s*$/);
    if (!match) return null;
    
    return {
        itemVar: match[1],
        indexVar: match[2],
        source: match[3].trim()
    };
}
