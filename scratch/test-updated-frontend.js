import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8081;
const PUBLIC_DIR = path.resolve('c:/Ai content Analyser/frontend');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, async () => {
  console.log(`[static-server] Server listening at http://localhost:${PORT}`);
  
  try {
    const response = await fetch(`http://localhost:${PORT}/index.html`);
    console.log(`[test] GET /index.html status: ${response.status}`);
    const cssResponse = await fetch(`http://localhost:${PORT}/style.css`);
    console.log(`[test] GET /style.css status: ${cssResponse.status}`);
    const jsResponse = await fetch(`http://localhost:${PORT}/script.js`);
    console.log(`[test] GET /script.js status: ${jsResponse.status}`);

    const htmlText = await response.text();
    const hasAbdallah = htmlText.includes('Abdallah');
    const hasAhmed = htmlText.includes('Ahmed');
    console.log(`[test] Contains 'Abdallah': ${hasAbdallah} | Contains 'Ahmed': ${hasAhmed}`);
  } catch (err) {
    console.error("[test] Static server fetch error:", err);
  } finally {
    server.close(() => {
      console.log("[test] Static server closed.");
      process.exit(0);
    });
  }
});
