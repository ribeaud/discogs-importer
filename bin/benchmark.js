'use strict';

const matchRelease = require('../helpers/matcher');
const cases = require('../test/resources/matcher-cases');
let correct = 0, accepted = 0, correctAccepted = 0, review = 0, unmatched = 0;
console.log('Offline synthetic matcher benchmark (not real-world accuracy)');
for (const test of cases) {
    const result = matchRelease(test.input, test.candidates, test.fuzzy);
    const actual = result.status === 'matched' ? result.release.id : result.status;
    if (actual === test.expected) correct++;
    if (result.status === 'matched') {
        accepted++;
        if (actual === test.expected) correctAccepted++;
    }
    if (result.status === 'review') review++;
    if (result.status === 'unmatched') unmatched++;
    console.log(`${actual === test.expected ? 'OK' : 'MISS'} ${test.name}: expected=${test.expected}, actual=${actual}`);
}
console.log(`Correct decisions: ${correct}/${cases.length}`);
console.log(`Correct automatic matches: ${correctAccepted}/${accepted}`);
console.log(`Automatic coverage: ${accepted}/${cases.length}; review: ${review}; unmatched: ${unmatched}`);
console.log('Candidate selection only; no API requests. Known gaps remain visible, not treated as successful matches.');

const fs = require('fs');
const path = require('path');
const parseOrders = require('../helpers/orders');
const directory = path.join(__dirname, '../test/resources');
const files = fs.readdirSync(directory).filter(file => /^deejay\..*\.csv$/.test(file));
let vinyl = 0, skipped = 0, rejected = 0;
for (const file of files) {
    const result = parseOrders(fs.readFileSync(path.join(directory, file), 'utf8'));
    vinyl += result.records.length;
    skipped += result.issues.filter(issue => issue.reason === 'Non-vinyl row skipped').length;
    rejected += result.issues.filter(issue => issue.reason !== 'Non-vinyl row skipped').length;
}
console.log(`Archived input coverage: ${files.length} files; ${vinyl} vinyl rows; ${skipped} non-vinyl skipped; ${rejected} malformed rows`);
console.log('Archived rows have no verified release IDs; they measure parsing coverage only. all.csv is excluded to avoid overlap.');
