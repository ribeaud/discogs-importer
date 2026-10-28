'use strict';

const similarity = require('./similarity');

function normalizeCatalog(value = '') {
    const normalized = value.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
    return ['NONE', 'NA', 'UNKNOWN'].includes(normalized) ? '' : normalized;
}

// Catalogs equal after dropping a trailing format word, as in Discogs' "SM-004 EP"
// or the retailer's "ALG046 10\"". Letter and digit suffixes still distinguish.
const sameCatalog = (a, b) => {
    const variants = value => new Set([value, value.replace(/\s+(?:ep|lp|cd|\d+")$/i, '')].map(normalizeCatalog));
    const left = variants(a || '');
    return [...variants(b || '')].some(value => value && left.has(value));
};

// Fold accents and ligatures too, so "Œil" equals "Oeil".
const normalizeText = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss').trim().replace(/\s+/g, ' ');

const isEdition = annotation =>
    /^(?:\d{4}\s+)?(?:remaster(?:ed)?|reissue|repress)(?:\s+\d{4})?(?:\s+edition)?$/.test(annotation.trim());

// This relaxed title is only evidence of a competing pressing, never sufficient
// evidence to select a release automatically.
const withoutEdition = title => title.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (annotation, round, square) =>
    isEdition(round || square || '') ? '' : annotation).replace(/\s+/g, ' ').trim();

// Retailer and Discogs annotate titles differently: "Separate Ways Ep (inc. X Remix)"
// is "Separate Ways EP". Drop annotations and trailing format words, but keep
// edition annotations, which identify a different pressing.
const cleanTitle = title => {
    let cleaned = title.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (annotation, round, square) =>
        isEdition(round || square || '') ? annotation : ' ').replace(/\s+(?:w\/|feat\.?|ft\.)\s.*$/, '')
        .replace(/\s+/g, ' ').trim();
    for (let previous; previous !== cleaned;) {
        previous = cleaned;
        cleaned = cleaned.replace(/[\s,;:/-]+(?:ep|lp|\d+\s?lp|\d+x\d+"?|\d+")$/, '').trim();
    }
    return cleaned;
};

// Discogs numbers artists sharing a name, "Lizards (3)", and marks name variations
// with "*". Compilations are "Various" on Discogs but "Various Artists", "VA (...)"
// or "Anonymous" at the retailer; these match any artist.
const cleanArtist = artist => artist.replace(/\([^()]*\)|\*/g, ' ').replace(/\s+/g, ' ').trim();
const isGeneric = artist => ['various', 'various artists', 'va', 'v a', 'anonymous', 'unknown artist']
    .includes(cleanArtist(artist).replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim());

const artistCompatible = (source, candidate) => isGeneric(source) || isGeneric(candidate) ||
    similarity.compareTwoStrings(source, candidate) > 0.7 ||
    similarity.compareTwoStrings(cleanArtist(source), cleanArtist(candidate)) > 0.7;

// A title also matches when it is a whole part of the other: "Testify" in
// "Testify / Can't U", "West End Edits" in "West End Edits: Medlar", "Cosmic Swimmer"
// in "Κοσμικός Κολυμβητής – Cosmic Swimmer".
const partOf = (short, long) => short.length >= 3 &&
    long.split(/\s*[/:–]\s*|\s+-\s+/).some(part => part.trim() === short);
const titleCompatible = (source, candidate) => {
    if (similarity.compareTwoStrings(source, candidate) > 0.7) return true;
    const [a, b] = [cleanTitle(source), cleanTitle(candidate)];
    return Boolean(a && b) && (similarity.compareTwoStrings(a, b) > 0.7 || partOf(a, b) || partOf(b, a));
};

// Retail pressings come first. Small labels often only press white labels or
// promos, and these are then what the shop sold.
const pressingRank = candidate => candidate.format.includes('Promo') ? 2
    : candidate.format.includes('White Label') ? 1 : 0;

module.exports = function matchRelease(release, candidates, fuzzy = false) {
    const catalog = normalizeCatalog(release.catno);
    // Test pressings are not sold. Promos and white labels need a matching catalog.
    const eligible = [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()]
        .filter(candidate => candidate.type === 'release' &&
        (!release.format || candidate.format.includes(release.format)) &&
        !candidate.format.includes('Test Pressing') && (catalog || !pressingRank(candidate)));
    if (!eligible.length) return {status: 'unmatched'};
    if (catalog) {
        // Catalog numbers can be shared by unrelated records and by multiple
        // pressings. Validate artist and title independently, not as one string.
        const sourceArtist = normalizeText(release.artist);
        const sourceTitle = normalizeText(release.title);
        const compatible = new Set();
        const sameArtist = new Set();
        const plausible = eligible.filter(candidate => {
            let editionVariant = false;
            for (let separator = candidate.title.indexOf(' - '); separator >= 0;
                separator = candidate.title.indexOf(' - ', separator + 3)) {
                const artist = normalizeText(candidate.title.slice(0, separator));
                const title = normalizeText(candidate.title.slice(separator + 3));
                if (!artistCompatible(sourceArtist, artist)) continue;
                // "Various" only proves a sibling pressing of another "Various" release
                // with a loosely similar title, not of any compilation sharing the catalog.
                if (isGeneric(sourceArtist) === isGeneric(artist) && (!isGeneric(artist) ||
                    similarity.compareTwoStrings(cleanTitle(sourceTitle), cleanTitle(title)) >= 0.5)) {
                    sameArtist.add(candidate.id);
                }
                // Discogs often repeats the artist: "Bananarama - Bananarama Remixed: Vol 1".
                if (titleCompatible(sourceTitle, title) || (title.startsWith(`${artist} `) &&
                    titleCompatible(sourceTitle, title.slice(artist.length + 1)))) {
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
        // Pressings sharing catalog and artist compete even when Discogs spells the
        // title differently: "TTJ Edits #1305" (2014) versus its repress "TTJ1305".
        let matching = eligible.filter(candidate => sameCatalog(release.catno, candidate.catno) &&
            (sameArtist.has(candidate.id) || compatible.has(candidate.id)));
        const best = Math.min(...matching.map(pressingRank));
        matching = matching.filter(candidate => pressingRank(candidate) === best);
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
