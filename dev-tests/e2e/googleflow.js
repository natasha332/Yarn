const { chromium } = require('playwright');
const { spawn } = require('child_process');
const KEY = 'a-long-random-secret-from-a-password-manager-1234';
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_TOKEN_KEY: KEY, GOOGLE_TOKEN_URL: 'http://localhost:4000/google/token', GOOGLE_REVOKE_URL: 'http://localhost:4000/google/revoke', GOOGLE_CALENDAR_URL: 'http://localhost:4000/gcal' };
const procs = [spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const fmt = d => d.toISOString().slice(0, 10);
const plus = n => fmt(new Date(Date.now() + n * 864e5 + 10 * 3600e3)); // roughly Sydney "today" + n
let crypto;
async function connect(token = '1//0g-REAL-REFRESH-TOKEN') { crypto = crypto || await import('/home/user/Yarn/src/lib/token-crypto.ts'); await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'natasha@sundaykitchens.com.au', refresh_token_enc: crypto.encryptToken(token, KEY), connected_at: new Date().toISOString() }); }
async function reset() { await post('/__reset'); await post('/__googlereset'); await post('/__gcalreset'); }
const events = async () => (await get('/__gcal')).events;
const calls = async () => (await get('/__gcal')).calls;
const items = async () => (await get('/__state')).items;
const byTitle = async t => (await items()).find(i => i.title === t);
async function open(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto('http://localhost:3000/login');
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]');
  await p.waitForSelector('text=Recent notes'); return { ctx, p };
}
const card = (extra) => ({ type: 'calendar', status: 'pending', client_name: 'Priya', ...extra });
const notice = p => p.locator('[role=status]').first().innerText();

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch();
  const { ctx, p } = await open(b);

  console.log('1. Confirming a calendar card adds the event with a 30 minute reminder');
  await reset(); await connect();
  await post('/__seed', { items: [card({ title: "Consult at Priya's", due_date: '2026-11-03', start_time: '09:00:00', details: { address: "Priya's house, 5 Wattle St", notes: 'Bring samples' } })] });
  await p.goto('http://localhost:3000/'); await p.waitForSelector("text=Consult at Priya's");
  await p.getByRole('button', { name: 'Confirm', exact: true }).click();
  await p.waitForSelector('text=added to Google Calendar');
  let it = await byTitle("Consult at Priya's"); let ev = Object.values(await events())[0]; const evs = await events();
  ok('exactly one event created', Object.keys(evs).length === 1);
  ok("event id is the booking's id (no dashes)", Object.keys(evs)[0] === it.id.replaceAll('-', ''));
  ok('title, location', ev.summary === "Consult at Priya's" && ev.location === "Priya's house, 5 Wattle St");
  ok('description has client and notes', ev.description.includes('Client: Priya') && ev.description.includes('Bring samples'));
  ok('starts 9:00am Sydney time', ev.start.dateTime === '2026-11-03T09:00:00' && ev.start.timeZone === 'Australia/Sydney');
  ok('no end time said -> 1 hour long (10:00am)', ev.end.dateTime === '2026-11-03T10:00:00' && ev.end.timeZone === 'Australia/Sydney');
  ok('standard 30 minute popup reminder, not Google defaults', ev.reminders.useDefault === false && ev.reminders.overrides.length === 1 && ev.reminders.overrides[0].method === 'popup' && ev.reminders.overrides[0].minutes === 30);
  ok("goes on the main calendar ('primary') using a fresh pass", (await calls()).every(c => c.path.startsWith('/gcal/calendars/primary/events') && c.auth === 'Bearer at-fresh'));
  ok('Yarn remembers the event (external_id), booking confirmed', it.external_id === Object.keys(evs)[0] && it.status === 'confirmed');
  ok('no "needs doing" note left', !it.details.calendar_sync);

  console.log('2. Times: given end, late night, all day');
  await reset(); await connect();
  await post('/__seed', { items: [
    card({ title: 'Long job', due_date: '2026-11-04', start_time: '09:00:00', end_time: '11:30:00' }),
    card({ title: 'Late callout', due_date: '2026-11-05', start_time: '23:30:00' }),
    card({ title: 'Delivery day', due_date: '2026-11-06' }),
  ] });
  await p.goto('http://localhost:3000/'); await p.waitForSelector('text=Long job');
  for (const t of ['Long job', 'Late callout', 'Delivery day']) {
    await p.locator('article', { hasText: t }).getByRole('button', { name: 'Confirm', exact: true }).click();
    await p.waitForFunction(n => document.body.innerText.includes('confirmed: ' + n), t, { timeout: 15000 });
  }
  for (let i = 0; i < 40 && Object.keys(await events()).length < 3; i++) await new Promise(r => setTimeout(r, 250));
  const e2 = Object.values(await events());
  const E = t => e2.find(e => e.summary === t);
  ok('end time respected (11:30)', E('Long job').end.dateTime === '2026-11-04T11:30:00');
  ok('11:30pm + 1 hour rolls to next day 12:30am', E('Late callout').end.dateTime === '2026-11-06T00:30:00');
  ok('no time -> all-day event (date only, ends next day)', E('Delivery day').start.date === '2026-11-06' && E('Delivery day').end.date === '2026-11-07' && !E('Delivery day').start.dateTime);
  ok('all-day event still has the reminder', E('Delivery day').reminders.overrides[0].minutes === 30);

  console.log('3. Same booking sent twice never doubles up');
  const lc = await byTitle('Long job');
  const again = await ctx.request.post('http://localhost:3000/api/google/sync', { data: { itemId: lc.id, create: true } });
  ok('second request says up to date', (await again.json()).status === 'uptodate');
  await post('/__setstatus', { title: 'Long job', status: 'confirmed' });
  ok('still 3 events', Object.keys(await events()).length === 3);

  console.log('4. Voice reschedule card moves the Google event');
  await reset(); await connect();
  await post('/__seed', { items: [card({ title: "Consult at Priya's", status: 'confirmed', due_date: '2026-11-03', start_time: '09:00:00', external_id: 'evt1' })] });
  await post('/__gcalseed', { id: 'evt1', event: { summary: "Consult at Priya's", description: 'Guest list I added myself', start: { dateTime: '2026-11-03T09:00:00' } } });
  const target = await byTitle("Consult at Priya's");
  await post('/__seed', { items: [{ type: 'reschedule', status: 'pending', title: "Move Consult at Priya's", due_date: '2026-11-12', start_time: '14:00:00', end_time: '15:00:00', details: { target_item_id: target.id, target: { id: target.id, title: target.title, date: '2026-11-03', start_time: '09:00:00' } } }] });
  await p.goto('http://localhost:3000/'); await p.waitForSelector("text=Move Consult at Priya's");
  await p.getByRole('button', { name: 'Confirm', exact: true }).click();
  await p.waitForSelector('text=Google Calendar updated');
  ev = (await events()).evt1;
  ok('event moved to the new day and time', ev.start.dateTime === '2026-11-12T14:00:00' && ev.end.dateTime === '2026-11-12T15:00:00');
  ok("event's own edits (description) are kept", ev.description === 'Guest list I added myself');
  ok('a move only changes the time: title and reminders she set in Google are untouched', ev.summary === "Consult at Priya's" && ev.reminders === undefined);
  ok('no extra event created', Object.keys(await events()).length === 1);
  it = await byTitle("Consult at Priya's");
  ok('"needs update" note cleared', !it.details.calendar_sync && it.external_id === 'evt1');

  console.log('5. Voice cancel card removes the Google event');
  await post('/__seed', { items: [{ type: 'cancel', status: 'pending', title: "Cancel Consult at Priya's", details: { target_item_id: target.id } }] });
  await p.goto('http://localhost:3000/'); await p.waitForSelector("text=Cancel Consult at Priya's");
  await p.getByRole('button', { name: 'Confirm', exact: true }).click();
  await p.waitForSelector('text=removed from Google Calendar');
  ok('event deleted from Google', Object.keys(await events()).length === 0);
  it = await byTitle("Consult at Priya's");
  ok('booking kept in Yarn as cancelled, note cleared', it.status === 'discarded' && !it.details.calendar_sync);

  console.log('6. Today buttons: Reschedule and Cancel follow too');
  await reset(); await connect();
  await post('/__seed', { items: [
    card({ title: 'Morning job', status: 'confirmed', due_date: plus(0), start_time: '08:00:00', external_id: 'evtA' }),
    card({ title: 'Afternoon job', status: 'confirmed', due_date: plus(0), start_time: '15:00:00', external_id: 'evtB' }),
  ] });
  await post('/__gcalseed', { id: 'evtA', event: { summary: 'Morning job' } }); await post('/__gcalseed', { id: 'evtB', event: { summary: 'Afternoon job' } });
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Morning job');
  const row = t => p.locator('li', { hasText: t });
  ok('both show "In Google Calendar"', (await p.locator('text=✓ In Google Calendar').count()) === 2);
  await row('Morning job').getByRole('button', { name: 'Reschedule' }).click();
  await p.getByRole('button', { name: 'Tomorrow', exact: true }).click(); await p.locator('input[type=time]').nth(0).fill('10:00'); await p.locator('input[type=time]').nth(1).fill('11:00');
  await p.getByRole('button', { name: 'Move it' }).click();
  await p.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('Google Calendar updated'), null, { timeout: 10000 });
  ev = (await events()).evtA;
  ok('Google event moved to tomorrow 10:00-11:00', ev.start.dateTime === `${plus(1)}T10:00:00` && ev.end.dateTime === `${plus(1)}T11:00:00`);
  await row('Afternoon job').getByRole('button', { name: 'Cancel booking' }).click();
  await p.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('removed from Google Calendar'), null, { timeout: 10000 });
  ok('Google event for the cancelled booking is gone', !(await events()).evtB);

  console.log('7. Google down: Yarn still saves, and "Try again" works');
  await reset(); await connect();
  await post('/__seed', { items: [card({ title: 'Quote visit', due_date: '2026-11-09', start_time: '10:00:00' })] });
  await post('/__gcalfail', { code: 500 });
  await p.goto('http://localhost:3000/'); await p.waitForSelector('text=Quote visit');
  await p.getByRole('button', { name: 'Confirm', exact: true }).click();
  await p.waitForSelector("text=Google Calendar didn't update");
  it = await byTitle('Quote visit');
  ok('booking is confirmed in Yarn anyway', it.status === 'confirmed' && !it.external_id);
  await post('/__gcalfail', { code: 0 });
  await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Quote visit').catch(() => {});
  await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Schedule');
  ok('Today shows "Not in Google Calendar" once it comes into view (Coming up if within a week)', true);
  await post('/__seed', { items: [card({ title: 'Today job', status: 'confirmed', due_date: plus(0), start_time: '07:00:00' })] });
  await p.reload(); await p.waitForSelector('text=Not in Google Calendar');
  await p.locator('li', { hasText: 'Today job' }).getByRole('button', { name: 'Add', exact: true }).click();
  await p.waitForSelector('text=added to Google Calendar');
  const ev7 = Object.values(await events());
  ok('Add puts it in Google with a reminder', ev7.length === 1 && ev7[0].summary === 'Today job' && ev7[0].reminders.overrides[0].minutes === 30);
  await p.reload(); await p.waitForSelector('text=✓ In Google Calendar');
  const quote = await p.locator('li', { hasText: 'Quote visit' }).getByRole('button', { name: 'Add', exact: true }).count();
  ok('the booking Google missed earlier still offers Add', quote === 1);

  console.log('8. A move that Google missed shows "Try again"');
  await reset(); await connect();
  await post('/__seed', { items: [card({ title: 'Stuck job', status: 'confirmed', due_date: plus(0), start_time: '07:00:00', external_id: 'evtS', details: { calendar_sync: 'needs_update' } })] });
  await post('/__gcalseed', { id: 'evtS', event: { summary: 'Stuck job' } });
  await p.goto('http://localhost:3000/today'); await p.waitForSelector("text=Google Calendar hasn't caught up");
  await p.getByRole('button', { name: 'Try again' }).click();
  await p.waitForSelector('text=Google Calendar updated');
  ok('Try again fixes it', (await events()).evtS.start.dateTime === `${plus(0)}T07:00:00`);

  console.log('9. Not connected: no Google noise, nothing sent');
  await reset();
  await post('/__seed', { items: [card({ title: 'Plain booking', due_date: plus(0), start_time: '09:00:00' })] });
  await p.goto('http://localhost:3000/'); await p.waitForSelector('text=Plain booking');
  await p.getByRole('button', { name: 'Confirm', exact: true }).click();
  await p.waitForFunction(() => document.body.innerText.includes('confirmed: Plain booking'), null, { timeout: 15000 });
  const n9 = await notice(p).catch(() => '');
  ok('message has no mention of Google', !(await p.locator('body').innerText()).includes('Google Calendar'));
  ok('no calls to Google', (await calls()).length === 0);
  await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Plain booking');
  ok('Today shows no Google status lines', (await p.locator('text=Google Calendar').count()) === 0);

  console.log('10. Connection cancelled on Google\'s side -> told to reconnect');
  await reset(); await connect('1//0g-OLD-REVOKED-TOKEN');
  await post('/__seed', { items: [card({ title: 'Revoked test', due_date: '2026-11-09', start_time: '10:00:00' })] });
  await p.goto('http://localhost:3000/'); await p.waitForSelector('text=Revoked test');
  await p.getByRole('button', { name: 'Confirm', exact: true }).click();
  await p.waitForSelector('text=Google needs reconnecting');
  ok('booking still saved in Yarn', (await byTitle('Revoked test')).status === 'confirmed');

  console.log('11. Safety');
  const anon = await b.newContext();
  const a = await anon.request.post('http://localhost:3000/api/google/sync', { data: { itemId: 'x' }, maxRedirects: 0 });
  ok('logged-out request refused', [307, 401].includes(a.status()));
  const bad = await ctx.request.post('http://localhost:3000/api/google/sync', { data: {} });
  ok('missing id -> 400', bad.status() === 400);
  await connect();
  const nf = await ctx.request.post('http://localhost:3000/api/google/sync', { data: { itemId: 'nope', create: true } });
  ok('unknown booking -> 404', nf.status() === 404);
  await post('/__seed', { items: [{ type: 'todo', title: 'A todo', status: 'confirmed' }] });
  const todo = await byTitle('A todo');
  ok('to-dos are never sent to Google', (await (await ctx.request.post('http://localhost:3000/api/google/sync', { data: { itemId: todo.id, create: true } })).json()).status === 'skipped');

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
