const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const port = 6000;

const windows11Url = 'https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information';
const windows10Url = 'https://learn.microsoft.com/en-us/windows/release-health/release-information';

let windows11Cache = { data: null, timestamp: null };
let windows10Cache = { data: null, timestamp: null };

async function scrapeReleaseInfo(url) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: 'domcontentloaded' });

	await page.waitForSelector('table[aria-label="Servicing channels"]');

	const releaseInfo = await page.evaluate(() => {
		const rows = document.querySelectorAll('table[aria-label="Servicing channels"] tbody tr');
		const data = [];

		rows.forEach(row => {
			const columns = row.querySelectorAll('td');
			
			if (columns.length >= 7) {
				const version = columns[0]?.innerText.trim();
				const latestBuild = columns[4]?.innerText.trim();
				const endOfServicingHomePro = columns[5]?.innerText.trim();
				const endOfServicingEnterprise = columns[6]?.innerText.trim();

				if (version && latestBuild && endOfServicingHomePro && endOfServicingEnterprise) {
					data.push({
						version,
						latestBuild,
						endOfServicingHomePro,
						endOfServicingEnterprise
					});
				}
			}
		});

		return data;
	});

	await browser.close();
	return releaseInfo;
}

function isCacheExpired(cache) {
    const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
    return !cache.timestamp || Date.now() - cache.timestamp > thirtyMinutes;
}

async function getWindows11Data() {
    if (isCacheExpired(windows11Cache)) {
        console.log('Fetching live data for Windows 11...');
        windows11Cache.data = await scrapeReleaseInfo(windows11Url);
        windows11Cache.timestamp = Date.now();
    }
    return windows11Cache.data;
}

async function getWindows10Data() {
    if (isCacheExpired(windows10Cache)) {
        console.log('Fetching live data for Windows 10...');
        windows10Cache.data = await scrapeReleaseInfo(windows10Url);
        windows10Cache.timestamp = Date.now();
    }
    return windows10Cache.data;
}

app.get('/api/windows11', async (req, res) => {
    try {
        const windows11Data = await getWindows11Data();
        res.json(windows11Data);
    } catch (error) {
        console.error('Error scraping Windows 11:', error);
        res.status(500).send('Error scraping Windows 11 release information');
    }
});

app.get('/api/windows10', async (req, res) => {
    try {
        const windows10Data = await getWindows10Data();
        res.json(windows10Data);
    } catch (error) {
        console.error('Error scraping Windows 10:', error);
        res.status(500).send('Error scraping Windows 10 release information');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
