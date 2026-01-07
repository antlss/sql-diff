/**
 * SQL Pretty Printer
 * Formats SQL output with proper line breaks and indentation
 */

const INDENT = '  ';

/**
 * Format SQL string with proper line breaks and indentation
 * @param {string} sql - Raw SQL string
 * @returns {string} Formatted SQL
 */
export function prettifySQL(sql) {
    if (!sql) return '';

    // Normalize whitespace first
    let formatted = sql.trim();

    // Keywords that should start on a new line (major clauses)
    const majorKeywords = [
        'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY',
        'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT'
    ];

    // Keywords for joins (should be on new line with indent)
    const joinKeywords = [
        'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
        'FULL JOIN', 'CROSS JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN',
        'FULL OUTER JOIN', 'JOIN'
    ];

    // Step 1: Normalize all whitespace to single spaces
    formatted = formatted.replace(/\s+/g, ' ');

    // Step 2: Add newlines before major keywords
    for (const keyword of majorKeywords) {
        const regex = new RegExp(`\\s+${keyword}\\b`, 'gi');
        formatted = formatted.replace(regex, `\n${keyword}`);
    }

    // Step 3: Handle JOINs (longer patterns first to avoid partial matches)
    const sortedJoins = joinKeywords.sort((a, b) => b.length - a.length);
    for (const keyword of sortedJoins) {
        const regex = new RegExp(`\\s+${keyword}\\b`, 'gi');
        formatted = formatted.replace(regex, `\n${INDENT}${keyword}`);
    }

    // Step 4: Handle AND/OR in WHERE clause (put on new line with indent)
    formatted = formatted.replace(/\s+AND\s+/gi, `\n${INDENT}AND `);
    formatted = formatted.replace(/\s+OR\s+/gi, `\n${INDENT}OR `);

    // Step 5: Handle commas in SELECT - each column on new line
    // Find the SELECT...FROM section and format columns
    formatted = formatSelectColumns(formatted);

    // Step 6: Clean up any double newlines
    formatted = formatted.replace(/\n\s*\n/g, '\n');

    // Step 7: Trim each line
    formatted = formatted
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((line, index) => {
            // Indent certain lines
            if (line.match(/^(AND|OR)\b/i)) {
                return INDENT + line;
            }
            if (line.match(/^(LEFT|RIGHT|INNER|OUTER|FULL|CROSS|JOIN)\b/i)) {
                return INDENT + line;
            }
            return line;
        })
        .join('\n');

    return formatted;
}

/**
 * Format SELECT columns to be one per line
 * @param {string} sql - SQL string
 * @returns {string} Formatted SQL with columns on separate lines
 */
function formatSelectColumns(sql) {
    // Match SELECT ... FROM section
    const selectMatch = sql.match(/^(SELECT\s+)(.*?)(\s+FROM\b)/is);

    if (!selectMatch) return sql;

    const [fullMatch, selectKeyword, columnsStr, fromKeyword] = selectMatch;

    // Split columns by comma, but be careful with functions that contain commas
    const columns = splitColumns(columnsStr);

    if (columns.length <= 1) {
        return sql;
    }

    // Format each column on its own line with indent
    const formattedColumns = columns
        .map((col, index) => {
            const trimmed = col.trim();
            if (index === 0) {
                return trimmed;
            }
            return INDENT + trimmed;
        })
        .join(',\n');

    return sql.replace(
        fullMatch,
        `${selectKeyword.trim()}\n${INDENT}${formattedColumns}\n${fromKeyword.trim()}`
    );
}

/**
 * Split columns by comma, respecting parentheses (for functions)
 * @param {string} str - Columns string
 * @returns {Array<string>} Array of column expressions
 */
function splitColumns(str) {
    const columns = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === '(') {
            depth++;
            current += char;
        } else if (char === ')') {
            depth--;
            current += char;
        } else if (char === ',' && depth === 0) {
            columns.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        columns.push(current.trim());
    }

    return columns;
}

/**
 * Format ON conditions in JOIN clauses
 * @param {string} sql - SQL string  
 * @returns {string} Formatted SQL
 */
function formatJoinConditions(sql) {
    // Split AND conditions within ON clauses to new lines
    return sql.replace(
        /(\bON\s+)([^\n]+?)(\s*(?:LEFT|RIGHT|INNER|JOIN|WHERE|ORDER|GROUP|HAVING|LIMIT|$))/gi,
        (match, onKeyword, conditions, nextPart) => {
            const formatted = conditions
                .split(/\s+AND\s+/i)
                .map((cond, i) => i === 0 ? cond : `${INDENT}${INDENT}AND ${cond}`)
                .join('\n');
            return `${onKeyword}${formatted}${nextPart}`;
        }
    );
}

export default { prettifySQL };
