const { chromium } = require('playwright');
const FAKE = 'http://localhost:4000';
const out = '/home/user/Yarn/dev-tests/';
const post = (path, body) => fetch(FAKE + path, { method: 'POST', body: JSON.stringify(body || {}) }).then(r => r.json());
const state = () => fetch(FAKE + '/__state').then(r => r.json());

async function run(b, name, { port = 3000, mode = 'ok', steps }) {
  await post('/__reset'); await post('/__mode', { mode });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  PAGE ERROR', e.message));
  await p.goto(`http://localhost:${port}/login`);
  await p.fill('input[type=email]', 'natasha@example.com');
  await p.fill('input[type=password]', 'password123');
  await p.click('button[type=submit]');
  await p.waitForSelector('button[aria-label="Start recording"]', { timeout: 15000 });
  await p.click('button[aria-label="Start recording"]');
  await p.waitForSelector('button[aria-label="Stop recording"]'); await p.waitForTimeout(1500);
  const t0 = Date.now();
  await p.click('button[aria-label="Stop recording"]');
  const seen = [];
  for (const s of steps) {
    if (s.switchMode) await post('/__mode', { mode: s.switchMode });
    await p.waitForSelector(s.expect, { timeout: 15000 });
    seen.push(s.label);
    if (s.shot) await p.screenshot({ path: out + s.shot });
    if (s.thenMode) await post('/__mode', { mode: s.thenMode });
    if (s.click) await p.click(s.click);
  }
  console.log(`\n[${name}] -> ${seen.join('  ->  ')}   (${Date.now() - t0} ms from Stop)`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
  const cases = [
    ['no credit (429 insufficient_quota)', 'quota', 'The OpenAI account has no credit'],
    ['wrong key (401)', 'badkey', 'OpenAI rejected the key'],
    ['busy (429)', 'busy', 'OpenAI is busy'],
    ['bad audio format (400)', 'badformat', 'OpenAI said no (400): Invalid file format'],
    ['works', 'ok', 'What you said'],
  ];
  for (const [name, mode, expect] of cases) {
    await run(b, name, { mode, steps: [{ expect: `text=${expect}`, label: expect }] });
  }
  await b.close();
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); process.exit(1); });
