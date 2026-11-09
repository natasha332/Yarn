const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SP = require('path').join(__dirname, '..') + '/';
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }), spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const st = () => fetch('http://localhost:4000/__state').then(r => r.json());
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`); };
const say = text => post('/__mode', { text });
const PRIYA = "Consult at Priya's house on the third of November at nine.";
async function open(b) {
  await post('/__reset');
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto('http://localhost:3000/login');
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123');
  await p.click('button[type=submit]');
  await p.waitForSelector('button[aria-label="Start recording"]'); await p.waitForSelector('text=Recent notes');
  return { ctx, p };
}
async function record(p) {
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200);
  await p.click('button[aria-label="Stop recording"]');
}
const total = async p => Number(((await p.locator('h2', { hasText: 'To check' }).innerText()).match(/\((\d+)\)/) || [])[1] || 0);
const waitTotal = (p, n) => p.waitForSelector(`text=To check (${n})`, { timeout: 25000 });
const warns = p => p.locator('[role=note]');
const card = (p, text) => p.locator('article', { hasText: text });

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('1. Recording the same note twice');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    ok('the first time, nothing is flagged', (await warns(p).count()) === 0);
    await record(p); await waitTotal(p, 4);
    ok('the second time, both new cards are flagged as repeats', (await warns(p).count()) === 2);
    const msg = await p.innerText('main');
    ok('the Talk screen says it looks like a repeat', msg.includes('This looks like a repeat of something already in Yarn'));
    ok('the warning names what it matches, with its date and time', (await warns(p).nth(0).innerText()).includes('Looks like a repeat of') && msg.includes('Tue 3 Nov · 9:00am'));
    ok('repeat cards offer "Discard repeat" and "Keep anyway"; the original still offers "Confirm"', (await p.getByRole('button', { name: 'Discard repeat' }).count()) === 2 && (await p.getByRole('button', { name: 'Keep anyway' }).count()) === 2 && (await p.getByRole('button', { name: 'Confirm', exact: true }).count()) === 2);
    ok('the repeated note gets "Discard all" and the original keeps "Confirm all"', (await p.getByRole('button', { name: 'Discard all' }).count()) === 1 && (await p.getByRole('button', { name: 'Confirm all' }).count()) === 1);
    await p.screenshot({ path: SP + 'dup-warning.png', fullPage: true });
    await p.getByRole('button', { name: 'Discard all' }).click();
    await waitTotal(p, 2);
    const s = await st(); ok('"Discard all" removed just the repeat, and kept the original 2 waiting', s.items.filter(i => i.status === 'discarded').length === 2 && s.items.filter(i => i.status === 'pending').length === 2);
    ok('the original cards carry no warning', (await warns(p).count()) === 0);
    await ctx.close(); }

  console.log('2. "Keep anyway" on a single repeat');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2); await record(p); await waitTotal(p, 4);
    const repeatJob = p.locator('article', { hasText: 'Looks like a repeat' }).filter({ hasText: 'Consultation' });
    await repeatJob.getByRole('button', { name: 'Keep anyway' }).click();
    await waitTotal(p, 3);
    const s = await st(); ok('it was confirmed (a second job made, because you said keep it)', s.madeJobs.length === 1);
    await ctx.close(); }

  console.log('3. Confirm all never confirms a repeat');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    await say('Consult at Priya\'s house on the third of November at nine PRIYAPLUS and order hinges tomorrow.');
    await record(p); await waitTotal(p, 5);
    ok('in the new note, the job and booking are flagged but the new to-do is not', (await warns(p).count()) === 2 && (await card(p, 'Order hinges').locator('[role=note]').count()) === 0);
    ok('that group offers "Confirm all", not "Discard all"', (await p.getByRole('button', { name: 'Discard all' }).count()) === 0);
    const group = p.locator('div.flex.flex-col.gap-3', { has: card(p, 'Order hinges') }).first();
    await group.getByRole('button', { name: 'Confirm all' }).click();
    await p.waitForSelector('text=skipped 2 possible repeats', { timeout: 15000 });
    const s = await st();
    ok('only the to-do was confirmed; the repeats were skipped and stay waiting', s.items.find(i => i.title === 'Order hinges').status === 'confirmed' && s.madeJobs.length === 0);
    ok('message says "Confirmed 1 card · skipped 2 possible repeats"', (await p.innerText('main')).includes('✓ Confirmed 1 card · skipped 2 possible repeats'));
    await ctx.close(); }

  console.log('4. Repeating something you already CONFIRMED');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    await p.getByRole('button', { name: 'Confirm all' }).click();
    await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    await record(p); await waitTotal(p, 2);
    ok('flagged, and says the original is confirmed', (await warns(p).count()) === 2 && (await warns(p).first().innerText()).includes('confirmed'));
    await ctx.close(); }

  console.log('5. Things that are NOT repeats are left alone');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    await say('PRIYALATER the same person but the afternoon');
    await record(p); await waitTotal(p, 3);
    ok('same person and day but a different time: not flagged', (await warns(p).count()) === 0);
    await say('Order the hinges tomorrow and chase Dave.'); await record(p); await waitTotal(p, 5);
    ok('a completely different note: not flagged', (await warns(p).count()) === 0);
    await ctx.close(); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
