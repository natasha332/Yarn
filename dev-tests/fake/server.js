// A pretend Supabase + pretend OpenAI, for testing only. Not part of the app.
const http = require('http');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: 'aaaaaaaa-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'natasha@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const BIZ = { id: 'b0000000-0000-0000-0000-00000000000b', name: 'Fresh Joinery', timezone: 'Australia/Sydney' };
const jwt = () => `${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:USER.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.sig`;
const state = { madeClients: [], madeJobs: [], items: [], anthropic: [], uploads: [], inserts: [], deleted: [], files: {}, captures: {}, patches: [], openai: [], mode: 'ok', text: 'Consult at Robyn\'s house on the third of November at nine.' };
const BIZID = 'b0000000-0000-0000-0000-00000000000b';
function seed() {
  const day = n => new Date(Date.UTC(2026, 9, 27, 23, 40) - n * 3600e3).toISOString();  // 27 Oct 2026, 10:40am Sydney, minus n hours
  state.files[BIZID + '/old-failed.webm'] = Buffer.from('fake-audio-failed');
  state.files[BIZID + '/old-quiet.webm'] = Buffer.from('fake-audio-quiet');
  state.captures['c-done'] = { id: 'c-done', status: 'transcribed', created_at: day(0), audio_url: BIZID + '/old-done.webm', transcript: 'Order six soft-close hinges for the Smith kitchen tomorrow, and chase Dave Nguyen about the laundry quote, he still has not got back to me about the price we sent through last week.' };
  state.captures['c-failed'] = { id: 'c-failed', status: 'failed', created_at: day(5), audio_url: BIZID + '/old-failed.webm', transcript: null };
  state.captures['c-echo'] = { id: 'c-echo', status: 'transcribed', created_at: day(40), audio_url: BIZID + '/old-quiet.webm', transcript: 'context: ### An Australian tradie talking about jobs, clients, bookings, quotes and invoices. Names that may come up: Robyn Clarke, Robyn, Rob, Dave Nguyen.' };
  state.captures['c-quiet'] = { id: 'c-quiet', status: 'transcribed', created_at: day(30), audio_url: BIZID + '/old-quiet.webm', transcript: '' };
}
seed();
const clients = [{ id: 'cl-robyn', name: 'Robyn Clarke', aliases: ['Robyn', 'Rob'], address: '14 Elm St', email: 'robyn@example.com' }, { id: 'cl-dave', name: 'Dave Nguyen', aliases: [], address: null, email: null }];

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
  const p = url.pathname;

  if (p === '/__mode') { Object.assign(state, JSON.parse(raw.toString() || '{}')); return json(200, { ok: true }); }
  if (p === '/__state') return json(200, { madeClients: state.madeClients, madeJobs: state.madeJobs, items: state.items, anthropic: state.anthropic, uploads: state.uploads, inserts: state.inserts, deleted: state.deleted, patches: state.patches, openai: state.openai, captures: state.captures, files: Object.fromEntries(Object.entries(state.files).map(([k, v]) => [k, v.length])) });
  if (p === '/__setstatus') { const { title, status } = JSON.parse(raw.toString() || '{}'); state.items.filter(i => i.title === title).forEach(i => { i.status = status; }); return json(200, { ok: true }); }
  if (p === '/__seed') { const { items } = JSON.parse(raw.toString() || '{}'); items.forEach((it, n) => state.items.push({ id: 'seed-' + state.items.length, business_id: 'b0000000-0000-0000-0000-00000000000b', capture_id: null, due_date: null, start_time: null, end_time: null, details: {}, status: 'confirmed', position: n, created_at: new Date().toISOString(), client_id: null, job_id: null, ...it })); return json(200, { ok: true }); }
  if (p === '/__reset') { state.patches = []; state.deleted = []; state.items = []; state.madeClients = []; state.madeJobs = []; state.anthropic = []; state.uploads = []; state.inserts = []; state.openai = []; state.captures = {}; state.files = {}; state.mode = 'ok'; seed(); return json(200, {}); }

  if (p === '/auth/v1/token') { const t = jwt(); return json(200, { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'r', user: USER }); }
  if (p === '/auth/v1/user') return json(200, USER);

  if (p === '/rest/v1/businesses' && req.method === 'PATCH') { if (state.bizFail) return json(500, { message: 'boom' }); const patch = JSON.parse(raw.toString()); state.bizPatches = (state.bizPatches || []).concat([patch]); state.bizSettings = { ...(state.bizSettings || {}), ...patch }; res.writeHead(204); return res.end(); }
  if (p === '/__biz') return json(200, { settings: state.bizSettings || {}, patches: state.bizPatches || [] });
  if (p === '/__bizreset') { state.bizSettings = {}; state.bizPatches = []; state.bizFail = false; return json(200, {}); }
  if (p === '/__bizfail') { state.bizFail = true; return json(200, {}); }
  if (p === '/rest/v1/businesses') { const row = { morning_enabled: true, morning_email_time: '07:00:00', wrapup_mode: 'end_of_day', wrapup_time: '17:00:00', ...BIZ, ...(state.bizSettings || {}) }; return json(200, wantsObject ? row : [row]); }
  if (p === '/rest/v1/clients' && req.method === 'PATCH') { const id = (url.searchParams.get('id') || '').replace('eq.', ''); const c = clients.find(x => x.id === id); const patch = JSON.parse(raw.toString()); state.clientPatches = (state.clientPatches || []).concat([{ id, ...patch }]); if (c) Object.assign(c, patch); res.writeHead(204); return res.end(); }
  if (p === '/__clientpatches') return json(200, state.clientPatches || []);
  if (p === '/rest/v1/clients' && url.searchParams.get('id')) { const c = clients.find(x => x.id === url.searchParams.get('id').replace('eq.', '')); return c ? json(200, wantsObject ? c : [c]) : wantsObject ? json(406, { code: 'PGRST116', message: 'no rows' }) : json(200, []); }
  if (p === '/rest/v1/clients') return json(200, clients);
  if (p === '/rest/v1/jobs') return json(200, []);
  if (p === '/rest/v1/items' && req.method === 'HEAD') {
    const rawStatus = url.searchParams.get('status') || ''; const want = rawStatus.replace('eq.', '');
    const n = state.items.filter(i => !want || i.status === want).length;
    res.writeHead(200, { 'content-range': n ? `0-${n - 1}/${n}` : '*/0' }); return res.end();
  }
  if (p === '/rest/v1/items') {
    if (req.method === 'POST') { const rows = [].concat(JSON.parse(raw.toString())); const base = state.items.length; const made = rows.map((r, i) => ({ id: 'it-' + (base + i), created_at: new Date(Date.now() + base + i).toISOString(), ...r })); made.forEach(m => state.items.push(m)); if ((req.headers.prefer || '').includes('return=representation')) return json(201, wantsObject ? made[0] : made); res.writeHead(201); return res.end(); }
    if (req.method === 'PATCH') {
      const idParam = url.searchParams.get('id') || '';
      const ids = idParam.startsWith('in.(') ? idParam.slice(4, -1).split(',') : [idParam.replace('eq.', '')];
      const wantStatus = (url.searchParams.get('status') || '').replace('eq.', '');
      const returnsRows = (req.headers.prefer || '').includes('return=representation');
      const found = state.items.filter(i => ids.includes(i.id) && (!wantStatus || i.status === wantStatus));
      if (!found.length) return returnsRows ? json(200, []) : json(404, { message: 'no item' });
      const patch = JSON.parse(raw.toString());
      found.forEach(it => { Object.assign(it, patch); state.patches.push({ item: it.id, ...patch }); });
      if (returnsRows) return json(200, found.map(f => ({ id: f.id })));
      res.writeHead(204); return res.end();
    }
    if (req.method === 'GET' && url.searchParams.get('capture_id')) { const cid = url.searchParams.get('capture_id').replace('eq.', ''); const stat = (url.searchParams.get('status') || '').replace('eq.', ''); return json(200, state.items.filter(i => i.capture_id === cid && (!stat || i.status === stat)).sort((a, b) => a.position - b.position)); }
    if (req.method === 'GET' && url.searchParams.get('id') && !url.searchParams.get('id').startsWith('in.(')) {
      const one = state.items.find(i => i.id === url.searchParams.get('id').replace('eq.', ''));
      if (!one) return wantsObject ? json(406, { code: 'PGRST116', message: 'no rows' }) : json(200, []);
      const allC = [...clients, ...state.madeClients];
      const row = { ...one, clients: (c => c ? { name: c.name, email: c.email ?? null } : one.client_name ? { name: one.client_name, email: null } : null)(allC.find(c => c.id === one.client_id)), jobs: one.job_name ? { name: one.job_name } : null };
      return json(200, wantsObject ? row : [row]);
    }
    if (req.method === 'GET') {
      const rawStatus = url.searchParams.get('status') || '';
      const wanted = rawStatus.startsWith('in.(') ? rawStatus.slice(4, -1).split(',') : rawStatus ? [rawStatus.replace('eq.', '')] : [];
      const orParam = url.searchParams.get('or') || '';
      const typeWanted = (url.searchParams.get('type') || '').replace('eq.', '');
      const dueFilters = url.searchParams.getAll('due_date');
      const dueGte = (dueFilters.find(f => f.startsWith('gte.')) || '').slice(4);
      const dueLte = (dueFilters.find(f => f.startsWith('lte.')) || '').slice(4);
      const skipCapture = (orParam.match(/capture_id\.neq\.([^,)]+)/) || [])[1];
      const allClients = [...clients, ...state.madeClients];
      const rows = state.items.filter(i => (!wanted.length || wanted.includes(i.status)) && !(skipCapture && i.capture_id === skipCapture) && (!typeWanted || i.type === typeWanted) && (!dueGte || (i.due_date && i.due_date >= dueGte)) && (!dueLte || (i.due_date && i.due_date <= dueLte))).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.position - b.position)
        .map(i => ({ ...i, captures: i.capture_id && state.captures[i.capture_id] ? { created_at: state.captures[i.capture_id].created_at } : null, clients: (c => c ? { name: c.name, email: c.email ?? null } : i.client_name ? { name: i.client_name, email: null } : null)(allClients.find(c => c.id === i.client_id)), jobs: i.job_name ? { name: i.job_name } : null }));
      return json(200, rows);
    }
  }
  if ((p === '/rest/v1/rpc/reschedule_booking' || p === '/rest/v1/rpc/cancel_booking') && req.method === 'POST') {
    const bad = m => json(400, { code: 'P0001', message: m, details: null, hint: null });
    const a = JSON.parse(raw.toString());
    const it = state.items.find(i => i.id === a.item_id);
    if (!it) return bad('That booking could not be found');
    if (p.endsWith('cancel_booking')) {
      if (it.type !== 'calendar' || it.status !== 'confirmed') return bad('Only a confirmed booking can be cancelled');
      it.status = 'discarded'; it.details = { ...it.details, cancelled_at: new Date().toISOString(), ...(it.external_id ? { calendar_sync: 'needs_delete' } : {}) };
    } else {
      if (it.type !== 'calendar' || it.status !== 'confirmed') return bad('Only a confirmed booking can be moved');
      if (!a.new_date) return bad('Choose a new day');
      if (a.new_end && !a.new_start) return bad('Add a start time as well as an end time');
      if (a.new_end && a.new_end <= a.new_start) return bad('The end time has to be after the start time');
      Object.assign(it, { due_date: a.new_date, start_time: a.new_start ? a.new_start + ':00' : null, end_time: a.new_end ? a.new_end + ':00' : null }); if (it.external_id) it.details = { ...it.details, calendar_sync: 'needs_update' };
    }
    state.patches.push({ item: it.id, action: p.split('/').pop(), args: a });
    res.writeHead(204); return res.end();
  }
  if (p === '/rest/v1/rpc/confirm_item' && req.method === 'POST') {
    const bad = m => json(400, { code: 'P0001', message: m, details: null, hint: null });
    const { item_id } = JSON.parse(raw.toString());
    const it = state.items.find(i => i.id === item_id);
    if (!it) return bad('That card could not be found');
    if (it.status !== 'pending') return bad('That card has already been dealt with');
    if (it.type === 'email') return bad('Use Send to email this');
    if (it.type === 'job') {
      const nc = it.details && it.details.new_client;
      if (!it.client_id && !(nc && nc.name && nc.name.trim())) return bad('Choose or enter the client first');
      let clientId = it.client_id;
      if (!clientId) { clientId = 'new-client-' + state.madeClients.length; state.madeClients.push({ id: clientId, name: nc.name.trim(), aliases: [], address: nc.address || null, phone: nc.phone || null }); }
      const jobId = 'new-job-' + state.madeJobs.length; state.madeJobs.push({ id: jobId, name: it.title, status: it.details.job_status || 'consultation', client_id: clientId, address: it.details.address || null });
      Object.assign(it, { status: 'confirmed', job_id: jobId, client_id: clientId });
      state.items.filter(x => x.capture_id && x.capture_id === it.capture_id && x.id !== it.id && x.details && x.details.belongs_to_card === it.position && ['pending', 'confirmed'].includes(x.status)).forEach(x => { x.job_id = jobId; x.client_id = x.client_id || clientId; });
    } else if (it.type === 'reschedule' || it.type === 'cancel') {
      const tid = it.details && it.details.target_item_id;
      if (!tid) return bad('Choose which booking first');
      const tg = state.items.find(i => i.id === tid);
      if (!tg) return bad('That booking could not be found');
      if (tg.type !== 'calendar' || tg.status !== 'confirmed') return bad(it.type === 'cancel' ? 'Only a confirmed booking can be cancelled' : 'Only a confirmed booking can be moved');
      if (it.type === 'reschedule') { if (!it.due_date) return bad('Choose the new day first'); Object.assign(tg, { due_date: it.due_date, start_time: it.start_time, end_time: it.end_time }); if (tg.external_id) tg.details = { ...tg.details, calendar_sync: 'needs_update' }; }
      else { tg.status = 'discarded'; tg.details = { ...tg.details, cancelled_at: new Date().toISOString(), ...(tg.external_id ? { calendar_sync: 'needs_delete' } : {}) }; }
      it.status = 'confirmed';
    } else if (it.type === 'calendar' && !it.due_date) return bad('Add a date to this booking first');
    else it.status = 'confirmed';
    res.writeHead(204); return res.end();
  }
  if (p === '/v1/messages' && req.method === 'POST') {
    const body = JSON.parse(raw.toString());
    state.anthropic.push({ content: String(body.messages[0].content), sawBookings: /UPCOMING BOOKINGS/.test(String(body.messages[0].content)) && (String(body.messages[0].content).split('UPCOMING BOOKINGS (JSON):\n')[1] || '').split('\n\n')[0], model: body.model, effort: body.output_config && body.output_config.effort, format: body.output_config && body.output_config.format && body.output_config.format.type, key: req.headers['x-api-key'] || req.headers['authorization'], system: String(body.system).slice(0, 60), user: body.messages[0].content });
    const note = body.messages[0].content.split('VOICE NOTE:\n')[1] || '';
    const bookings = (() => { try { return JSON.parse(body.messages[0].content.split('UPCOMING BOOKINGS (JSON):\n')[1].split('\n\n')[0]); } catch { return []; } })();
    const bk = word => (bookings.find(b => b.title.includes(word)) || { id: null, date: null, start_time: null });
    const card = o => ({ email_kind: 'none', email_note: '', email_subject: '', email_body: '', goes_with_card: -1, target_booking_id: null, target_options: [], date: null, start_time: null, end_time: null, client_id: null, client_options: [], job_id: null, new_client: null, job_status: null, address: null, notes: null, belongs_to_card: null, ...o });
    let cards = [];
    if (/BADDATA/.test(note)) cards = [card({ type: 'todo', title: 'Bad data card', client_id: 'cl-bogus', client_options: ['cl-robyn', 'cl-ghost'], date: 'next week', start_time: '25:99', belongs_to_card: 7 })];
    else if (/MOVETELL/.test(note)) cards = [card({ type: 'reschedule', title: 'Move Site visit', target_booking_id: bk('Site visit').id, date: '2026-11-12', start_time: '09:00' }), card({ type: 'email', title: 'Email Robyn', client_id: 'cl-robyn', email_kind: 'reschedule', goes_with_card: 0, email_note: "It's because of a supplier delay." })];
    else if (/CANCELTELL/.test(note)) cards = [card({ type: 'cancel', title: 'Cancel Site visit', target_booking_id: bk('Site visit').id }), card({ type: 'email', title: 'Email Robyn', client_id: 'cl-robyn', email_kind: 'cancel', goes_with_card: 0, email_note: "I've come down with the flu." })];
    else if (/EMAILROBYN/.test(note)) cards = [card({ type: 'email', title: 'Email Robyn', client_id: 'cl-robyn', email_kind: 'other', email_subject: 'Quote ready', email_body: "Your quote is ready. I'll drop it round on Friday." })];
    else if (/EMAILDAVE/.test(note)) cards = [card({ type: 'email', title: 'Email Dave', client_id: 'cl-dave', email_kind: 'other', email_subject: 'Quick question', email_body: 'Can you confirm the colour you picked?' })];
    else if (/MOVEPRIYA/.test(note)) cards = [card({ type: 'reschedule', title: "Move Consult at Priya's", target_booking_id: bk('Priya').id, date: '2026-11-12', start_time: '14:00', end_time: '15:00' })];
    else if (/DAYONLY/.test(note)) cards = [card({ type: 'reschedule', title: "Move Consult at Priya's", target_booking_id: bk('Priya').id, date: '2026-11-12' })];
    else if (/CANCELDAVE/.test(note)) cards = [card({ type: 'cancel', title: 'Cancel Site visit', target_booking_id: bk('Site visit').id })];
    else if (/WHICHONE/.test(note)) cards = [card({ type: 'reschedule', title: 'Move a booking', target_options: [bk('Priya').id, bk('Site visit').id], date: '2026-11-12', start_time: '10:00' })];
    else if (/NOMATCH/.test(note)) cards = [card({ type: 'cancel', title: 'Cancel a booking' })];
    else if (/BOGUSID/.test(note)) cards = [card({ type: 'cancel', title: 'Cancel something', target_booking_id: 'bk-bogus' })];
    else if (/SAMETIME/.test(note)) cards = [card({ type: 'reschedule', title: "Move Consult at Priya's", target_booking_id: bk('Priya').id, date: bk('Priya').date, start_time: bk('Priya').start_time ? bk('Priya').start_time.slice(0, 5) : null })];
    else if (/PRIYAPLUS/.test(note)) cards = [
      card({ type: 'job', title: 'Consultation', job_status: 'consultation', new_client: { name: 'Priya', phone: null, email: null, address: null, nicknames: [] } }),
      card({ type: 'calendar', title: "Consult at Priya's", date: '2026-11-03', start_time: '09:00', address: "Priya's house", belongs_to_card: 0 }),
      card({ type: 'todo', title: 'Order hinges', date: '2026-10-30' })];
    else if (/PRIYALATER/.test(note)) cards = [card({ type: 'calendar', title: "Consult at Priya's", date: '2026-11-03', start_time: '14:00' })];
    else if (/NODATE/.test(note)) cards = [card({ type: 'calendar', title: 'Meet the supplier', start_time: '11:00' })];
    else if (/NOCLIENT/.test(note)) cards = [card({ type: 'job', title: 'Bathroom job', job_status: 'quoted' })];
    else if (/Priya/.test(note)) cards = [
      card({ type: 'job', title: 'Consultation', job_status: 'consultation', new_client: { name: 'Priya', phone: null, email: null, address: null, nicknames: [] } }),
      card({ type: 'calendar', title: 'Consult at Priya\'s', date: '2026-11-03', start_time: '09:00', address: 'Priya\'s house', belongs_to_card: 0 })];
    else if (/hinges/.test(note)) cards = [card({ type: 'todo', title: 'Order soft-close hinges', date: '2026-10-30' }), card({ type: 'followup', title: 'Chase laundry quote', client_id: 'cl-dave' })];
    else if (/Rob\b/.test(note)) cards = [card({ type: 'calendar', title: 'Site visit', client_options: ['cl-robyn', 'cl-dave'], date: '2026-10-31', start_time: '14:00' })];
    if (/REFUSE/.test(note)) return json(200, { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: 'refusal', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } });
    if (state.sortfail) return json(500, { type: 'error', error: { type: 'api_error', message: 'boom' } });
    if (state.mode === 'badkey') return json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    return json(200, { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ cards }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 } });
  }
  if (p === '/rest/v1/captures') {
    if (req.method === 'POST') { const row = JSON.parse(raw.toString()); state.inserts.push(row.id); state.captures[row.id] = { ...row, transcript: null, created_at: new Date().toISOString() }; res.writeHead(201); return res.end(); }
    const id = (url.searchParams.get('id') || '').replace('eq.', '');
    if (req.method === 'DELETE') { state.deleted.push({ table: 'captures', id }); delete state.captures[id]; res.writeHead(204); return res.end(); }
    if (req.method === 'PATCH') { const patch = JSON.parse(raw.toString()); state.patches.push({ id, ...patch }); Object.assign(state.captures[id] || {}, patch); res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && !url.searchParams.get('id')) return json(200, Object.values(state.captures).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(c => ({ ...c, items: state.items.filter(i => i.capture_id === c.id).map(i => ({ status: i.status })) })));
    if (req.method === 'GET') { const row = state.captures[id]; return row ? json(200, wantsObject ? row : [row]) : json(406, { code: 'PGRST116', message: 'no rows' }); }
  }
  if (p === '/storage/v1/object/audio' && req.method === 'DELETE') {
    if (state.mode === 'deletefail') return json(500, { message: 'boom' });
    const { prefixes } = JSON.parse(raw.toString());
    prefixes.forEach(x => { state.deleted.push({ file: x }); delete state.files[x]; });
    return json(200, prefixes.map(name => ({ name })));
  }
  if (p.startsWith('/storage/v1/object/audio/')) {
    const path = decodeURIComponent(p.replace('/storage/v1/object/audio/', ''));
    if (req.method === 'POST' && state.mode === 'uploadfail') return json(500, { message: 'boom' });
    if (req.method === 'POST') { if (state.files[path]) return json(409, { message: 'The resource already exists', statusCode: '409' }); state.uploads.push(path); state.files[path] = raw; return json(200, { Key: 'audio/' + path, Id: 'x' }); }
    if (req.method === 'GET') { const f = state.files[path]; if (!f) return json(404, { message: 'not found' }); res.writeHead(200, { 'Content-Type': 'audio/webm' }); return res.end(f); }
  }
  if (p === '/v1/audio/transcriptions') {
    const text = raw.toString('latin1');
    const field = n => (text.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
    state.openai.push({ auth: req.headers.authorization, model: field('model'), language: field('language'), prompt: field('prompt'), filename: (text.match(/filename="([^"]+)"/) || [])[1], bytes: raw.length });
    if (state.mode === 'fail') return json(500, { error: { message: 'boom' } });
    if (state.mode === 'quota') return json(429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } });
    if (state.mode === 'busy') return json(429, { error: { code: 'rate_limit_exceeded', message: 'slow down' } });
    if (state.mode === 'badkey') return json(401, { error: { code: 'invalid_api_key', message: 'Incorrect API key provided' } });
    if (state.mode === 'badformat') return json(400, { error: { message: 'Invalid file format. Supported formats: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm' } });
    return json(200, { text: state.mode === 'empty' ? '' : state.mode === 'echo' ? 'context: ### An Australian tradie talking about jobs, clients, bookings, quotes and invoices. Names that may come up: Robyn Clarke, Robyn, Rob, Dave Nguyen.' : state.text });
  }


  if (p.startsWith('/gcal/calendars/primary/events')) {
    state.gcalCalls = (state.gcalCalls || []).concat([{ method: req.method, path: p, auth: req.headers.authorization }]);
    state.gcal = state.gcal || {};
    if (state.gcalFail) return json(state.gcalFail, { error: { message: 'boom' } });
    const id = p.replace('/gcal/calendars/primary/events', '').replace(/^\//, '');
    const body = raw.length ? JSON.parse(raw.toString()) : {};
    if (req.method === 'GET') return json(200, { items: Object.entries(state.gcal).map(([id, e]) => ({ id, ...e })) });
    if (req.method === 'POST') { if (state.gcal[body.id]) return json(409, { error: { message: 'duplicate' } }); state.gcal[body.id] = body; return json(200, body); }
    if (req.method === 'PATCH') { if (!state.gcal[id]) return json(404, {}); state.gcal[id] = { ...state.gcal[id], ...body }; return json(200, state.gcal[id]); }
    if (req.method === 'DELETE') { if (!state.gcal[id]) return json(410, {}); delete state.gcal[id]; res.writeHead(204); return res.end(); }
  }
  if (p === '/__gcal') return json(200, { events: state.gcal || {}, calls: state.gcalCalls || [] });
  if (p === '/__gcalreset') { state.gcal = {}; state.gcalCalls = []; state.gcalFail = 0; return json(200, {}); }
  if (p === '/__gcalfail') { state.gcalFail = JSON.parse(raw.toString() || '{}').code || 0; return json(200, {}); }
  if (p === '/__gcalseed') { const { id, event } = JSON.parse(raw.toString()); state.gcal = state.gcal || {}; state.gcal[id] = event; return json(200, {}); }

  if (p === '/resend/emails' && req.method === 'POST') {
    state.emails = state.emails || [];
    if (state.emailFail) return json(state.emailFail.code, { message: state.emailFail.message });
    state.emails.push({ auth: req.headers.authorization, ...JSON.parse(raw.toString()) });
    return json(200, { id: 'em_' + state.emails.length });
  }
  if (p === '/rest/v1/sent_emails' && req.method === 'POST') { state.sentLog = (state.sentLog || []).concat([JSON.parse(raw.toString())]); res.writeHead(201); return res.end(); }
  if (p === '/__sentlog') return json(200, state.sentLog || []);
  if (p === '/__sentreset') { state.sentLog = []; state.clientPatches = []; clients[1].email = null; return json(200, {}); }
  if (p === '/__emails') return json(200, state.emails || []);
  if (p === '/__emailsreset') { state.emails = []; state.emailFail = null; return json(200, {}); }
  if (p === '/__emailfail') { state.emailFail = JSON.parse(raw.toString()); return json(200, {}); }

  if (p === '/rest/v1/users' && req.method === 'GET') { const row = { name: 'Tabrez', email: 'natasha@example.com' }; return json(200, wantsObject ? row : [row]); }
  if (p === '/rest/v1/rpc/claim_digest' && req.method === 'POST') {
    const a = JSON.parse(raw.toString()); const key = [a.p_business_id, a.p_kind, a.p_local_date].join('|');
    state.digestLog = state.digestLog || {}; const row = state.digestLog[key];
    if (!row) { state.digestLog[key] = { business_id: a.p_business_id, kind: a.p_kind, local_date: a.p_local_date, status: 'sending', attempts: 1, claimed_at: new Date().toISOString() }; return json(200, true); }
    if (row.status === 'failed' && row.attempts < 3) { Object.assign(row, { status: 'sending', attempts: row.attempts + 1, error: null }); return json(200, true); }
    return json(200, false);
  }
  if (p === '/rest/v1/digest_log') {
    state.digestLog = state.digestLog || {};
    if (req.method === 'PATCH') { const q = k => (url.searchParams.get(k) || '').replace('eq.', ''); const row = state.digestLog[[q('business_id'), q('kind'), q('local_date')].join('|')]; if (!row) return json(404, {}); Object.assign(row, JSON.parse(raw.toString())); res.writeHead(204); return res.end(); }
    if (req.method === 'GET') return json(200, Object.values(state.digestLog).sort((a, b) => b.local_date.localeCompare(a.local_date) || b.claimed_at.localeCompare(a.claimed_at)));
  }
  if (p === '/__digestlog') return json(200, Object.values(state.digestLog || {}));
  if (p === '/__digestreset') { state.digestLog = {}; return json(200, {}); }
  if (p === '/__bizset') { state.bizSettings = { ...(state.bizSettings || {}), ...JSON.parse(raw.toString()) }; return json(200, {}); }
  if (p === '/rest/v1/google_connections') {
    if (req.method === 'POST') { state.google = JSON.parse(raw.toString()); state.googleSaves = (state.googleSaves || 0) + 1; res.writeHead(state.googleSaveFail ? 500 : 201); return res.end(); }
    if (req.method === 'DELETE') { state.google = null; res.writeHead(204); return res.end(); }
    if (req.method === 'GET') return state.google ? json(200, wantsObject ? state.google : [state.google]) : wantsObject ? json(406, { code: 'PGRST116', message: 'no rows' }) : json(200, []);
  }
  if (p === '/google/token' && req.method === 'POST') {
    const f = new URLSearchParams(raw.toString()); state.googleTokenCalls = (state.googleTokenCalls || []).concat([Object.fromEntries(f)]);
    if (f.get('grant_type') === 'refresh_token') return f.get('refresh_token') === '1//0g-REAL-REFRESH-TOKEN' ? json(200, { access_token: 'at-fresh' }) : json(400, { error: 'invalid_grant' });
    const code = f.get('code');
    if (code === 'GOODCODE' || code === 'NOREFRESH') {
      const idt = `${b64({ alg: 'none' })}.${b64({ email: 'natasha@sundaykitchens.com.au' })}.x`;
      return json(200, code === 'NOREFRESH' ? { access_token: 'at', id_token: idt } : { access_token: 'at', refresh_token: '1//0g-REAL-REFRESH-TOKEN', id_token: idt });
    }
    return json(400, { error: 'invalid_grant' });
  }
  if (p === '/google/revoke' && req.method === 'POST') { state.googleRevoked = new URLSearchParams(raw.toString()).get('token'); return json(200, {}); }
  if (p === '/__google') return json(200, { google: state.google, saves: state.googleSaves || 0, tokenCalls: state.googleTokenCalls || [], revoked: state.googleRevoked || null });
  if (p === '/__googlereset') { state.google = null; state.googleSaves = 0; state.googleTokenCalls = []; state.googleRevoked = null; state.googleSaveFail = false; return json(200, {}); }
  if (p === '/__googlefail') { state.googleSaveFail = true; return json(200, {}); }
  if (p === '/__googleseed') { state.google = JSON.parse(raw.toString()); return json(200, {}); }
  console.log('UNHANDLED', req.method, req.url);
  json(404, { message: 'unhandled ' + req.url });
}).listen(4000, () => console.log('fake ready on 4000'));
