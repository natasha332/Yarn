const { chromium } = require('playwright');
const { spawn } = require('child_process');
const KEY = 'a-long-random-secret-from-a-password-manager-1234';
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: KEY };
const pr = spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' });
const stopAll = () => { try { process.kill(-pr.pid); } catch {} };
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await post('/__bizreset'); await post('/__googlereset');
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]');
  await p.waitForSelector('text=Recent notes');
  const open = async (q = '') => { await p.goto('http://localhost:3000/settings' + q); await p.waitForSelector('h2:has-text("Daily briefing")'); };
  const mt = () => p.locator('input[name=morning_time]'), wt = () => p.locator('input[name=wrapup_time]');
  const on = n => p.locator(`input[name=${n}]`).isChecked();

  console.log('1. Defaults');
  await open();
  ok('morning briefing on at 07:00', (await on('morning_on')) && (await mt().inputValue()) === '07:00');
  ok('wrap-up on at 17:00 (5pm)', (await on('wrapup_on')) && (await wt().inputValue()) === '17:00');
  ok('timezone is mentioned', await p.locator('text=Australia/Sydney').count() >= 1);
  ok('not connected to Google -> goes to the login email', await p.locator('b:has-text("natasha@example.com")').count() === 1);
  await p.screenshot({ path: (process.env.SP || require('path').join(__dirname, '..') + '/') + 'settings-daily.png', fullPage: true });

  console.log('2. Connected to Google -> goes to the calendar account');
  await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'calendar.person@gmail.com', refresh_token_enc: 'x', connected_at: new Date().toISOString() });
  await open();
  const daily = p.locator('section', { hasText: 'Daily briefing' });
  ok('emails go to the Google account', await daily.locator('b:has-text("calendar.person@gmail.com")').count() === 1 && await daily.locator('b:has-text("natasha@example.com")').count() === 0);

  console.log('3. Change the times and save');
  await mt().fill('06:30'); await wt().fill('16:45'); await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click();
  await p.waitForSelector('text=Saved.');
  let biz = await get('/__biz');
  ok('saved morning 06:30 and wrap-up 16:45, both on', biz.settings.morning_email_time === '06:30' && biz.settings.wrapup_time === '16:45' && biz.settings.morning_enabled === true && biz.settings.wrapup_mode === 'end_of_day');
  await open();
  ok('shows what was saved after a reload', (await mt().inputValue()) === '06:30' && (await wt().inputValue()) === '16:45');

  console.log('4. Turn the wrap-up off');
  await p.locator('input[name=wrapup_on]').uncheck(); await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForSelector('text=Saved.');
  biz = await get('/__biz');
  ok("wrap-up 'off' (time kept)", biz.settings.wrapup_mode === 'off' && biz.settings.wrapup_time === '16:45' && biz.settings.morning_enabled === true);
  await open();
  ok('box stays unticked after reload', !(await on('wrapup_on')) && (await on('morning_on')));

  console.log('5. Turn the morning briefing off, wrap-up back on');
  await p.locator('input[name=morning_on]').uncheck(); await p.locator('input[name=wrapup_on]').check(); await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForSelector('text=Saved.');
  biz = await get('/__biz');
  ok('morning off, wrap-up on', biz.settings.morning_enabled === false && biz.settings.wrapup_mode === 'end_of_day');

  console.log('6. Bad input and failures');
  await open();
  const before = (await get('/__biz')).patches.length;
  await p.evaluate(() => document.querySelectorAll('input[type=time]').forEach(i => i.removeAttribute('required')));
  await mt().fill(''); await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click();
  await p.waitForSelector('text=Pick a time for each one');
  ok('empty time refused, nothing saved', (await get('/__biz')).patches.length === before);
  await post('/__bizfail'); await open(); await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click();
  await p.waitForSelector("text=That didn't save");
  ok('save failure is reported', true);

  console.log('6b. The message is on screen right after tapping Save (not off the top of the card)');
  await post('/__bizreset'); await open();
  await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
  await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForSelector('text=Saved.');
  await p.waitForTimeout(600); const inView = await p.locator('[role=status]').evaluateAll(els => els.some(el => { const r = el.getBoundingClientRect(); return el.textContent.includes('Saved') && r.top >= 0 && r.bottom <= window.innerHeight; }));
  ok('"Saved." pops up on screen without scrolling', inView);

  console.log('7. Fits a small phone');
  await post('/__bizreset'); await open();
  const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok('no sideways scrolling at 390px', w.sw <= w.cw);

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
