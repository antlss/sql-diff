
import pkg from 'node-sql-parser';
const { Parser } = pkg;

function normalizeTableName(name) {
    if (!name) return '';
    return name.replace(/^["'`]|["'`]$/g, '').toLowerCase();
}

const parser = new Parser();
const opt = { database: 'mysql' };

const sql1 = `
SELECT "name", "employee_id"
FROM "employees"
ORDER BY "employee_id" ASC
`;

const sql2 = `
SELECT e.name AS name
FROM employees e
ORDER BY e.employee_id ASC
`;

function getAst(sql) {
    const result = parser.astify(sql, opt);
    return Array.isArray(result) ? result[0] : result;
}

console.log("--- Debugging AST ---");

try {
    const ast1 = getAst(sql1);
    console.log("AST 1 FROM:", JSON.stringify(ast1.from, null, 2));
    console.log("AST 1 Columns:", JSON.stringify(ast1.columns, null, 2));
    console.log("AST 1 OrderBy:", JSON.stringify(ast1.orderby, null, 2));

    const fromTable = ast1.from[0].table;
    console.log("\nTable Name Raw:", fromTable);
    const normalizedTable = normalizeTableName(fromTable);
    console.log("Table Name Normalized:", normalizedTable);

    console.log("\n--- Comparison target ---");
    const ast2 = getAst(sql2);
    console.log("AST 2 Columns:", JSON.stringify(ast2.columns, null, 2));

} catch (e) {
    console.error("Error:", e);
}
