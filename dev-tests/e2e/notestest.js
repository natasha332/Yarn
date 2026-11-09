const { chromium } = require('playwright');
const FAKE = 'http://localhost:4000';
const out = '/home/user/Yarn/dev-tests/';
const post = (path, body) => fetch(FAKE + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
(async () => {
  await post('/__reset');
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await p.goto('http://localhost:3000/login');
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Recent notes', { timeout: 15000 });
  const items = () => p.$$eval('section li', lis => lis.map(l => l.innerText.replace(/\n+/g, ' | ')));
  console.log('1. list on first load:'); (await items()).forEach(t => console.log('   -', t.slice(0, 150)));
  await p.screenshot({ path: out + 'notes-list.png', fullPage: true });

  console.log('2. tap the long note to open it');
  await p.click('section li:first-child summary');
  console.log('   opened text length:', (await p.innerText('section li:first-child')).length);

  console.log('3. fix the failed note with "Write it down"');
  await p.click('section li:has-text("didn\'t get written down") button:has-text("Write it down")');
  await p.waitForFunction(() => !document.body.innerText.includes("didn't get written down"), null, { timeout: 15000 });
  console.log('   failed note gone from the list, items now:'); (await items()).forEach(t => console.log('   -', t.slice(0, 110)));

  console.log('4. record a new note: it should appear at the top without reloading');
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200);
  await p.click('button[aria-label="Stop recording"]');
  await p.waitForSelector('text=What you said', { timeout: 15000 });
  await p.waitForFunction(() => document.querySelectorAll('section li').length === 4, null, { timeout: 15000 });
  const now = await items();
  console.log('   list has', now.length, 'notes; newest:', now[0].slice(0, 130));
  await b.close();
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); process.exit(1); });
