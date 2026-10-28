'use strict';

const assert = require('assert');
const {compareTwoStrings} = require('../helpers/similarity');

const config = require('config');
const Discogs = require('disconnect').Client;
const discogs = new Discogs({userToken: config.userToken});
const database = discogs.database();

const findBestMatch = (search, targets) => targets
    .map(target => ({target, rating: compareTwoStrings(search, target)}))
    .reduce((best, match) => match.rating > best.rating ? match : best, {rating: -1});

describe('/GET database/search', () => {
    // Andy Ash / Runaway;Otp Party Breaks 3
    const s1 = 'Andy Ash / Runaway - Otp Party Breaks 3';
    it(s1, (done) => {
        database.search(s1, (err, data) => {
            if (err) {
                return done(err);
            }
            let bestMatch = findBestMatch(s1, data.results.map(res => res.title));
            assert.ok(bestMatch.target);
            assert.ok(bestMatch.rating > 0.6);
            assert.ok(bestMatch.rating < 0.7);
            let res = data.results.find(res => res.title === bestMatch.target);
            assert.strictEqual(res.title, 'Andy Ash / Runaway - On The Prowl Presents: OTP Party Breaks # 3');
            done();
        });
    });
    // Maxxi & Zeus - American Dreamer/ Mz Medley
    const s2 = 'Maxxi & Zeus - American Dreamer/ Mz Medley';
    it(s2, (done) => {
        database.search(s2, (err, data) => {
            if (err) {
                return done(err);
            }
            let bestMatch = findBestMatch(s2, data.results.map(res => res.title));
            assert.ok(bestMatch.target);
            assert.ok(bestMatch.rating > 0.70);
            assert.ok(bestMatch.rating < 0.75);
            let res = data.results.find(res => res.title === bestMatch.target);
            assert.strictEqual(res.title, 'Maxxi* & Zeus (11) - American Dreamer');
            done();
        });
    });
    // World Premiere - Share The Night
    const s3 = 'World Premiere - Share The Night';
    it(s3, (done) => {
        database.search(null, {artist: 'World Premiere', title: 'Share The Night'}, (err, data) => {
            if (err) {
                return done(err);
            }
            assert.strictEqual(data.results.length, 26);
            done();
        });
    });
});
