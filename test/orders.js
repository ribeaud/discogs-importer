'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parseOrders = require('../helpers/orders');

describe('Order CSV import', () => {
    it('decodes entities without turning them into CSV delimiters or quotes', () => {
        const result = parseOrders('\uFEFF<pre>ID;Artist;Title;Format;Label No\n' +
            '42;Maxxi &amp; Zeus;A&#59; B &quot;Mix&quot;;Vinyl;CAT01\n' +
            '43;Shop;Sleeve;Sonstiges;X\n' +
            '44;Broken;Row;Vinyl;X;extra\n</pre>');
        assert.deepStrictEqual(result.records, [{ID: '42', Artist: 'Maxxi & Zeus',
            Title: 'A; B "Mix"', Format: 'Vinyl', 'Label No': 'CAT01'}]);
        assert.deepStrictEqual(result.issues, [
            {row: 3, reason: 'Non-vinyl row skipped'}, {row: 4, reason: 'Column count mismatch'}
        ]);
    });
    it('supports quoted multiline titles and header-only exports', () => {
        assert.strictEqual(parseOrders('Artist;Title;Format\nA;"One\nTwo";Vinyl').records[0].Title, 'One\nTwo');
        assert.deepStrictEqual(parseOrders('Artist;Title;Format\n').records, []);
        assert.throws(() => parseOrders('Artist;Title\n'), /Missing CSV column: Format/);
    });
    it('preserves a known purchase in the legacy export and parses the consolidated export', () => {
        const read = name => parseOrders(fs.readFileSync(path.join(__dirname, 'resources', name), 'utf8'));
        const legacy = read('deejay.0002.csv');
        assert.strictEqual(legacy.records.length, 6);
        assert.deepStrictEqual(legacy.issues, []);
        const item = legacy.records.find(row => row.ID === '54091');
        assert.strictEqual(item.Artist, 'Maxxi & Zeus');
        assert.strictEqual(item['Label No'], 'IFEEL010');
        const consolidated = read('all.csv');
        assert.strictEqual(consolidated.records.length, 387);
        assert.strictEqual(consolidated.records.find(row => row.ID === '304546')['Label No'], 'F&R004');
    });
});
