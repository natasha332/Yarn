// A pretend phone push service (like Google's or Apple's), for testing only. Real push services are HTTPS,
// so this makes itself a throwaway certificate. The app under test is started with
// NODE_TLS_REJECT_UNAUTHORIZED=0 so it will talk to it.
//   POST /push/<name>      records the request (headers + encrypted body). A name starting "gone-" answers
//                          410 (the phone removed the subscription), "broken-" answers 500, anything else 201.
//   GET  /__pushlog        everything received so far
//   POST /__pushreset      forget it
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dir = path.join(__dirname, '..', '.tmp', 'push');
fs.mkdirSync(dir, { recursive: true });
const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
if (!fs.existsSync(cert)) execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${key} -out ${cert} -days 30 -subj "/CN=localhost" 2>/dev/null`);
let log = [];
https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (req.url === '/__pushlog') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(log)); }
    if (req.url === '/__pushreset') { log = []; res.writeHead(200); return res.end('{}'); }
    const name = req.url.replace('/push/', '');
    log.push({ name, headers: req.headers, body: body.toString('base64') });
    res.writeHead(name.startsWith('gone-') ? 410 : name.startsWith('broken-') ? 500 : 201);
    res.end();
  });
}).listen(4443, () => console.log('fake push service ready on 4443'));
