'use strict';

const similarity = require('./similarity');

function normalizeCatalog(value = '') {
    const normalized = value.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
    return ['NONE', 'NA', 'UNKNOWN'].includes(normalized) ? '' : normalized;
}

const normalizeText = value => value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

// This relaxed title is only evidence of a competing pressing, never sufficient
// evidence to select a release automatically.
const withoutEdition = title => title.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (annotation, round, square) =>
    /^(?:\d{4}\s+)?(?:remaster(?:ed)?|reissue|repress)(?:\s+\d{4})?(?:\s+edition)?$/.test((round || square || '').trim())
        ? '' : annotation).replace(/\s+/g, ' ').trim();

module.exports = function matchRelease(release, candidates, fuzzy = false) {
    const eligible = [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()]
        .filter(candidate => candidate.type === 'release' &&
        (!release.format || candidate.format.includes(release.format)) &&
        !candidate.format.includes('Promo') && !candidate.format.includes('White Label'));
    if (!eligible.length) return {status: 'unmatched'};
    const catalog = normalizeCatalog(release.catno);
    if (catalog) {
        // Catalog numbers can be shared by unrelated records and by multiple
        // pressings. Validate artist and title independently, not as one string.
        const sourceArtist = normalizeText(release.artist);
        const sourceTitle = normalizeText(release.title);
        const compatible = new Set();
        const plausible = eligible.filter(candidate => {
            let editionVariant = false;
            for (let separator = candidate.title.indexOf(' - '); separator >= 0;
                separator = candidate.title.indexOf(' - ', separator + 3)) {
                const artist = normalizeText(candidate.title.slice(0, separator));
                const title = normalizeText(candidate.title.slice(separator + 3));
                if (similarity.compareTwoStrings(sourceArtist, artist) <= 0.7) continue;
                if (similarity.compareTwoStrings(sourceTitle, title) > 0.7) {
                    compatible.add(candidate.id);
                    return true;
                }
                if (similarity.compareTwoStrings(withoutEdition(sourceTitle), withoutEdition(title)) > 0.7) {
                    editionVariant = true;
                }
            }
            return editionVariant;
        });
        if (!plausible.length) return {status: 'unmatched'};
        const matching = plausible.filter(candidate => normalizeCatalog(candidate.catno) === catalog);
        // Missing catalog data cannot rule out a competing pressing either.
        if (matching.length !== 1 || !compatible.has(matching[0].id) ||
            plausible.some(candidate => !normalizeCatalog(candidate.catno))) {
            return {status: 'review'};
        }
        return {status: 'matched', release: matching[0]};
    }
    // Without a usable source catalog, retain the phase-one text policy.
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

module.exports.normalizeCatalog = normalizeCatalog;
