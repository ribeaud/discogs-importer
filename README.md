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
- `Label No` (or `Catno`) is preserved but **not yet used for ranking**.
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

## Matching baseline

1. Search by artist, title, format and release type, collecting all result pages.
2. Exclude Promo, White Label and non-release results in both search paths.
3. Accept a single eligible strict-search candidate; send multiple candidates to `REVIEW`.
4. If no eligible strict candidate exists, try combined artist/title text search.
5. Accept a unique best fuzzy score above 0.7. Tied best scores go to `REVIEW`.

`REVIEW` currently means log and skip, not an interactive review queue. A single result or a
high text score does **not** establish that a pressing is correct. Catalog conflicts, near-ties,
reissues, and abbreviated titles remain limitations to address in the next matching phase.

## Tests and benchmark

- `npm test`: offline parser, matcher and import-workflow tests; no credentials or network required.
- `npm run benchmark`: reproducible candidate-selection benchmark using the same matcher as the CLI.
- `npm run test:integration`: legacy live Discogs tests; requires credentials and network. These
  tests retain historical search expectations and may fail as Discogs data changes.

The benchmark cases in `test/resources/matcher-cases.js` use **synthetic IDs and candidate sets**,
including two retailer-title examples. They are not verified mappings of your purchases.
The benchmark reports all incorrect decisions, including known limitations; it is a measurement
command, not a passing-test claim. The initial phase-one baseline is:

| Metric | Result |
| --- | --- |
| Correct decisions | 10 / 13 |
| Correct automatic matches | 3 / 4 |
| Automatically matched cases | 4 / 13 |
| Review / unmatched | 4 / 5 |

The same command checks all 141 individual archived order exports: 670 vinyl rows,
224 non-vinyl rows skipped, and no malformed rows. This is parsing coverage, not matching
accuracy; the overlapping consolidated `all.csv` is excluded from these totals.

Three known gaps are catalog-number disambiguation, rejecting a conflicting catalog number,
and matching an abbreviated retailer title. These remain visible in benchmark output rather than
being counted as successes. Contract tests cover the implemented behavior, including reversed
candidate ordering; known-gap cases are measured only by the benchmark.

Before claiming real-world accuracy, build a separate verified dataset: retain the purchase ID,
source metadata, frozen Discogs candidates and their provenance, and a manually confirmed release ID
(or explicit ambiguous/unmatched decision). Keep repeat purchases together when splitting tuning
and evaluation data. Measure automatic-match correctness and coverage separately. This benchmark
does not measure candidate retrieval quality, API usage, or runtime performance.
