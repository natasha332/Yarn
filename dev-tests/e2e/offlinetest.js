const { chromium } = require('playwright');
const FAKE = 'http://localhost:4000';
const out = '/home/user/Yarn/dev-tests/';
const post = (path, body) => fetch(FAKE + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const st = () => fetch(FAKE + '/__state').then(r => r.json());
const waiting = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('yarn'); r.onupgradeneeded = () => {}; r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('pending-notes')) return res(0); const q = db.transaction('pending-notes').objectStore('pending-notes').count(); q.onsuccess = () => res(q.result); }; r.onerror = () => res(-1); }));

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
const ok = (label, cond) => console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`);

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('A. With signal, nothing changes: saved, written down, nothing left on the phone');
  { const { ctx, p } = await open(b);
    await record(p); await p.waitForSelector('text="Saved."'); await p.waitForSelector('text=What you said');
    await p.waitForTimeout(500);
    const s = await st();
    ok('uploaded once', s.uploads.length === 1); ok('row added once', s.inserts.length === 1); ok('nothing left waiting on the phone', await waiting(p) === 0);
    ok('no "Waiting to upload" box', !(await p.innerText('body')).includes('Waiting to upload'));
    await ctx.close(); }

  console.log('B. No signal: recording is kept on the phone, then uploads by itself when signal returns');
  { const { ctx, p } = await open(b);
    await ctx.setOffline(true);
    await record(p); await p.waitForSelector('text=No signal right now');
    await p.waitForSelector('text=Waiting to upload (1)');
    await p.screenshot({ path: out + 'offline-waiting.png', fullPage: true });
    let s = await st();
    ok('nothing reached the server', s.uploads.length === 0 && s.inserts.length === 0);
    ok('1 note stored on the phone', await waiting(p) === 1);
    ok('player for the waiting note is there', (await p.$$('section audio')).length === 1);
    await ctx.setOffline(false);
    await p.waitForSelector('text="Saved."', { timeout: 15000 });
    await p.waitForSelector('text=What you said', { timeout: 15000 });
    await p.waitForFunction(() => !document.body.innerText.includes('Waiting to upload'), null, { timeout: 15000 });
    await p.screenshot({ path: out + 'offline-done.png', fullPage: true });
    s = await st();
    ok('uploaded exactly once', s.uploads.length === 1); ok('row added exactly once', s.inserts.length === 1);
    ok('written down exactly once', s.openai.length === 1); ok('phone copy cleared', await waiting(p) === 0);
    ok('shows in Recent notes', (await p.$$eval('section li', l => l.length)) >= 4);
    await ctx.close(); }

  console.log('C. Record with no signal, close the app, reopen it later with signal');
  { const { ctx, p } = await open(b);
    await ctx.setOffline(true); await record(p); await p.waitForSelector('text=Waiting to upload (1)');
    await p.close();                                   // app closed with the note still on the phone
    let s = await st(); ok('nothing on the server while the app is closed', s.uploads.length === 0 && s.inserts.length === 0);
    await ctx.setOffline(false);
    const p2 = await ctx.newPage();                    // reopened later
    await p2.goto('http://localhost:3000/');
    await p2.waitForSelector('text=Recent notes');
    await p2.waitForFunction(() => !document.body.innerText.includes('Waiting to upload') && document.querySelectorAll('section li').length >= 4, null, { timeout: 15000 });
    await p2.waitForTimeout(1500);
    s = await st();
    ok('uploaded once', s.uploads.length === 1); ok('row added once', s.inserts.length === 1); ok('written down once', s.openai.length === 1);
    ok('phone copy cleared', await waiting(p2) === 0);
    await ctx.close(); }

  console.log('D. Three notes recorded with no signal all go up, each exactly once');
  { const { ctx, p } = await open(b);
    await ctx.setOffline(true);
    for (let i = 0; i < 3; i++) { await record(p); await p.waitForSelector(`text=Waiting to upload (${i + 1})`); }
    await ctx.setOffline(false);
    await p.waitForFunction(() => !document.body.innerText.includes('Waiting to upload'), null, { timeout: 20000 });
    await p.waitForTimeout(1500);
    const s = await st();
    ok('3 uploads', s.uploads.length === 3); ok('3 rows', s.inserts.length === 3 && new Set(s.inserts).size === 3);
    ok('3 written down', s.openai.length === 3); ok('phone copies cleared', await waiting(p) === 0);
    await ctx.close(); }

  console.log('E. Signal is there but the upload fails: note stays safe, "Try now" works once fixed');
  { const { ctx, p } = await open(b);
    await post('/__mode', { mode: 'uploadfail' });
    await record(p); await p.waitForSelector("text=Couldn't upload it just now");
    await p.waitForSelector('text=Waiting to upload (1)');
    ok('note kept on the phone', await waiting(p) === 1);
    await post('/__mode', { mode: 'ok' });
    await p.click('section:has-text("Waiting to upload") button:has-text("Try now")');
    await p.waitForFunction(() => !document.body.innerText.includes('Waiting to upload'), null, { timeout: 15000 });
    await p.waitForSelector('text=What you said', { timeout: 15000 });
    const s = await st();
    ok('uploaded once', s.uploads.length === 1); ok('row added once', s.inserts.length === 1); ok('phone copy cleared', await waiting(p) === 0);
    await ctx.close(); }

  console.log('F. Deleting a waiting note from the phone');
  { const { ctx, p } = await open(b);
    await ctx.setOffline(true); await record(p); await p.waitForSelector('text=Waiting to upload (1)');
    p.on('dialog', d => d.accept());
    await p.click('section:has-text("Waiting to upload") button:has-text("Delete")');
    await p.waitForFunction(() => !document.body.innerText.includes('Waiting to upload'), null, { timeout: 8000 });
    ok('gone from the screen', true); ok('gone from the phone', await waiting(p) === 0);
    await ctx.setOffline(false); await p.waitForTimeout(1500);
    const s = await st(); ok('nothing was ever uploaded', s.uploads.length === 0 && s.inserts.length === 0);
    await ctx.close(); }

  await b.close();
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); process.exit(1); });
