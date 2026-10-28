// Downloads deejay.de order exports as one CSV file containing their vinyl rows.
//
// deejay.de is behind a Cloudflare browser check, so curl cannot download the
// exports. Run this in the browser instead:
// 1. Log in at https://www.deejay.de and open "shipped Orders"
//    (https://www.deejay.de/m_myDeejay/sm_myInvoices).
// 2. Set FROM below to the first order number not yet in test/resources/all.csv.
// 3. Open the developer console (F12), paste this whole file and press Enter.
// The browser saves deejay.<FROM>-<latest>.csv. Append it without its header:
//     tail -n +2 ~/Downloads/deejay.0143-0202.csv >> test/resources/all.csv
// Non-vinyl rows, including the payment rows with transaction details, are left out.
(async (FROM = 143) => {
    const ids = [...document.querySelectorAll('a[href*="getTXT.php"]')]
        .map(link => link.href.match(/rechID=(\d+)-(\d+)/)).filter(Boolean);
    if (!ids.length) throw new Error('Open "shipped Orders" while logged in, then run this again.');
    const latest = Math.max(...ids.map(([, id]) => Number(id)));
    const customer = ids[0][2];
    const pad = n => String(n).padStart(4, '0');
    let header;
    const rows = [];
    for (let n = FROM; n <= latest; n++) {
        const response = await fetch(`/ajaxHelper/getTXT.php?rechID=${pad(n)}-${customer}&kunde=${customer}`);
        const [first, ...lines] = (await response.text()).split(/\r?\n/).filter(line => line.trim());
        if (!response.ok || !first || !first.startsWith('ID;')) {
            console.warn(`Order ${pad(n)}: no export (HTTP ${response.status}), skipped.`);
            continue;
        }
        header = header || first;
        if (first !== header) throw new Error(`Order ${pad(n)} has a different column layout: ${first}`);
        const columns = header.split(';');
        const format = columns.indexOf('Format');
        // Keep rows with an unexpected column count: the importer reports them.
        rows.push(...lines.filter(line => {
            const values = line.split(';');
            return values.length !== columns.length || values[format] === 'Vinyl';
        }));
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (!header) throw new Error(`No exports found from order ${pad(FROM)} to ${pad(latest)}.`);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([[header, ...rows].join('\n') + '\n'], {type: 'text/csv'}));
    link.download = `deejay.${pad(FROM)}-${pad(latest)}.csv`;
    link.click();
    console.log(`Saved ${link.download}: ${rows.length} vinyl rows from orders ${pad(FROM)} to ${pad(latest)}.`);
})();
