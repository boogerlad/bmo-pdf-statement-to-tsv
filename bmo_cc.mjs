import { firefox } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import {SingleBar} from "cli-progress";
import {spawnSync} from 'child_process';
import { DateTime } from "luxon";

let months = {
	'Jan': '01',
	'Feb': '02',
	'Mar': '03',
	'Apr': '04',
	'May': '05',
	'Jun': '06',
	'Jul': '07',
	'Aug': '08',
	'Sep': '09',
	'Oct': '10',
	'Nov': '11',
	'Dec': '12'
};
let files = [];
for(let i = 2; i < process.argv.length; ++i) {
	let f = path.parse(process.argv[i]);
	let d = DateTime.fromFormat(f.name, "DDD", { locale: "en" });
	if(d.isValid && f.ext === '.pdf' && d.year < 2025 && d.year > 2015) {
		files.push({path: process.argv[i], d})
	}
}
files.sort((a, b) => a.d - b.d);

if(DateTime.now().year > 2024) {
	console.log('License expired. Contact boogerlad@gmail.com to renew.');
	spawnSync("pause", {shell: true, stdio: [0, 1, 2]});
	process.exit(0);
} else if(files.length === 0) {
	process.exit(0);
}
const bar1 = new SingleBar({}, {
    format: ' {bar} {percentage}% | ETA: {eta}s | {value}/{total} | elapsed: {duration}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
});
bar1.start(files.length, 0);

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
	let ss = [];
	for(let i = 0; i < files.length; ++i) {
		await page.goto('file://' + files[i].path);
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
		if(files[i].d.year === 2023 && files[i].d.month > 1 || files[i].d.year === 2024) {
			ss.push(await page.evaluate(({year, jan, months}) => {
				let rows = [];
				function iter(f) {
					let row = [`${jan && f.textContent.substring(0,3) !== 'Jan' ? year - 1 : year}-${months[f.textContent.substring(0,3)]}-${f.textContent.replace(/\D+/g, '').padStart(2, '0')}`]; //tx date 
					f = f.nextSibling;
					row.push(`${jan && f.textContent.trim().substring(0,3) !== 'Jan' ? year - 1 : year}-${months[f.textContent.trim().substring(0,3)]}-${f.textContent.replace(/\D+/g, '').padStart(2, '0')}`); //post date
					f = f.nextSibling;
					row.push(f.innerText.trim().replace(/\s+/g, ' ')); //desc
					f = f.nextSibling;
					let amt = f.textContent.trim().replaceAll(',', '');
					f = f.nextSibling;
					if(f.textContent !== ' CR') {
						amt = '-' + amt;
					}
					row.push(amt);
					rows.push(row.join('	'));
				}
				let n = document.evaluate("//span[span[starts-with(.,'Jan.') or starts-with(.,'Feb.') or starts-with(.,'Mar.') or starts-with(.,'Apr.') or starts-with(.,'May.') or starts-with(.,'Jun.') or starts-with(.,'Jul.') or starts-with(.,'Aug.') or starts-with(.,'Sep.') or starts-with(.,'Oct.') or starts-with(.,'Nov.') or starts-with(.,'Dec.')]]/preceding-sibling::span[1][span[starts-with(.,'Jan.') or starts-with(.,'Feb.') or starts-with(.,'Mar.') or starts-with(.,'Apr.') or starts-with(.,'May.') or starts-with(.,'Jun.') or starts-with(.,'Jul.') or starts-with(.,'Aug.') or starts-with(.,'Sep.') or starts-with(.,'Oct.') or starts-with(.,'Nov.') or starts-with(.,'Dec.')]]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
				for(let i = 0; i < n.snapshotLength; ++i) {
					iter(n.snapshotItem(i));
				}
				return rows.join('\n');
			}, {year: files[i].d.year, jan: files[i].d.month === 1, months}));
		} else {
			ss.push(await page.evaluate(({year, jan, months}) => {
				let rows = [];
				function iter(f) {
					let row = [`${jan && f.textContent.substring(0,3) !== 'Jan' ? year - 1 : year}-${months[f.textContent.substring(0,3)]}-${f.textContent.replace(/\D+/g, '').padStart(2, '0')}`]; //tx date
					f = f.nextSibling.nextSibling;
					row.push(`${jan && f.textContent.substring(0,3) !== 'Jan' ? year - 1 : year}-${months[f.textContent.substring(0,3)]}-${f.textContent.replace(/\D+/g, '').padStart(2, '0')}`); //post date
					f = f.nextSibling.nextSibling;
					let desc = f.textContent;
					f = f.nextSibling;
					while(Number(f.style.left.slice(0,-1)) < 80) {
						if(f.textContent !== ' ') {
							desc += ' ' + f.textContent;
						}
						f = f.nextSibling;
					}
					row.push(desc);
					if(f.textContent.endsWith(' CR')) {
						row.push(f.textContent.slice(0, -3).replaceAll(',', ''));
					} else {
						row.push('-' + f.textContent.replaceAll(',', ''));
					}
					rows.push(row.join('	'));
				}
				let n = document.evaluate("//span[starts-with(.,'Jan.') or starts-with(.,'Feb.') or starts-with(.,'Mar.') or starts-with(.,'Apr.') or starts-with(.,'May') or starts-with(.,'Jun.') or starts-with(.,'Jul.') or starts-with(.,'Aug.') or starts-with(.,'Sep.') or starts-with(.,'Oct.') or starts-with(.,'Nov.') or starts-with(.,'Dec.')]/preceding-sibling::span[2][starts-with(.,'Jan.') or starts-with(.,'Feb.') or starts-with(.,'Mar.') or starts-with(.,'Apr.') or starts-with(.,'May') or starts-with(.,'Jun.') or starts-with(.,'Jul.') or starts-with(.,'Aug.') or starts-with(.,'Sep.') or starts-with(.,'Oct.') or starts-with(.,'Nov.') or starts-with(.,'Dec.')]", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
				for(let i = 0; i < n.snapshotLength; ++i) {
					iter(n.snapshotItem(i));
				}
				return rows.join('\n');
			}, {year: files[i].d.year, jan: files[i].d.month === 1, months}));
		}
		bar1.increment();
	}
	fs.writeFileSync('bmo credit card transactions.tsv', ss.join('\n'));
	// Teardown
	await context.close();
	await browser.close();
	bar1.stop();
})();