const { chromium } = require('playwright');
const { spawn } = require('child_process');
const env = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', EMAIL_FROM: 'Yarn <briefing@mail.sundaykitchens.com.au>', RESEND_API_KEY: 're_test_key', RESEND_API_URL: 'http://localhost:4000/resend' };
const pr = spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', '3000'], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' });
const stopAll = () => { try { process.kill(-pr.pid); } catch {} };
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const get = path => fetch('http://localhost:4000' + path).then(r => r.json());
let fails = 0; const ok = (l, c) => { if (!c) fails++; console.log(`   ${c ? 'PASS' : 'FAIL'} - ${l}`); };
const sydney = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const plus = n => { const [y, m, d] = sydney().split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const lab = iso => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); const f = o => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...o }).format(dt); return `${f({ weekday: 'short' })} ${f({ day: 'numeric' })} ${f({ month: 'short' })}`; };
const D = plus(4), NEW = '2026-11-12';
const say = text => post('/__mode', { text });
const card = (p, t) => p.locator('article', { hasText: t });
const btn = (c, name) => c.getByRole('button', { name, exact: true });
const mails = () => get('/__emails');
const waitMails = async n => { for (let i = 0; i < 60 && (await mails()).length < n; i++) await new Promise(r => setTimeout(r, 250)); return mails(); };
const reset = async () => { await post('/__reset'); await post('/__bizreset'); await post('/__emailsreset'); await post('/__sentreset'); };
async function open(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto('http://localhost:3000/login'); await p.fill('input[type=email]', 'natasha@example.com'); await p.fill('input[type=password]', 'password123'); await p.click('button[type=submit]');
  await p.waitForSelector('button[aria-label="Start recording"]'); await p.waitForSelector('text=Recent notes'); return { ctx, p };
}
async function record(p) { await p.click('button[aria-label="Start recording"]'); await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1200); await p.click('button[aria-label="Stop recording"]'); }
async function say1(p, text) { await say(text); await record(p); await p.waitForSelector('article', { timeout: 25000 }); await p.waitForSelector('text=/Found \\d+ thing|looks like a repeat of something/', { timeout: 25000 }); }
const seedBooking = () => post('/__seed', { items: [{ type: 'calendar', title: 'Site visit', due_date: D, start_time: '14:00:00', client_name: 'Robyn Clarke', client_id: 'cl-robyn' }] });
const toast = async (p, t) => p.waitForFunction(x => [...document.querySelectorAll('[role=status]')].some(e => e.textContent.includes(x)), t, { timeout: 15000 });
const setIdentity = () => post('/__bizset', { email_from_name: 'Tabrez – Sunday Kitchens', email_reply_to: 'tabrez@sundaykitchens.com.au', email_sign_off: 'Tabrez\nSunday Kitchens\n0400 000 000' });

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

  console.log('1. Settings: how clients see your emails');
  { await reset(); const { p } = await open(b);
    await p.goto('http://localhost:3000/settings'); await p.waitForSelector('h2:has-text("Emails to clients")');
    ok('shows the sending address and who clients see', await p.locator('text=briefing@mail.sundaykitchens.com.au').count() >= 1 && await p.locator('text=Fresh Joinery').count() >= 1);
    await p.fill('input[name=from_name]', 'Tabrez – Sunday Kitchens'); await p.fill('input[name=reply_to]', 'not-an-email');
    await p.locator('section', { hasText: 'Emails to clients' }).getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(600);
    ok('the phone itself stops a bad address before it is even sent', (await get('/__biz')).patches.length === 0);
    await p.evaluate(() => { document.querySelector('input[name=reply_to]').type = 'text'; });
    await p.locator('section', { hasText: 'Emails to clients' }).getByRole('button', { name: 'Save', exact: true }).click();
    await toast(p, "reply-to email address doesn't look right");
    ok('a bad reply-to is refused and nothing saved', (await get('/__biz')).patches.length === 0);
    await p.waitForSelector('input[name=from_name]');
    await p.fill('input[name=from_name]', 'Tabrez – Sunday Kitchens'); await p.fill('input[name=reply_to]', 'tabrez@sundaykitchens.com.au'); await p.fill('textarea[name=sign_off]', 'Tabrez\nSunday Kitchens\n0400 000 000');
    await p.locator('section', { hasText: 'Emails to clients' }).getByRole('button', { name: 'Save', exact: true }).click();
    await toast(p, 'Saved.');
    const s = (await get('/__biz')).settings;
    ok('saved name, reply-to and sign-off', s.email_from_name === 'Tabrez – Sunday Kitchens' && s.email_reply_to === 'tabrez@sundaykitchens.com.au' && s.email_sign_off.includes('0400 000 000')); }

  console.log('2. Voice: "move the site visit and let Robyn know"');
  { await reset(); await setIdentity(); const { ctx, p } = await open(b); await seedBooking();
    await say1(p, 'MOVETELL move the site visit and tell Robyn');
    const mv = card(p, 'Move Site visit'), em = card(p, 'Email to Robyn Clarke');
    ok('two cards: the move and the email', await mv.count() === 1 && await em.count() === 1);
    const t = await em.innerText();
    ok('subject has the real new day and time', t.includes(`Moving our booking to ${lab(NEW)}, 9:00am`));
    ok('body has the real old and new times, and her reason', t.includes(`from ${lab(D)}, 2:00pm to ${lab(NEW)}, 9:00am. It's because of a supplier delay.`));
    ok("signed with her sign-off, addressed to Robyn's email on file", t.includes('Hi Robyn,') && t.includes('0400 000 000') && t.includes('robyn@example.com'));
    ok('the sorter was never shown the client email addresses', !(await get('/__state')).anthropic[0].content.includes('robyn@example.com'));
    ok('Send is held back until the move is confirmed', await btn(em, 'Send email').isDisabled() && t.includes('Confirm the change above first'));
    ok('nothing has been sent yet', (await mails()).length === 0);
    await btn(mv, 'Confirm').click(); await p.waitForFunction(() => !document.body.innerText.includes('Move Site visit') || document.querySelectorAll('article').length === 1, null, { timeout: 15000 });
    await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Send email'); return b && !b.disabled; }, null, { timeout: 15000 });
    ok('after confirming the move, Send is available', true);
    await btn(em, 'Send email').click();
    const m = (await waitMails(1))[0];
    ok('exactly one email sent', (await mails()).length === 1);
    ok('from her business name on the Yarn sending address', m.from === 'Tabrez – Sunday Kitchens <briefing@mail.sundaykitchens.com.au>');
    ok('replies go to her', m.reply_to === 'tabrez@sundaykitchens.com.au' && m.to[0] === 'robyn@example.com');
    ok('subject and message as shown, with the Yarn footer', m.subject === `Moving our booking to ${lab(NEW)}, 9:00am` && m.text.includes("It's because of a supplier delay.") && m.text.includes('Tabrez\nSunday Kitchens\n0400 000 000') && m.text.endsWith('Sent with Yarn') && m.html.includes('Sent with Yarn'));
    const item = (await get('/__state')).items.find(i => i.type === 'email');
    ok('the card is marked done and a send record is kept', item.status === 'confirmed' && (await get('/__sentlog')).length === 1 && (await get('/__sentlog'))[0].status === 'sent' && (await get('/__sentlog'))[0].to_email === 'robyn@example.com');
    const again = await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: item.id } });
    ok('sending the same card again is refused (no double send)', again.status() === 409 && (await mails()).length === 1);
    const bk = (await get('/__state')).items.find(i => i.type === 'calendar'); ok('the booking itself really moved', bk.due_date === NEW); }

  console.log('3. Voice: "cancel the site visit and tell Robyn"');
  { await reset(); await setIdentity(); const { p } = await open(b); await seedBooking();
    await say1(p, 'CANCELTELL cancel the site visit and let Robyn know');
    const em = card(p, 'Email to Robyn Clarke'); const t = await em.innerText();
    ok('cancel notice with the real day and her reason', t.includes(`Cancelling our booking on ${lab(D)}`) && t.includes(`on ${lab(D)}, 2:00pm. I've come down with the flu.`));
    await btn(card(p, 'Cancel Site visit'), 'Confirm').click();
    await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Send email'); return b && !b.disabled; }, null, { timeout: 15000 });
    await btn(em, 'Send email').click(); const m = (await waitMails(1))[0];
    ok('cancel email sent', m.subject === `Cancelling our booking on ${lab(D)}` && m.text.includes('Sorry for the inconvenience.'));
    ok('booking is cancelled in Yarn', (await get('/__state')).items.find(i => i.type === 'calendar').status === 'discarded'); }

  console.log('4. Voice: a free-form email, edited before sending');
  { await reset(); await setIdentity(); const { p } = await open(b);
    await say1(p, 'EMAILROBYN email Robyn the quote is ready');
    const em = card(p, 'Email to Robyn Clarke'); const t = await em.innerText();
    ok('her words get a greeting and sign-off', t.includes('Quote ready') && t.includes("Hi Robyn,\n\nYour quote is ready. I'll drop it round on Friday.\n\nThanks,\nTabrez"));
    ok('no change card, so Send is ready straight away', !(await btn(em, 'Send email').isDisabled()));
    await btn(em, 'Edit').click();
    const msg = p.locator('textarea'); await msg.fill("Hi Robyn,\n\nYour quote is ready & attached.\n\nCheers,\nTabrez"); await p.locator('input').nth(1).fill('Your quote');
    await btn(p.locator('form'), 'Save').click(); await p.waitForSelector('text=Your quote is ready & attached.');
    ok('edit saved on the card', (await get('/__state')).items.find(i => i.type === 'email').details.email.subject === 'Your quote');
    await btn(card(p, 'Email to Robyn Clarke'), 'Send email').click(); const m = (await waitMails(1))[0];
    ok('what was edited is what was sent (escaped in html)', m.subject === 'Your quote' && m.text.includes('Your quote is ready & attached.') && m.html.includes('ready &amp; attached')); }

  console.log('5. A client with no email address on file');
  { await reset(); await setIdentity(); const { p } = await open(b);
    await say1(p, 'EMAILDAVE email Dave about the colour');
    const em = card(p, 'Email to Dave Nguyen'); const t = await em.innerText();
    ok('card says there is no address, and Send is off', t.includes('no email address yet') && t.includes('Add an email address first') && await btn(em, 'Send email').isDisabled());
    await btn(em, 'Edit').click(); await p.locator('input[placeholder="name@example.com"]').fill('nope'); await btn(p.locator('form').filter({ hasText: 'Editing' }), 'Save').click(); await p.waitForTimeout(500);
    ok('the phone stops a bad address before it is saved', (await get('/__state')).items.find(i => i.type === 'email').details.email.to === null);
    await p.evaluate(() => { document.querySelector('input[placeholder="name@example.com"]').type = 'text'; });
    await btn(p.locator('form').filter({ hasText: 'Editing' }), 'Save').click();
    ok('and Yarn checks again itself if that is bypassed', await p.locator('text=doesn\'t look right').count() === 1);
    await p.locator('input[placeholder="name@example.com"]').fill('dave@example.com'); await btn(p.locator('form').filter({ hasText: 'Editing' }), 'Save').click(); await p.waitForSelector('text=dave@example.com');
    await btn(card(p, 'Email to Dave Nguyen'), 'Send email').click(); const m = (await waitMails(1))[0];
    ok('sent to the address she typed', m.to[0] === 'dave@example.com');
    ok('the address is saved on the client for next time', (await get('/__clientpatches')).some(c => c.id === 'cl-dave' && c.email === 'dave@example.com')); }

  console.log('6. When sending fails');
  { await reset(); await setIdentity(); const { ctx, p } = await open(b);
    await say1(p, 'EMAILROBYN email Robyn the quote is ready');
    await post('/__emailfail', { code: 500, message: 'Resend is having a moment' });
    await btn(card(p, 'Email to Robyn Clarke'), 'Send email').click(); await p.waitForSelector('text=Resend is having a moment');
    const item = (await get('/__state')).items.find(i => i.type === 'email');
    ok('error shown on the card, and it is still waiting to send', item.status === 'pending' && (await mails()).length === 0);
    ok('failure is logged', (await get('/__sentlog')).some(l => l.status === 'failed' && l.error.includes('Resend is having a moment')));
    await post('/__emailfail', { code: 403, message: 'The mail.example.com domain is not verified' });
    await btn(card(p, 'Email to Robyn Clarke'), 'Send email').click(); await p.waitForSelector('text=domain is not verified');
    ok('a refusal explains why', true);
    await post('/__emailsreset'); await btn(card(p, 'Email to Robyn Clarke'), 'Send email').click(); await waitMails(1);
    ok('retry works and sends exactly once', (await mails()).length === 1 && (await get('/__state')).items.find(i => i.type === 'email').status === 'confirmed'); }

  console.log('7. Confirm all never sends an email by itself');
  { await reset(); await setIdentity(); const { p } = await open(b); await seedBooking();
    await say1(p, 'MOVETELL move the site visit and tell Robyn');
    await p.getByRole('button', { name: 'Confirm all' }).click();
    await p.waitForSelector('text=/1 email is waiting for you to send/');
    ok('the move was confirmed, the email was left for her', (await get('/__state')).items.find(i => i.type === 'calendar').due_date === NEW && (await get('/__state')).items.find(i => i.type === 'email').status === 'pending' && (await mails()).length === 0);
    await btn(card(p, 'Email to Robyn Clarke'), 'Send email').click(); await waitMails(1);
    ok('then Send works', (await mails()).length === 1); }

  console.log('8. Discarded the change? The email about it will not go');
  { await reset(); await setIdentity(); const { ctx, p } = await open(b); await seedBooking();
    await say1(p, 'MOVETELL move the site visit and tell Robyn');
    await btn(card(p, 'Move Site visit'), 'Discard').click(); await p.waitForFunction(() => document.querySelectorAll('article').length === 1);
    await btn(card(p, 'Email to Robyn Clarke'), 'Send email').click(); await p.waitForSelector('text=You discarded the change');
    ok('blocked with a clear message, nothing sent', (await mails()).length === 0 && (await get('/__state')).items.find(i => i.type === 'email').status === 'pending'); }

  console.log('9. Today buttons: moving or cancelling drafts the email for her to send');
  { await reset(); await setIdentity(); const { ctx, p } = await open(b);
    await post('/__seed', { items: [
      { type: 'calendar', title: 'Morning job', due_date: plus(0), start_time: '08:00:00', client_name: 'Robyn Clarke', client_id: 'cl-robyn' },
      { type: 'calendar', title: 'Dave job', due_date: plus(0), start_time: '10:00:00', client_name: 'Dave Nguyen', client_id: 'cl-dave' },
      { type: 'calendar', title: 'Cancel me', due_date: plus(0), start_time: '15:00:00', client_name: 'Robyn Clarke', client_id: 'cl-robyn' },
    ] });
    p.on('dialog', d => d.accept());
    await p.goto('http://localhost:3000/today'); await p.waitForSelector('text=Morning job');
    const row = t => p.locator('li', { hasText: t });
    await row('Morning job').getByRole('button', { name: 'Reschedule' }).click();
    await p.getByRole('button', { name: 'Tomorrow', exact: true }).click(); await p.locator('input[type=time]').nth(0).fill('10:30'); await p.locator('input[type=time]').nth(1).fill('11:30');
    await p.getByRole('button', { name: 'Move it' }).click(); await toast(p, 'email to Robyn is ready to check');
    let em = (await get('/__state')).items.filter(i => i.type === 'email');
    ok('one pending email card was written, not sent', em.length === 1 && em[0].status === 'pending' && (await mails()).length === 0);
    ok('it has the real before and after', em[0].details.email.subject === `Moving our booking to ${lab(plus(1))}, 10:30am` && em[0].details.email.body.includes(`(Morning job) from ${lab(plus(0))}, 8:00am to ${lab(plus(1))}, 10:30am.`) && em[0].details.email.to === 'robyn@example.com');
    await row('Dave job').getByRole('button', { name: 'Reschedule' }).click();
    await p.getByRole('button', { name: 'Tomorrow', exact: true }).click(); await p.getByRole('button', { name: 'Move it' }).click();
    await p.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('Moved'), null, { timeout: 10000 });
    await p.waitForTimeout(800);
    ok('a client with no email gets no draft', (await get('/__state')).items.filter(i => i.type === 'email').length === 1 && !(await p.locator('[role=status]').innerText()).includes('email to'));
    await row('Cancel me').getByRole('button', { name: 'Cancel booking' }).click(); await toast(p, 'email to Robyn is ready to check');
    em = (await get('/__state')).items.filter(i => i.type === 'email');
    ok('cancel makes a cancel notice', em.length === 2 && em.some(e => e.details.email.kind === 'cancel' && e.details.email.subject === `Cancelling our booking on ${lab(plus(0))}`));
    await p.goto('http://localhost:3000/'); await p.waitForSelector('text=To check (2)');
    ok('both are waiting in To check', await card(p, 'Email to Robyn Clarke').count() === 2);
    const mk = (await get('/__state')).items.find(i => i.title === 'Morning job');
    const dup = await ctx.request.post('http://localhost:3000/api/email/draft', { data: { bookingId: mk.id, kind: 'reschedule' } });
    ok('asking again does not make a second draft', (await dup.json()).status === 'exists' && (await get('/__state')).items.filter(i => i.type === 'email').length === 2);
    await btn(card(p, 'Moving our booking'), 'Send email').click(); await waitMails(1);
    ok('and sending it works', (await mails()).length === 1 && (await mails())[0].to[0] === 'robyn@example.com'); }

  console.log('10. Safety and layout');
  { await reset(); await setIdentity(); const { ctx, p } = await open(b);
    const anon = await (await b.newContext()).request.post('http://localhost:3000/api/email/send', { data: { itemId: 'x' }, maxRedirects: 0 });
    ok('logged-out send refused', [307, 401].includes(anon.status()));
    ok('missing id -> 400', (await ctx.request.post('http://localhost:3000/api/email/send', { data: {} })).status() === 400);
    ok('unknown card -> 404', (await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: 'nope' } })).status() === 404);
    await post('/__seed', { items: [{ type: 'todo', title: 'A todo', status: 'pending' }] });
    const todo = (await get('/__state')).items.find(i => i.title === 'A todo');
    ok('a to-do cannot be "sent"', (await ctx.request.post('http://localhost:3000/api/email/send', { data: { itemId: todo.id } })).status() === 400);
    ok('draft needs a real booking', (await ctx.request.post('http://localhost:3000/api/email/draft', { data: { bookingId: 'nope', kind: 'cancel' } })).status() === 404);
    await p.setViewportSize({ width: 360, height: 780 }); await seedBooking(); await say1(p, 'MOVETELL move the site visit and tell Robyn');
    let w = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    ok('email card fits a small phone', w.s <= w.c);
    await btn(card(p, 'Email to Robyn Clarke'), 'Edit').click(); await p.waitForSelector('textarea');
    w = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    ok('and so does its edit form', w.s <= w.c); }

  console.log('11. "Open in my email app": reply from her own mail app, any provider');
  { await reset(); await setIdentity(); const { p } = await open(b); await seedBooking();
    await say1(p, 'EMAILROBYN reply to Robyn about the quote');
    const em = card(p, 'Email to Robyn Clarke');
    const link = em.locator('a:has-text("Open in my email app")');
    ok('the email card offers it', await link.count() === 1);
    const href = await link.getAttribute('href');
    ok('it opens a new email to Robyn with the subject', href.startsWith('mailto:robyn@example.com?subject=Quote%20ready&body='));
    ok('with the message exactly as written, line breaks included', decodeURIComponent(href.split('&body=')[1]) === "Hi Robyn,\r\n\r\nYour quote is ready. I'll drop it round on Friday.\r\n\r\nThanks,\r\nTabrez\r\nSunday Kitchens\r\n0400 000 000");
    await p.evaluate(() => { document.querySelector('a[href^="mailto:"]').addEventListener('click', e => e.preventDefault()); });
    await link.click();
    await p.waitForSelector('text=Opened in your email app');
    ok('the card remembers it, and nothing was sent by Yarn', (await get('/__state')).items.find(i => i.type === 'email').details.handed_off_at && (await mails()).length === 0);
    ok('it asks whether she sent it, and Send with Yarn is still there', await btn(em, 'Done, I sent it').count() === 1 && await btn(em, 'Send email').count() === 1);
    await btn(em, 'Done, I sent it').click();
    await p.waitForFunction(() => document.querySelectorAll('article').length === 0, null, { timeout: 15000 });
    ok('Done clears the card without Yarn sending anything', (await get('/__state')).items.find(i => i.type === 'email').status === 'confirmed' && (await mails()).length === 0); }
  { await reset(); await setIdentity(); const { p } = await open(b);
    await say1(p, 'EMAILDAVE email Dave about the colour');
    const href = await card(p, 'Email to Dave Nguyen').locator('a:has-text("Open in my email app")').getAttribute('href');
    ok('a client with no address still works: her mail app opens with To empty to pick someone', href.startsWith('mailto:?subject=Quick%20question&body=')); }
  { await reset(); await setIdentity(); const { p } = await open(b); await seedBooking();
    await say1(p, 'MOVETELL move the site visit and tell Robyn');
    ok('an email about a move has no mail-app link until the move is confirmed', await card(p, 'Email to Robyn Clarke').locator('a:has-text("Open in my email app")').count() === 0); }
  { await reset(); await setIdentity(); const { p } = await open(b);
    await say1(p, 'EMAILROBYN email Robyn the quote is ready');
    await btn(card(p, 'Email to Robyn Clarke'), 'Edit').click(); await p.locator('textarea').fill('long message '.repeat(200));
    await btn(p.locator('form').filter({ hasText: 'Editing' }), 'Save').click(); await p.waitForSelector('text=long message'); await p.waitForFunction(() => !document.querySelector('a[href^="mailto:"]'), null, { timeout: 10000 }).catch(() => {});
    ok('a message too long for a phone link has no mail-app link, but can still be sent', await card(p, 'Email to Robyn Clarke').locator('a:has-text("Open in my email app")').count() === 0 && await btn(card(p, 'Email to Robyn Clarke'), 'Send email').count() === 1); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); stopAll(); process.exit(1); });
