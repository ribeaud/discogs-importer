'use strict';

const Enum = require('enum');

// 'DEV' is the mode where application is started in IDE.
exports.Environment = new Enum({PROD: 'production', DEV: 'development'});
exports.Environment.fromDescription = function (description) {
    for (let e of this.enums) {
        if (e.value === description) {
            return e;
        }
    }
    throw new Error(`No Environment for description '${description}'.`);
};
Object.freeze(exports.Environment);

exports.Release = require('./Release');