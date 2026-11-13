// Contacts: clients (customers) and business contacts (accountant, supplier, rep...).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SP = require('path').join(__dirname, '..') + '/';
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }), spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`); };
const sydney = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const SAM = { id: 'cl-sam', name: 'Sam Lee', kind: 'contact', role: 'Accountant', email: 'sam@leeaccounting.com.au', phone: null, address: null, aliases: ['my accountant', 'Sam'] };
const KIM = { id: 'cl-kim', name: 'Kim Ortiz', kind: 'contact', role: 'Sales rep', email: null, phone: '0455 889 900', address: null, aliases: ['Hafele rep'] };
const say = text => post('/__mode', { text });
async function record(p) {
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200);
  await p.click('button[aria-label="Stop recording"]');
}
(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, permissions: ['microphone'] }); const p = await ctx.newPage();
  p.on('pageerror', e => { fails++; console.log('  PAGE ERROR', e.message); });
  await post('/__reset'); await post('/__contacts', [SAM, KIM]);
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]');
  await p.waitForSelector('button[aria-label="Start recording"]');

  console.log('1. The Contacts screen starts on Clients');
  await p.goto('http://localhost:3000/clients'); await p.waitForSelector('h1:has-text("Contacts")'); await p.waitForSelector('text=Robyn Clarke');
  let text = await p.innerText('main');
  ok('lists customers, not business contacts', text.includes('Robyn Clarke') && text.includes('Dave Nguyen') && !text.includes('Sam Lee'));
  ok('the button adds a client', await p.locator('a', { hasText: /^Add client$/ }).count() === 1);
  ok('the bottom tab says Contacts', await p.locator('nav a', { hasText: 'Contacts' }).count() >= 1 && await p.locator('nav a', { hasText: /^Clients$/ }).count() === 1 /* the switch, not the tab */);

  console.log('2. Switch to Business contacts');
  await p.click('a:has-text("Business contacts")'); await p.waitForSelector('text=Sam Lee');
  text = await p.innerText('main');
  ok('address shows ?kind=contact', p.url().endsWith('/clients?kind=contact'));
  ok('lists the contacts with their roles', text.includes('Sam Lee') && text.includes('Accountant') && text.includes('Kim Ortiz') && text.includes('Sales rep') && !text.includes('Robyn Clarke'));
  ok('shows email or phone under the name', text.includes('sam@leeaccounting.com.au') && text.includes('0455 889 900'));
  ok('the button adds a business contact', await p.locator('a', { hasText: 'Add business contact' }).count() === 1);
  await p.screenshot({ path: SP + 'contacts-list.png' });
  ok('fits a small phone', !(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));

  console.log('3. Add a business contact');
  await p.click('a:has-text("Add business contact")'); await p.waitForSelector('h1:has-text("New business contact")');
  ok('form has a Role box and no Address box', await p.locator('input[placeholder^="e.g. Accountant"]').count() === 1 && await p.locator('label:has-text("Address")').count() === 0);
  await p.fill('input[autocomplete=off] >> nth=0', 'Bunnings Penrith');
  await p.fill('input[placeholder^="e.g. Accountant"]', 'Timber supplier');
  await p.fill('input[type=email]', 'trade@bunnings.example.com');
  await p.screenshot({ path: SP + 'contacts-add.png' });
  await p.click('button:has-text("Add business contact")'); await p.waitForSelector('text=Bunnings Penrith');
  const log = await get('/__clientlog');
  ok('saved as a contact with the role, no address', log.inserts.length === 1 && log.inserts[0].kind === 'contact' && log.inserts[0].role === 'Timber supplier' && !('address' in log.inserts[0]) && log.inserts[0].name === 'Bunnings Penrith');
  ok('back on the business contacts list, new one shown with its role', p.url().includes('kind=contact') && (await p.innerText('main')).includes('Timber supplier'));

  console.log('4. The switch inside the form');
  await p.goto('http://localhost:3000/clients/new'); await p.waitForSelector('h1:has-text("New client")');
  ok('a new client has an Address box, no Role', await p.locator('label:has-text("Address")').count() === 1 && await p.locator('input[placeholder^="e.g. Accountant"]').count() === 0);
  await p.click('button:has-text("Business contact")');
  ok('switching shows Role and hides Address', await p.locator('input[placeholder^="e.g. Accountant"]').count() === 1 && await p.locator('label:has-text("Address")').count() === 0);
  await p.click('button:has-text("Client")');
  ok('and back again', await p.locator('label:has-text("Address")').count() === 1);

  console.log('5. Edit a business contact');
  await p.goto('http://localhost:3000/clients/cl-sam'); await p.waitForSelector('h1:has-text("Edit business contact")');
  ok('role is filled in', (await p.inputValue('input[placeholder^="e.g. Accountant"]')) === 'Accountant');
  await p.fill('input[placeholder^="e.g. Accountant"]', 'Bookkeeper'); await p.click('button:has-text("Save changes")'); await p.waitForSelector('text=Bookkeeper');
  const patch = (await get('/__clientpatches')).filter(x => x.id === 'cl-sam').pop();
  ok('saved the new role and kept them a contact', patch && patch.role === 'Bookkeeper' && patch.kind === 'contact' && !('address' in patch));

  console.log('6. A client with jobs stays a client');
  await post('/__jobcounts', { 'cl-robyn': 2 });
  await p.goto('http://localhost:3000/clients/cl-robyn'); await p.waitForSelector('h1:has-text("Edit client")');
  ok('no switch, and it says why', await p.locator('button:has-text("Business contact")').count() === 0 && (await p.innerText('main')).includes('has jobs'));
  await post('/__jobcounts', {});
  await p.goto('http://localhost:3000/clients/cl-robyn'); await p.waitForSelector('h1:has-text("Edit client")');
  ok('a client with no jobs can be switched', await p.locator('button:has-text("Business contact")').count() === 1);
  await p.click('button:has-text("Save changes")'); await p.waitForSelector('text=Dave Nguyen');
  const rp = (await get('/__clientpatches')).filter(x => x.id === 'cl-robyn').pop();
  ok('saving a client keeps kind client, no role, and the address', rp.kind === 'client' && rp.role === null && rp.address === '14 Elm St');

  console.log('7. Delete a business contact');
  await p.goto('http://localhost:3000/clients/cl-kim'); await p.waitForSelector('h1:has-text("Edit business contact")');
  p.once('dialog', d => { ok('asks first, without the jobs wording', d.message() === 'Delete Kim Ortiz?'); d.accept(); });
  await p.click('button:has-text("Delete business contact")'); await p.waitForSelector('text=Sam Lee');
  ok('deleted', (await get('/__clientlog')).deletes.includes('cl-kim'));

  console.log('8. New jobs can only go to clients');
  await p.goto('http://localhost:3000/jobs/new'); await p.waitForSelector('h1:has-text("New job")'); await p.check('text=Repeat client'); await p.waitForSelector('select');
  const opts = await p.locator('select option').allInnerTexts();
  ok('the client picker lists customers only', opts.some(o => o.includes('Robyn')) && !opts.some(o => o.includes('Sam Lee')));

  console.log('9. Talking: the sorter is told who is a client and who is a contact');
  await post('/__reset'); await post('/__contacts', [SAM, KIM]);
  await p.goto('http://localhost:3000/'); await p.waitForSelector('button[aria-label="Start recording"]');
  await say('CONTACTMEET'); await record(p); await p.waitForSelector('text=To check (1)', { timeout: 20000 });
  const sent = (await get('/__state')).anthropic.pop().content;
  ok('the list says kind, and gives a contact their role', sent.includes('PEOPLE (JSON; kind is client or contact)') && sent.includes('"kind":"contact","role":"Accountant"') && sent.includes('"kind":"client"'));
  ok('the card names the contact and their role', (await p.innerText('main')).includes('Business contact: Kim Ortiz · Sales rep'));
  await p.screenshot({ path: SP + 'contacts-card.png', fullPage: true });

  console.log('10. A job card can never be given to a contact');
  await post('/__reset'); await post('/__contacts', [SAM, KIM]);
  await p.goto('http://localhost:3000/'); await p.waitForSelector('button[aria-label="Start recording"]');
  await say('CONTACTJOB'); await record(p); await p.waitForSelector('text=To check (1)', { timeout: 20000 });
  ok('even if the sorter slips, the job shows no client chosen', (await p.innerText('main')).includes('Client: not chosen yet'));

  console.log('10b. The AI forgot to link "the accountant": Yarn links it from the card\'s own words');
  await post('/__reset'); await post('/__contacts', [SAM, KIM]);
  await p.goto('http://localhost:3000/'); await p.waitForSelector('button[aria-label="Start recording"]');
  await say('FORGOTLINK'); await record(p); await p.waitForSelector('text=To check (1)', { timeout: 20000 });
  ok('the to-do shows Business contact: Sam Lee · Accountant', (await p.innerText('main')).includes('Business contact: Sam Lee · Accountant'));

  console.log('11. Someone not in the list (a rep) just becomes a to-do');
  await post('/__reset'); await post('/__contacts', [SAM, KIM]);
  await p.goto('http://localhost:3000/'); await p.waitForSelector('button[aria-label="Start recording"]');
  await say('UNKNOWNREP'); await record(p); await p.waitForSelector('text=To check (1)', { timeout: 20000 });
  text = await p.innerText('main');
  ok('a plain to-do, no job, no new client', text.includes('Meet the Hafele rep') && !/NEW JOB/i.test(text) && !text.includes('new client'));

  console.log('12. Today shows roles for business contacts, plain names for clients');
  await post('/__reset'); await post('/__contacts', [SAM, KIM]);
  const today = sydney();
  await post('/__seed', { items: [
    { type: 'calendar', status: 'confirmed', title: 'Meeting with Kim', due_date: today, start_time: '10:00:00', client_id: 'cl-kim' },
    { type: 'calendar', status: 'confirmed', title: 'Site visit', due_date: today, start_time: '14:00:00', client_id: 'cl-dave' },
    { type: 'todo', status: 'confirmed', title: 'Send BAS papers', client_id: 'cl-sam' }] });
  await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Meeting with Kim');
  text = await p.innerText('main');
  ok('the rep shows "Kim Ortiz · Sales rep"', text.includes('Kim Ortiz · Sales rep'));
  ok('the accountant to-do shows "Sam Lee · Accountant"', text.includes('Sam Lee · Accountant'));
  ok('a client is just their name', text.includes('Dave Nguyen') && !text.includes('Dave Nguyen ·'));
  await p.screenshot({ path: SP + 'contacts-today.png', fullPage: true });

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await b.close(); stopAll(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
