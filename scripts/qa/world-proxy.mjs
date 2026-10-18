import http from 'node:http';

// Local-only fault harness. Never part of the deployed Worker or the public UI.
const mode = process.argv[2] ?? 'webgl';
if (!['webgl', 'model-error', 'updates-error', 'weather-error', 'music-error', 'slow'].includes(mode)) throw new Error('Invalid QA mode');
const upstream = process.env.TCC_QA_UPSTREAM ?? 'http://127.0.0.1:5173';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(upstream)) throw new Error('Use a local preview upstream');
const port = Number(process.env.TCC_QA_PORT ?? 5175);

const controls = `<div id="qa-controls" style="position:fixed;right:12px;bottom:12px;z-index:1000;padding:8px;background:#fff;color:#111;border:1px solid #111;font:14px sans-serif"><button id="qa-context-loss">Simular perda de WebGL</button></div><script type="module">document.querySelector('#qa-context-loss').addEventListener('click',()=>{const canvas=document.querySelector('.island-canvas canvas');const gl=canvas?.getContext('webgl2');const extension=gl?.getExtension('WEBGL_lose_context');if(extension){extension.loseContext();document.querySelector('#qa-context-loss').textContent='Contexto perdido';}else{document.querySelector('#qa-context-loss').textContent='Cena ainda não pronta';}});</script>`;

http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, upstream);
    if (mode === 'model-error' && url.pathname.endsWith('.glb')) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Simulated missing model'); return;
    }
    if (mode === 'updates-error' && url.pathname === '/api/updates') {
      response.writeHead(503, { 'Content-Type': 'application/json' }); response.end('{"error":"Simulated unavailable updates"}'); return;
    }
    if (mode === 'weather-error' && url.pathname === '/api/weather') {
      response.writeHead(503, { 'Content-Type': 'application/json' }); response.end('{"error":"Simulated unavailable weather","places":[]}'); return;
    }
    if (mode === 'music-error' && url.pathname.endsWith('.mp3')) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Simulated missing music'); return;
    }
    if (mode === 'slow' && url.pathname.endsWith('.glb')) await new Promise(resolve => setTimeout(resolve, 12000));
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (value && !['host', 'connection', 'accept-encoding'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await Array.fromAsync(request).then(chunks => Buffer.concat(chunks));
    const fetched = await fetch(url, { method: request.method, headers, body });
    const contentType = fetched.headers.get('content-type') ?? '';
    const outputHeaders = {};
    for (const [key, value] of fetched.headers) if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key)) outputHeaders[key] = value;
    const bytes = Buffer.from(await fetched.arrayBuffer());
    const output = mode === 'webgl' && contentType.includes('text/html') ? Buffer.from(bytes.toString('utf8').replace('</body>', `${controls}</body>`)) : bytes;
    response.writeHead(fetched.status, outputHeaders); response.end(output);
  } catch (error) { response.writeHead(502); response.end(String(error.message)); }
}).listen(port, '127.0.0.1', () => console.log(`Local world QA: http://127.0.0.1:${port} (${mode})`));
