const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const HOST = '0.0.0.0';
const ROOT = __dirname;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Request too large.'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const target = path.normalize(path.join(ROOT, urlPath));
  if (!target.startsWith(ROOT)) return sendJson(res, 403, { error: 'Forbidden' });

  try {
    const content = await fsp.readFile(target);
    const ext = path.extname(target);
    const type = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    }[ext] || 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

function parseTsvExport(raw, deckName = 'Imported') {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines
    .map((line, index) => {
      const [front, back, tagsText] = line.split('\t');
      if (!front || !back) return null;
      return {
        id: `${deckName}-${index + 1}`,
        front,
        back,
        deck: deckName,
        tags: tagsText ? tagsText.split(' ').filter(Boolean) : [],
      };
    })
    .filter(Boolean);
}

async function syncViaPlaywright({ email, password, deckFilter }) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    throw new Error('Playwright is not installed. Run: npm install && npx playwright install chromium');
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto('https://ankiweb.net/account/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60_000 }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);

    if (page.url().includes('/account/login')) {
      throw new Error('Login failed. Double-check your AnkiWeb credentials.');
    }

    await page.goto('https://ankiweb.net/export', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const selectLocator = page.locator('select[name="did"], select[name="deck"], select#did').first();
    if ((await selectLocator.count()) > 0) {
      const options = await selectLocator.locator('option').allTextContents();
      if (deckFilter) {
        const optionHandle = await selectLocator.locator('option').elementHandles();
        let selected = false;
        for (const option of optionHandle) {
          const label = (await option.textContent()) || '';
          const value = await option.getAttribute('value');
          if (label.toLowerCase().includes(deckFilter.toLowerCase()) && value) {
            await selectLocator.selectOption(value);
            selected = true;
            break;
          }
        }
        if (!selected) {
          throw new Error(`Could not find a deck matching "${deckFilter}" in AnkiWeb export options.`);
        }
      } else if (options.length > 1) {
        const firstValue = await selectLocator.locator('option').nth(1).getAttribute('value');
        if (firstValue) await selectLocator.selectOption(firstValue);
      }
    }

    const formatSelect = page.locator('select[name="format"], select[name="exportFormat"]').first();
    if ((await formatSelect.count()) > 0) {
      const allValues = await formatSelect.locator('option').evaluateAll((opts) => opts.map((o) => o.value));
      const txtOption = allValues.find((value) => /txt|text|note/i.test(value));
      if (txtOption) await formatSelect.selectOption(txtOption);
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Export")');
    const download = await downloadPromise;
    const exportPath = await download.path();
    if (!exportPath || !fs.existsSync(exportPath)) {
      throw new Error('AnkiWeb export did not produce a downloadable file.');
    }

    const raw = await fsp.readFile(exportPath, 'utf8');
    const deckName = deckFilter || 'AnkiWeb';
    const cards = parseTsvExport(raw, deckName);

    if (!cards.length) {
      throw new Error('The exported file contained no parseable cards.');
    }

    return cards;
  } finally {
    await browser.close();
  }
}

async function handleSync(req, res) {
  try {
    const raw = await readRequestBody(req);
    const body = JSON.parse(raw || '{}');
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const deckFilter = String(body.deckFilter || '').trim();

    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required.' });
    }

    const cards = await syncViaPlaywright({ email, password, deckFilter });
    return sendJson(res, 200, { cards });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Unexpected sync error.' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/sync') return handleSync(req, res);
  if (req.method === 'GET') return serveStatic(req, res);
  return sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`Anki Review Companion running at http://${HOST}:${PORT}`);
});
