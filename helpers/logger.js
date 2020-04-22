'use strict';

const {createLogger, format, transports} = require('winston');
const {combine, timestamp, label, printf} = format;

const classes = require('../classes');
const env = classes.Environment.fromDescription(process.env.NODE_ENV || 'development');

const logger = createLogger();

const myFormat = printf(({level, message, timestamp}) => {
    return `${timestamp} [${level}]: ${message}`;
});

if (env.is(classes.Environment.DEV)) {
    logger.add(new (transports.Console)({
        format: combine(
            timestamp(),
            myFormat
        ),
        level: 'debug'
    }));
} else if (env.is(classes.Environment.PROD)) {
    logger.add(new (winston.transports.File)({
        format: combine(
            timestamp(),
            myFormat
        ),
        level: 'info',
        filename: 'chem-rich-books.log',
    }));
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
