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

  await run(b, '1. everything works', { steps: [
    { expect: 'text="Saved."', label: 'Saved.' },
    { expect: 'text=What you said', label: 'transcript shown', shot: 'transcript.png' },
  ]});
  const s1 = await state();
  console.log('  OpenAI saw:', JSON.stringify(s1.openai.map(o => ({ auth: o.auth, model: o.model, language: o.language, file: o.filename, bytes: o.bytes, prompt: o.prompt }))));
  console.log('  capture updates:', JSON.stringify(s1.patches.map(({ id, ...r }) => r)));

  await run(b, '2. transcriber fails, then Try again works', { mode: 'fail', steps: [
    { expect: "text=transcriber didn't answer", label: 'error + Try again', thenMode: 'ok', click: 'button:has-text("Try again")', shot: 'failed.png' },
    { expect: 'text=What you said', label: 'transcript shown' },
  ]});
  console.log('  capture updates:', JSON.stringify((await state()).patches.map(({ id, ...r }) => r)));

  await run(b, '3. silence', { mode: 'empty', steps: [{ expect: "text=didn't catch anything", label: "I didn't catch anything" }] });

  await run(b, '4. no OpenAI key on the server', { port: 3001, steps: [{ expect: "text=Transcription isn't set up yet", label: 'not set up message', shot: 'noKey.png' }] });
  await b.close();
})().catch(e => { console.log('TEST FAILED:', e.message.split('\n')[0]); process.exit(1); });
