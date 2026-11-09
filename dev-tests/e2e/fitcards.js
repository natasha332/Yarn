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

const sydney = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const plus = (n) => { const [y, m, d] = sydney().split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const longDay = ds => { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); const f = o => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...o }).format(dt); return `${f({ weekday: 'long' })} ${f({ day: 'numeric' })} ${f({ month: 'long' })}`; };
const days3Ago = new Date(Date.now() - 3 * 86400e3).toISOString();


// Does anything poke out past the edge of the screen?
const overflow = (p, selector) => p.evaluate(sel => {
  const W = document.documentElement.clientWidth;
  const root = document.querySelector(sel);
  const bad = [...root.querySelectorAll('input, select, textarea, button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > W - 4); })
    .map(e => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} ${Math.round(e.getBoundingClientRect().left)}-${Math.round(e.getBoundingClientRect().right)} of ${W}`);
  const rr = root.getBoundingClientRect();
  return { pageScrollsSideways: document.documentElement.scrollWidth > W + 1, formRight: Math.round(rr.right), screen: W, bad };
}, selector);

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
  const { ctx, p } = await open(b);
  const snap = (id, title, date, start, client) => ({ id, title, date, start, end: null, client });
  const long1 = snap('b1', "Consultation and measure-up at the Papadopoulos-Fitzgerald residence", '2026-11-03', '09:00', 'Alexandra Papadopoulos-Fitzgerald');
  const long2 = snap('b2', 'Site visit', '2026-11-04', '14:00', 'Dave Nguyen');
  await post('/__seed', { items: [
    { type: 'reschedule', title: "Move Consultation and measure-up at the Papadopoulos-Fitzgerald residence", status: 'pending', due_date: '2026-11-12', start_time: '14:00:00', end_time: '15:30:00', details: { target_item_id: 'b1', target: long1, target_options: [] } },
    { type: 'cancel', title: 'Cancel Site visit', status: 'pending', details: { target_item_id: 'b2', target: long2, target_options: [] } },
    { type: 'reschedule', title: 'Move a booking', status: 'pending', due_date: '2026-11-12', start_time: '10:00:00', details: { target_item_id: null, target: null, target_options: [long1, long2] } },
  ] });
  for (const width of [320, 360, 390]) {
    await p.setViewportSize({ width, height: 800 });
    await p.goto('http://localhost:3000/'); await p.waitForSelector('text=To check');
    const r = await p.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('article')].flatMap(a => [...a.querySelectorAll('button, p, h3, span')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > W - 2); }).map(e => e.tagName.toLowerCase() + ':' + (e.textContent || '').slice(0, 30)));
      return { sideways: document.documentElement.scrollWidth > W + 1, bad, cards: document.querySelectorAll('article').length };
    });
    ok(`at ${width}px: 3 cards, nothing sticks out past the edge${r.bad.length ? ' (' + r.bad.join('; ') + ')' : ''}`, r.cards === 3 && !r.sideways && r.bad.length === 0);
    if (width === 360) await p.screenshot({ path: SP + 'voice-cards-360.png', fullPage: true });
    // the edit form for the reschedule card
    await p.locator('article', { hasText: 'Papadopoulos' }).first().getByRole('button', { name: 'Edit' }).click();
    const o = await p.evaluate(() => { const W = document.documentElement.clientWidth; const f = document.querySelector('form'); return { sideways: document.documentElement.scrollWidth > W + 1, bad: [...f.querySelectorAll('input, button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > W - 4); }).length }; });
    ok(`at ${width}px: the Edit form for a reschedule fits`, !o.sideways && o.bad === 0);
    await p.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await ctx.close(); await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
