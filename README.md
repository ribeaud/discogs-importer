# Discogs Importer

Given a **CSV** file, it imports the releases (one release per line) into your named collection
at [Discogs](https://www.discogs.com/).

### CSV file format

Expectations regarding the __CSV__ file:

* Presence of header required. Minimum set of expected columns are **Artist**, **Title** and **Format** (case is _important_).
Optional column is **Catno**.

Expectations regarding the program itself:

* It will NOT create any duplicate in the specified target folder. If the item already exists, then a log will be made
 and adding will be skipped.
* Due to current [Discogs](https://www.discogs.com/) limitations concerning rate limitation
(`requests are throttled by the server to 240 per minute per IP address`),
each **CSV** record (line) is handled _synchronously_.

Current configuration could be found [here](config/default.json) and MUST be adapted to your needs.

### Running the program

1. Install [Node.js](https://nodejs.org/)
1. Go to this package's download directory
1. Start the program with `node app.js <csv-file>`