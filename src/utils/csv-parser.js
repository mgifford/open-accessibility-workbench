/**
 * Lightweight, robust RFC 4180-compliant CSV parser with zero external dependencies.
 * Handles embedded newlines, escaped quotes (""), and trailing whitespace.
 */

/**
 * Parses a CSV string into an array of object records.
 * @param {string} csvText
 * @param {object} [options]
 * @param {boolean} [options.trim=true]
 * @returns {Array<Record<string, string>>}
 */
export function parseCSV(csvText, options = { trim: true }) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(options.trim ? currentField.trim() : currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(options.trim ? currentField.trim() : currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(options.trim ? currentField.trim() : currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(options.trim ? currentField.trim() : currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  // Filter out any purely empty trailing rows
  const cleanRows = rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
  if (cleanRows.length === 0) {
    return [];
  }

  const headers = cleanRows[0];
  const records = [];

  for (let r = 1; r < cleanRows.length; r++) {
    const row = cleanRows[r];
    const record = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      record[header] = row[c] !== undefined ? row[c] : '';
    }
    records.push(record);
  }

  return records;
}
