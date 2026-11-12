const { chromium } = require('playwright');
const { spawn } = require('child_process');
const KEY = 'a-long-random-secret-from-a-password-manager-1234';
const base = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const gEnv = { GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_TOKEN_KEY: KEY, GOOGLE_TOKEN_URL: 'http://localhost:4000/google/token', GOOGLE_REVOKE_URL: 'http://localhost:4000/google/revoke' };
const start = (extra, port) => spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', String(port)], { cwd: '/home/user/Yarn', env: { ...base, ...extra }, detached: true, stdio: 'ignore' });
const procs = [start(gEnv, 3000), start({}, 3001)]; // 3001 = Google not set up
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const get = p => fetch('http://localhost:4000' + p).then(r => r.json());
const post = (p, b) => fetch('http://localhost:4000' + p, { method: 'POST', body: JSON.stringify(b || {}) }).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
async function login(b, port) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(require('./open-settings.js')); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto(`http://localhost:${port}/login`);
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]');
  await p.waitForSelector('text=Recent notes'); return { ctx, p };
}
(async () => {
  for (let i = 0; i < 40; i++) { try { const a = await fetch('http://localhost:3000/login'); const c = await fetch('http://localhost:3001/login'); if (a.ok && c.ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch(); await post('/__googlereset');
  const { ctx, p } = await login(b, 3000);

  console.log('1. Settings page, not connected');
  await p.click('text=Settings'); await p.waitForSelector('a:has-text("Connect Google Calendar")');
  ok('shows Connect Google Calendar', await p.locator('a:has-text("Connect Google Calendar")').count() === 1);
  ok('mentions the unverified-app warning', await p.locator('text=Go to Yarn').count() === 1);
  ok('Connect is a plain link to /api/google/connect', (await p.locator('a:has-text("Connect Google Calendar")').getAttribute('href')) === '/api/google/connect');

  console.log('2. Connect sends you to Google with the right settings');
  const r1 = await ctx.request.get('http://localhost:3000/api/google/connect', { maxRedirects: 0 });
  const loc = new URL(r1.headers()['location']);
  ok('redirects to Google sign-in', loc.origin === 'https://accounts.google.com' && loc.pathname === '/o/oauth2/v2/auth');
  ok('asks for calendar events only (+ who you are)', loc.searchParams.get('scope') === 'https://www.googleapis.com/auth/calendar.events openid email');
  ok('asks for a lasting key (offline + consent)', loc.searchParams.get('access_type') === 'offline' && loc.searchParams.get('prompt') === 'consent');
  ok('redirect address is exactly the callback', loc.searchParams.get('redirect_uri') === 'http://localhost:3000/api/google/callback');
  ok('sends our client id', loc.searchParams.get('client_id') === gEnv.GOOGLE_CLIENT_ID);
  const state = loc.searchParams.get('state'); ok('has a secret state', state && state.length >= 30);
  const sc = r1.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value).find(v => v.startsWith('yarn_google_state='));
  ok('state cookie is httpOnly, lax, short-lived', /HttpOnly/i.test(sc) && /SameSite=lax/i.test(sc) && /Max-Age=600/.test(sc));

  // The browser keeps the state cookie itself (it was set by /connect), like a real sign-in.
  const fresh = async () => new URL((await ctx.request.get('http://localhost:3000/api/google/connect', { maxRedirects: 0 })).headers()['location']).searchParams.get('state');
  const cb = (q) => ctx.request.get('http://localhost:3000/api/google/callback?' + q, { maxRedirects: 0 });
  const where = r => new URL(r.headers()['location'], 'http://x').search;

  console.log('3. Bad callbacks are refused, nothing saved');
  ok('wrong state -> failed', where(await cb('code=GOODCODE&state=nope')) === '?google=failed');
  await ctx.clearCookies({ name: 'yarn_google_state' });
  ok('no cookie -> failed', where(await cb(`code=GOODCODE&state=${state}`)) === '?google=failed');
  let s2 = await fresh();
  ok('user said no -> denied', where(await cb(`error=access_denied&state=${s2}`)) === '?google=denied');
  s2 = await fresh();
  ok('bad code -> failed', where(await cb(`code=BAD&state=${s2}`)) === '?google=failed');
  s2 = await fresh();
  ok('no lasting key from Google -> norefresh', where(await cb(`code=NOREFRESH&state=${s2}`)) === '?google=norefresh');
  ok('nothing saved by any of those', (await get('/__google')).saves === 0);

  console.log('4. Good callback saves an ENCRYPTED key');
  const s3 = await fresh();
  const good = await cb(`code=GOODCODE&state=${s3}`);
  ok('redirects to settings connected', where(good) === '?google=connected');
  const g = await get('/__google');
  ok('saved once for this business', g.saves === 1 && g.google.business_id === 'b0000000-0000-0000-0000-00000000000b');
  ok('saved the Google account email', g.google.google_email === 'natasha@sundaykitchens.com.au');
  ok('refresh key is NOT stored in plain text', !JSON.stringify(g.google).includes('REAL-REFRESH'));
  ok('code was swapped using our client secret + same redirect', g.tokenCalls.at(-1).client_secret === 'test-secret' && g.tokenCalls.at(-1).redirect_uri === 'http://localhost:3000/api/google/callback' && g.tokenCalls.at(-1).grant_type === 'authorization_code');
  const { decryptToken } = await import('/home/user/Yarn/src/lib/token-crypto.ts');
  ok('decrypts back to the real key with the server secret', decryptToken(g.google.refresh_token_enc, KEY) === '1//0g-REAL-REFRESH-TOKEN');
  ok('state cookie cleared afterwards', good.headersArray().some(h => h.name.toLowerCase() === 'set-cookie' && /yarn_google_state=;/.test(h.value)));

  console.log('5. Settings shows connected, and Disconnect works');
  await p.goto('http://localhost:3000/settings?google=connected');
  await p.waitForSelector('text=✓ Connected');
  ok('shows the connected email', await p.locator('section', { hasText: 'Google Calendar' }).first().locator('b:has-text("natasha@sundaykitchens.com.au")').count() === 1);
  ok('shows success message', await p.locator('text=Connected. Yarn can now use your Google Calendar.').count() === 1);
  ok('no Connect button while connected', await p.locator('a:has-text("Connect Google Calendar")').count() === 0);
  ok('mentions the 30 minute reminder', await p.locator('text=30 minute reminder').count() >= 1);
  await p.screenshot({ path: (process.env.SP || require('path').join(__dirname, '..') + '/') + 'settings-connected.png' });
  await p.click('button:has-text("Disconnect")'); await p.waitForSelector('text=Disconnected.');
  const g2 = await get('/__google');
  ok('connection removed', g2.google === null);
  ok('key handed back to Google (revoked)', g2.revoked === '1//0g-REAL-REFRESH-TOKEN');
  ok('Connect button back', await p.locator('a:has-text("Connect Google Calendar")').count() === 1);

  console.log('6. Save fails -> told to try again');
  await post('/__googlefail');
  const s4 = await fresh();
  ok('save error -> failed', where(await cb(`code=GOODCODE&state=${s4}`)) === '?google=failed');

  console.log('7. Logged-out people are sent to log in');
  const anon = await b.newContext(); const ap = anon.request;
  const a1 = await ap.get('http://localhost:3000/api/google/connect', { maxRedirects: 0 });
  ok('connect -> /login', new URL(a1.headers()['location'], 'http://x').pathname === '/login');
  const a2 = await ap.get('http://localhost:3000/api/google/callback?code=GOODCODE&state=x', { maxRedirects: 0, headers: { cookie: 'yarn_google_state=x' } });
  ok('callback -> /login', new URL(a2.headers()['location'], 'http://x').pathname === '/login');

  console.log('8. Google not set up on the server'); await post('/__googlereset');
  const { ctx: c3, p: p3 } = await login(b, 3001);
  await p3.goto('http://localhost:3001/settings'); await p3.waitForSelector("text=Google isn't set up on the server yet.");
  ok('no Connect button, plain message', await p3.locator('a:has-text("Connect Google Calendar")').count() === 0 && await p3.locator("text=Google isn't set up on the server yet.").count() >= 1);
  const r3 = await c3.request.get('http://localhost:3001/api/google/connect', { maxRedirects: 0 });
  ok('connect link -> settings notset', new URL(r3.headers()['location'], 'http://x').search === '?google=notset');

  console.log('9. Home screen has a Settings link');
  await p.goto('http://localhost:3000/'); await p.waitForSelector('text=Recent notes');
  ok('Settings link on home', await p.locator('a[href="/settings"]').count() >= 1);

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
