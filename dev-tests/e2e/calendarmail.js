const { chromium } = require('playwright');
const { spawn } = require('child_process');
const KEY = 'a-long-random-secret-from-a-password-manager-1234', SECRET = 'cron-secret-from-the-password-manager-123456';
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: KEY, GOOGLE_TOKEN_URL: 'http://localhost:4000/google/token', GOOGLE_CALENDAR_URL: 'http://localhost:4000/gcal', RESEND_API_KEY: 're_test_key', RESEND_API_URL: 'http://localhost:4000/resend', SITE_URL: 'https://yarnnatasha.netlify.app', SUPABASE_SECRET_KEY: 'sb_secret_test', CRON_SECRET: SECRET };
const pr = spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' });
const stopAll = () => { try { process.kill(-pr.pid); } catch {} };
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const TZ = 'Australia/Sydney';
const dayOf = n => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + n * 864e5));
const hhmm = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 1440) + 1440) % 1440 % 60).padStart(2, '0')}:00`;
const sydMin = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value); };
// A Sydney wall-clock time as the ISO text Google sends (with the right +10:00 / +11:00).
const at = (date, hm) => { for (const off of ['+11:00', '+10:00']) { const d = new Date(`${date}T${hm}:00${off}`); const l = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); const t = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d); if (l === date && t === hm) return `${date}T${hm}:00${off}`; } throw new Error('bad time'); };
const ev = (id, summary, date, from, to, extra = {}) => post('/__gcalseed', { id, event: { summary, start: { dateTime: at(date, from) }, end: { dateTime: at(date, to) }, ...extra } });
let crypto;
async function connect(token = '1//0g-REAL-REFRESH-TOKEN') { crypto = crypto || await import('/home/user/Yarn/src/lib/token-crypto.ts'); await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'calendar.person@gmail.com', refresh_token_enc: crypto.encryptToken(token, KEY), connected_at: new Date().toISOString() }); }
const T = dayOf(0), TM = dayOf(1);
const reset = async () => { await post('/__reset'); await post('/__bizreset'); await post('/__googlereset'); await post('/__gcalreset'); await post('/__emailsreset'); await post('/__digestreset'); };
const row = async () => (await get('/__emails')).at(-1);
const order = (html, ...names) => names.map(n => html.indexOf(n)).every((x, i, a) => x > -1 && (i === 0 || x > a[i - 1]));
const toast = async (p, t) => p.waitForFunction(x => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes(x)), t, { timeout: 15000 });
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]'); await p.waitForSelector('text=Recent notes');
  const sendTest = async kind => { await p.goto('http://localhost:3000/settings'); await p.waitForSelector('text=Send me a test briefing'); await p.getByRole('button', { name: kind === 'morning' ? 'Send me a test briefing' : 'Send me a test wrap-up' }).click(); await toast(p, 'Sent to'); await new Promise(r => setTimeout(r, 300)); };

  console.log('1. Briefing mixes in other Google Calendar events, in time order');
  await reset(); await connect();
  const c = (o) => ({ status: 'confirmed', type: 'calendar', ...o });
  await post('/__seed', { items: [
    c({ title: "Consult at Priya's", due_date: T, start_time: '09:00:00', end_time: '10:00:00', client_name: 'Priya' }),
    c({ title: 'Site visit', due_date: T, start_time: '14:00:00', external_id: 'evtYarn1' }),
    c({ title: 'Tomorrow measure-up', due_date: TM, start_time: '08:30:00' }),
  ] });
  await ev('evtYarn1', 'Site visit', T, '14:00', '15:00');               // made by Yarn: must not repeat
  await ev('d1', 'Dentist', T, '12:30', '13:15', { location: '12 Smile St' });
  await ev('d2', 'Kids school pickup', T, '15:30', '16:00');
  await post('/__gcalseed', { id: 'h1', event: { summary: 'Public holiday', start: { date: T }, end: { date: dayOf(1) } } });   // all-day: out
  await ev('x1', 'Declined meeting', T, '10:30', '11:00', { attendees: [{ self: true, responseStatus: 'declined' }] });
  await ev('x2', 'Free reminder', T, '11:00', '11:30', { transparency: 'transparent' });
  await ev('x3', 'Cancelled thing', T, '16:00', '17:00', { status: 'cancelled' });
  await ev('y1', 'Yesterday thing', dayOf(-1), '10:00', '11:00');
  await ev('y2', 'Day after tomorrow thing', dayOf(2), '10:00', '11:00');
  await ev('t1', 'Tomorrow dentist follow-up', TM, '08:00', '08:30');
  await sendTest('morning'); let m = await row();
  ok('other events are in, with their place', m.html.includes('Dentist') && m.html.includes('12 Smile St') && m.html.includes('Kids school pickup'));
  ok('one list in time order (9:00 consult, 12:30 dentist, 2:00 site visit, 3:30 school)', order(m.html, "Consult at Priya", 'Dentist', 'Site visit', 'Kids school pickup'));
  ok('calendar ones are labelled, Yarn bookings are not', (m.html.match(/>Calendar</g) || []).length === 2 && m.text.includes('Dentist [Calendar]') && !m.text.includes('Consult at Priya\'s [Calendar]'));
  ok('the Yarn-made event is not shown twice', (m.html.match(/Site visit/g) || []).length === 1);
  ok('all-day, declined, free, cancelled, other days are left out', ['Public holiday', 'Declined meeting', 'Free reminder', 'Cancelled thing', 'Yesterday thing', 'Day after tomorrow', 'Tomorrow dentist'].every(x => !m.html.includes(x)));
  ok('times shown in Sydney time', m.html.includes('12:30pm – 1:15pm') && m.html.includes('3:30pm'));
  ok('subject counts them all', m.subject.includes('4 appointments'));
  await p.screenshot({ path: (process.env.SP || require('path').join(__dirname, '..') + '/') + 'x.png' }).catch(() => {});

  console.log('2. Wrap-up: tomorrow includes them');
  await sendTest('wrapup'); m = await row();
  ok('tomorrow: Google event 8:00am before Yarn booking 8:30am, labelled', order(m.html.slice(m.html.indexOf('>Tomorrow <span')), 'Tomorrow dentist follow-up', 'Tomorrow measure-up') && m.text.includes('Tomorrow dentist follow-up [Calendar]'));
  ok("today's other events are not in the wrap-up's tomorrow list", !m.html.slice(m.html.indexOf('>Tomorrow <span')).includes('Dentist'));

  console.log('3. Google trouble never stops the email');
  await post('/__emailsreset'); await post('/__gcalfail', { code: 500 });
  await sendTest('morning'); m = await row();
  ok('Google down: email still sent with the Yarn bookings', m.html.includes("Consult at Priya") && !m.html.includes('Dentist'));
  await post('/__gcalfail', { code: 0 }); await post('/__emailsreset'); await connect('1//0g-OLD-REVOKED-TOKEN');
  await sendTest('morning'); m = await row();
  ok('connection revoked: email still sent without them', m.html.includes("Consult at Priya") && !m.html.includes('Dentist'));
  await post('/__emailsreset'); await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'calendar.person@gmail.com', refresh_token_enc: 'garbage', connected_at: new Date().toISOString() });
  await sendTest('morning'); m = await row();
  ok('unreadable saved key: email still sent', m.html.includes("Consult at Priya"));

  console.log('4. Not connected: just Yarn bookings');
  await post('/__googlereset'); await post('/__emailsreset'); await sendTest('morning'); m = await row();
  ok('no calendar events, no tags', !m.html.includes('Dentist') && !m.html.includes('>Calendar<'));

  console.log('5. The automatic timer includes them too');
  await post('/__emailsreset'); await connect();
  const n = sydMin(); await post('/__bizset', { morning_enabled: true, morning_email_time: hhmm(Math.max(0, n - 5)), wrapup_mode: 'off', wrapup_time: hhmm(n + 720) });
  const run = await (await fetch('http://localhost:3000/api/cron/digest', { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } })).json();
  m = await row();
  ok('automatic morning email sent with Google events', run.sent === 1 && m.html.includes('Dentist') && order(m.html, "Consult at Priya", 'Dentist', 'Site visit', 'Kids school pickup'));

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
