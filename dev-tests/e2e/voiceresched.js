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
async function record(p) {
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200);
  await p.click('button[aria-label="Stop recording"]');
}
const total = async p => Number(((await p.locator('h2', { hasText: 'To check' }).innerText()).match(/\((\d+)\)/) || [])[1] || 0);
const waitTotal = (p, n) => p.waitForSelector(`text=To check (${n})`, { timeout: 25000 });
const warns = p => p.locator('[role=note]');
const card = (p, text) => p.locator('article', { hasText: text });

const notesIn = p => p.locator('section', { has: p.locator('h2', { hasText: 'Recent notes' }) }).locator('li');
const sydney = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const plus = (n) => { const [y, m, d] = sydney().split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dayLabel = iso => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); const f = o => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...o }).format(dt); return `${f({ weekday: 'short' })} ${f({ day: 'numeric' })} ${f({ month: 'short' })}`; };
const P = plus(3), D = plus(4), NEW = '2026-11-12';
const confirmBtn = c => c.getByRole('button', { name: 'Confirm', exact: true });
const bookingOf = async title => { const it = (await st()).items.find(i => i.title === title && i.type === 'calendar'); if (it) { it.start_time = it.start_time && it.start_time.slice(0, 5); it.end_time = it.end_time && it.end_time.slice(0, 5); } return it; };

async function fresh(b, seed = true) {
  const r = await open(b);
  if (seed) await post('/__seed', { items: [
    { type: 'calendar', title: "Consult at Priya's", due_date: P, start_time: '09:00:00', end_time: '10:00:00', client_name: 'Priya' },
    { type: 'calendar', title: 'Site visit', due_date: D, start_time: '14:00:00', client_name: 'Dave Nguyen' },
  ] });
  return r;
}
async function say1(p, text) { await say(text); await record(p); await p.waitForSelector('article', { timeout: 25000 }); await p.waitForSelector('text=/Found \\d+ thing|looks like a repeat of something/', { timeout: 25000 }); }

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('1. "Move Priya\'s consult to Thursday at 2"');
  { const { ctx, p } = await fresh(b); await say1(p, 'MOVEPRIYA move the consult');
    const c = card(p, "Move Consult at Priya's");
    const t = await c.innerText();
    ok('the sorter was shown the upcoming bookings (ids and all)', (await st()).anthropic[0].sawBookings.includes("Consult at Priya's") && (await st()).anthropic[0].sawBookings.includes('Site visit'));
    ok('labelled RESCHEDULE', /RESCHEDULE/i.test(t));
    ok('shows where it is now', t.includes(`Now: ${dayLabel(P)} · 9:00am`));
    ok('and where it will move to, with the times', t.includes(`Move to: ${dayLabel(NEW)} · 2:00pm until 3:00pm`));
    ok('names the client', t.includes('Client: Priya'));
    await p.screenshot({ path: SP + 'voice-reschedule.png', fullPage: true });
    await confirmBtn(c).click(); await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    const bk = await bookingOf("Consult at Priya's");
    ok('Confirm moved the real booking', bk.due_date === NEW && bk.start_time === '14:00' && bk.end_time === '15:00' && bk.status === 'confirmed');
    ok('the note cleared off the home screen, as for any approved note', (await notesIn(p).filter({ hasText: 'MOVEPRIYA' }).count()) === 0);
    await ctx.close(); }

  console.log('2. Only a new day is said: the time carries over');
  { const { ctx, p } = await fresh(b); await say1(p, 'DAYONLY move the consult to the twelfth');
    ok('shows 9:00am until 10:00am on the new day', (await card(p, "Move Consult at Priya's").innerText()).includes(`Move to: ${dayLabel(NEW)} · 9:00am until 10:00am`)); await ctx.close(); }

  console.log('3. "Cancel Dave\'s site visit"');
  { const { ctx, p } = await fresh(b); await say1(p, 'CANCELDAVE cancel the site visit');
    const c = card(p, 'Cancel Site visit'); const t = await c.innerText();
    ok('labelled CANCEL BOOKING, with when it is booked', /CANCEL BOOKING/i.test(t) && t.includes(`Booked for: ${dayLabel(D)} · 2:00pm`));
    ok('says what will happen', t.includes('It will be taken off Today and your calendar.'));
    ok('has no Edit button (nothing to edit)', (await c.getByRole('button', { name: 'Edit' }).count()) === 0);
    await confirmBtn(c).click(); await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    const bk = await bookingOf('Site visit');
    ok('Confirm cancelled the booking, kept as a record', bk.status === 'discarded' && !!bk.details.cancelled_at);
    await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Schedule');
    ok('and it has gone from Today', !(await p.innerText('main')).includes('Site visit'));
    await ctx.close(); }

  console.log('4. It cannot tell which booking: it asks');
  { const { ctx, p } = await fresh(b); await say1(p, 'WHICHONE move one of them');
    const c = card(p, 'Move a booking');
    ok('asks "Which booking?" with a button for each', (await c.innerText()).includes('Which booking?') && (await c.getByRole('button', { name: /Consult at Priya's/ }).count()) === 1 && (await c.getByRole('button', { name: /Site visit/ }).count()) === 1);
    ok('Confirm is off until you choose', await confirmBtn(c).isDisabled() && (await c.innerText()).includes('Choose which booking'));
    await c.getByRole('button', { name: /Site visit/ }).click();
    await p.waitForFunction(() => document.body.innerText.includes('Now:'), null, { timeout: 10000 });
    const c2 = card(p, 'Move a booking');
    ok('after choosing, it shows the before and after', (await c2.innerText()).includes(`Now: ${dayLabel(D)} · 2:00pm`) && (await c2.innerText()).includes(`Move to: ${dayLabel(NEW)} · 10:00am`));
    await confirmBtn(c2).click(); await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    const bk = await bookingOf('Site visit'); ok('the chosen booking (not the other one) moved', bk.due_date === NEW && bk.start_time === '10:00' && (await bookingOf("Consult at Priya's")).due_date === P);
    await ctx.close(); }

  console.log('5. Nothing matches, or the sorter made up a booking: you are still never stuck');
  for (const [word, what] of [['NOMATCH', 'no match'], ['BOGUSID', 'an invented booking id']]) {
    const { ctx, p } = await fresh(b); await say1(p, `${word} cancel something`);
    const c = p.locator('article').first();
    { const seen = { priya: await c.getByRole('button', { name: /Consult at Priya's/ }).count(), visit: await c.getByRole('button', { name: /Site visit/ }).count(), off: await confirmBtn(c).isDisabled(), cards: await p.locator('article').count() }; if (!(seen.priya === 1 && seen.visit === 1 && seen.off)) console.log('   saw:', JSON.stringify(seen), (await c.innerText()).replace(/\n+/g, ' | ')); ok(`(${what}) the nearest bookings are offered to choose from`, seen.priya === 1 && seen.visit === 1 && seen.off); }
    await c.getByRole('button', { name: /Consult at Priya's/ }).click();
    await p.waitForFunction(() => document.body.innerText.includes('Booked for:'), null, { timeout: 10000 });
    await confirmBtn(p.locator('article').first()).click(); await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    ok(`(${what}) choosing one and confirming cancels that booking`, (await bookingOf("Consult at Priya's")).status === 'discarded');
    await ctx.close(); }
  { const { ctx, p } = await fresh(b, false); await say1(p, 'NOMATCH cancel something');
    const c = p.locator('article').first();
    ok('with no bookings at all, it says so and Confirm stays off', (await c.innerText()).includes("couldn't find a booking") && await confirmBtn(c).isDisabled()); await ctx.close(); }

  console.log('6. Moving a booking to where it already is');
  { const { ctx, p } = await fresh(b); await say1(p, 'SAMETIME move the consult');
    const c = card(p, "Move Consult at Priya's");
    ok('flagged as already booked at that time, offering to discard', (await c.innerText()).includes('is already booked at that time') && (await c.getByRole('button', { name: 'Discard repeat' }).count()) === 1);
    await c.getByRole('button', { name: 'Discard repeat' }).click(); await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    ok('discarding leaves the booking alone', (await bookingOf("Consult at Priya's")).due_date === P); await ctx.close(); }

  console.log('7. Edit a reschedule card before confirming');
  { const { ctx, p } = await fresh(b); await say1(p, 'MOVEPRIYA move the consult');
    const c = card(p, "Move Consult at Priya's"); await c.getByRole('button', { name: 'Edit' }).click();
    const form = p.locator('form', { hasText: 'Editing' });
    const ft = await form.innerText();
    ok('the form asks for the "New day" and times, with no address or notes', ft.includes('New day') && ft.includes('Starts') && !ft.includes('Where') && !ft.includes('Notes'));
    await form.getByRole('button', { name: /^Thursday|^Friday|^Monday|^Tuesday|^Wednesday|^Saturday|^Sunday/ }).first().click();
    await form.getByRole('button', { name: 'Tomorrow', exact: true }).click();
    await form.locator('input[type=time]').nth(0).fill('16:00'); await form.locator('input[type=time]').nth(1).fill('17:30');
    await form.getByRole('button', { name: 'Save' }).click();
    await p.waitForFunction(() => document.body.innerText.includes('until 5:30pm'), null, { timeout: 10000 });
    await confirmBtn(card(p, "Move Consult at Priya's")).click(); await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    const bk = await bookingOf("Consult at Priya's");
    ok('the edited day and times were used', bk.due_date === plus(1) && bk.start_time === '16:00' && bk.end_time === '17:30'); await ctx.close(); }

  console.log('8. Discard, and the booking being changed behind your back');
  { const { ctx, p } = await fresh(b); await say1(p, 'CANCELDAVE cancel the site visit');
    await post('/__setstatus', { title: 'Site visit', status: 'discarded' });   // someone cancelled it already
    await confirmBtn(card(p, 'Cancel Site visit')).click();
    await p.waitForSelector('text=Only a confirmed booking can be cancelled', { timeout: 10000 });
    ok('a clear message shows, and the card stays so you can discard it', (await card(p, 'Cancel Site visit').count()) === 1);
    await card(p, 'Cancel Site visit').getByRole('button', { name: 'Discard', exact: true }).click();
    await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    ok('discarding the card is fine', true); await ctx.close(); }
  { const { ctx, p } = await fresh(b); await say1(p, 'MOVEPRIYA move the consult');
    await card(p, "Move Consult at Priya's").getByRole('button', { name: 'Discard', exact: true }).click();
    await p.waitForFunction(() => !document.body.innerText.includes('To check ('), null, { timeout: 15000 });
    ok('discarding a move card leaves the booking untouched', (await bookingOf("Consult at Priya's")).due_date === P); await ctx.close(); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
