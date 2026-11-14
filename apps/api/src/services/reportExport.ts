export function csvCell(value:unknown):string{const s=String(value??'');const safe=/^[\s]*[=+@\-]/.test(s)?`'${s}`:s;return `"${safe.replace(/"/g,'""')}"`;}
export function toCsv(rows:Record<string,unknown>[],columns:string[]){if(!columns.length)throw new Error('CSV columns required');return [columns.map(csvCell).join(','),...rows.map(r=>columns.map(c=>csvCell(r[c])).join(','))].join('\r\n');}
