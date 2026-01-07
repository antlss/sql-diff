/**
 * SQL Alias Resolver
 * Handles extracting aliases and replacing them with full table names
 */

/**
 * Normalize table name - remove quotes and convert to lowercase for comparison
 * @param {string} name - Table name
 * @returns {string} Normalized table name
 */
function normalizeTableName(name) {
  if (!name) return '';
  // Remove surrounding quotes (", ', `)
  return name.replace(/^["'`]|["'`]$/g, '').toLowerCase();
}

/**
 * Build a map of alias -> table name from AST
 * @param {Object} ast - Parsed SQL AST
 * @returns {Map<string, string>} alias to table name mapping
 */
export function buildAliasMap(ast) {
  const aliasMap = new Map();

  if (!ast) return aliasMap;

  // Process FROM clause (includes JOINs)
  if (ast.from) {
    for (const table of ast.from) {
      const tableName = normalizeTableName(table.table);

      if (table.table && table.as) {
        // Table with alias
        aliasMap.set(table.as.toLowerCase(), tableName);
        aliasMap.set(tableName, tableName); // Map table to itself too
      } else if (table.table) {
        // Table without alias - map table name to itself
        aliasMap.set(tableName, tableName);
      }
    }
  }

  return aliasMap;
}

/**
 * Recursively resolve aliases in column references
 * @param {Object} expr - Expression AST node
 * @param {Map<string, string>} aliasMap - Alias mapping
 * @returns {Object} Expression with resolved aliases
 */
export function resolveExpressionAliases(expr, aliasMap) {
  if (!expr) return expr;

  // Deep clone to avoid mutation
  const result = JSON.parse(JSON.stringify(expr));

  return resolveExpressionAliasesInPlace(result, aliasMap);
}

function resolveExpressionAliasesInPlace(expr, aliasMap) {
  if (!expr) return expr;

  // Handle column reference: { type: 'column_ref', table: 'alias', column: 'name' }
  if (expr.type === 'column_ref' && expr.table) {
    const tableLower = normalizeTableName(expr.table);
    if (aliasMap.has(tableLower)) {
      expr.table = aliasMap.get(tableLower);
    }
  }

  // Handle binary expressions (AND, OR, =, <, >, etc.)
  if (expr.left) {
    resolveExpressionAliasesInPlace(expr.left, aliasMap);
  }
  if (expr.right) {
    resolveExpressionAliasesInPlace(expr.right, aliasMap);
  }

  // Handle function arguments
  if (expr.args) {
    if (Array.isArray(expr.args)) {
      for (const arg of expr.args) {
        resolveExpressionAliasesInPlace(arg, aliasMap);
      }
    } else if (expr.args.value) {
      if (Array.isArray(expr.args.value)) {
        for (const arg of expr.args.value) {
          resolveExpressionAliasesInPlace(arg, aliasMap);
        }
      }
    }
    // Handle CASE expression nested in args
    if (expr.args.expr) {
      resolveExpressionAliasesInPlace(expr.args.expr, aliasMap);
    }
  }

  // Handle CASE expressions
  if (expr.type === 'case') {
    // Process WHEN clauses
    if (expr.args) {
      for (const arg of expr.args) {
        if (arg.cond) {
          resolveExpressionAliasesInPlace(arg.cond, aliasMap);
        }
        if (arg.result) {
          resolveExpressionAliasesInPlace(arg.result, aliasMap);
        }
      }
    }
  }

  // Handle IN expressions with subqueries or lists
  if (expr.value && Array.isArray(expr.value)) {
    for (const val of expr.value) {
      resolveExpressionAliasesInPlace(val, aliasMap);
    }
  }

  // Handle subqueries
  if (expr.ast) {
    resolveAstAliases(expr.ast, buildAliasMap(expr.ast));
  }

  return expr;
}

/**
 * Normalize table reference in FROM clause
 * @param {Object} table - Table entry from FROM clause
 */
function normalizeTableEntry(table) {
  if (table.table) {
    // Remove quotes from table name
    table.table = normalizeTableName(table.table);
  }
  // Remove alias
  if (table.as) {
    delete table.as;
  }
}

/**
 * Resolve all aliases in the AST
 * @param {Object} ast - SQL AST
 * @param {Map<string, string>} aliasMap - Alias mapping
 */
export function resolveAstAliases(ast, aliasMap) {
  if (!ast) return;

  // Resolve SELECT columns
  if (ast.columns) {
    if (ast.columns !== '*') {
      for (const col of ast.columns) {
        if (col.expr) {
          resolveExpressionAliasesInPlace(col.expr, aliasMap);
        }
      }
    }
  }

  // Normalize and resolve FROM clause
  if (ast.from) {
    for (const table of ast.from) {
      // Normalize table entry (remove quotes and alias)
      normalizeTableEntry(table);

      // Handle ON conditions in JOINs
      if (table.on) {
        resolveExpressionAliasesInPlace(table.on, aliasMap);
      }
    }
  }

  // Resolve WHERE clause
  if (ast.where) {
    resolveExpressionAliasesInPlace(ast.where, aliasMap);
  }

  // Resolve GROUP BY
  if (ast.groupby) {
    for (const group of ast.groupby) {
      resolveExpressionAliasesInPlace(group, aliasMap);
    }
  }

  // Resolve HAVING
  if (ast.having) {
    resolveExpressionAliasesInPlace(ast.having, aliasMap);
  }

  // Resolve ORDER BY
  if (ast.orderby) {
    for (const order of ast.orderby) {
      resolveExpressionAliasesInPlace(order.expr, aliasMap);
    }
  }
}

export default {
  buildAliasMap,
  resolveExpressionAliases,
  resolveAstAliases
};
