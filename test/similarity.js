'use strict';

const chai = require('chai');
const should = chai.should();
const _ = require('lodash');
const similarity = require('string-similarity');

const config = require('config');

describe('Multiple best matches', () => {
    it('Returns only ONE best match', (done) => {
        const matches = similarity.findBestMatch("Hello", ["Hello", "Hello", "Hell", "Hello Again"]);
        should.exist(matches.bestMatch);
        matches.bestMatch.rating.should.be.equal(1);
        matches.bestMatch.target.should.be.equal("Hello");
        const bestMatches = _.filter(matches.ratings, {target: matches.bestMatch.target});
        bestMatches.should.be.lengthOf(2);
        bestMatches[0].target.should.be.equal('Hello');
        done();
    });
});