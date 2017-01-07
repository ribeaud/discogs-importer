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
                        logger.info(`NOTHING has been found for '${release}'.`);
                        return Promise.reject();
                    case 1:
                        return _addToCollectionPromise(data.results[0]);
                    default:
                        const releases = _.filter(data.results, {type: 'release'});
                        if (releases.length == 1) {
                            return _addToCollectionPromise(releases[0]);
                        } else {
                            logger.info(`TOO MANY items (${len}) found for '${release}'.`);
                            return Promise.reject();
                        }
                }
            }).then(_.noop).catch(err => {
                if (err) {
                    logger.error(err);
                }
            });
            // We have to throttle our requests. Otherwise, Discogs will reject us.
            if (counter < data.length) {
                setTimeout(iterate, 1000);
            }
        };
        iterate();
    }
});

/**
 * Adds given release to <b>Discogs</b> collection.
 *
 * @param release the release data.
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
            logger.info(`Release '${release.title}' has been ADDED to collection '${folderName}'.`);
            collection.addRelease(userName, folder.id, release.id, callback);
        }
    })
    // Catch any error happening in the chain
        .catch(err => callback(err));
};

const _addToCollectionPromise = (release) => {
    return new Promise((resolve, reject) => {
        addToCollection(release, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });

    });
};

fs.createReadStream(__dirname + '/test/resources/all.csv').pipe(parser);