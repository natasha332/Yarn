const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SECRET = 'cron-secret-from-the-password-manager-123456';
const base = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', RESEND_API_URL: 'http://localhost:4000/resend', SITE_URL: 'https://yarnnatasha.netlify.app', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: 'a-long-random-secret-from-a-password-manager-1234' };
const start = (extra, port) => spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', String(port)], { cwd: '/home/user/Yarn', env: { ...base, ...extra }, detached: true, stdio: 'ignore' });
const procs = [start({ RESEND_API_KEY: 're_test_key', SUPABASE_SECRET_KEY: 'sb_secret_test', CRON_SECRET: SECRET }, 3000), start({ RESEND_API_KEY: 're_test_key' }, 3001)];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const run = (port = 3000, auth = `Bearer ${SECRET}`) => fetch(`http://localhost:${port}/api/cron/digest`, { method: 'POST', headers: auth ? { Authorization: auth } : {} });
const hhmm = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 1440) + 1440) % 1440 % 60).padStart(2, '0')}:00`;
const sydMin = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value); };
// Make "morning" due right now (set 5 minutes ago) and "wrap-up" far away from now.
const setTimes = async (extra = {}) => { const n = sydMin(); await post('/__bizset', { morning_enabled: true, morning_email_time: hhmm(Math.max(0, n - 5)), wrapup_mode: 'end_of_day', wrapup_time: hhmm(n + 720), ...extra }); };
const reset = async () => { await post('/__reset'); await post('/__bizreset'); await post('/__googlereset'); await post('/__emailsreset'); await post('/__digestreset'); };
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:3001/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }

  console.log('1. Only the timer may start a run');
  ok('no secret -> 401', (await run(3000, null)).status === 401);
  ok('wrong secret -> 401', (await run(3000, 'Bearer nope')).status === 401);
  ok('server without CRON_SECRET refuses everything', (await run(3001, `Bearer ${SECRET}`)).status === 401);
  ok('nothing was emailed by those', (await get('/__emails')).length === 0);

  console.log('2. Nothing due -> nothing sent');
  await reset(); await setTimes({ morning_email_time: hhmm(sydMin() + 600) });
  let r = await (await run()).json();
  ok('checked 1 business, sent 0', r.checked === 1 && r.sent === 0 && (await get('/__emails')).length === 0);

  console.log('3. Morning due -> sent once, never twice');
  await reset(); await setTimes(); await post('/__seed', { items: [{ type: 'todo', title: 'Order hinges', status: 'confirmed' }] });
  r = await (await run()).json();
  let mails = await get('/__emails');
  ok('1 sent', r.sent === 1 && mails.length === 1);
  ok('to the login email, morning subject, key used', mails[0].to[0] === 'natasha@example.com' && mails[0].subject.startsWith('Today, ') && mails[0].auth === 'Bearer re_test_key');
  ok('includes the to-do', mails[0].html.includes('Order hinges'));
  let log = await get('/__digestlog');
  ok('logged as sent with address and time', log.length === 1 && log[0].status === 'sent' && log[0].to_email === 'natasha@example.com' && !!log[0].sent_at && log[0].kind === 'morning');
  r = await (await run()).json();
  ok('15 minutes later: already handled, nothing new sent', r.sent === 0 && r.alreadyHandled === 1 && (await get('/__emails')).length === 1);
  await Promise.all([run(), run(), run(), run(), run()]);
  ok('five runs at the same moment: still just one email', (await get('/__emails')).length === 1);

  console.log('4. Both due at once -> two emails, each once');
  await reset(); await setTimes({ wrapup_time: hhmm(Math.max(0, sydMin() - 3)) });
  r = await (await run()).json(); await run();
  mails = await get('/__emails');
  ok('morning and wrap-up both sent', r.sent === 2 && mails.length === 2 && mails.some(m => m.subject.startsWith('Today,')) && mails.some(m => m.subject.startsWith('Wrap-up,')));

  console.log('5. Goes to the Google account when connected');
  await reset(); await setTimes();
  await post('/__googleseed', { business_id: 'b0000000-0000-0000-0000-00000000000b', google_email: 'calendar.person@gmail.com', refresh_token_enc: 'x', connected_at: new Date().toISOString() });
  await run(); mails = await get('/__emails');
  ok('sent to calendar.person@gmail.com', mails.length === 1 && mails[0].to[0] === 'calendar.person@gmail.com');

  console.log('6. Switched off -> not sent');
  await reset(); await setTimes({ morning_enabled: false });
  await run(); ok('morning off: no email', (await get('/__emails')).length === 0);
  await reset(); await setTimes({ morning_enabled: false, wrapup_mode: 'off', wrapup_time: hhmm(Math.max(0, sydMin() - 3)) });
  await run(); ok('wrap-up off: no email', (await get('/__emails')).length === 0);

  console.log('7. Resend fails -> logged, retried next run, gives up after 3');
  await reset(); await setTimes(); await post('/__emailfail', { code: 500, message: 'Resend is having a moment' });
  r = await (await run()).json(); log = await get('/__digestlog');
  ok('failed once, error logged', r.failed === 1 && log[0].status === 'failed' && log[0].attempts === 1 && log[0].error.includes('Resend is having a moment'));
  await post('/__emailfail', null).catch(() => {}); await post('/__emailsreset');
  r = await (await run()).json(); log = await get('/__digestlog'); mails = await get('/__emails');
  ok('next run retries and sends (attempt 2), exactly one email', r.sent === 1 && log[0].status === 'sent' && log[0].attempts === 2 && mails.length === 1);
  await reset(); await setTimes(); await post('/__emailfail', { code: 500, message: 'down' });
  for (let i = 0; i < 5; i++) await run();
  log = await get('/__digestlog');
  ok('gives up after 3 attempts (no hammering)', log[0].status === 'failed' && log[0].attempts === 3);
  await post('/__emailsreset');

  console.log('8. Settings shows when they last went out');
  await reset(); await setTimes(); await run();
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]'); await p.waitForSelector('text=Recent notes');
  await p.goto('http://localhost:3000/settings'); await p.waitForSelector('text=Last sent');
  ok('morning briefing shows as sent', await p.locator('text=/Morning briefing: ✓ sent/').count() === 1);
  ok('wrap-up shows not sent yet', await p.locator('text=Day wrap-up: not sent yet').count() === 1);
  await b.close();

  console.log('9. The Netlify timer file');
  const calls = []; const realFetch = global.fetch;
  global.fetch = async (u, o) => { calls.push({ u, o }); return new Response('{"sent":0}', { status: 200 }); };
  process.env.SITE_URL = 'https://yarnnatasha.netlify.app/'; process.env.CRON_SECRET = SECRET;
  const timer = await import('/home/user/Yarn/netlify/functions/digest-cron.mts');
  await timer.default();
  ok('calls the run route with the secret', calls.length === 1 && calls[0].u === 'https://yarnnatasha.netlify.app/api/cron/digest' && calls[0].o.method === 'POST' && calls[0].o.headers.Authorization === `Bearer ${SECRET}`);
  ok('runs every 15 minutes', timer.config.schedule === '*/15 * * * *');
  delete process.env.CRON_SECRET; await timer.default();
  ok('without a secret it does nothing', calls.length === 1);
  global.fetch = realFetch;

  stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
