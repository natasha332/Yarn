const { chromium } = require('playwright');
const { spawn } = require('child_process');
const SP = require('path').join(__dirname, '..') + '/';
const base = { ...process.env, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:4000/v1', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:4000', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const withKey = { ...base, ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_BASE_URL: 'http://localhost:4000' };
const next = (port, env) => spawn('/home/user/Yarn/node_modules/.bin/next', ['start', '-p', String(port)], { cwd: '/home/user/Yarn', env, detached: true, stdio: 'ignore' });
const procs = [spawn('node', [SP + 'fake/server.js'], { detached: true, stdio: 'ignore' }), next(3000, withKey), next(3001, base)];
const stopAll = () => procs.forEach(p => { try { process.kill(-p.pid); } catch {} });
const post = (path, body) => fetch('http://localhost:4000' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const st = () => fetch('http://localhost:4000/__state').then(r => r.json());
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log(`   ${cond ? 'PASS' : 'FAIL'} - ${label}`); };

async function open(b, port = 3000) {
  await post('/__reset');
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto(`http://localhost:${port}/login`);
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
const say = text => post('/__mode', { text });

(async () => {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:3000/login')).ok && (await fetch('http://localhost:3001/login')).ok && (await fetch('http://localhost:4000/__state')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

  console.log('1. A booking for a new person: job card + calendar card');
  { const { ctx, p } = await open(b); await say("Consult at Priya's house on the third of November at nine.");
    await record(p); await p.waitForSelector('text=Found 2 things', { timeout: 15000 }); await p.waitForSelector('text=To check (2)', { timeout: 15000 });
    const text = await p.innerText('main'); await p.screenshot({ path: SP + 'cards-basic.png', fullPage: true });
    ok('shows "New job" with Consultation and the new client', /NEW JOB/i.test(text) && text.includes('Consultation') && text.includes('Client: Priya (new client)'));
    ok('shows the calendar card with "Tue 3 Nov · 9:00am"', /CALENDAR/i.test(text) && text.includes('Tue 3 Nov · 9:00am'));
    const s = await st(); const a = s.anthropic[0];
    console.log('   DEBUG request seen by Claude:', JSON.stringify({ n: s.anthropic.length, model: a.model, effort: a.effort, format: a.format, key: a.key }));
    ok('asked Claude once, with the right model, low effort, structured format and key', s.anthropic.length === 1 && a.model === 'claude-opus-5-5' && a.effort === 'low' && a.format === 'json_schema' && /sk-ant-test/.test(a.key || ''));
    ok("sent today's date, timezone, client ids and the words", /TODAY: \w+ \d{4}-\d{2}-\d{2} \(timezone Australia\/Sydney\)/.test(a.user) && a.user.includes('cl-robyn') && a.user.includes('cl-dave') && a.user.includes("Priya's house"));
    ok('saved 2 pending cards in order', s.items.length === 2 && s.items.every(i => i.status === 'pending') && s.items[0].type === 'job' && s.items[1].type === 'calendar');
    ok('calendar card remembers which job card it belongs to', s.items[1].details.belongs_to_card === 0 && s.items[1].due_date === '2026-11-03' && s.items[1].start_time === '09:00');
    ok('job card keeps the new client and status', s.items[0].details.new_client.name === 'Priya' && s.items[0].details.job_status === 'consultation');
    ok('note marked as sorted', s.patches.some(x => x.status === 'sorted'));
    await ctx.close(); }

  console.log('2. To-do and follow-up for an existing client');
  { const { ctx, p } = await open(b); await say('Order the hinges tomorrow and chase Dave about the laundry quote.');
    await record(p); await p.waitForSelector('text=Found 2 things', { timeout: 15000 });
    const s = await st();
    ok('follow-up linked to the existing client (Dave)', s.items[1].client_id === 'cl-dave' && s.items[1].type === 'followup');
    ok('to-do has its due date', s.items[0].type === 'todo' && s.items[0].due_date === '2026-10-30');
    await ctx.close(); }

  console.log('3. Two clients could fit: the card asks, it does not guess');
  { const { ctx, p } = await open(b); await say('Site visit at Rob on Saturday at two.');
    await record(p); await p.waitForSelector('text=Which client?', { timeout: 15000 });
    ok('card asks "Which client?" with a button for each: Robyn Clarke and Dave Nguyen', (await p.getByRole('button', { name: 'Robyn Clarke' }).count()) === 1 && (await p.getByRole('button', { name: 'Dave Nguyen' }).count()) === 1);
    const s = await st(); ok('no client chosen on the saved card', s.items[0].client_id === null && s.items[0].details.client_options.length === 2);
    await ctx.close(); }

  console.log('4. Claude returns rubbish ids, dates and times: all thrown away, nothing breaks');
  { const { ctx, p } = await open(b); await say('BADDATA test note');
    await record(p); await p.waitForSelector('text=Found 1 thing', { timeout: 15000 });
    const i = (await st()).items[0];
    ok('made-up client id dropped', i.client_id === null);
    ok('only real candidates kept', JSON.stringify(i.details.client_options) === JSON.stringify([{ id: 'cl-robyn', name: 'Robyn Clarke' }]));
    ok('bad date and time dropped', i.due_date === null && i.start_time === null);
    ok('bad card link dropped', i.details.belongs_to_card === null);
    await ctx.close(); }

  console.log('5. Nothing worth sorting');
  { const { ctx, p } = await open(b); await say('Just testing the microphone.');
    await record(p); await p.waitForSelector('text=Nothing to sort in this one', { timeout: 15000 });
    ok('friendly message, no cards saved', (await st()).items.length === 0); await ctx.close(); }

  console.log('6. Claude refuses, or errors: clear message and a Try again button');
  { const { ctx, p } = await open(b); await say('REFUSE this one');
    await record(p); await p.waitForSelector("text=Couldn't sort this one", { timeout: 15000 });
    ok('refusal handled', true); await ctx.close(); }
  { const { ctx, p } = await open(b); await say('Order the hinges tomorrow'); await post('/__mode', { sortfail: true });
    await record(p); await p.waitForSelector('text=The sorter said no (500)', { timeout: 40000 });
    ok('server error handled, with the real status', true);
    await post('/__mode', { sortfail: false }); await p.click('button:has-text("Try again")');
    await p.waitForSelector('text=Found 2 things', { timeout: 15000 });
    ok('Try again works once it recovers', (await st()).items.length === 2); await ctx.close(); }

  console.log('7. Asking twice never makes duplicate cards');
  { const { ctx, p } = await open(b); await say('Order the hinges tomorrow');
    await record(p); await p.waitForSelector('text=Found 2 things', { timeout: 15000 });
    const id = (await st()).items[0].capture_id;
    const r = await p.evaluate(async id => (await fetch('/api/sort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captureId: id }) })).status, id);
    const s = await st(); ok('second request fine, still 2 cards, Claude asked only once', r === 200 && s.items.length === 2 && s.anthropic.length === 1); await ctx.close(); }

  console.log('8. Recorded with no signal: sorted quietly after it uploads');
  { const { ctx, p } = await open(b); await say("Consult at Priya's house on the third of November at nine.");
    await ctx.setOffline(true); await record(p); await p.waitForSelector('text=Waiting to upload (1)');
    await ctx.setOffline(false);
    await p.waitForFunction(() => !document.body.innerText.includes('Waiting to upload'), null, { timeout: 20000 });
    await p.waitForTimeout(2500);
    const s = await st(); ok('cards were made without anyone tapping anything', s.items.length === 2 && s.anthropic.length === 1); await ctx.close(); }

  console.log('9. Anthropic key not set on the server');
  { const { ctx, p } = await open(b, 3001); await say('Order the hinges tomorrow');
    await record(p); await p.waitForSelector("text=Sorting isn't set up yet", { timeout: 15000 });
    ok('words still appear, and a clear "not set up" message shows', (await p.innerText('main')).toLowerCase().includes('what you said')); await ctx.close(); }

  await b.close(); stopAll();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); stopAll(); process.exit(1); });
