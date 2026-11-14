export function safeCsvCell(value: unknown): string { const text = String(value ?? ''); const safe = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text; return '"' + safe.replace(/"/g, '""') + '"'; }
