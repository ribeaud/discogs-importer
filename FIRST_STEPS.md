#### Discogs API

You will have first to generate a token at [Discogs](https://www.discogs.com/). This is the quickest to proceed.

##### User REST API
```
curl https://api.discogs.com/users/ribose/wants --user-agent "FooBarApp/3.0" -H "Authorization: Discogs token=<user-token>"
curl https://api.discogs.com/users/ribose/collection/folders --user-agent "FooBarApp/3.0" -H "Authorization: Discogs token=<user-token>"
```

##### Database REST API

We need the authorization token:

```
curl "https://api.discogs.com/database/search?artist=Blanck+Mass&title=No+Lite" –user-agent "FooBarApp/3.0" -H "Authorization: Discogs token=<user-token>"
```
will returns following results:

```
{"pagination": {"per_page": 50, "pages": 1, "page": 1, "urls": {}, "items": 1},
"results": [{"style": ["Techno", "Minimal", "Leftfield", "Industrial"],
"thumb": "https://api-img.discogs.com/REiT7t8NspIsn5vOY60rMgztFi0=/fit-in/150x150/filters:strip_icc():format(jpeg):mode_rgb():quality(40)/discogs-images/R-7589442-1445749594-1304.jpeg.jpg",
"format": ["Vinyl", "12\"", "33 \u2153 RPM", "Single Sided", "EP", "Limited Edition", "White Label"], "country": "US",
"barcode": ["SBR-143 A BONATI MASTERING NYC"], "uri": "/Blanck-Mass-No-Lite-/release/7589442",
"community": {"want": 72, "have": 97}, "label": ["Sacred Bones Records", "Bonati Mastering"], "catno": "SBR 143", "year": "2015",
"genre": ["Electronic"], "title": "Blanck Mass - No Lite  ", "resource_url": "https://api.discogs.com/releases/7589442", "type": "release", "id": 7589442}]}
```

#### Deejay.de csv export

With https://www.deejay.de/ajaxHelper/getTXT.php?rechID=0084-103274, I am getting:

```
ID;Price;Pieces;Artist;Title;Label No;Orderref.;Format;Country;Release Date;Excl Vinyl
204396;17.50;1;Blanck Mass;No Lite;SBR143;;Vinyl;NL;2015-10-26;
186196;8.75;1;Das Komplex;Universe;STEP006;;Vinyl;NL;2015-07-28;
198583;10.35;1;Sparky;Signals / Tigress;NMBRS43;;Vinyl;NL;2015-10-21;
139032;13.99;1;Leerhülle 1 Stück / Cover;12&quot; Schwarz Inside Out _dick_ Mit Loch;CO12LP280S INSIDE OUT BLACK 1;;Sonstiges;DE;2016-12-09;
357100;0.00;1;Pp Zahlungseingang;Paypal / Sofort;;-50.59€|*NBON* link:mailto:&#80;P&#45;&#x72;&#x69;&#x73;&#x6b;&#121;&#x40;&#x63;h&#114;&#x69;&#46;c&#104;&#59;&#83;o&#110;s&#x74;&#105;&#x67;&#x65;&#115;&#59;D&#x45;&#x3b;1&#57;&#x39;&#x38;&#45;&#49;&#49;&#45;&#50;&#x36;[&#80;P&#45;&#x72;&#x69;&#x73;&#x6b;&#121;&#x40;&#x63;h&#114;&#x69;&#46;c&#104;&#59;&#83;o&#110;s&#x74;&#105;&#x67;&#x65;&#115;&#59;D&#x45;&#x3b;1&#57;&#x39;&#x38;&#45;&#49;&#49;&#45;&#50;&#x36;];
```

This URL follows schema `rechID=<order-id>-<customer-id>`. If authentication does NOT succeed, then you will get the headers only.
ich does NOT exist) returns:

```
ID;Price;Pieces;Artist;Title;Label No;Orderref.;Format;Country;Release Date;Excl Vinyl
```