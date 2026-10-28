'use strict';

const similarity = require('string-similarity');

// Baseline policy: preserve the existing 0.7 threshold and strict-search
// behavior. Catalog-number ranking will be evaluated against this baseline.
module.exports = function matchRelease(release, candidates, fuzzy = false) {
    const eligible = candidates.filter(candidate => candidate.type === 'release' &&
        !candidate.format.includes('Promo') && !candidate.format.includes('White Label'));
    if (!eligible.length) return {status: 'unmatched'};
    if (!fuzzy) return eligible.length === 1
        ? {status: 'matched', release: eligible[0]}
        : {status: 'review'};
    const search = `${release.artist} - ${release.title}`;
    const ratings = eligible.map(candidate => ({
        release: candidate, score: similarity.compareTwoStrings(search, candidate.title)
    })).sort((a, b) => b.score - a.score);
    const best = ratings[0];
    if (best.score <= 0.7) return {status: 'unmatched'};
    if (ratings.length > 1 && ratings[1].score === best.score) return {status: 'review'};
    return {status: 'matched', release: best.release};
};
