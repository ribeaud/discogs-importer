# Discogs Importer

Given a **CSV** file, it imports the releases (one release per line) into your named collection
at [Discogs](https://www.discogs.com/).

### CSV file format

#### Expectations regarding the __CSV__ file:

* Presence of header required. Minimum set of expected columns are **Artist**, **Title** and **Format** (case is _important_).
Optional column is **Catno**. **Catno** is currently NOT used. 

### Program behaviour

#### Expectations regarding the program itself:

* It will NOT create any duplicate in the specified target folder. If the item already exists, then a log will be made
 and adding will be skipped.
* Due to current [Discogs](https://www.discogs.com/) limitations concerning rate limitation
(`requests are throttled by the server to 240 per minute per IP address`),
each **CSV** record (line) is handled _synchronously_.
* Only regular releases will be considered. _While Label_, _Promo_ and _Master_ will NOT.

#### Logic

1. It first tries to find a _perfect_ match for a given **Artist**, **Title** and **Format**.
1. If nothing is found, then tries to find a _similar_ match for a given **Artist**, **Title** and **Format**.
1. If multiple matches are found, then a log is made and nothing will happen.

### Configuration

Current configuration could be found [here](config/default.json) and MUST be adapted to your needs:
```
{
  "userName": // What is your Discogs user name?,
  "folderName": // Where do you want to put the releases added?,
  "userToken": // Generate a personal Discogs access token here ---> https://www.discogs.com/settings/developers,
  "dryRun": // "false" if you do NOT want to really add the releases for now and prefer to see what the program will do,
  "csv": {
    "delimiter": // CSV delimiter
  }
}
```

#### Running the program

1. Install [Node.js](https://nodejs.org/)
1. Go to this package's download directory
1. Adapt configuration [here](config/default.json)
1. Start the program with `node app.js <csv-file>`