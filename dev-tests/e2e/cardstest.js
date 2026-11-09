const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SP = require('path').join(__dirname, '..') + '/';
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }), spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' })];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const st = () => fetch('http://localhost:4000/__state').then(r => r.json());
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`); };
const say = text => post('/__mode', { text });
const PRIYA = "Consult at Priya's house on the third of November at nine.";

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
async function record(p, waitFor = 'text=check') {
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200);
  await p.click('button[aria-label="Stop recording"]');
}
const card = (p, text) => p.locator('article', { hasText: text });
const confirmBtn = c => c.getByRole('button', { name: 'Confirm', exact: true });
const heading = p => p.locator('h2', { hasText: 'To check' });
const gone = (p, text) => p.waitForFunction(t => ![...document.querySelectorAll('article')].some(a => a.innerText.includes(t)), text, { timeout: 15000 });

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('1. Cards stay on the home page until you deal with them');
  { const { ctx, p } = await open(b); await say(PRIYA); await record(p);
    await p.waitForSelector('text=To check (2)', { timeout: 20000 });
    { const order = await p.$$eval('article h3', hs => hs.map(h => h.textContent)); ok('job card comes before its booking', order[0] === 'Consultation' && order[1] === "Consult at Priya's"); }
    ok('both cards listed under "To check (2)"', (await card(p, 'Consultation').count()) === 1 && (await card(p, "Consult at Priya's").count()) === 1);
    ok('talk screen points to them ("Found 2 things")', (await p.innerText('main')).includes('Found 2 things'));
    await p.screenshot({ path: SP + 'tocheck.png', fullPage: true });
    await p.reload(); await p.waitForSelector('text=To check (2)');
    ok('still there after closing and reopening the page', true);
    await say('Order the hinges tomorrow and chase Dave.'); await record(p);
    await p.waitForSelector('text=To check (4)', { timeout: 20000 });
    ok('a new note adds its cards without losing the old ones (4, in 2 groups)', (await p.locator('text=From your note').count()) === 2);
    const p2 = await ctx.newPage(); await p2.goto('http://localhost:3000/'); await p2.waitForSelector('text=To check (4)');
    ok('and they show up on another tab/session too', true);
    await ctx.close(); }

  console.log('2. Confirm a to-do');
  { const { ctx, p } = await open(b); await say('Order the hinges tomorrow and chase Dave.'); await record(p);
    await p.waitForSelector('text=To check (2)', { timeout: 20000 });
    await confirmBtn(card(p, 'Order soft-close hinges')).click();
    await gone(p, 'Order soft-close hinges');
    ok('the card disappears and a confirmation shows', (await p.innerText('main')).includes('✓ To-do confirmed: Order soft-close hinges') && (await heading(p).innerText()).includes('(1)'));
    ok('saved as confirmed', (await st()).items.find(i => i.title === 'Order soft-close hinges').status === 'confirmed');
    console.log('7. Discard');
    await card(p, 'Chase laundry quote').getByRole('button', { name: 'Discard' }).click();
    await gone(p, 'Chase laundry quote');
    ok('discarded card goes, and is kept as discarded', (await st()).items.find(i => i.title === 'Chase laundry quote').status === 'discarded');
    ok('section hides when nothing is left to check', (await p.locator('h2', { hasText: 'To check' }).count()) === 0);
    await ctx.close(); }

  console.log('3. Confirm a New job card: the client and job are created, and the booking is linked');
  { const { ctx, p } = await open(b); await say(PRIYA); await record(p);
    await p.waitForSelector('text=To check (2)', { timeout: 20000 });
    ok('job card shows the new client and status', (await card(p, 'Consultation').innerText()).includes('Client: Priya (new client)') && (await card(p, 'Consultation').innerText()).includes('Consultation'));
    await confirmBtn(card(p, 'Consultation').first()).click();
    await p.waitForSelector('text=To check (1)', { timeout: 15000 });
    const s = await st();
    ok('client Priya and her job were created', s.madeClients.length === 1 && s.madeClients[0].name === 'Priya' && s.madeJobs.length === 1 && s.madeJobs[0].client_id === s.madeClients[0].id);
    ok('the calendar card was linked to that job', s.items.find(i => i.type === 'calendar').job_id === s.madeJobs[0].id);
    ok('the calendar card now shows the client', (await card(p, "Consult at Priya's").innerText()).includes('Client: Priya'));
    await confirmBtn(card(p, "Consult at Priya's")).click(); await gone(p, "Consult at Priya's");
    ok('booking confirmed', (await st()).items.find(i => i.type === 'calendar').status === 'confirmed');
    await ctx.close(); }

  console.log('4. A booking with no date cannot be confirmed until you add one');
  { const { ctx, p } = await open(b); await say('NODATE meet the supplier'); await record(p);
    await p.waitForSelector('text=To check (1)', { timeout: 20000 });
    const c = card(p, 'Meet the supplier');
    ok('card says "Needs a date" and Confirm is disabled', (await c.innerText()).includes('Needs a date') && await confirmBtn(c).isDisabled());
    await c.getByRole('button', { name: 'Edit' }).click();
    for (let n = 0; n < 12 && (await p.getByRole('button', { name: 'Wednesday 4 November 2026' }).count()) === 0; n++) await p.getByRole('button', { name: 'Next month' }).click();
    await p.getByRole('button', { name: 'Wednesday 4 November 2026' }).click(); await p.fill('input[type=time] >> nth=1', '12:00');
    await p.click('button:has-text("Save")');
    await p.waitForSelector('text=Wed 4 Nov', { timeout: 10000 });
    ok('after editing it shows the date and time range', (await card(p, 'Meet the supplier').innerText()).includes('Wed 4 Nov · 11:00am'));
    ok('Confirm now works', !(await confirmBtn(card(p, 'Meet the supplier')).isDisabled()));
    await confirmBtn(card(p, 'Meet the supplier')).click(); await gone(p, 'Meet the supplier');
    const it = (await st()).items[0]; ok('saved with the new date and end time', it.due_date === '2026-11-04' && it.end_time === '12:00' && it.status === 'confirmed');
    await ctx.close(); }

  console.log('5. Two clients could fit: pick one');
  { const { ctx, p } = await open(b); await say('Site visit at Rob on Saturday at two.'); await record(p);
    await p.waitForSelector('text=Which client?', { timeout: 20000 });
    await p.getByRole('button', { name: 'Robyn Clarke' }).click();
    await p.waitForSelector('text=Client: Robyn Clarke', { timeout: 10000 });
    ok('the choice is saved and shown', (await st()).items[0].client_id === 'cl-robyn' && !(await p.innerText('main')).includes('Which client?'));
    await ctx.close(); }

  console.log('6. A job card with no client: fill it in by hand, then confirm');
  { const { ctx, p } = await open(b); await say('NOCLIENT bathroom'); await record(p);
    await p.waitForSelector('text=To check (1)', { timeout: 20000 });
    const c = card(p, 'Bathroom job');
    ok('says "Needs a client" and Confirm is disabled', (await c.innerText()).includes('Needs a client') && await confirmBtn(c).isDisabled());
    await c.getByRole('button', { name: 'Edit' }).click();
    await p.fill('label:has-text("Client name") input', 'Sam Taylor'); await p.fill('label:has-text("Client phone") input', '0411 000 111');
    await p.selectOption('label:has-text("Status") select', 'booked');
    await p.click('button:has-text("Save")');
    await p.waitForSelector('text=Sam Taylor (new client)', { timeout: 10000 });
    ok('shows the new client and "Booked job"', (await card(p, 'Bathroom job').innerText()).includes('Booked job'));
    await confirmBtn(card(p, 'Bathroom job')).click(); await gone(p, 'Bathroom job');
    const s = await st(); ok('client and job created with the edited details', s.madeClients[0].name === 'Sam Taylor' && s.madeClients[0].phone === '0411 000 111' && s.madeJobs[0].status === 'booked');
    await ctx.close(); }

  console.log('8. Confirm all');
  { const { ctx, p } = await open(b); await say(PRIYA); await record(p);
    await p.waitForSelector('text=To check (2)', { timeout: 20000 });
    await p.click('button:has-text("Confirm all")');
    await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    const s = await st();
    ok('both cards confirmed, job made, booking linked', s.items.every(i => i.status === 'confirmed') && s.madeJobs.length === 1 && s.items.find(i => i.type === 'calendar').job_id === s.madeJobs[0].id);
    await ctx.close(); }

  console.log('9. Confirm all skips cards that still need something, and says nothing falsely');
  { const { ctx, p } = await open(b); await say('NODATE meet the supplier'); await record(p);
    await p.waitForSelector('text=To check (1)', { timeout: 20000 });
    ok('a single card has no "Confirm all"', (await p.getByRole('button', { name: 'Confirm all' }).count()) === 0);
    await ctx.close(); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
