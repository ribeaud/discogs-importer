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
    it('matches retailer spellings of real purchases when the catalog agrees', () => {
        for (const [artist, title, catno, candidate, candidateCatno = catno, format = ['Vinyl']] of [
            ['Lizards', 'Separate Ways Ep (inc. Lord Of The Isles Remix)', 'FBR049', 'Lizards (3) - Separate Ways EP'],
            ['Jamie 3:26 & Masalo & Sameed', 'Testify', 'LT074', 'Jamie 3:26 & Masalo / Sameed - Testify / Can\'t U'],
            ['Makadem', 'Nyako (africane 808 / Modified Man / Daisho Remixes)', 'OTCR12005', 'Makadem & Behr (2) -  Nyako'],
            ['Various Artists', 'In The Dark Again 07', 'DARK007', 'Various - In The Dark Again 07', 'Dark 007'],
            ['Various', 'West End Edits: Medlar (2x12)', 'WEBMG02LP', 'Medlar - West End Edits'],
            ['Gerait', 'Room 110', 'SM-004', 'Gerait - Room 110', 'SM-004 EP', ['Vinyl', 'White Label']],
            ['Various', 'Fuifnummers', 'OYEEDIT011', 'Various - Fuifnummers (Edits 11)', undefined, ['Vinyl', 'Promo']],
            ['Bananarama', 'Remixed: Vol 1', 'LMS5521271', 'Bananarama - Bananarama Remixed: Vol 1'],
            ['Crooked Finger', 'Soaked Through EP w/ Hodge Remix', 'SZE008', 'Crooked Finger - Soaked Through EP', 'SZE 008'],
            ['Tendts', 'Cosmic Swimmer', 'PR19', 'Tendts - Κοσμικός Κολυμβητής – Cosmic Swimmer']
        ]) {
            const result = matchRelease({artist, title, format: 'Vinyl', catno},
                [pressing(7, {title: candidate, catno: candidateCatno, format})]);
            assert.strictEqual(result.status === 'matched' && result.release.id, 7, `${artist} - ${title}`);
        }
    });
    it('keeps the relaxed comparisons tied to real title, artist and catalog evidence', () => {
        for (const title of ['Example Artist - Nightfall', 'Various - Unrelated Album']) {
            assert.strictEqual(matchRelease({...purchase, artist: 'Various Artists'}, [pressing(1, {title})]).status,
                'unmatched', title);
        }
        assert.strictEqual(matchRelease(purchase, [pressing(1, {catno: 'EX-001 A EP'})]).release.id, 1);
        assert.strictEqual(matchRelease(purchase, [pressing(1, {catno: 'EX-001 AB'})]).status, 'review');
        const whiteLabel = pressing(2, {format: ['Vinyl', 'White Label']});
        assert.strictEqual(matchRelease(purchase, [whiteLabel, pressing(1)]).release.id, 1);
        const testPressing = pressing(3, {format: ['Vinyl', 'Test Pressing']});
        assert.strictEqual(matchRelease(purchase, [testPressing, pressing(1)]).release.id, 1);
        assert.strictEqual(matchRelease(purchase, [testPressing]).status, 'unmatched');
        const promo = pressing(4, {format: ['Vinyl', 'Promo']});
        assert.strictEqual(matchRelease(purchase, [promo]).release.id, 4);
        assert.strictEqual(matchRelease(purchase, [promo, pressing(1)]).release.id, 1);
        assert.strictEqual(matchRelease(purchase, [promo, pressing(5, {format: ['Vinyl', 'Promo']})]).status, 'review');
        assert.strictEqual(matchRelease({...purchase, catno: ''}, [whiteLabel]).status, 'unmatched');
    });
    it('reviews sibling pressings whose titles Discogs spells differently', () => {
        const source = {artist: 'Various', title: 'Ttj#1305 (todd Terje Edits)', format: 'Vinyl', catno: 'TTJ1305'};
        const original = pressing(1, {title: 'Various - TTJ Edits #1305', catno: 'TTJ 1305'});
        const repress = pressing(2, {title: 'Various - TTJ1305', catno: 'TTJ 1305'});
        assert.strictEqual(matchRelease(source, [original, repress]).status, 'review');
        // Unrelated compilations sharing a common catalog are not siblings.
        const lostProperty = {artist: 'Anonymous', title: 'Lost Property Volume 2', format: 'Vinyl', catno: 'LP02'};
        assert.strictEqual(matchRelease(lostProperty, [
            pressing(3, {title: 'Various - Lost Property Volume 2', catno: 'LP02'}),
            pressing(4, {title: 'Various - Big Lizard Stomp!: Volume Two', catno: 'LP02'})
        ]).release.id, 3);
    });
    it('keeps the text fallback for purchases without a usable catalog', () => {
        for (const catno of [undefined, '', '  ', 'none', 'N/A']) {
            assert.strictEqual(matchRelease({...purchase, catno}, [pressing(1)]).release.id, 1);
        }
    });
});
