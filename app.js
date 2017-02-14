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

const discogs = new Discogs({userToken: config.userToken});
const database = discogs.database();
const collection = discogs.user().collection();

// We are using relax to preserve '"' within value. With 'columns', we make sure that object instead of arrays are returned.
// With autodetection, it expects a header in CSV file.
const parser = parse({delimiter: ';', relax: true, columns: true, trim: true}, (err, data) => {
    if (err) {
        logger.error(err);
    } else {
        // Data contain all the lines parsed
        let counter = 0;
        const iterate = () => {
            const item = data[counter++];
            const release = new Release(item.Artist, item.Title, item.Format);
            logger.debug(`Looking for '${release}'.`);
            database.search(null, release).then(data => {
                let len = data.results.length;
                switch (len) {
                    case 0:
                        _asPromise(_similaritySearch, release).then(next);
                        break;
                    case 1:
                        return _asPromise(addToCollection, data.results[0]).then(next);
                    default:
                        const releases = _.filter(data.results, {type: 'release'});
                        if (releases.length == 1) {
                            return _asPromise(addToCollection, releases[0]).then(next);
                        } else {
                            logger.info(`TOO MANY items (${len}) found for '${release}'.`);
                            next();
                        }
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
    database.search(search, {format: release.format}).then(data => {
        const len = data.results.length;
        if (!len) {
            logger.info(`NOTHING has been found for '${release}'.`);
            return callback();
        }
        // Only consider results of type 'release'
        const titles = _.filter(data.results, {type: 'release'}).map(res => res.title);
        const uniqueTitles = new Set(titles);
        // If we have multiple times the SAME title, then we should exit
        if (uniqueTitles.size < titles.length) {
            logger.info(`TOO MANY identical titles (${len}) found for '${release}'.`);
            return callback();
        }
        const similaritySearch = similarity.findBestMatch(search, titles);
        logger.debug(`Following ratings found '${util.inspect(similaritySearch.ratings)}'.`);
        const bestMatch = similaritySearch.bestMatch;
        // Be more verbose here
        if (bestMatch.rating > 0.7) {
            const answer = _.find(data.results, result => result.title == bestMatch.target);
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
            const folderNames = _.map(folders.folders, {name});
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
            callback();
        } else {
            assert(folder, 'Unspecified folder');
            logger.info(`ADDING release '${release.title}' to collection '${folderName}'.`);
            collection.addRelease(userName, folder.id, release.id, callback);
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

fs.createReadStream(__dirname + '/test/resources/all.csv').pipe(parser);