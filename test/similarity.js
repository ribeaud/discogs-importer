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

    const purchase = {artist: 'Example Artist', title: 'Night', format: 'Vinyl', catno: 'EX-001 A'};
    const pressing = (id, extra = {}) => ({id, title: 'Example Artist - Night',
        type: 'release', format: ['Vinyl'], catno: 'ex001a', ...extra});

    it('normalizes catalog separators and case while preserving suffixes and leading zeros', () => {
        for (const fuzzy of [false, true]) {
            const result = matchRelease(purchase, [pressing(1, {catno: 'EX001B'}),
                pressing(2, {catno: 'EX1A'}), pressing(3)], fuzzy);
            assert.strictEqual(result.release.id, 3);
            assert.strictEqual(matchRelease(purchase, [pressing(1, {catno: 'EX001B'})], fuzzy).status, 'review');
        }
    });
    it('requires compatible artist and title separately even for matching catalogs', () => {
        for (const title of ['Unrelated Performer - Night', 'Example Artist - Unrelated Album']) {
            assert.strictEqual(matchRelease(purchase, [pressing(1, {title})]).status, 'unmatched');
        }
        assert.strictEqual(matchRelease(purchase, [pressing(1, {title: 'EXAMPLE ARTIST - NIGHT'})]).release.id, 1);
        assert.strictEqual(matchRelease(purchase, [pressing(1, {format: ['CD']})]).status, 'unmatched');
    });
    it('does not rank plausible pressings sharing a catalog by title score', () => {
        const candidates = [pressing(1), pressing(2, {title: 'Example Artist - Night EP'})];
        for (const fuzzy of [false, true]) {
            assert.strictEqual(matchRelease(purchase, candidates, fuzzy).status, 'review');
            assert.strictEqual(matchRelease(purchase, [...candidates].reverse(), fuzzy).status, 'review');
        }
    });
    it('retains edition variants as competing pressings without using stripped titles to auto-match', () => {
        for (const edition of ['(Remastered)', '[2020 Reissue]', '(Repress)']) {
            const variant = pressing(2, {title: `Example Artist - Night ${edition}`});
            for (const fuzzy of [false, true]) {
                for (const candidates of [[pressing(1), variant], [variant, pressing(1)], [variant]]) {
                    assert.strictEqual(matchRelease(purchase, candidates, fuzzy).status, 'review');
                }
                assert.strictEqual(matchRelease({...purchase, title: `Night ${edition}`}, [pressing(1)], fuzzy).status, 'review');
            }
        }
        assert.strictEqual(matchRelease(purchase, [pressing(2, {
            title: 'Example Artist - Unrelated Album (Remastered)'
        })]).status, 'unmatched');
    });
    it('finds the artist/title boundary when either field contains delimiters', () => {
        for (const [artist, title] of [
            ['Artist A - Artist B', 'Night'],
            ['Example Artist', 'Night - Day'],
            ['Artist A - Artist B', 'Night - Day']
        ]) {
            const source = {...purchase, artist, title};
            for (const fuzzy of [false, true]) {
                const result = matchRelease(source, [pressing(3, {title: `${artist} - ${title}`})], fuzzy);
                assert.strictEqual(result.release.id, 3);
                assert.strictEqual(matchRelease(source, [pressing(4, {
                    title: `${artist} - Unrelated Album`
                })], fuzzy).status, 'unmatched');
            }
        }
    });
    it('requires review when candidate catalogs are absent or unspecified', () => {
        for (const catno of [undefined, '', 'none', 'N/A']) {
            const unknown = pressing(1, {catno});
            assert.strictEqual(matchRelease(purchase, [unknown]).status, 'review');
            assert.strictEqual(matchRelease(purchase, [unknown, pressing(2)]).status, 'review');
        }
    });
    it('keeps the text fallback for purchases without a usable catalog', () => {
        for (const catno of [undefined, '', '  ', 'none', 'N/A']) {
            assert.strictEqual(matchRelease({...purchase, catno}, [pressing(1)]).release.id, 1);
        }
    });
});
