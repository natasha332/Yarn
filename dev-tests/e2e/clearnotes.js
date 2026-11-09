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

const notesIn = p => p.locator('section', { has: p.locator('h2', { hasText: 'Recent notes' }) }).locator('li');
const hasNote = async (p, text) => (await notesIn(p).filter({ hasText: text }).count()) > 0;
const confirmBtn = c => c.getByRole('button', { name: 'Confirm', exact: true });

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('1. A note clears off the home screen once ALL its cards are approved');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    ok('while its cards are waiting, the note is listed', await hasNote(p, "Consult at Priya's house"));
    await confirmBtn(card(p, 'Consultation')).click(); await waitTotal(p, 1);
    ok('after approving only one of two cards, the note is still there', await hasNote(p, "Consult at Priya's house"));
    await confirmBtn(card(p, "Consult at Priya's")).click();
    await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    await p.waitForFunction(() => ![...document.querySelectorAll('section li')].some(l => l.innerText.includes("Consult at Priya's house")), null, { timeout: 15000 });
    ok('after approving the last card, the note is gone from the list (no reload needed)', !(await hasNote(p, "Consult at Priya's house")));
    ok('older notes with no cards are untouched', await hasNote(p, 'Order six soft-close hinges'));
    await p.reload(); await p.waitForSelector('text=Recent notes');
    ok('and it stays gone after reopening', !(await hasNote(p, "Consult at Priya's house")));
    const s = await st();
    ok('nothing was deleted: the recording, its words and the confirmed cards are all still saved', Object.values(s.captures).some(c => (c.transcript || '').includes('Priya')) && Object.keys(s.files).some(f => f.includes(Object.values(s.captures).find(c => (c.transcript || '').includes('Priya')).id)) && s.items.every(i => i.status === 'confirmed'));
    await ctx.close(); }

  console.log('2. "Confirm all" clears it too');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    await p.getByRole('button', { name: 'Confirm all' }).click();
    await p.waitForFunction(() => ![...document.querySelectorAll('section li')].some(l => l.innerText.includes("Consult at Priya's house")), null, { timeout: 15000 });
    ok('note cleared after Confirm all', true); await ctx.close(); }

  console.log('3. A single-card note clears after its card is approved');
  { const { ctx, p } = await open(b); await say('Order the hinges tomorrow please');
    await record(p); await p.waitForSelector('text=To check (2)', { timeout: 25000 });
    ok('listed while waiting', await hasNote(p, 'Order the hinges tomorrow'));
    await confirmBtn(card(p, 'Order soft-close hinges')).click(); await waitTotal(p, 1);
    ok('still listed while its other card (the follow-up) waits', await hasNote(p, 'Order the hinges tomorrow'));
    await confirmBtn(card(p, 'Chase laundry quote')).click();
    await p.waitForFunction(() => ![...document.querySelectorAll('section li')].some(l => l.innerText.includes('Order the hinges tomorrow')), null, { timeout: 15000 });
    ok('cleared once both are approved', true); await ctx.close(); }

  console.log('4. Notes that were only DISCARDED, or had no cards, stay (so nothing is lost by accident)');
  { const { ctx, p } = await open(b); await say(PRIYA);
    await record(p); await waitTotal(p, 2);
    await p.getByRole('button', { name: 'Discard', exact: true }).first().click(); await waitTotal(p, 1);
    await p.getByRole('button', { name: 'Discard', exact: true }).first().click();
    await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    ok('a fully discarded note stays listed, with its Delete button', await hasNote(p, "Consult at Priya's house"));
    await say('Just testing the microphone.'); await record(p);
    await p.waitForSelector('text=Nothing to sort in this one', { timeout: 20000 });
    for (let i = 0; i < 20 && !(await hasNote(p, 'Just testing the microphone')); i++) await p.waitForTimeout(250);
    ok('a note with nothing to sort stays listed too', await hasNote(p, 'Just testing the microphone'));
    await ctx.close(); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
