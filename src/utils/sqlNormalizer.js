/**
 * SQL Query Normalizer
 * Main orchestration module for SQL normalization
 */
import { Parser } from 'node-sql-parser';
import { buildAliasMap, resolveAstAliases } from './aliasResolver';
import { sortSelectColumns, sortJoinClauses, sortWhereConditions, sortGroupBy } from './elementSorter';
import { prettifySQL } from './sqlPrettifier';

// Create parser instance with MySQL as default dialect
const parser = new Parser();

/**
 * Parse SQL string to AST
 * @param {string} sql - SQL query string
 * @param {string} database - Database dialect (default: 'mysql')
 * @returns {Object} { ast, error }
 */
export function parseSQL(sql, database = 'mysql') {
    try {
        const opt = { database };
        const ast = parser.astify(sql, opt);
        return { ast: Array.isArray(ast) ? ast[0] : ast, error: null };
    } catch (error) {
        return { ast: null, error: error.message };
    }
}

/**
 * Convert AST back to SQL string
 * @param {Object} ast - SQL AST
 * @param {string} database - Database dialect (default: 'mysql')
 * @returns {string} SQL string
 */
export function astToSQL(ast, database = 'mysql') {
    try {
        const opt = { database };
        return parser.sqlify(ast, opt);
    } catch (error) {
        return `/* Error generating SQL: ${error.message} */`;
    }
}

/**
 * Normalize a SQL query
 * @param {string} sql - SQL query string
 * @param {Object} options - Normalization options
 * @returns {Object} { normalized, ast, error }
 */
export function normalizeQuery(sql, options = {}) {
    const {
        database = 'mysql',
        resolveAliases = true,
        sortColumns = true,
        sortJoins = true,
        sortWhere = true,
        sortGroupBy: shouldSortGroupBy = true
    } = options;

    // Parse SQL
    const { ast, error } = parseSQL(sql, database);

    if (error) {
        return { normalized: null, ast: null, error };
    }

    if (!ast) {
        return { normalized: null, ast: null, error: 'Empty or invalid SQL' };
    }

    // Clone AST to avoid mutating original
    const normalizedAst = JSON.parse(JSON.stringify(ast));

    try {
        // Step 1: Resolve aliases
        if (resolveAliases) {
            const aliasMap = buildAliasMap(normalizedAst);
            resolveAstAliases(normalizedAst, aliasMap);
        }

        // Implicit Step: Standardize SELECT Aliases
        // Ensure every column has an alias (as) to ensure "col" and "col AS col" normalize identically
        if (normalizedAst.columns && Array.isArray(normalizedAst.columns)) {
            normalizedAst.columns.forEach(col => {
                if (!col.as && col.expr && col.expr.type === 'column_ref') {
                    col.as = col.expr.column;
                }
                // Handle double_quote_string that were converted or not
                if (!col.as && col.expr && col.expr.type === 'double_quote_string') {
                    col.as = col.expr.value;
                }
            });
        }

        // Step 2: Sort SELECT columns
        if (sortColumns && normalizedAst.columns) {
            normalizedAst.columns = sortSelectColumns(normalizedAst.columns);
        }

        // Step 3: Sort JOIN clauses
        if (sortJoins && normalizedAst.from) {
            normalizedAst.from = sortJoinClauses(normalizedAst.from);
        }

        // Step 4: Sort WHERE conditions
        if (sortWhere && normalizedAst.where) {
            normalizedAst.where = sortWhereConditions(normalizedAst.where);
        }

        // Step 5: Sort GROUP BY
        if (shouldSortGroupBy && normalizedAst.groupby) {
            normalizedAst.groupby = sortGroupBy(normalizedAst.groupby);
        }

        // Generate normalized SQL and format with line breaks
        const rawNormalized = astToSQL(normalizedAst, database);
        const normalized = prettifySQL(rawNormalized);

        return { normalized, ast: normalizedAst, error: null };
    } catch (err) {
        return { normalized: null, ast: null, error: `Normalization error: ${err.message}` };
    }
}

/**
 * Compare two SQL queries after normalization
 * @param {string} sql1 - First SQL query
 * @param {string} sql2 - Second SQL query
 * @param {Object} options - Normalization options
 * @returns {Object} { isEquivalent, normalized1, normalized2, error1, error2 }
 */
export function compareQueries(sql1, sql2, options = {}) {
    const result1 = normalizeQuery(sql1, options);
    const result2 = normalizeQuery(sql2, options);

    const isEquivalent = !result1.error && !result2.error &&
        result1.normalized === result2.normalized;

    return {
        isEquivalent,
        normalized1: result1.normalized,
        normalized2: result2.normalized,
        error1: result1.error,
        error2: result2.error
    };
}

/**
 * Format SQL query with proper indentation (without normalization)
 * @param {string} sql - SQL query string
 * @param {string} database - Database dialect
 * @returns {Object} { formatted, error }
 */
export function formatSQL(sql, database = 'mysql') {
    const { ast, error } = parseSQL(sql, database);

    if (error) {
        return { formatted: null, error };
    }

    const formatted = astToSQL(ast, database);
    return { formatted, error: null };
}

export default {
    parseSQL,
    astToSQL,
    normalizeQuery,
    compareQueries,
    formatSQL
};
