'use strict';

const Discogs = require('disconnect').Client;
const fs = require('fs');
const parse = require('csv-parse');
const _ = require('lodash');
const config = require('config');
const logger = require('./helpers').logger;

const db = new Discogs({userToken: 'fwxgZMIuKZwNNoXViqyfdizawVEPkqVfgDTtSfVI'}).database();

// We are using relax to preserve '"' within value. With 'columns', we make sure that object instead of arrays are returned.
// With autodetection, it expects a header in CSV file.
const parser = parse({delimiter: ';', relax: true, columns: true, trim: true}, (err, data) => {
    if (err)  {
        logger.error(err);
    } else {
        // We have to clean the data. Remove any "Price: '0.00'" or any "Leerhülle..."
        _.remove(data, item => {
            return item.Price === '0.00' || item.Artist.startsWith('Leerhülle');
        });
        _.forEach(data, item =>  {
            let artist = item.Artist;
            let title = item.Title;
            logger.debug(`Looking for ${artist} - ${title}`);
            db.search(null, {artist: artist, title: title}, function(err, data) {
                let len = data.results.length;
                switch (len) {
                    case 0:
                        logger.info(`Nothing has been found for '${artist} - ${title}'.`);
                        break;
                    case 1:
                        addToCollection(data.results[0]);
                        break;
                    default:
                        logger.info(`Too many items (${len}) found for '${artist} - ${title}'.`);
                }
            });
        })
    }
});

/**
 * Adds given data to <b>Discogs</b> collection.
 *
 * @param data
 */
const addToCollection = (data) => {

};

fs.createReadStream(__dirname + '/test/resources/deejay.002.csv').pipe(parser);

if (require.main === module) {

} else {

}