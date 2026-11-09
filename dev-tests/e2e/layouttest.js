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
  const T = sydney();
  await post('/__seed', { items: [
    { type: 'calendar', title: "Consult at Priya's", due_date: T, start_time: '09:00:00', end_time: '10:00:00', client_name: 'Priya', details: { address: '22 Carrington Rd, Randwick' } },
    { type: 'calendar', title: 'Site visit', due_date: plus(1), start_time: '14:00:00', client_name: 'Robyn Clarke' },
    { type: 'calendar', title: 'Waiting booking', status: 'pending', due_date: plus(2), start_time: '11:00:00', details: { address: '5 Hill St, Leichhardt' } },
    { type: 'job', title: 'Kitchen renovation', status: 'pending', details: { job_status: 'consultation', new_client: { name: 'Mark Ellis', phone: '0412 345 678' }, address: '5 Hill St, Leichhardt' } },
    { type: 'todo', title: 'Order the hinges', status: 'pending', details: { notes: 'soft-close, six pairs' } },
  ] });

  for (const width of [320, 360, 390]) {
    console.log(`Phone width ${width}px`);
    await p.setViewportSize({ width, height: 800 });

    await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Schedule');
    await p.locator('li', { hasText: "Consult at Priya's" }).getByRole('button', { name: 'Reschedule' }).click();
    await p.waitForSelector('text=New day');
    const form = p.locator('form', { hasText: 'New day' });
    await form.evaluate(el => el.setAttribute('data-test', 'resched'));
    let o = await overflow(p, '[data-test=resched]');
    ok(`Reschedule form (today's booking) fits: ${o.bad.length ? o.bad.join('; ') : 'nothing sticks out'}`, !o.pageScrollsSideways && o.bad.length === 0);
    if (width === 360) await p.screenshot({ path: SP + 'resched-360.png', fullPage: true });
    await p.getByRole('button', { name: 'Never mind' }).click();

    await p.locator('li', { hasText: 'Site visit' }).getByRole('button', { name: 'Reschedule' }).click();
    await p.waitForSelector('text=New day');
    await p.locator('form', { hasText: 'New day' }).evaluate(el => el.setAttribute('data-test', 'resched2'));
    o = await overflow(p, '[data-test=resched2]');
    ok(`Reschedule form (Coming up booking) fits`, !o.pageScrollsSideways && o.bad.length === 0);
    await p.getByRole('button', { name: 'Never mind' }).click();

    await p.goto('http://localhost:3000/'); await p.waitForSelector('text=To check');
    for (const [title, label] of [['Waiting booking', 'booking'], ['Kitchen renovation', 'new job'], ['Order the hinges', 'to-do']]) {
      await p.locator('article', { hasText: title }).getByRole('button', { name: 'Edit' }).click();
      const f = p.locator('form', { hasText: 'Editing' }); await f.evaluate(el => el.setAttribute('data-test', 'editcard'));
      o = await overflow(p, '[data-test=editcard]');
      ok(`Edit form for the ${label} card fits`, !o.pageScrollsSideways && o.bad.length === 0);
      if (width === 360 && label === 'booking') await p.screenshot({ path: SP + 'editcard-360.png', fullPage: true });
      await f.getByRole('button', { name: 'Cancel' }).click();
    }
  }
  await ctx.close(); await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
