const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SP = require('path').join(__dirname, '..') + '/';
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
let procs = [];
const up = async () => {
  procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }),
           spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
  for (let i = 0; i < 40; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error('servers did not start');
};
const down = async () => { procs.forEach(p => { try { process.kill(-p.pid); } catch {} }); await new Promise(r => setTimeout(r, 1200)); };
const ok = (label, cond) => console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`);
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());

(async () => {
  await up();
  console.log('1. Installability files are readable without logging in');
  const man = await (await fetch('http://localhost:3000/manifest.webmanifest')).json();
  ok('manifest: name, standalone, 3 icons', man.name === 'Yarn' && man.display === 'standalone' && man.icons.length === 3);
  for (const u of ['/sw.js', '/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/apple-icon.png']) {
    const r = await fetch('http://localhost:3000' + u, { redirect: 'manual' }); ok(`${u} -> ${r.status}`, r.status === 200);
  }

  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await post('/__reset');
  await p.goto('http://localhost:3000/login');
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123');
  await p.click('button[type=submit]');
  await p.waitForSelector('button[aria-label="Start recording"]'); await p.waitForSelector('text=Recent notes');

  console.log('2. The app saves a copy of itself on the phone');
  await p.evaluate(() => navigator.serviceWorker.ready);
  for (let i = 0; i < 30 && !(await p.evaluate(async () => !!(await (await caches.open('yarn-pages-v1')).match('/')))); i++) await p.waitForTimeout(500);
  const saved = await p.evaluate(async () => ({ page: !!(await (await caches.open('yarn-pages-v1')).match('/')), offline: !!(await (await caches.open('yarn-pages-v1')).match('/offline.html')), files: (await (await caches.open('yarn-static-v1')).keys()).length }));
  ok('home screen saved', saved.page); ok('"no signal" page saved', saved.offline); ok(`app code saved (${saved.files} files)`, saved.files > 3);

  console.log('3. NO SIGNAL AT ALL (both servers off): reopening the app');
  await down();
  await p.reload();
  await p.waitForSelector('button[aria-label="Start recording"]', { timeout: 15000 });
  ok('app opens with the mic button', true);
  ok('Recent notes from last time still showing', (await p.innerText('body')).includes('Recent notes'));
  await p.screenshot({ path: SP + 'pwa-offline-open.png', fullPage: true });

  console.log('4. Recording with no signal still works');
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200);
  await p.click('button[aria-label="Stop recording"]');
  await p.waitForSelector('text=Waiting to upload (1)', { timeout: 10000 });
  ok('note kept on the phone', true);

  console.log('5. Other pages with no signal show the friendly "no signal" page, not a browser error');
  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:3000/jobs');
  ok('"No signal right now" page', (await p2.innerText('body')).includes('No signal right now'));
  await p2.screenshot({ path: SP + 'pwa-offline-page.png' });
  await p2.close();

  console.log('6. Signal returns: the note goes up without any fuss');
  await up(); await post('/__reset');
  await p.click('section:has-text("Waiting to upload") button:has-text("Try now")');
  await p.waitForFunction(() => !document.body.innerText.includes('Waiting to upload'), null, { timeout: 20000 });
  await p.waitForSelector('text=What you said', { timeout: 15000 });
  const s = await fetch('http://localhost:4000/__state').then(r => r.json());
  ok('uploaded once and written down once', s.uploads.length === 1 && s.openai.length === 1);

  console.log('7. Logging out forgets the saved signed-in screen');
  await p.click('button:has-text("Log out")');
  await p.waitForURL('**/login');
  await p.waitForTimeout(800);
  const still = await p.evaluate(async () => !!(await (await caches.open('yarn-pages-v1')).match('/')));
  ok('saved home screen removed after logout', !still);
  await down();
  const p3 = await ctx.newPage();
  await p3.goto('http://localhost:3000/');
  ok('with no signal after logout: "no signal" page, not someone\'s notes', (await p3.innerText('body')).includes('No signal right now') && !(await p3.innerText('body')).includes('Recent notes'));
  await b.close(); await down();
})().catch(async e => { console.log('TEST FAILED:', e.message.split('\n')[0]); procs.forEach(p => { try { process.kill(-p.pid); } catch {} }); process.exit(1); });
