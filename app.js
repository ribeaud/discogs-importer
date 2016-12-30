const Discogs = require('disconnect').Client;
const fs = require('fs');
const parse = require('csv-parse');
const _ = require('lodash');

const db = new Discogs({userToken: 'fwxgZMIuKZwNNoXViqyfdizawVEPkqVfgDTtSfVI'}).database();

// We are using relax to preserve '"' within value. With 'columns', we make sure that object instead of arrays are returned.
// With autodetection, it expects a header in CSV file.
const parser = parse({delimiter: ';', relax: true, columns: true, trim: true}, function(err, data){
    if (err)  {
        console.error(err);
    } else {
        // We have to clean the data. Remove any "Price: '0.00'" or any "Leerhülle..."
        _.remove(data, function(item) {
            return item.Price === '0.00' || item.Artist.startsWith('Leerhülle');
        });
        _.forEach(data, function(item) {
            db.search(null, {artist: item.Artist, title: item.Title}, function(err, data){
                console.log(data);
            });
        })
    }
});

fs.createReadStream(__dirname + '/test/resources/deejay.csv').pipe(parser);
