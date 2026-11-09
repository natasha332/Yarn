const { chromium } = require('playwright');
const FAKE = 'http://localhost:4000';
const out = '/home/user/Yarn/dev-tests/';
const post = (path, body) => fetch(FAKE + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const st = () => fetch(FAKE + '/__state').then(r => r.json());
(async () => {
  await post('/__reset');
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  let dialogs = [];
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await p.goto('http://localhost:3000/login');
  await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Recent notes'); await p.waitForSelector('button:has-text("Delete")');
  const count = () => p.$$eval('section li', l => l.length);
  console.log('1. notes at start:', await count(), '(every one has a Delete button:', (await p.$$('section li button:has-text("Delete")')).length === await count(), ')');
  await p.screenshot({ path: out + 'delete-list.png', fullPage: true });

  console.log('2. Cancel keeps the note');
  p.removeAllListeners('dialog'); p.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await p.click('section li:has-text("didn\'t get written down") button:has-text("Delete")');
  await p.waitForTimeout(800);
  console.log('   notes now:', await count(), '| deleted on server:', JSON.stringify((await st()).deleted));

  console.log('3. If the recording cannot be deleted, the note stays and a message shows');
  await post('/__mode', { mode: 'deletefail' });
  p.removeAllListeners('dialog'); p.on('dialog', d => d.accept());
  await p.click('section li:has-text("didn\'t get written down") button:has-text("Delete")');
  await p.waitForSelector("text=Couldn't delete it");
  console.log('   notes now:', await count(), '| message shown: yes | note rows deleted on server:', (await st()).deleted.filter(x => x.table).length);

  console.log('4. Delete for real (undelivered note, recording first, then the note)');
  await post('/__mode', { mode: 'ok' });
  await p.reload(); await p.waitForSelector('text=Recent notes');
  await p.click('section li:has-text("didn\'t get written down") button:has-text("Delete")');
  await p.waitForFunction(() => !document.body.innerText.includes("didn't get written down"), null, { timeout: 15000 });
  console.log('   notes now:', await count(), '| deleted on server:', JSON.stringify((await st()).deleted));
  console.log('   confirm question asked:', JSON.stringify(dialogs[0]));
  await b.close();
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); process.exit(1); });
