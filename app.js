'use strict';

const Discogs = require('disconnect').Client;
const fs = require('fs');
const parse = require('csv-parse');
const _ = require('lodash');
const config = require('config');
const logger = require('./helpers').logger;
const request = require("request");
const http = require("http");
const Release = require('./classes').Release;
const Promise = require('promise');
const assert = require('assert');
const similarity = require('string-similarity');
const util = require('util');
const program = require('commander');
require('pkginfo')(module, 'version');

const discogs = new Discogs({userToken: config.userToken});
const database = discogs.database();
const collection = discogs.user().collection();

// We are using relax to preserve '"' within value. With 'columns', we make sure that object instead of arrays are returned.
// With autodetection, it expects a header in CSV file.
const parser = parse({
    delimiter: config.csv.delimiter,
    relax: true,
    columns: true,
    trim: true,
    skip_empty_lines: true
}, (err, data) => {
    if (err) {
        logger.error(err);
    } else {
        // Data contain all the lines parsed
        let counter = 0;
        const iterate = () => {
            const item = data[counter++];
            const release = new Release(item.Artist, item.Title, item.Format, item['Label No']);
            logger.debug(`Looking for '${release}'.`);
            // Only consider results of type 'release'
            database.search(null, {
                artist: release.artist,
                title: release.title,
                format: release.format,
                type: 'release'
            }).then(data => {
                const results = _.filter(data.results, res => {
                    // Filter out format 'Promo' and 'White Label' assuming we want to register a regular release
                    return _.indexOf(res.format, 'Promo') < 0 && _.indexOf(res.format, 'White Label') < 0;
                });
                let len = results.length;
                switch (len) {
                    case 0:
                        // Nothing found. Try a similarity search
                        return _asPromise(_similaritySearch, release).then(next);
                    case 1:
                        // Easiest case: only one match
                        return _asPromise(addToCollection, results[0]).then(next);
                    default:
                        // Multiple matches
                        const catnos = _.map(results, 'catno');
                        logger.info(`TOO MANY items (${len}) found for '${release}' (Catnos: '${catnos.join("', '")}').`);
                        return next();
                }
            }).catch(err => {
                if (err) {
                    logger.error(err);
                }
            });
            // We have to throttle our requests. Otherwise, Discogs will reject us.
            const next = () => {
                if (counter < data.length) {
                    setTimeout(iterate, 100);
                }
            };
        };
        iterate();
    }
});

/**
 * Performs a similarity search for given <i>release</i>.
 *
 * @param release the release to search for. Can NOT be <code>null</code>.
 * @param callback the callback. Accepts at most one parameter, the <i>err</i> if any.
 * @private
 */
const _similaritySearch = (release, callback) => {
    const search = `${release.artist} - ${release.title}`;
    // Only consider results of type 'release'
    database.search(search, {format: release.format, type: 'release'}).then(data => {
        const results = data.results;
        const len = results.length;
        if (!len) {
            logger.info(`NOTHING has been found for '${release}'.`);
            return callback();
        }
        const titles = results.map(res => res.title);
        const similaritySearch = similarity.findBestMatch(search, titles);
        logger.debug(`Following ratings found '${util.inspect(similaritySearch.ratings)}'.`);
        const bestMatch = similaritySearch.bestMatch;
        const bestMatches = _.filter(similaritySearch.ratings, bestMatch.target);
        // If we have multiple best matches, then we should exit
        if (bestMatches.length > 1) {
            logger.info(`TOO MANY best matches (${bestMatches.length}) found for '${release}'.`);
            return callback();
        }
        // Be more verbose here
        if (bestMatch.rating > 0.7) {
            const answer = _.find(results, result => result.title == bestMatch.target);
            logger.info(`Following SIMILAR match '${answer.title}' found for '${release}'.`);
            return _asPromise(addToCollection, answer).then(callback);
        }
        logger.info(`NO SIMILAR match found for '${release}'.`);
        callback();
    })
    // Catch any error happening in the chain
        .catch(err => callback(err));
};

/**
 * Adds given release to <b>Discogs</b> collection.
 *
 * @param release the release data.
 * @param callback the callback. Accepts at most one parameter, the <i>err</i> if any.
 */
const addToCollection = (release, callback) => {
    const {userName, folderName} = config;
    let folder;
    collection.getFolders(userName).then(folders => {
        const folder = _.find(folders.folders, {name: folderName});
        if (folder) {
            return Promise.resolve(folder);
        } else {
            const folderNames = _.map(folders.folders, 'name');
            const uncategorized = 'Uncategorized';
            logger.warn(`No folder named '${folderName}' found in folders '${folderNames}'. Using '${uncategorized}'.`);
            return Promise.resolve(_.find(folders.folders, {name: uncategorized}));
        }
    }).then(f => {
        folder = f;
        // Search itself is folder agnostic. But we would NOT start the search if the folder does NOT exist.
        return collection.getReleaseInstances(userName, release.id);
    }).then(instances => {
        if (instances.releases.length) {
            logger.info(`Release '${release.title}' ALREADY exists in collection '${folderName}'.`);
            return callback();
        } else {
            assert(folder, 'Unspecified folder');
            // Only add the release if we are NOT in dry mode.
            if (!config.dryRun) {
                logger.info(`ADDING release '${release.title}' (ID: ${release.id}, Catno: ${release.catno}) to collection '${folderName}'.`);
                return collection.addRelease(userName, folder.id, release.id, callback);
            }
            logger.info(`WOULD ADD release '${release.title}' (ID: ${release.id}, Catno: ${release.catno}) to collection '${folderName}'.`);
            return callback();
        }
    })
    // Catch any error happening in the chain
        .catch(err => callback(err));
};

/**
 * Converts given <i>func</i> into a <code>Promise</code>.
 * <p>
 * Note that it is expected that passed function has a callback as its last argument.
 * </p>
 *
 * @param func the function to convert. Can NOT be <code>null</code>.
 * @param args function arguments.
 * @returns {*}
 * @private
 */
const _asPromise = (func, ...args) => {
    // Make sure 'args' is defined
    args = args || [];
    return new Promise((resolve, reject) => {
        // Append a callback to function arguments
        args.push((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
        func.apply(this, args);
    });
};

program
    .version(module.exports.version)
    .parse(process.argv);

const args = process.argv.slice(2);
if (!args.length) {
    program.outputHelp();
} else {
    let path = args[0];
    path = path.startsWith('/') ? path : __dirname + `/${path}`;
    fs.stat(args[0], (err, stats) => {
        if (err) {
            return console.error(`Given '${path}' does NOT exist.`);
        }
        if (stats.isFile()) {
            logger.info(`Loading following file '${path}'.`);
            fs.createReadStream(path).pipe(parser);
        } else {
            console.error(`Given path is NOT a file '${path}'.`);
        }
    });
}

