const { chromium } = require('playwright');
const { spawn } = require('child_process');
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', EMAIL_FROM: 'Yarn <briefing@mail.sundaykitchens.com.au>', RESEND_API_KEY: 're_test_key', RESEND_API_URL: 'http://localhost:4000/resend', VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y' };
const pr = spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' });
const stopAll = () => { try { process.kill(-pr.pid); } catch {} };
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const EVIL = { origin: 'https://evil.example.com' };
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  await post('/__reset'); await post('/__bizreset'); await post('/__emailsreset'); await post('/__sentreset'); await post('/__pushsubsreset');
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]'); await p.waitForSelector('text=Recent notes');
  await post('/__seed', { items: [{ type: 'email', status: 'pending', title: 'Hi', client_id: 'cl-robyn', details: { email: { to: 'robyn@example.com', subject: 'Hi', body: 'Hello Robyn', kind: 'other' } } }] });
  const email = (await get('/__state')).items.find(i => i.type === 'email');

  console.log('1. A request from another website is refused, even with a valid login');
  const routes = [['email/send', { itemId: email.id }], ['email/draft', { bookingId: 'x', kind: 'cancel' }], ['email/test', { kind: 'morning' }], ['gmail/prepare', { itemId: email.id }], ['gmail/choose', { itemId: email.id, threadId: 't' }], ['gmail/draft', { itemId: email.id }], ['google/sync', { itemId: 'x', create: true }], ['push/subscribe', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/a', keys: { p256dh: 'a', auth: 'b' } } }], ['push/test', { endpoint: 'x' }], ['push/unsubscribe', { endpoint: 'x' }], ['sort', { captureId: 'c-done' }], ['transcribe', { captureId: 'c-done' }]];
  for (const [r, data] of routes) { const x = await ctx.request.post('http://localhost:3000/api/' + r, { data, headers: EVIL }); ok(`${r}: refused (403)`, x.status() === 403); }
  ok('and nothing happened as a result', (await get('/__emails')).length === 0 && (await get('/__state')).items.find(i => i.id === email.id).status === 'pending' && (await get('/__pushsubs')).length === 0);
  const same = await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: email.id }, headers: { origin: 'http://localhost:3000' } });
  ok('from Yarn itself, the same request works', (await same.json()).status === 'sent' && (await get('/__emails')).length === 1);
  const none = await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: 'nope' } });
  ok('a request with no Origin (not from a web page) goes through the normal login check', none.status() === 404);
  const weird = await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: email.id }, headers: { origin: 'not a url' } });
  ok('a garbled Origin is refused', weird.status() === 403);

  console.log('2. Push addresses can only point at real push services');
  const keys = { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) };
  for (const endpoint of ['https://169.254.169.254/latest/meta-data', 'https://internal.example.com/x', 'https://localhost:4443/push/x', 'https://fcm.googleapis.com.evil.com/x', 'http://fcm.googleapis.com/fcm/send/x']) {
    const x = await ctx.request.post('http://localhost:3000/api/push/subscribe', { data: { subscription: { endpoint, keys } } }); ok(`refused: ${endpoint}`, x.status() === 400);
  }
  const good = await ctx.request.post('http://localhost:3000/api/push/subscribe', { data: { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys } } });
  ok('a real Chrome/Android address is accepted', (await good.json()).status === 'saved' && (await get('/__pushsubs')).length === 1);

  console.log('3. Odd ids cannot change how Yarn asks the database');
  for (const id of ['x),id.neq.0', 'a.b', 'a b', 'x'.repeat(65), '']) { const s = await ctx.request.post('http://localhost:3000/api/sort', { data: { captureId: id } }); ok(`sort refuses ${JSON.stringify(id.slice(0, 14))}`, s.status() === 400); }
  const t = await ctx.request.post('http://localhost:3000/api/transcribe', { data: { captureId: 'x),id.neq.0' } }); ok('transcribe refuses a trick id', t.status() === 400);

  console.log('4. A daily limit on emails to clients');
  await post('/__emailsreset'); await post('/__seed', { items: [{ type: 'email', status: 'pending', title: 'Hi 2', client_id: 'cl-robyn', details: { email: { to: 'robyn@example.com', subject: 'Hi 2', body: 'Hello again', kind: 'other' } } }] });
  const second = (await get('/__state')).items.find(i => i.title === 'Hi 2');
  await post('/__sentoverride', { n: 100 });
  const over = await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: second.id } });
  ok('at 100 in a day, sending stops with a clear message', over.status() === 429 && (await over.json()).message.includes("today's limit of 100") && (await get('/__emails')).length === 0 && (await get('/__state')).items.find(i => i.id === second.id).status === 'pending');
  await post('/__sentoverride', { n: 99 });
  const under = await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: second.id } });
  ok('at 99 it still goes', (await under.json()).status === 'sent');

  console.log('5. Browser protections on every page');
  for (const path of ['/login', '/today', '/']) { const r = await ctx.request.get('http://localhost:3000' + path); const h = r.headers();
    ok(`${path}: no framing, no type-guessing, careful referrer, HTTPS only, microphone only for Yarn`, h['x-frame-options'] === 'DENY' && h['x-content-type-options'] === 'nosniff' && h['referrer-policy'] === 'strict-origin-when-cross-origin' && /max-age=31536000/.test(h['strict-transport-security']) && h['permissions-policy'].includes('microphone=(self)') && h['permissions-policy'].includes('camera=()')); }
  const api = await ctx.request.post('http://localhost:3000/api/email/send', { data: {} }); ok('API answers carry them too', api.headers()['x-frame-options'] === 'DENY');
  const sw = await ctx.request.get('http://localhost:3000/sw.js'); ok('the service worker file is served normally', sw.status() === 200 && sw.headers()['x-content-type-options'] === 'nosniff');

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
