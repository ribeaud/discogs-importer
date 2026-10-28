'use strict';

const fs = require('fs');
const path = require('path');
const parseOrders = require('./helpers/orders');
const matchRelease = require('./helpers/matcher');

async function importOrders(records, {database, collection, config, logger,
    wait = () => new Promise(resolve => setTimeout(resolve, 1100))}) {
    const summary = {added: 0, planned: 0, existing: 0, review: 0, unmatched: 0, failed: 0};
    if (!records.length) return summary;
    // Pace every API request, not just every purchase. Do not automatically
    // retry writes: a timeout does not mean Discogs rejected the addition.
    const request = async operation => { await wait(); return operation(); };
    const folders = await request(() => collection.getFolders(config.userName));
    const folder = folders.folders.find(f => f.name === config.folderName);
    if (!folder) throw new Error(`Collection folder not found: ${config.folderName}`);
    const seen = new Set();
    const uncertainWrites = new Set();
    for (const item of records) {
        const release = {artist: item.Artist, title: item.Title, format: item.Format,
            catno: item['Label No'] || item.Catno};
        try {
            const search = async (query, params) => {
                const results = [];
                let page = 1, pages;
                do {
                    const data = await request(() => database.search(query, {...params, page, per_page: 100}));
                    results.push(...data.results);
                    pages = data.pagination ? data.pagination.pages : 1;
                } while (++page <= pages);
                return [...new Map(results.map(result => [result.id, result])).values()];
            };
            let result = matchRelease(release, await search(null, {
                artist: release.artist, title: release.title, format: release.format, type: 'release'
            }));
            if (result.status === 'unmatched') {
                result = matchRelease(release, await search(`${release.artist} - ${release.title}`, {
                    format: release.format, type: 'release'
                }), true);
            }
            if (result.status !== 'matched') {
                summary[result.status]++;
                logger.info(`${result.status.toUpperCase()}: ${release.artist} - ${release.title}`);
                continue;
            }
            const selected = result.release;
            if (uncertainWrites.has(selected.id)) {
                summary.review++;
                logger.info(`REVIEW: ${selected.title} (${selected.id}): earlier write outcome unknown; verify in Discogs before retrying.`);
                continue;
            }
            const instances = seen.has(selected.id) ? {releases: [selected]} :
                await request(() => collection.getReleaseInstances(config.userName, selected.id));
            if (instances.releases.length) {
                summary.existing++;
                logger.info(`ALREADY EXISTS: ${selected.title} (${selected.id})`);
            } else if (config.dryRun !== false) {
                summary.planned++;
                logger.info(`WOULD ADD: ${selected.title} (${selected.id})`);
            } else {
                await request(() => {
                    uncertainWrites.add(selected.id);
                    return collection.addRelease(config.userName, folder.id, selected.id);
                });
                uncertainWrites.delete(selected.id);
                summary.added++;
                logger.info(`ADDED: ${selected.title} (${selected.id})`);
            }
            seen.add(selected.id);
        } catch (error) {
            summary.failed++;
            logger.error(`FAILED: ${release.artist} - ${release.title}: ${error.message}`);
        }
    }
    return summary;
}

async function main() {
    const program = require('commander');
    program.version(require('./package.json').version).arguments('<csv-file>').parse(process.argv);
    if (!program.args.length) { program.outputHelp(); return; }
    const config = require('config');
    if (!config.userName || !config.userToken) {
        throw new Error('Set DISCOGS_USER_NAME and DISCOGS_USER_TOKEN, or configure config/local.json.');
    }
    const logger = require('./helpers/logger');
    const {records, issues} = parseOrders(fs.readFileSync(path.resolve(program.args[0]), 'utf8'), config.csv.delimiter);
    issues.forEach(issue => logger.warn(`CSV row ${issue.row}: ${issue.reason}`));
    const Discogs = require('disconnect').Client;
    const discogs = new Discogs({userToken: config.userToken});
    const summary = await importOrders(records, {
        database: discogs.database(), collection: discogs.user().collection(), config, logger
    });
    logger.info(JSON.stringify(summary));
    if (summary.failed || issues.some(issue => issue.reason !== 'Non-vinyl row skipped')) process.exitCode = 1;
}

module.exports = {importOrders};
if (require.main === module) main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
