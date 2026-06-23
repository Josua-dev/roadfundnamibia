/**
 * Builds a `col1 = $1, col2 = $2, ...` clause plus the matching
 * parameter array, for dynamic UPDATE statements.
 *
 * Replaces mysql2's `UPDATE table SET ? WHERE id = ?` object shorthand,
 * which has no equivalent in node-postgres / plain SQL.
 *
 * @param {Object} updates - column: value pairs to set
 * @returns {{ clause: string, values: any[] }}
 */
function buildSetClause(updates) {
  const columns = Object.keys(updates);
  const clause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const values = columns.map((col) => updates[col]);
  return { clause, values };
}

module.exports = { buildSetClause };
