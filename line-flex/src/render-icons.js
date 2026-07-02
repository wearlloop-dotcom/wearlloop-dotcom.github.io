// render ไอคอน SVG → PNG โปร่งใส 400x400 (NODE_PATH=<global node_modules> node render-icons.js)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = path.join(__dirname, '..');
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 300, height: 300 } });
  await p.goto('file://' + path.join(__dirname, 'icon-generator.html'));
  await p.waitForTimeout(400);
  for (const t of await p.$$('.tile')) {
    const id = await t.getAttribute('id');
    await t.screenshot({ path: path.join(out, 'icon-' + id.replace('tile-', '') + '.png'), omitBackground: true });
  }
  await b.close();
})();
