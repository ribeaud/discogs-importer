'use strict';

const assert = require('assert');
const matchRelease = require('../helpers/matcher');
const cases = require('./resources/matcher-cases');

describe('Matcher contract', () => {
    for (const test of cases.filter(test => !test.knownGap)) {
        it(test.name, () => {
            for (const candidates of [test.candidates, [...test.candidates].reverse()]) {
                const result = matchRelease(test.input, candidates, test.fuzzy);
                assert.strictEqual(result.status === 'matched' ? result.release.id : result.status, test.expected);
            }
        });
    }
});
