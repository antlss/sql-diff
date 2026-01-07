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

function resolveExpressionAliasesInPlace(expr, aliasMap, implicitTable = null) {
  if (!expr) return expr;

  // Handle column reference: { type: 'column_ref', table: 'alias', column: 'name' }
  if (expr.type === 'column_ref') {
    // Case 1: Has table prefix -> resolve alias
    if (expr.table) {
      const tableLower = normalizeTableName(expr.table);
      if (aliasMap.has(tableLower)) {
        expr.table = aliasMap.get(tableLower);
      }
    }
    // Case 2: No table prefix but implicit table available -> inject it
    else if (implicitTable) {
      expr.table = implicitTable;
    }
  }

  // Handle binary expressions (AND, OR, =, <, >, etc.)
  if (expr.left) {
    resolveExpressionAliasesInPlace(expr.left, aliasMap, implicitTable);
  }
  if (expr.right) {
    resolveExpressionAliasesInPlace(expr.right, aliasMap, implicitTable);
  }

  // Handle function arguments
  if (expr.args) {
    if (Array.isArray(expr.args)) {
      for (const arg of expr.args) {
        resolveExpressionAliasesInPlace(arg, aliasMap, implicitTable);
      }
    } else if (expr.args.value) {
      if (Array.isArray(expr.args.value)) {
        for (const arg of expr.args.value) {
          resolveExpressionAliasesInPlace(arg, aliasMap, implicitTable);
        }
      }
    }
    // Handle CASE expression nested in args
    if (expr.args.expr) {
      resolveExpressionAliasesInPlace(expr.args.expr, aliasMap, implicitTable);
    }
  }

  // Handle CASE expressions
  if (expr.type === 'case') {
    // Process WHEN clauses
    if (expr.args) {
      for (const arg of expr.args) {
        if (arg.cond) {
          resolveExpressionAliasesInPlace(arg.cond, aliasMap, implicitTable);
        }
        if (arg.result) {
          resolveExpressionAliasesInPlace(arg.result, aliasMap, implicitTable);
        }
      }
    }
  }

  // Handle IN expressions with subqueries or lists
  if (expr.value && Array.isArray(expr.value)) {
    for (const val of expr.value) {
      resolveExpressionAliasesInPlace(val, aliasMap, implicitTable);
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

  // Single Table Inference:
  // If there is exactly one table in FROM, we can assume implicit aliasing
  let implicitTable = null;
  if (ast.from && ast.from.length === 1 && ast.from[0].table) {
    implicitTable = normalizeTableName(ast.from[0].table);
  }

  // Helper to inject implicit table if explicit table is missing (null)
  const injectImplicitAlias = (expr) => {
    if (!implicitTable) return;
    if (expr.type === 'column_ref' && !expr.table) {
      expr.table = implicitTable;
    }
    // Recursive check for other parts like function args handled by resolveExpressionAliasesInPlace
    // But resolveExpressionAliasesInPlace expects aliasMap mostly.
    // We should modify aliasMap to handle empty table keys? No, better to pre-process or inject here.
  };

  // Actually, we can just intercept column_ref within resolveExpressionAliasesInPlace
  // or explicit injection here. 
  // Let's modify resolveExpressionAliasesInPlace to accept implicitTable context
  // BUT modifying the signature might break other calls.
  // Instead, let's pre-populate the aliasMap with a special key or handle it in the traversals below.

  // Better approach: When we build the aliasMap, we only map aliases.
  // Here, if we have implicitTable, we can try to resolve null tables to it.

  // Let's augment resolveExpressionAliasesInPlace to handle implicit table injection
  const resolveWithImplicit = (expr) => {
    if (!expr) return;

    // Direct column ref check
    if (expr.type === 'column_ref' && !expr.table && implicitTable) {
      expr.table = implicitTable;
    }

    // Use existing recursion but we need to ensure it hits our injection logic
    // The existing resolveExpressionAliasesInPlace only resolves IF table is present and in map
    // We need to inject table first

    // Let's do a custom traversal or modify resolveExpressionAliasesInPlace?
    // Modifying resolveExpressionAliasesInPlace is cleaner if possible, but it's used elsewhere.
    // Let's update `resolveExpressionAliasesInPlace` to take an optional `implicitTable` arg.
    resolveExpressionAliasesInPlace(expr, aliasMap, implicitTable);
  };

  // Resolve SELECT columns
  if (ast.columns) {
    if (ast.columns !== '*') {
      for (const col of ast.columns) {
        if (col.expr) {
          resolveWithImplicit(col.expr);
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
        resolveWithImplicit(table.on);
      }
    }
  }

  // Resolve WHERE clause
  if (ast.where) {
    resolveWithImplicit(ast.where);
  }

  // Resolve GROUP BY
  if (ast.groupby) {
    for (const group of ast.groupby) {
      resolveWithImplicit(group);
    }
  }

  // Resolve HAVING
  if (ast.having) {
    resolveWithImplicit(ast.having);
  }

  // Resolve ORDER BY
  if (ast.orderby) {
    for (const order of ast.orderby) {
      resolveWithImplicit(order.expr);
    }
  }
}

export default {
  buildAliasMap,
  resolveExpressionAliases,
  resolveAstAliases
};
