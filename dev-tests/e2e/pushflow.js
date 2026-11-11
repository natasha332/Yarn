process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // the pretend push service uses a throwaway certificate
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const crypto = require('crypto');
const webpush = require('/home/user/Yarn/node_modules/web-push');
const VAPID = webpush.generateVAPIDKeys();
const SECRET = 'cron-secret-from-the-password-manager-123456';
const base = { ...process.env, PUSH_TEST_HOSTS: 'localhost', NODE_TLS_REJECT_UNAUTHORIZED: '0', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', RESEND_API_KEY: 're_test_key', RESEND_API_URL: 'http://localhost:4000/resend', SITE_URL: 'https://yarnnatasha.netlify.app', SUPABASE_SECRET_KEY: 'sb_secret_test', CRON_SECRET: SECRET, GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: 'a-long-random-secret-from-a-password-manager-1234' };
const start = (extra, port) => spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', String(port)], { cwd: '/home/user/Yarn', env: { ...base, ...extra }, detached: true, stdio: 'ignore' });
const pushSvc = spawn('node', ['/home/user/Yarn/dev-tests/fake/push-service.js'], { detached: true, stdio: 'ignore', env: process.env });
const procs = [pushSvc, start({ VAPID_PUBLIC_KEY: VAPID.publicKey, VAPID_PRIVATE_KEY: VAPID.privateKey, VAPID_SUBJECT: 'mailto:hello@example.com' }, 3000), start({}, 3001)];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
const pushLog = () => fetch('https://localhost:4443/__pushlog').then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const TZ = 'Australia/Sydney';
const sydDay = n => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + n * 864e5));
const lab = iso => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); const f = o => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...o }).format(dt); return `${f({ weekday: 'short' })} ${f({ day: 'numeric' })} ${f({ month: 'short' })}`; };
const hhmm = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 1440) + 1440) % 1440 % 60).padStart(2, '0')}:00`;
const sydMin = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value); };
const device = name => { const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const authBuf = crypto.randomBytes(16); return { name, ecdh, authBuf, endpoint: `https://localhost:4443/push/${name}`, p256dh: ecdh.getPublicKey().toString('base64url'), auth: authBuf.toString('base64url') }; };
const seedDevice = d => post('/__pushseed', { endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth });
// RFC 8291 (aes128gcm) decryption, as the phone would do it
function decrypt(bodyB64, dev) {
  const buf = Buffer.from(bodyB64, 'base64'); const salt = buf.subarray(0, 16); const idlen = buf[20]; const asPub = buf.subarray(21, 21 + idlen); const cipher = buf.subarray(21 + idlen);
  const secret = dev.ecdh.computeSecret(asPub);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), dev.ecdh.getPublicKey(), asPub]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, dev.authBuf, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(cipher.subarray(cipher.length - 16));
  let pt = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]); pt = pt.subarray(0, pt.lastIndexOf(2));
  return JSON.parse(pt.toString());
}
const reset = async () => { await post('/__reset'); await post('/__bizreset'); await post('/__googlereset'); await post('/__emailsreset'); await post('/__digestreset'); await post('/__pushsubsreset'); await fetch('https://localhost:4443/__pushreset', { method: 'POST' }); };
const setChannel = async (channel, extra = {}) => { const n = sydMin(); await post('/__bizset', { notify_channel: channel, morning_enabled: true, morning_email_time: hhmm(Math.max(0, n - 5)), wrapup_mode: 'off', wrapup_time: hhmm(n + 720), ...extra }); };
const run = (port = 3000) => fetch(`http://localhost:${port}/api/cron/digest`, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } }).then(r => r.json());
const toast = (p, t) => p.waitForFunction(x => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes(x)), t, { timeout: 15000 });
async function login(b, port = 3000, ctxOpts = {}, init) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ...ctxOpts }); if (init) await ctx.addInitScript(init.fn, init.arg);
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto(`http://localhost:${port}/login`); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]'); await p.waitForSelector('text=Recent notes'); return { ctx, p };
}
// pretend phone: a service worker registration + push manager we can watch
const phone = (dev, perm) => ({ fn: ({ endpoint, p256dh, auth, perm }) => {
  window.__push = { sub: null, opts: null, unsubscribed: false, asked: 0 };
  const sub = { endpoint, toJSON() { return { endpoint, keys: { p256dh, auth } }; }, unsubscribe: async () => { window.__push.unsubscribed = true; window.__push.sub = null; return true; } };
  const reg = { pushManager: { getSubscription: async () => window.__push.sub, subscribe: async o => { window.__push.opts = Array.from(new Uint8Array(o.applicationServerKey)); window.__push.sub = sub; return sub; } } };
  Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg) });
  let permission = perm; Object.defineProperty(Notification, 'permission', { get: () => permission });
  Notification.requestPermission = async () => { window.__push.asked++; permission = 'granted'; return 'granted'; };
}, arg: { endpoint: dev.endpoint, p256dh: dev.p256dh, auth: dev.auth, perm } });

(async () => {
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:3001/login')).ok && (await fetch('http://localhost:4000/__state')).ok && (await fetch('https://localhost:4443/__pushlog')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch();

  console.log('1. Turning notifications on from Settings (a pretend phone)');
  { await reset(); const d = device('phone1'); const { ctx, p } = await login(b, 3000, {}, phone(d, 'default'));
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector('text=Turn on notifications on this phone');
    ok('offers to turn them on', await p.locator('button:has-text("Turn on notifications on this phone")').count() === 1);
    await p.getByRole('button', { name: 'Turn on notifications on this phone' }).click(); await p.waitForSelector('text=✓ On');
    const info = await p.evaluate(() => window.__push);
    ok('asked the phone for permission once, and subscribed with Yarn\'s public key', info.asked === 1 && Buffer.from(info.opts).toString('base64url') === VAPID.publicKey);
    const saved = (await get('/__pushsubs'))[0];
    ok('the phone address and codes were saved for this business and person', saved && saved.endpoint === d.endpoint && saved.p256dh === d.p256dh && saved.auth === d.auth && saved.business_id === 'b0000000-0000-0000-0000-00000000000b' && saved.user_id === 'aaaaaaaa-0000-0000-0000-000000000001' && /Chrome/.test(saved.device));
    await p.getByRole('button', { name: 'Send me a test notification' }).click();
    for (let i = 0; i < 40 && (await pushLog()).length < 1; i++) await new Promise(r => setTimeout(r, 250));
    const log = await pushLog(); const h = log[0].headers;
    ok('a real Web Push request reached the phone\'s push service', log.length === 1 && log[0].name === 'phone1' && h['content-encoding'] === 'aes128gcm' && h['ttl'] === '14400');
    ok('signed as Yarn (VAPID) with Yarn\'s public key', /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(h.authorization) && h.authorization.includes(`k=${VAPID.publicKey}`));
    ok('the message is scrambled in transit', !Buffer.from(log[0].body, 'base64').toString('latin1').includes('working'));
    const msg = decrypt(log[0].body, d);
    ok('and only that phone can unscramble it: the test message', msg.title === 'Yarn' && msg.body.includes('Notifications are working') && msg.url === '/settings');
    await p.getByRole('button', { name: 'Turn off' }).click(); await p.waitForSelector('button:has-text("Turn on notifications on this phone")');
    ok('Turn off removes the phone and unsubscribes it', (await get('/__pushsubs')).length === 0 && (await p.evaluate(() => window.__push.unsubscribed)));
    const anon = await (await b.newContext()).request;
    for (const r of ['subscribe', 'unsubscribe', 'test']) { const x = await anon.post('http://localhost:3000/api/push/' + r, { data: {}, maxRedirects: 0 }); ok(`logged-out ${r} refused`, [307, 401].includes(x.status())); }
    ok('a made-up subscription is refused', (await (await ctx.request.post('http://localhost:3000/api/push/subscribe', { data: { subscription: { endpoint: 'http://insecure.example/x', keys: { p256dh: 'a', auth: 'b' } } } })).json()).status === 'error' && (await get('/__pushsubs')).length === 0);
    ok('testing a phone that is not turned on says so', (await (await ctx.request.post('http://localhost:3000/api/push/test', { data: { endpoint: 'https://localhost:4443/push/nobody' } })).json()).status === 'error'); }

  console.log('2. Other situations on the Settings screen');
  { await reset(); const d = device('blocked1'); const { p } = await login(b, 3000, {}, phone(d, 'denied'));
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector('text=Notifications are blocked');
    ok('blocked in the phone: explains how to allow it', true); }
  { await reset(); const { p } = await login(b, 3000, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' }, { fn: () => { delete window.PushManager; }, arg: null });
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector('text=Add to Home Screen');
    ok('iPhone in the browser: told to add Yarn to the Home Screen first', true); }
  { await reset(); const { p } = await login(b, 3000, {}, { fn: () => { delete window.PushManager; }, arg: null });
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector("text=can't show notifications");
    ok('a browser with no push: says so plainly', true); }
  { await reset(); const d = device('nokey'); const { p } = await login(b, 3001, {}, phone(d, 'default'));
    await p.goto('http://localhost:3001/settings'); await p.waitForSelector('text=Turn on notifications on this phone'); await p.getByRole('button', { name: 'Turn on notifications on this phone' }).click(); await toast(p, "Notifications aren't set up on the server yet");
    ok('server without keys: a plain message, nothing saved', (await get('/__pushsubs')).length === 0); }
  { await reset(); const { p } = await login(b);
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector('legend:has-text("How should it reach you?")');
    ok('the choice defaults to email', await p.locator('input[name=channel][value=email]').isChecked());
    await p.locator('input[name=channel][value=both]').check(); await p.locator('section', { hasText: 'Daily briefing' }).getByRole('button', { name: 'Save', exact: true }).click(); await toast(p, 'Saved.');
    ok('choosing Both is saved', (await get('/__biz')).settings.notify_channel === 'both');
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector('input[name=channel]');
    ok('and remembered', await p.locator('input[name=channel][value=both]').isChecked());
    const w = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })); ok('fits a small phone', w.s <= w.c); }

  console.log('3. The automatic briefing goes to phones');
  const T = sydDay(0);
  const seedDay = () => post('/__seed', { items: [{ type: 'calendar', status: 'confirmed', title: "Consult at Priya's", due_date: T, start_time: '09:00:00' }, { type: 'todo', status: 'confirmed', title: 'Order hinges' }] });
  { await reset(); await seedDay(); await setChannel('push');
    const d1 = device('okA'), d2 = device('okB'), dg = device('gone-C'); await seedDevice(d1); await seedDevice(d2); await seedDevice(dg);
    const r = await run(); const log = await pushLog();
    ok('push-only: sent to both working phones, and no email', r.sent === 1 && r.pushed === 2 && (await get('/__emails')).length === 0);
    const m = decrypt(log.find(x => x.name === 'okA').body, d1);
    ok('the lock-screen text', m.title === `Today, ${lab(T)}` && m.body === '1 appointment · 1 to-do. First up: 9:00am Consult at Priya\'s' && m.url === '/today');
    ok('each phone got a message only it can read', decrypt(log.find(x => x.name === 'okB').body, d2).title === m.title && log.find(x => x.name === 'okA').body !== log.find(x => x.name === 'okB').body);
    ok('a phone that has removed the subscription (410) is forgotten', !(await get('/__pushsubs')).some(s => s.endpoint === dg.endpoint) && (await get('/__pushsubs')).length === 2);
    const row = (await get('/__digestlog'))[0]; ok('logged as sent by push', row.status === 'sent' && row.channels === 'push' && !row.error);
    await run(); ok('15 minutes later: nothing sent twice', (await pushLog()).length === 3 && (await get('/__emails')).length === 0); }
  { await reset(); await seedDay(); await setChannel('both'); await seedDevice(device('okD'));
    const r = await run(); ok('both: an email AND a notification', r.sent === 1 && (await get('/__emails')).length === 1 && (await pushLog()).length === 1 && (await get('/__digestlog'))[0].channels === 'push+email'); }
  { await reset(); await seedDay(); await setChannel('email'); await seedDevice(device('okE'));
    await run(); ok('email-only: no notification even if a phone is set up', (await get('/__emails')).length === 1 && (await pushLog()).length === 0 && (await get('/__digestlog'))[0].channels === 'email'); }
  { await reset(); await seedDay(); await setChannel('push');
    await run(); const row = (await get('/__digestlog'))[0];
    ok('push chosen but no phone is turned on: the email is sent instead, and the log says why', (await get('/__emails')).length === 1 && row.status === 'sent' && row.channels === 'email (backup)' && row.error.includes('no phones have notifications on')); }
  { await reset(); await seedDay(); await setChannel('push'); await seedDevice(device('broken-F'));
    await run(); const row = (await get('/__digestlog'))[0];
    ok("the push service is down: email instead, and the phone is kept to try next time", (await get('/__emails')).length === 1 && row.channels === 'email (backup)' && (await get('/__pushsubs')).length === 1); }
  { await reset(); await seedDay(); await setChannel('push'); await seedDevice(device('okG'));
    await run(3001); const row = (await get('/__digestlog'))[0];
    ok('push chosen but the server has no push keys: nothing is sent to the phone, the email goes instead', (await pushLog()).length === 0 && (await get('/__emails')).length === 1 && row.channels === 'email (backup)'); }
  { await reset(); await seedDay(); await setChannel('both'); await seedDevice(device('broken-H'));
    await run(); const row = (await get('/__digestlog'))[0];
    ok('both, push fails: the email still counts as sent', row.status === 'sent' && row.channels === 'email' && (await get('/__emails')).length === 1); }
  { await reset(); await setChannel('push', { morning_enabled: true, wrapup_mode: 'end_of_day', wrapup_time: hhmm(Math.max(0, sydMin() - 3)), morning_email_time: hhmm(sydMin() + 600) });
    const d = device('wrapA'); await seedDevice(d); await post('/__seed', { items: [{ type: 'todo', status: 'done', title: 'Ticked today', done_at: new Date().toISOString() }, { type: 'calendar', status: 'confirmed', title: 'Tomorrow job', due_date: sydDay(1), start_time: '08:30:00' }] });
    await run(); const m = decrypt((await pushLog())[0].body, d);
    ok('the wrap-up notification', m.title === `Wrap-up, ${lab(T)}` && m.body === '1 done · 0 still open. Tomorrow: 8:30am Tomorrow job' && m.url === '/today'); }

  console.log('4. What the phone does when a notification arrives (the real service worker file)');
  { await reset(); const ctx = await b.newContext(); const p = await ctx.newPage();
    await p.goto('http://localhost:3000/forgot-password'); let sw; for (let i = 0; i < 60 && !(sw = ctx.serviceWorkers()[0]); i++) await p.waitForTimeout(250);
    ok('the service worker is running', !!sw);
    if (sw) {
      for (let i = 0; i < 40; i++) { if (await sw.evaluate(() => self.registration.active && self.registration.active.state === 'activated').catch(() => false)) break; await p.waitForTimeout(250); }
      // (a headless browser won't really show notifications, so what the worker asks the phone to show is recorded instead)
      await sw.evaluate(() => { self.__shown = []; self.registration.showNotification = (title, opts) => { self.__shown.push({ title, opts }); return Promise.resolve(); }; });
      const push = payload => sw.evaluate(p => { self.dispatchEvent(new PushEvent('push', { data: new TextEncoder().encode(JSON.stringify(p)) })); }, payload);
      await push({ title: 'Today, Tue 3 Nov', body: '2 appointments · 1 to-do', url: '/today', tag: 'yarn-briefing' }); await p.waitForTimeout(500);
      let shown = await sw.evaluate(() => self.__shown); const a = shown[0] && shown[0].opts;
      ok('it shows the notification with its title and text', shown.length === 1 && shown[0].title === 'Today, Tue 3 Nov' && a.body === '2 appointments · 1 to-do' && a.tag === 'yarn-briefing' && a.data.url === '/today');
      ok('with the Yarn icon', a.icon === '/icons/icon-192.png' && a.badge === '/icons/icon-192.png');
      await push({ title: 'Sneaky', body: 'x', url: '//evil.example.com/steal', tag: 'x' }); await p.waitForTimeout(300);
      await push({ title: 'Also sneaky', body: 'x', url: 'https://evil.example.com', tag: 'y' }); await p.waitForTimeout(300);
      shown = await sw.evaluate(() => self.__shown);
      ok('a link to anywhere but Yarn is replaced with the home screen', shown[1].opts.data.url === '/' && shown[2].opts.data.url === '/');
      await sw.evaluate(() => { self.dispatchEvent(new PushEvent('push', {})); }); await p.waitForTimeout(300);
      shown = await sw.evaluate(() => self.__shown);
      ok('a notification with no content still shows something sensible', shown[3].title === 'Yarn');
      await sw.evaluate(async () => { const ev = new Event('notificationclick'); let closed = false; ev.notification = { close() { closed = true; }, data: { url: '/today' } }; ev.waitUntil = pr => { self.__click = pr; }; self.dispatchEvent(ev); await self.__click; });
      await p.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
      ok('tapping it brings the open Yarn to the right screen (here logged out, so Today sends you to log in)', /\/login/.test(p.url())); } }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
