'use strict';

const winston = require('winston');
const classes = require('../classes');
const env = classes.Environment.fromDescription(process.env.NODE_ENV || 'development');

const logger = new winston.Logger();

if (env.is(classes.Environment.DEV)) {
    logger.add(winston.transports.Console, {
        level: 'debug', timestamp: () => {
            return new Date().toISOString();
        }
    });
} else if (env.is(classes.Environment.PROD)) {
    logger.add(winston.transports.File, {
        level: 'info',
        filename: 'chem-rich-books.log',
        json: false
    });
}
// Configure CLI on an instance of winston.Logger. Switching CLI on will make verbose logs disappearing... And I think
// it is NOT supported everywhere yet.
// logger.cli();
// Only if we are NOT in 'JENKINS' mode (this concerns running all the tests locally using 'npm test' as well).
if (!env.is(classes.Environment.JENKINS)) {
    logger.exitOnError = false;
    let keys = Object.keys(logger.transports);
    keys.forEach(k => logger.transports[k].handleExceptions = true);
}

module.exports = logger;
module.exports.stream = {
    write: (message, encoding) => {
        logger.debug(message.trim());
    }
};