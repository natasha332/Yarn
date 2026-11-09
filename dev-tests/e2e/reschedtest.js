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

const dialogs = [];
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
  const { ctx, p } = await open(b);
  const T = sydney();
  await post('/__seed', { items: [
    { type: 'calendar', title: "Consult at Priya's", due_date: T, start_time: '09:00:00', end_time: '10:00:00', client_name: 'Priya' },
    { type: 'calendar', title: 'Site visit', due_date: plus(1), start_time: '14:00:00', client_name: 'Robyn Clarke' },
    { type: 'calendar', title: 'Delivery day', due_date: plus(2) },
  ] });
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Schedule');
  const row = text => p.locator('li', { hasText: text });
  const btn = (text, name) => row(text).getByRole('button', { name });

  console.log('1. The buttons are there');
  ok('today\'s booking has Reschedule and Cancel booking', (await btn("Consult at Priya's", 'Reschedule').count()) === 1 && (await btn("Consult at Priya's", 'Cancel booking').count()) === 1);
  ok('so does a booking under Coming up', (await btn('Site visit', 'Reschedule').count()) === 1);

  console.log('2. Reschedule: move today\'s consult to tomorrow, 3:00pm to 4:30pm');
  await btn("Consult at Priya's", 'Reschedule').click();
  await p.getByRole('button', { name: 'Tomorrow', exact: true }).click(); await p.locator('input[type=time]').nth(0).fill('15:00'); await p.locator('input[type=time]').nth(1).fill('16:30');
  await p.getByRole('button', { name: 'Move it' }).click();
  await p.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('Moved'), null, { timeout: 10000 });
  const toast = await p.locator('[role=status]').innerText();
  ok('a message pops up: "✓ Moved “Consult at Priya\'s” to ... · 3:00pm"', toast.startsWith("✓ Moved “Consult at Priya's” to") && toast.endsWith('3:00pm'));
  await p.waitForFunction(() => document.querySelector('main').innerText.includes('Nothing booked for today.'), null, { timeout: 10000 });
  ok('it left today\'s schedule', true);
  const t2 = await p.innerText('main');
  ok('and now shows under Coming up for tomorrow at 3:00pm', t2.includes("Consult at Priya's") && t2.includes('3:00pm'));
  const s1 = await st(); const m = s1.items.find(i => i.title === "Consult at Priya's");
  ok('saved with the new day, start and end', m.due_date === plus(1) && m.start_time === '15:00:00' && m.end_time === '16:30:00' && m.status === 'confirmed');

  console.log('3. A bad time is refused with a clear message, and nothing changes');
  await btn('Site visit', 'Reschedule').click();
  await p.locator('input[type=time]').nth(0).fill('15:00'); await p.locator('input[type=time]').nth(1).fill('14:00');
  await p.getByRole('button', { name: 'Move it' }).click();
  await p.waitForSelector('text=The end time has to be after the start time', { timeout: 10000 });
  ok('error shown, and the form stays open to fix it', (await p.getByRole('button', { name: 'Move it' }).count()) === 1);
  ok('the booking was not changed', (await st()).items.find(i => i.title === 'Site visit').start_time === '14:00:00');
  await p.getByRole('button', { name: 'Never mind' }).click();
  ok('"Never mind" closes the form', (await p.getByRole('button', { name: 'Move it' }).count()) === 0);

  console.log('4. Make a booking all-day by clearing its times');
  await btn('Site visit', 'Reschedule').click();
  await p.locator('input[type=time]').nth(0).fill(''); await p.locator('input[type=time]').nth(1).fill('');
  await p.getByRole('button', { name: 'Move it' }).click();
  await p.waitForFunction(() => document.querySelector('main').innerText.includes('All day'), null, { timeout: 10000 });
  const sv = (await st()).items.find(i => i.title === 'Site visit'); ok('now an all-day booking', sv.start_time === null && sv.end_time === null);

  console.log('5. Cancel');
  await btn('Delivery day', 'Cancel booking').click();
  await p.waitForFunction(() => !document.querySelector('main').innerText.includes('Delivery day'), null, { timeout: 10000 });
  ok('it asked first, naming the booking and when', dialogs.some(d => d.startsWith('Cancel “Delivery day”')));
  ok('a message pops up: "✓ Cancelled “Delivery day”"', (await p.locator('[role=status]').innerText()) === '✓ Cancelled “Delivery day”');
  const dd = (await st()).items.find(i => i.title === 'Delivery day');
  ok('kept as a cancelled record, not wiped', dd.status === 'discarded' && !!dd.details.cancelled_at);
  p.removeAllListeners('dialog'); p.on('dialog', d => { dialogs.push('DISMISSED ' + d.message()); d.dismiss(); });
  await btn('Site visit', 'Cancel booking').click(); await p.waitForTimeout(800);
  ok('saying no at the question keeps the booking', (await st()).items.find(i => i.title === 'Site visit').status === 'confirmed' && (await row('Site visit').count()) === 1);

  await ctx.close(); await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
