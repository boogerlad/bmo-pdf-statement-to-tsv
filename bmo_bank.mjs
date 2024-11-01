import { firefox } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import {SingleBar} from "cli-progress";
import {spawnSync} from 'child_process';
import { DateTime } from "luxon";

let files = {};
let cnt = 0;
for(let i = 2; i < process.argv.length; ++i) {
	let f = path.parse(process.argv[i]);
	let d = DateTime.fromFormat(f.name.slice(12), "yyyy-MM-dd");
	if(d.isValid && f.ext === '.pdf' && d.year < 2025 && d.year > 2015 && /^\d{11}\.$/.test(f.name.slice(0, 12))) {
		let acct = f.name.slice(0, 11);
		if(!files.hasOwnProperty(acct)) {
			files[acct] = [];
		}
		files[acct].push({path: process.argv[i], d});
		++cnt;
	}
}

if(DateTime.now().year > 2024) {
	console.log('License expired. Contact boogerlad@gmail.com to renew.');
	spawnSync("pause", {shell: true, stdio: [0, 1, 2]});
	process.exit(0);
} else if(cnt === 0) {
	process.exit(0);
}
const bar1 = new SingleBar({}, {
    format: ' {bar} {percentage}% | ETA: {eta}s | {value}/{total} | elapsed: {duration}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
});
bar1.start(cnt, 0);

(async () => {
	// Setup
	const browser = await firefox.launch({
		//headless: false,
		executablePath: __dirname + '\\firefox\\firefox.exe',
		firefoxUserPrefs: {
			'pdfjs.disabled': false,
			'pdfjs.defaultZoomValue': '1'
		},
		//slowMo: 500
	});
	const context = await browser.newContext();
	const page = await context.newPage();
	for(let acct in files) {
		files[acct].sort((a, b) => a.d - b.d);
		let ss = [];
		for(let i = 0; i < files[acct].length; ++i) {
			await page.goto('file://' + files[acct][i].path);
			await page.addScriptTag({path: __dirname + '\\firefox\\big.js'});
			while(!await page.locator('#next').isDisabled()) {
				await page.locator('#next').click();
			}
			await page.waitForFunction(() => {
				let x = document.querySelectorAll('.page');
				for(let i = 0; i < x.length; ++i) {
					if(x[i].getAttribute('data-loaded') !== 'true') {
						return false;
					}
				}
				return true;
			});
			ss.push(await page.evaluate(({y, m}) => {

				let n = document.evaluate(
					"//span[contains(., 'Opening balance')]",
					document,
					null,
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				).snapshotItem(0)
				.nextSibling
				.nextSibling;

				let balance = Big(n.textContent.replace(/,/g, ''));

				let rows = [];

				function iter(f) {//element with first tx, the date
					while(true) {
						let row = [`${y}-${m}-${f.textContent.replace(/\D+/g, '')}`]; //date
						f = f.nextSibling.nextSibling;
						if(f.textContent === 'Closing totals'){
							break;
						}
						let desc = f.textContent;
						f = f.nextSibling;
						while(f.textContent !== ' ') {
							if(f.textContent !== '') {
								desc += ' ' + f.textContent;
							}
							f = f.nextSibling;
						}
						row.push(desc);
						f = f.nextSibling;
						let change = Big(f.textContent.replace(/,/g, ''));
						f = f.nextSibling.nextSibling;
						let after = Big(f.textContent.replace(/,/g, ''));
						let diff = after.minus(balance);
						if(diff.eq(change)) {
							row.push(change.toFixed());
						} else if(diff.eq(change.neg())) {
							row.push(change.neg().toFixed());
						} else {
							row.push('fuck');
						}
						row.push(after.toFixed());
						balance = after;
						rows.push(row.join('	'));
						f = f.nextSibling;
						if(f.className === "endOfContent") {
							break;
						} else {
							f = f.nextSibling;
						}
					}
				}
				iter(n.nextSibling.nextSibling);

				n = document.evaluate("//span[.='(continued)']", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
				for(let i = 0; i < n.snapshotLength - 1; ++i) {
					iter(n.snapshotItem(i).nextSibling.nextSibling.nextSibling.nextSibling);
				}
				if(n.snapshotLength) {
					iter(n.snapshotItem(n.snapshotLength - 1).nextSibling.nextSibling);
				}
				return rows.join('\n');
			}, {y: files[acct][i].d.year, m: (files[acct][i].d.month < 10 ? '0' : '') + files[acct][i].d.month}));
			bar1.increment();
		}
		fs.writeFileSync(`bmo bank(${acct}) transactions.tsv`, ss.join('\n'));
	}

	// Teardown
	await context.close();
	await browser.close();
	bar1.stop();
})();