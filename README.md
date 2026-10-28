# Discogs Importer

Imports vinyl purchases from deejay.de CSV exports into a named Discogs collection folder.
The default is a **dry run**: it searches Discogs but does not add anything.

## Running

Use a current Node.js LTS release and run `npm ci`.
Set `DISCOGS_USER_NAME` and `DISCOGS_USER_TOKEN` in your environment. Generate a personal
token at https://www.discogs.com/settings/developers. Do not commit tokens.

Override settings in the gitignored `config/local.json`, for example:

```json
{
  "folderName": "Deejay",
  "dryRun": true
}
```

Run `node app.js <csv-file>`. Relative paths resolve from your current directory.
The folder must already exist; the importer will not silently choose a different one.
Only set `dryRun` to `false` after reviewing the output and the matching limitations below.

## Input and safety

- Semicolon-separated CSV with case-sensitive `Artist`, `Title`, and `Format` headers.
- Both archived deejay header layouts are supported, including `<pre>` wrappers and HTML entities.
- Only rows with `Format` equal to `Vinyl` are imported; other purchases are reported as skipped.
- Missing artist/title and incorrect column counts are reported with CSV record numbers and skipped.
  Invalid CSV syntax or missing required headers aborts the file. Record numbers may differ from
  physical line numbers when quoted fields span lines.
- Import individual downloads separately. Do not concatenate exports with different column layouts.
- `Label No` (or `Catno`) is used for catalog-first search and candidate validation.
- Releases already anywhere in your collection, or already planned/added in this run, are skipped.
  Intentional multiple copies are not supported.
- Row-level API failures are reported and processing continues. Failed rows or malformed input
  produce a nonzero exit code. No writes are automatically retried after a timeout.
- If a write fails, later purchases matching that release go to `REVIEW` without another write,
  even if collection reads would still be empty. This protection lasts only for the current run;
  verify uncertain additions in Discogs before rerunning the import.
- Requests are paced at least 1.1 seconds apart, below the documented authenticated limit of
  60 requests/minute for a single process. Other clients sharing the limit can still cause throttling;
  adaptive throttling and resumable runs are not implemented yet.

## Catalog-first matching

1. If the purchase has a usable catalog number, search by catalog, format and release type.
   Query both the original spelling and its normalized spelling when different, collecting all
   pages and deduplicating by release ID before making a decision.
2. Normalize catalog numbers with Unicode normalization, uppercase, and removal of punctuation
   and whitespace. Preserve all letters and digits, including suffixes and leading zeros:
   `EX-001 A` equals `ex001a`, but not `EX001B` or `EX1A`. Empty values and `none`, `N/A`,
   or `unknown` are treated as unavailable, not identifiers.
3. Exclude non-release results, incompatible formats, Promo and White Label in every search path.
   For purchases with a catalog number, compare artist and title separately (case/whitespace
   normalized), requiring each string-similarity score to exceed 0.7. A catalog alone is not proof.
   Try each ` - ` separator boundary, so delimiters inside an artist or title do not force an
   incorrect split. Both fields must pass at the same boundary.
4. Accept exactly one plausible candidate with the matching catalog. Multiple plausible pressings
   sharing that catalog go to `REVIEW`, even if one has a better title score. Plausible candidates
   with missing catalog data also force review because they cannot be ruled out. If all plausible
   candidates have conflicting catalogs, review rather than choosing one.
   Parenthesized or bracketed remaster, reissue and repress annotations (optionally with a year
   and `edition`) are also checked without the annotation to retain competing pressings. This
   relaxed comparison can only trigger review; it cannot qualify a candidate for automatic selection.
5. If no plausible catalog-search candidate exists, fall back to artist/title search and then
   combined-text search. Apply the same catalog validation in both fallbacks; never bypass a
   catalog ambiguity by searching more loosely.

Purchases without a usable catalog retain the phase-one text policy: accept a single eligible
strict-search result; otherwise review multiple results, or try fuzzy search when none exist.
The fuzzy path accepts a unique best combined artist/title score above 0.7 and reviews ties.

`REVIEW` currently means log and skip, not an interactive review queue. Scores are heuristics,
not calibrated probabilities. Missing metadata, unrecognized edition annotations, complex artist credits, abbreviated titles and
indistinguishable pressings can still require manual verification. No-catalog single-result
acceptance and fuzzy near-ties retain the limitations of the baseline. Catalog search can add
one or two paginated queries per purchase; live retrieval quality has not been measured.

## Tests and benchmark

- `npm test`: offline parser, matcher and import-workflow tests; no credentials or network required.
- `npm run benchmark`: reproducible candidate-selection benchmark using the same matcher as the CLI.
- `npm run test:integration`: legacy live Discogs tests; requires credentials and network. These
  tests retain historical search expectations and may fail as Discogs data changes.

GitHub Actions runs `npm ci` (with dependency lifecycle scripts disabled), the offline tests,
and the benchmark on Node.js 22 and 24 for pushes and pull requests targeting `master`.
Offline test failures block the CI job. Benchmark results are informational: known matching
gaps are reported, not treated as test failures. Live integration tests are excluded, so CI
needs no Discogs credentials and cannot modify your collection. CI does not deploy or publish.

The benchmark cases in `test/resources/matcher-cases.js` use **synthetic IDs and candidate sets**,
including two retailer-title examples. They are not verified mappings of your purchases.
The benchmark reports all incorrect decisions, including known limitations; it is a measurement
command, not a passing-test claim. The same 13 inputs, candidate sets and expected decisions
were run before and after catalog-first matching. The phase-one baseline is commit
[`eb05d61`](https://github.com/ribeaud/discogs-importer/commit/eb05d61172a2707358165eb2e34b5e61519c0363).

| Metric | Phase-one baseline | Catalog-first |
| --- | --- | --- |
| Correct decisions | 10 / 13 | 12 / 13 |
| Correct automatic matches | 3 / 4 | 4 / 4 |
| Automatically matched cases | 4 / 13 | 4 / 13 |
| Review / unmatched | 4 / 5 | 4 / 5 |

Automatic coverage is unchanged: catalog disambiguation adds one correct automatic match,
while a formerly incorrect match with a conflicting catalog now goes to review. No previously
correct benchmark decisions regressed. Additional contract tests (outside these 13 cases) cover
normalization, metadata conflicts, missing catalogs, shared catalogs, pagination, and fallback safety.

The same command checks all 141 individual archived order exports: 670 vinyl rows,
224 non-vinyl rows skipped, and no malformed rows. This is parsing coverage, not matching
accuracy; the overlapping consolidated `all.csv` is excluded from these totals.

The remaining benchmark gap is the abbreviated retailer title. It remains visible in benchmark
output rather than being counted as a success. Contract tests cover the implemented behavior,
including reversed candidate ordering; the known-gap case is measured only by the benchmark.

Before claiming real-world accuracy, build a separate verified dataset: retain the purchase ID,
source metadata, frozen Discogs candidates and their provenance, and a manually confirmed release ID
(or explicit ambiguous/unmatched decision). Keep repeat purchases together when splitting tuning
and evaluation data. Measure automatic-match correctness and coverage separately. This benchmark
does not measure candidate retrieval quality, API usage, or runtime performance.
