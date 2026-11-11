const { chromium } = require('playwright');
const { spawn } = require('child_process');
const KEY = 'a-long-random-secret-from-a-password-manager-1234';
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: KEY, GOOGLE_TOKEN_URL: 'http://localhost:4000/google/token', GOOGLE_CALENDAR_URL: 'http://localhost:4000/gcal' };
const pr = spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' });
const stopAll = () => { try { process.kill(-pr.pid); } catch {} };
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const TZ = 'Australia/Sydney';
const dayOf = n => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + n * 864e5));
const at = (date, hm) => { for (const off of ['+11:00', '+10:00']) { const d = new Date(`${date}T${hm}:00${off}`); const l = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); const t = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); if (l === date && t === hm) return `${date}T${hm}:00${off}`; } throw new Error('bad time'); };
const ev = (id, summary, date, from, to, extra = {}) => post('/__gcalseed', { id, event: { summary, start: { dateTime: at(date, from) }, end: { dateTime: at(date, to) }, ...extra } });
let crypto; const connect = async () => { crypto = crypto || await import('/home/user/Yarn/src/lib/token-crypto.ts'); await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'tabrez@sundaykitchens.com.au', refresh_token_enc: crypto.encryptToken('1//0g-REAL-REFRESH-TOKEN', KEY), connected_at: new Date().toISOString() }); };
const reset = async () => { await post('/__reset'); await post('/__googlereset'); await post('/__gcalreset'); };
const T = dayOf(0), TM = dayOf(1);
const order = (text, ...names) => names.map(n => text.indexOf(n)).every((x, i, a) => x > -1 && (i === 0 || x > a[i - 1]));
async function open(b, w = 390) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const p = await ctx.newPage(); p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]'); await p.waitForSelector('text=Recent notes'); return p;
}
const section = (p, title) => p.locator('section', { has: p.locator('h2', { hasText: title }) });
const seedYarn = () => post('/__seed', { items: [
  { type: 'calendar', status: 'confirmed', title: "Consult at Priya's", due_date: T, start_time: '09:00:00', client_name: 'Priya' },
  { type: 'calendar', status: 'confirmed', title: 'Site visit', due_date: T, start_time: '14:00:00', external_id: 'evtYarn1' },
  { type: 'calendar', status: 'confirmed', title: 'Tomorrow measure-up', due_date: TM, start_time: '08:30:00' },
] });
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch();

  console.log('1. Other Google Calendar events join the Schedule, in time order');
  { await reset(); await connect(); await seedYarn();
    await ev('evtYarn1', 'Site visit', T, '14:00', '15:00');                       // made by Yarn: must not repeat
    await ev('d1', 'Dentist', T, '12:30', '13:15', { location: '12 Smile St' });
    await ev('d2', 'Kids school pickup', T, '15:30', '16:00');
    await post('/__gcalseed', { id: 'h1', event: { summary: 'Public holiday', start: { date: T }, end: { date: dayOf(1) } } });
    await ev('x1', 'Declined meeting', T, '10:30', '11:00', { attendees: [{ self: true, responseStatus: 'declined' }] });
    await ev('x2', 'Free reminder', T, '11:00', '11:30', { transparency: 'transparent' });
    await ev('x3', 'Cancelled thing', T, '16:00', '17:00', { status: 'cancelled' });
    await ev('t1', 'Tomorrow dentist follow-up', TM, '08:00', '08:30');
    await ev('far', 'Way too far away', dayOf(12), '10:00', '11:00');
    await ev('past', 'Yesterday thing', dayOf(-1), '10:00', '11:00');
    const p = await open(b); await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Dentist');
    const s = await section(p, 'Schedule').innerText();
    ok('one list in time order: 9:00 consult, 12:30 dentist, 2:00 site visit, 3:30 school pickup', order(s, "Consult at Priya", 'Dentist', 'Site visit', 'Kids school pickup') && s.includes('12:30pm') && s.includes('3:30pm') && s.includes('12 Smile St') && s.includes('until 1:15pm'));
    ok('the heading counts all four', /Schedule\s*4/.test(s));
    const tag = t => section(p, 'Schedule').locator('li', { hasText: t }).locator('span', { hasText: /^Calendar$/ }).count();
    ok('Google ones are labelled Calendar; Yarn bookings are not', await tag('Dentist') === 1 && await tag('Kids school pickup') === 1 && await tag('Consult at Priya') === 0 && await tag('Site visit') === 0);
    ok('the event Yarn made is shown once, not twice', (s.match(/Site visit/g) || []).length === 1);
    ok('all-day, declined, free, cancelled, and other days are left out', ['Public holiday', 'Declined meeting', 'Free reminder', 'Cancelled thing', 'Yesterday thing', 'Way too far', 'Tomorrow dentist'].every(x => !s.includes(x)));
    ok('Yarn bookings keep their Reschedule and Cancel; calendar ones have none (they are changed in Google)', await section(p, 'Schedule').locator('li', { hasText: 'Site visit' }).getByRole('button', { name: 'Reschedule' }).count() === 1 && await section(p, 'Schedule').locator('li', { hasText: 'Dentist' }).locator('button').count() === 0);
    const c = await section(p, 'Coming up').innerText();
    ok('Coming up: tomorrow, 8:00 Google event then 8:30 Yarn booking, with the day', order(c, 'Tomorrow dentist follow-up', 'Tomorrow measure-up') && c.includes('8:00am'));
    ok('and Today still shows the rest of the screen', await p.locator('h2:has-text("To-dos and follow-ups")').count() === 1); }

  console.log('2. A day with only Google events is not "nothing booked"');
  { await reset(); await connect(); await ev('d1', 'Dentist', T, '12:30', '13:15');
    const p = await open(b); await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Dentist');
    ok('shows it instead of the empty message', await p.locator('text=Nothing booked for today').count() === 0 && await section(p, 'Schedule').locator('text=Dentist').count() === 1); }

  console.log('3. Google not connected, or down: the screen still works');
  { await reset(); await seedYarn(); await ev('d1', 'Dentist', T, '12:30', '13:15');
    const p = await open(b); await p.goto('http://localhost:3000/today'); await p.waitForSelector("text=Consult at Priya");
    ok('not connected: no Google events, no errors', await p.locator('text=Dentist').count() === 0 && await p.locator('text=Calendar').count() === 0); }
  { await reset(); await connect(); await seedYarn(); await post('/__gcalfail', { code: 500 });
    const p = await open(b); await p.goto('http://localhost:3000/today'); await p.waitForSelector("text=Consult at Priya");
    ok('Google down: the Yarn bookings still show', await p.locator('text=Site visit').count() >= 1 && await p.locator('text=Dentist').count() === 0); }
  { await reset(); await connect(); await seedYarn(); await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'x', refresh_token_enc: 'garbage', connected_at: new Date().toISOString() });
    const p = await open(b); await p.goto('http://localhost:3000/today'); await p.waitForSelector("text=Consult at Priya");
    ok('an unreadable saved key: the screen still works', true); }

  console.log('4. Small phone');
  { await reset(); await connect(); await seedYarn(); await ev('d1', 'A very long dentist appointment title that goes on and on for a while', T, '12:30', '13:15', { location: '12 Smile Street, Some Long Suburb Name NSW 2000' });
    const p = await open(b, 360); await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=A very long dentist');
    const w = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    ok('no sideways scrolling at 360px', w.s <= w.c); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
