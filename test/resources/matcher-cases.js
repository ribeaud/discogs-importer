'use strict';

// Synthetic release IDs and candidate sets, NOT verified Discogs ground truth.
// Titles in the two retailer examples come from archived purchases.
const input = {artist: 'Example Artist', title: 'Night', format: 'Vinyl', catno: 'EX001'};
const candidate = (id, title = 'Example Artist - Night', extra = {}) =>
    ({id, title, type: 'release', format: ['Vinyl'], catno: 'EX001', ...extra});
module.exports = [
    {name: 'single strict candidate', input, candidates: [candidate(1)], expected: 1},
    {name: 'no candidates', input, candidates: [], expected: 'unmatched'},
    {name: 'strict pressing ambiguity', input, candidates: [candidate(1), candidate(2)], expected: 'review'},
    {name: 'identical fuzzy titles', input, fuzzy: true, candidates: [candidate(1), candidate(2)], expected: 'review'},
    {name: 'equal scores with different titles', input, fuzzy: true,
        candidates: [candidate(1, 'Example Artist - Night X'), candidate(2, 'Example Artist - Night Y')], expected: 'review'},
    {name: 'unique fuzzy winner', input, fuzzy: true,
        candidates: [candidate(2, 'Unrelated - Album'), candidate(1)], expected: 1},
    {name: 'below fuzzy threshold', input, fuzzy: true,
        candidates: [candidate(2, 'Unrelated - Album')], expected: 'unmatched'},
    {name: 'excluded formats in fallback', input, fuzzy: true,
        candidates: [candidate(1, undefined, {format: ['Vinyl', 'Promo']}),
            candidate(2, undefined, {format: ['Vinyl', 'White Label']})], expected: 'unmatched'},
    {name: 'master is not a pressing', input, candidates: [candidate(1, undefined, {type: 'master'})], expected: 'unmatched'},
    {name: 'catalog number could disambiguate', input,
        candidates: [candidate(2, undefined, {catno: 'OTHER02'}), candidate(1)], expected: 1},
    {name: 'single candidate with conflicting catalog', input,
        candidates: [candidate(2, undefined, {catno: 'OTHER02'})], expected: 'review'},
    {name: 'retailer abbreviated title', input: {artist: 'Andy Ash / Runaway', title: 'Otp Party Breaks 3'}, fuzzy: true,
        candidates: [candidate(3, 'Andy Ash / Runaway - On The Prowl Presents: OTP Party Breaks # 3')], expected: 3, knownGap: true},
    {name: 'Discogs artist suffix', input: {artist: 'Maxxi & Zeus', title: 'American Dreamer/ Mz Medley'}, fuzzy: true,
        candidates: [candidate(4, 'Maxxi* & Zeus (11) - American Dreamer')], expected: 4}
];
