// Settings: folded rows with a summary, the right area stays open after Save, Save shows it's been pressed.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const KEY = 'a-long-random-secret-from-a-password-manager-1234';
const SP = require('path').join(__dirname, '..') + '/';
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: KEY };
const procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }), spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  p.on('pageerror', e => { fails++; console.log('  PAGE ERROR', e.message); });
  await post('/__bizreset'); await post('/__googlereset');
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]'); await p.waitForSelector('text=Recent notes');

  console.log('1. Settings starts as a short list of rows');
  await p.goto('http://localhost:3000/settings'); await p.waitForSelector('h2:has-text("Daily briefing")');
  const titles = await p.locator('main > section h2, main section > details > summary h2').allInnerTexts();
  ok('four areas: briefing, client emails, calendar, Gmail', ['Daily briefing', 'Emails to clients', 'Google Calendar', 'Gmail'].every(t => titles.includes(t)));
  ok('all folded up to begin with', await p.locator('details[open]').count() === 0);
  const sums = await p.locator('summary').allInnerTexts();
  ok('briefing row says when and how: "Morning 7:00am · Wrap-up 5:00pm · Email"', sums.some(t => /Morning 7:00am · Wrap-up 5:00pm · Email/.test(t)));
  ok('calendar row says Not connected', sums.some(t => /Google Calendar[\s\S]*Not connected/.test(t)));
  ok('the Save button is not on screen until its area is opened', !(await p.getByRole('button', { name: 'Save', exact: true }).first().isVisible()));
  await p.screenshot({ path: SP + 'settings-folded.png' });

  console.log('2. Open an area, change it, Save');
  await p.locator('summary', { hasText: 'Daily briefing' }).click();
  ok('opens', await p.locator('details[open]').count() === 1);
  await p.locator('input[name=morning_time]').fill('06:15');
  const save = p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true });
  // slow the save down a touch so we can look at the button while it's working
  await p.route('**/settings', async route => { await new Promise(r => setTimeout(r, 900)); route.continue(); });
  await save.click();
  await p.waitForSelector('button[aria-busy=true]');
  const busy = p.locator('button[aria-busy=true]');
  ok('while saving the button says "Saving…"', (await busy.innerText()).includes('Saving'));
  ok('and is dimmed and locked', await busy.isDisabled() && Number(await busy.evaluate(e => getComputedStyle(e).opacity)) < 0.8);
  await p.screenshot({ path: SP + 'settings-saving.png' });
  await p.waitForSelector('text=Saved.');
  await p.unroute('**/settings');
  ok('that area is still open after saving, and the others are folded', await p.locator('details[open]').count() >= 1 && await p.locator('section', { hasText: 'Daily briefing' }).locator('details[open]').count() >= 1 && await p.locator('section', { hasText: 'Emails to clients' }).locator('> details[open]').count() === 0);
  ok('the row summary shows the new time', (await p.locator('summary', { hasText: 'Daily briefing' }).innerText()).includes('6:15am'));
  await p.screenshot({ path: SP + 'settings-open.png' });

  console.log('3. A plain button shrinks and darkens while pressed');
  await p.locator('summary', { hasText: 'Emails to clients' }).click();
  const btn = p.locator('section', { hasText: 'Emails to clients' }).getByRole('button', { name: 'Save', exact: true });
  await btn.scrollIntoViewIfNeeded(); const box = await btn.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(250);
  const during = await btn.evaluate(e => ({ scale: getComputedStyle(e).scale, filter: getComputedStyle(e).filter }));
  await p.mouse.up();
  ok(`pressed look: scale ${during.scale}, ${during.filter}`, during.scale !== 'none' && Number(during.scale) < 1 && during.filter.includes('brightness'));

  console.log('4. Fits a small phone');
  const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok('no sideways scrolling at 360px', w.sw <= w.cw);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await b.close(); stopAll(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
