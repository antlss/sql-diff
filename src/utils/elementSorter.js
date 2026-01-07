/**
 * SQL Element Sorter
 * Sorts query elements to ensure consistent ordering for comparison
 */

/**
 * Generate a sort key for an expression
 * @param {Object} expr - Expression AST node
 * @returns {string} Sort key string
 */
export function generateSortKey(expr) {
    if (!expr) return '';

    if (typeof expr === 'string') return expr;
    if (typeof expr === 'number') return String(expr);

    // Column reference
    if (expr.type === 'column_ref') {
        const table = expr.table || '';
        const column = expr.column || '';
        return `${table}.${column}`.toLowerCase();
    }

    // Binary expression (like a = b)
    if (expr.type === 'binary_expr') {
        const left = generateSortKey(expr.left);
        const op = expr.operator || '';
        const right = generateSortKey(expr.right);
        return `${left}|${op}|${right}`;
    }

    // Function call
    if (expr.type === 'function' || expr.type === 'aggr_func') {
        const name = expr.name || '';
        const args = expr.args ? JSON.stringify(expr.args) : '';
        return `fn:${name}(${args})`.toLowerCase();
    }

    // Number
    if (expr.type === 'number') {
        return String(expr.value);
    }

    // String
    if (expr.type === 'single_quote_string' || expr.type === 'string') {
        return `"${expr.value}"`;
    }

    // Star (SELECT *)
    if (expr.type === 'star') {
        return '*';
    }

    // Default: stringify
    return JSON.stringify(expr).toLowerCase();
}

/**
 * Flatten AND/OR conditions into a list
 * @param {Object} expr - WHERE expression
 * @param {string} operator - 'AND' or 'OR'
 * @returns {Array} List of conditions
 */
function flattenConditions(expr, operator) {
    if (!expr) return [];

    if (expr.type === 'binary_expr' && expr.operator.toUpperCase() === operator) {
        return [
            ...flattenConditions(expr.left, operator),
            ...flattenConditions(expr.right, operator)
        ];
    }

    return [expr];
}

/**
 * Rebuild a binary expression tree from a list of conditions
 * @param {Array} conditions - List of conditions
 * @param {string} operator - 'AND' or 'OR'
 * @returns {Object} Binary expression tree
 */
function rebuildConditionTree(conditions, operator) {
    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];

    // Build right-associative tree
    let result = conditions[conditions.length - 1];
    for (let i = conditions.length - 2; i >= 0; i--) {
        result = {
            type: 'binary_expr',
            operator: operator.toUpperCase(),
            left: conditions[i],
            right: result
        };
    }

    return result;
}

/**
 * Sort WHERE conditions recursively
 * @param {Object} where - WHERE clause AST
 * @returns {Object} Sorted WHERE clause
 */
export function sortWhereConditions(where) {
    if (!where) return where;

    // Clone to avoid mutation
    const result = JSON.parse(JSON.stringify(where));
    return sortWhereConditionsInPlace(result);
}

function sortWhereConditionsInPlace(expr) {
    if (!expr) return expr;

    // Handle AND expressions
    if (expr.type === 'binary_expr' && expr.operator.toUpperCase() === 'AND') {
        const conditions = flattenConditions(expr, 'AND');

        // Recursively sort nested conditions
        const sortedConditions = conditions
            .map(c => sortWhereConditionsInPlace(c))
            .sort((a, b) => generateSortKey(a).localeCompare(generateSortKey(b)));

        return rebuildConditionTree(sortedConditions, 'AND');
    }

    // Handle OR expressions
    if (expr.type === 'binary_expr' && expr.operator.toUpperCase() === 'OR') {
        const conditions = flattenConditions(expr, 'OR');

        // Recursively sort nested conditions
        const sortedConditions = conditions
            .map(c => sortWhereConditionsInPlace(c))
            .sort((a, b) => generateSortKey(a).localeCompare(generateSortKey(b)));

        return rebuildConditionTree(sortedConditions, 'OR');
    }

    // For other binary expressions, sort left/right if they're comparable
    if (expr.type === 'binary_expr') {
        // For commutative operators like =, sort left and right
        const commutativeOps = ['=', '!=', '<>', 'AND', 'OR'];
        if (commutativeOps.includes(expr.operator.toUpperCase())) {
            const leftKey = generateSortKey(expr.left);
            const rightKey = generateSortKey(expr.right);

            // Keep the smaller key on the left
            if (leftKey > rightKey && expr.operator === '=') {
                const temp = expr.left;
                expr.left = expr.right;
                expr.right = temp;
            }
        }
    }

    return expr;
}

/**
 * Sort SELECT columns (except keep * first)
 * @param {Array} columns - SELECT columns
 * @returns {Array} Sorted columns
 */
export function sortSelectColumns(columns) {
    if (!columns || columns === '*') return columns;

    // Clone to avoid mutation
    const result = JSON.parse(JSON.stringify(columns));

    // Separate star columns from others
    const starCols = result.filter(c => c.expr && c.expr.type === 'star');
    const otherCols = result.filter(c => !c.expr || c.expr.type !== 'star');

    // Sort non-star columns
    otherCols.sort((a, b) => {
        const keyA = generateSortKey(a.expr);
        const keyB = generateSortKey(b.expr);
        return keyA.localeCompare(keyB);
    });

    return [...starCols, ...otherCols];
}

/**
 * Sort JOIN clauses
 * @param {Array} from - FROM clause with joins
 * @returns {Array} Sorted FROM clause
 */
export function sortJoinClauses(from) {
    if (!from || from.length <= 1) return from;

    // Clone to avoid mutation
    const result = JSON.parse(JSON.stringify(from));

    // First item is always the main table, rest are joins
    const mainTable = result[0];
    const joins = result.slice(1);

    // Sort joins by join type + table name
    joins.sort((a, b) => {
        const keyA = `${a.join || ''}.${a.table || ''}`.toLowerCase();
        const keyB = `${b.join || ''}.${b.table || ''}`.toLowerCase();
        return keyA.localeCompare(keyB);
    });

    // Sort ON conditions within each join
    for (const join of joins) {
        if (join.on) {
            join.on = sortWhereConditions(join.on);
        }
    }

    return [mainTable, ...joins];
}

/**
 * Sort GROUP BY columns
 * @param {Array} groupby - GROUP BY clause
 * @returns {Array} Sorted GROUP BY
 */
export function sortGroupBy(groupby) {
    if (!groupby) return groupby;

    const result = JSON.parse(JSON.stringify(groupby));

    return result.sort((a, b) => {
        const keyA = generateSortKey(a);
        const keyB = generateSortKey(b);
        return keyA.localeCompare(keyB);
    });
}

export default {
    generateSortKey,
    sortWhereConditions,
    sortSelectColumns,
    sortJoinClauses,
    sortGroupBy
};
