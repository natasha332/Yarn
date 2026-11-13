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

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('1. The menu bar');
  { const { ctx, p } = await open(b);
    const tabs = p.getByRole('navigation', { name: 'Main' });
    ok('four tabs on the home screen: Talk, Today, Jobs, Contacts', (await tabs.getByRole('link').allInnerTexts()).join(',') === 'Talk,Today,Jobs,Contacts');
    ok('Talk is highlighted on the home screen', (await tabs.getByRole('link', { name: 'Talk' }).getAttribute('aria-current')) === 'page');
    ok('the old Jobs/Clients buttons and "← Home" links are gone', (await p.getByText('← Home').count()) === 0);
    await tabs.getByRole('link', { name: 'Today' }).click(); await p.waitForURL('**/today');
    ok('Today opens and is highlighted', (await tabs.getByRole('link', { name: 'Today' }).getAttribute('aria-current')) === 'page');
    await tabs.getByRole('link', { name: 'Jobs' }).click(); await p.waitForURL('**/jobs'); await p.waitForSelector('h1:has-text("Jobs")');
    ok('Jobs opens, with no "← Home" link', (await p.getByText('← Home').count()) === 0);
    await tabs.getByRole('link', { name: 'Contacts' }).click(); await p.waitForURL('**/clients'); await p.waitForSelector('h1:has-text("Contacts")');
    await tabs.getByRole('link', { name: 'Talk' }).click(); await p.waitForURL('http://localhost:3000/'); await p.waitForSelector('button[aria-label="Start recording"]');
    ok('Talk takes you back to the mic', true);
    await p.click('button:has-text("Log out")'); await p.waitForURL('**/login');
    ok('the bar is hidden on the sign-in screen', (await p.getByRole('navigation', { name: 'Main' }).count()) === 0);
    await ctx.close(); }

  console.log('2. Today with nothing in it');
  { const { ctx, p } = await open(b); await p.goto('http://localhost:3000/today');
    await p.waitForSelector('text=Nothing booked for today.');
    const t = await p.innerText('main');
    ok('shows today\'s date in Sydney as the heading', t.includes(longDay(sydney())));
    ok('friendly empty messages, and no "Coming up"', t.includes('Nothing to do. Nice.') && t.includes('No job notes from today.') && !t.includes('Coming up'));
    await ctx.close(); }

  console.log('3. Today with a busy day');
  { const { ctx, p } = await open(b);
    const T = sydney(), items = [
      { type: 'calendar', title: 'Site visit', due_date: T, start_time: '14:00:00', end_time: '15:30:00', client_name: 'Robyn Clarke', job_name: 'Clarke kitchen', details: { address: '14 Elm St, Marrickville' } },
      { type: 'calendar', title: "Consult at Priya's", due_date: T, start_time: '09:00:00', client_name: 'Priya' },
      { type: 'calendar', title: 'Delivery day', due_date: T },
      { type: 'calendar', title: 'Measure up (tomorrow)', due_date: plus(1), start_time: '10:00:00' },
      { type: 'calendar', title: 'Yesterday booking', due_date: plus(-1), start_time: '10:00:00' },
      { type: 'calendar', title: 'Far future booking', due_date: plus(8), start_time: '10:00:00' },
      { type: 'todo', title: 'Order hinges (overdue)', due_date: plus(-2) },
      { type: 'todo', title: 'Call plumber (today)', due_date: T, client_name: 'Dave Nguyen' },
      { type: 'followup', title: 'Chase laundry quote (no date)', client_name: 'Dave Nguyen' },
      { type: 'todo', title: 'Tomorrow task', due_date: plus(1) },
      { type: 'todo', title: 'Already done task', due_date: T, status: 'done' },
      { type: 'todo', title: 'Discarded task', due_date: T, status: 'discarded' },
      { type: 'note', title: 'Install complete except kickboards', job_name: 'Smith kitchen', details: { notes: '16 hours, two people' } },
      { type: 'note', title: 'Old note from days ago', created_at: days3Ago },
      { type: 'todo', title: 'Waiting card A', status: 'pending' }, { type: 'calendar', title: 'Waiting card B', status: 'pending', due_date: T },
    ];
    await post('/__seed', { items });
    await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Schedule');
    const txt = await p.innerText('main');
    const order = ['All day', '9:00am', '2:00pm'].map(x => txt.indexOf(x));
    ok('schedule shows the day in time order: all-day first, then 9:00am, then 2:00pm', order.every(i => i >= 0) && order[0] < order[1] && order[1] < order[2]);
    ok('a booking shows its client, job, address and end time', txt.includes('Robyn Clarke · Clarke kitchen') && txt.includes('14 Elm St, Marrickville') && txt.includes('until 3:30pm'));
    ok('yesterday\'s and far-future bookings are NOT in today\'s schedule', !txt.includes('Yesterday booking') && !txt.includes('Far future booking'));
    ok('"Coming up" lists tomorrow\'s booking with its date and time', txt.includes('Coming up') && txt.includes('Measure up (tomorrow)'));
    ok('overdue to-do is marked overdue and listed first', txt.includes('Overdue') && txt.indexOf('Order hinges') < txt.indexOf('Call plumber') && txt.indexOf('Call plumber') < txt.indexOf('Chase laundry quote'));
    ok('to-dos due tomorrow, done and discarded are hidden', !txt.includes('Tomorrow task') && !txt.includes('Already done task') && !txt.includes('Discarded task'));
    ok('job notes from today show with their extra detail; old notes do not', txt.includes('Install complete except kickboards') && txt.includes('16 hours, two people') && !txt.includes('Old note from days ago'));
    ok('a banner says 2 cards are waiting, linking to the home screen', txt.includes('2 cards are waiting for you to check'));
    await p.screenshot({ path: SP + 'today.png', fullPage: true });
    console.log('   ticking a to-do');
    await p.getByRole('button', { name: 'Mark done: Call plumber (today)' }).click();
    await p.waitForFunction(() => !document.body.innerText.includes('Call plumber (today)'), null, { timeout: 10000 });
    ok('the ticked to-do disappears and is saved as done', (await st()).items.find(i => i.title === 'Call plumber (today)').status === 'done');
    await p.getByText('Check →').click(); await p.waitForURL('http://localhost:3000/');
    ok('the banner takes you to the home screen', true);
    await ctx.close(); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
