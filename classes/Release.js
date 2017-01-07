'use strict';

const assert = require('assert');

/**
 * Class describing a release.
 */
class Release {

    /**
     * Constructor.
     *
     * @param artist the release artist. Can NOT be <code>null</code>.
     * @param title the release title. Can NOT be <code>null</code>.
     * @param format the release format. Can NOT be <code>null</code>.
     */
    constructor(artist, title, format) {
        assert(artist, 'Unspecified artist');
        assert(title, 'Unspecified title');
        assert(format, 'Unspecified format');
        this.artist = artist;
        this.title = title;
        this.format = format;
    }

    /**
     * Text representation of this object.
     *
     * @returns {string} the text representation of this object.
     */
    toString() {
        return `${this.artist} - ${this.title} (${this.format})`;
    }
}

module.exports = Release;