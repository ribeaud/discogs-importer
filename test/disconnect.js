'use strict';

const chai = require('chai');
const should = chai.should();
const _ = require('lodash');
const similarity = require('string-similarity');

const config = require('config');
const Discogs = require('disconnect').Client;
const discogs = new Discogs({userToken: config.userToken});
const database = discogs.database();

describe('/GET database/search', () => {
    // Andy Ash / Runaway;Otp Party Breaks 3
    const s1 = 'Andy Ash / Runaway - Otp Party Breaks 3';
    it(s1, (done) => {
        database.search(s1, (err, data) => {
            if (err) {
                return done(err);
            }
            let bestMatch = similarity.findBestMatch(s1, _.map(data.results, res => res.title)).bestMatch;
            should.exist(bestMatch);
            bestMatch.rating.should.be.gt(0.6);
            bestMatch.rating.should.be.lt(0.7);
            let res = _.find(data.results, res => res.title == bestMatch.target);
            res.title.should.be.equal('Andy Ash / Runaway - On The Prowl Presents: OTP Party Breaks # 3');
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
            let bestMatch = similarity.findBestMatch(s2, _.map(data.results, res => res.title)).bestMatch;
            should.exist(bestMatch);
            bestMatch.rating.should.be.gt(0.70);
            bestMatch.rating.should.be.lt(0.75);
            let res = _.find(data.results, res => res.title == bestMatch.target);
            res.title.should.be.equal('Maxxi* & Zeus (11) - American Dreamer');
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
            data.results.should.be.lengthOf(26);
            done();
        });
    });
});
