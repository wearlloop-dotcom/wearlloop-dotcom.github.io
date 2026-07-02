const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const outDir = '/home/user/wearlloop-dotcom.github.io/line-flex';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 900, height: 500 } });
  await page.goto('file://' + path.join(__dirname, 'art.html'));
  const tiles = await page.$$('.tile');
  for (const t of tiles) {
    const id = await t.getAttribute('id');
    const name = id.replace('tile-', '');
    await t.screenshot({ path: path.join(outDir, name + '.png') });
    console.log('rendered', name);
  }
  await browser.close();
})();
