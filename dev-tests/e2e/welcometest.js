// The "How Yarn works" tour: steps through, no sideways scroll, Skip and Start work, Settings links to it.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SP = require('path').join(__dirname, '..') + '/';
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }), spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`); };
(async () => {
  await new Promise(r => setTimeout(r, 6000));
  await fetch('http://localhost:4000/__reset', { method: 'POST', body: '{}' });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', e => { fails++; console.log('  PAGE ERROR', e.message); });
  await p.goto('http://localhost:3000/login');
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123');
  await p.click('button[type=submit]');
  await p.waitForSelector('button[aria-label="Start recording"]');
  await p.goto('http://localhost:3000/welcome');
  await p.waitForSelector('text=Talk, don\'t type.');
  ok('no bottom menu on the tour', (await p.locator('nav').count()) === 0);
  ok('Skip link shown on the first step', await p.locator('a', { hasText: 'Skip' }).count() === 1);
  await p.screenshot({ path: SP + 'welcome1.png' });
  const titles = ["Yarn sorts it for you.", "Your calendar keeps up.", "Today, at a glance.", "Emails, written for you.", "A morning briefing, and a wrap-up."];
  for (const t of titles) {
    await p.click('button:has-text("Next")');
    await p.waitForSelector(`h1:has-text("${t}")`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`"${t}" fits the screen`, !wide);
  }
  await p.screenshot({ path: SP + 'welcome6.png' });
  ok('last step has Start talking and no Skip', await p.locator('a', { hasText: 'Start talking' }).count() === 1 && await p.locator('a', { hasText: 'Skip' }).count() === 0);
  await p.click('button:has-text("Back")');
  await p.waitForSelector('h1:has-text("Emails, written for you.")');
  ok('Back goes to the previous step', true);
  await p.goto('http://localhost:3000/welcome');
  await p.click('a:has-text("Skip")');
  await p.waitForSelector('button[aria-label="Start recording"]');
  ok('Skip goes to the Talk screen', true);
  await p.goto('http://localhost:3000/settings');
  await p.click('a:has-text("How Yarn works")');
  await p.waitForSelector('text=Talk, don\'t type.');
  ok('Settings links to the tour', p.url().endsWith('/welcome'));
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await b.close(); stopAll(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); stopAll(); process.exit(1); });
