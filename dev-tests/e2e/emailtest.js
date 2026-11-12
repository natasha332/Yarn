const { chromium } = require('playwright');
const { spawn } = require('child_process');
const base = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: 'a-long-random-secret-from-a-password-manager-1234' };
const start = (extra, port) => spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', String(port)], { cwd: '/home/user/Yarn', env: { ...base, ...extra }, detached: true, stdio: 'ignore' });
const procs = [start({ RESEND_API_KEY: 're_test_key', RESEND_API_URL: 'http://localhost:4000/resend', SITE_URL: 'https://yarnnatasha.netlify.app' }, 3000), start({}, 3001)];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const sydney = n => { const d = new Date(Date.now() + n * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); };
async function login(b, port) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(require('./open-settings.js')); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto(`http://localhost:${port}/login`); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]');
  await p.waitForSelector('text=Recent notes'); return { ctx, p };
}
const toast = async (p, text) => { await p.waitForFunction(t => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes(t)), text, { timeout: 15000 }); };
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:3001/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch(); const { ctx, p } = await login(b, 3000);
  const T = sydney(0), TM = sydney(1), OLD = sydney(-3);
  await post('/__reset'); await post('/__googlereset'); await post('/__emailsreset');
  const it = (o) => ({ status: 'confirmed', ...o });
  await post('/__seed', { items: [
    it({ type: 'calendar', title: "Consult at Priya's <script>alert(1)</script>", due_date: T, start_time: '09:00:00', end_time: '10:30:00', client_name: 'Priya', details: { address: '5 Wattle St & Co' } }),
    it({ type: 'calendar', title: 'Site visit', due_date: T, start_time: '14:00:00' }),
    it({ type: 'calendar', title: 'Delivery day', due_date: T }),
    it({ type: 'calendar', title: 'Tomorrow measure-up', due_date: TM, start_time: '08:30:00', client_name: 'Robyn Clarke' }),
    it({ type: 'calendar', title: 'Cancelled thing', status: 'discarded', due_date: T, start_time: '11:00:00' }),
    it({ type: 'todo', title: 'Order hinges', due_date: OLD }),
    it({ type: 'followup', title: 'Chase laundry quote', client_name: 'Dave Nguyen' }),
    it({ type: 'todo', title: 'Ticked today', status: 'done', done_at: new Date().toISOString() }),
    it({ type: 'todo', title: 'Ticked ages ago', status: 'done', done_at: new Date(Date.now() - 3 * 864e5).toISOString() }),
    { type: 'todo', title: 'Waiting card', status: 'pending' },
  ] });
  await p.goto('http://localhost:3000/settings'); await p.waitForSelector('text=Send me a test briefing');

  console.log('1. Test briefing (not connected to Google -> login email)');
  await p.getByRole('button', { name: 'Send me a test briefing' }).click();
  await toast(p, 'Sent to natasha@example.com');
  let mails = await get('/__emails'); const m = mails[0];
  ok('one email sent with the Resend key', mails.length === 1 && m.auth === 'Bearer re_test_key');
  ok('from the Resend test sender, to the login email', m.from === 'Yarn <onboarding@resend.dev>' && m.to[0] === 'natasha@example.com');
  ok('subject counts bookings and to-dos', m.subject.startsWith('Today, ') && m.subject.includes('3 appointments') && m.subject.includes('2 to-dos'));
  ok("today's bookings are in, in time order", m.html.indexOf('Consult at Priya') < m.html.indexOf('Site visit') && m.html.includes('9:00am – 10:30am') && m.html.includes('2:00pm') && m.html.includes('All day'));
  ok('address and client shown', m.html.includes('5 Wattle St &amp; Co') && m.html.includes('Priya'));
  ok('what she said cannot break the email (escaped)', !m.html.includes('<script>') && m.html.includes('&lt;script&gt;'));
  ok('open to-dos and follow-ups in, overdue marked', m.html.includes('Order hinges') && m.html.includes('overdue, was') && m.html.includes('Chase laundry quote'));
  ok('not in the briefing: tomorrow, cancelled, done', !m.html.includes('Tomorrow measure-up') && !m.html.includes('Cancelled thing') && !m.html.includes('Ticked today'));
  ok('mentions the waiting card and links to Today', m.html.includes('1 card waiting for you to check') && m.html.includes('href="https://yarnnatasha.netlify.app/today"'));
  ok('plain-text version too', m.text.includes('TODAY\'S SCHEDULE') && m.text.includes('Open Yarn: https://yarnnatasha.netlify.app/today'));

  console.log('2. Test wrap-up, sent to the Google account once connected');
  await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'calendar.person@gmail.com', refresh_token_enc: 'x', connected_at: new Date().toISOString() });
  await p.reload(); await p.waitForSelector('text=Send me a test wrap-up');
  await p.getByRole('button', { name: 'Send me a test wrap-up' }).click(); await toast(p, 'Sent to calendar.person@gmail.com');
  mails = await get('/__emails'); const w = mails[1];
  ok('goes to the calendar account', w.to[0] === 'calendar.person@gmail.com');
  ok('subject: 1 done, 2 still open', w.subject.includes('Wrap-up') && w.subject.includes('1 done') && w.subject.includes('2 still open'));
  ok('Done today has only what was ticked today', w.html.includes('Ticked today') && !w.html.includes('Ticked ages ago'));
  ok("Tomorrow's bookings listed", w.html.includes('Tomorrow measure-up') && w.html.includes('8:30am') && w.html.includes('Robyn Clarke'));
  ok('Still open lists the open to-dos', w.html.includes('Order hinges') && w.html.includes('Chase laundry quote'));
  ok('links to the home screen', w.html.includes('href="https://yarnnatasha.netlify.app/"'));

  console.log('3. Quiet day reads nicely');
  await post('/__reset'); await post('/__googlereset'); await post('/__emailsreset');
  await p.reload(); await p.waitForSelector('text=Send me a test briefing');
  await p.getByRole('button', { name: 'Send me a test briefing' }).click(); await toast(p, 'Sent to');
  const q = (await get('/__emails'))[0];
  ok('subject says nothing booked', q.subject.includes('nothing booked') && q.subject.includes('0 to-dos'));
  ok('friendly empty messages, no waiting-cards line', q.html.includes('Nothing booked for today.') && q.html.includes('Nothing to do. Nice.') && !q.html.includes('waiting for you'));

  console.log('4. Problems are explained');
  await post('/__emailfail', { code: 403, message: 'You can only send testing emails to your own email address (you@example.com).' });
  await p.getByRole('button', { name: 'Send me a test briefing' }).click(); await toast(p, 'You can only send testing emails');
  ok('Resend refusing shows its reason', true);
  const { p: p3 } = await login(b, 3001); await p3.goto('http://localhost:3001/settings'); await p3.waitForSelector('text=Send me a test briefing');
  await p3.getByRole('button', { name: 'Send me a test briefing' }).click(); await toast(p3, "Email isn't set up on the server yet");
  ok('no key on the server -> plain message', true);
  const out = await (await b.newContext()).request.post('http://localhost:3000/api/email/test', { data: { kind: 'morning' }, maxRedirects: 0 });
  ok('logged-out request refused', [307, 401].includes(out.status()));
  const bad = await ctx.request.post('http://localhost:3000/api/email/test', { data: { kind: 'junk' } });
  ok('unknown kind -> 400', bad.status() === 400);
  const tiny = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok('Settings still fits a small phone', tiny.sw <= tiny.cw);

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
