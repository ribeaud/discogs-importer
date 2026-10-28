'use strict';

const {parse} = require('csv-parse/sync');
const {decode} = require('he');

// Protect entity semicolons before CSV tokenization. Decode fields afterwards,
// so encoded quotes and delimiters cannot become CSV syntax.
module.exports = function parseOrders(text, delimiter = ';') {
    const entities = [];
    const protectedText = text.replace(/^\uFEFF/, '').replace(/^\s*<pre>/i, '')
        .replace(/<\/pre>\s*$/i, '').replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, entity => {
            if (decode(entity) === entity) return entity;
            entities.push(entity);
            return `\u0000${entities.length - 1}\u0000`;
        });
    const rows = parse(protectedText, {
        delimiter, relax_quotes: true, relax_column_count: true, trim: true, skip_empty_lines: true
    });
    const restore = value => decode(value.replace(/\u0000(\d+)\u0000/g, (_, i) => entities[i]));
    const headers = (rows.shift() || []).map(restore);
    for (const required of ['Artist', 'Title', 'Format']) {
        if (!headers.includes(required)) throw new Error(`Missing CSV column: ${required}`);
    }
    const records = [], issues = [];
    rows.forEach((values, index) => {
        const row = index + 2;
        if (values.length !== headers.length) {
            issues.push({row, reason: 'Column count mismatch'});
            return;
        }
        const record = Object.fromEntries(headers.map((header, i) => [header, restore(values[i])]));
        if (record.Format !== 'Vinyl') {
            issues.push({row, reason: 'Non-vinyl row skipped'});
        } else if (!record.Artist || !record.Title) {
            issues.push({row, reason: 'Missing artist or title'});
        } else {
            records.push(record);
        }
    });
    return {records, issues};
};
