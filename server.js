const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PRIMARY_PORT = parseInt(process.env.PORT || process.argv[2] || '3001', 10);
const SECONDARY_PORT = PRIMARY_PORT === 3001 ? 3000 : null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.sql': 'text/plain; charset=utf-8'
};

function requestHandler(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // API: Get Company & Bank Settings
  if (pathname === '/api/company-settings' && req.method === 'GET') {
    const settingsPath = path.join(ROOT_DIR, 'company_settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const data = fs.readFileSync(settingsPath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        return res.end(data);
      } catch (err) {
        console.error("Error reading company_settings.json:", err);
      }
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    return res.end(JSON.stringify(null));
  }

  // API: Save Company & Bank Settings
  if (pathname === '/api/company-settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const settingsPath = path.join(ROOT_DIR, 'company_settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(parsed, null, 2), 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ success: true, settings: parsed }));
      } catch (err) {
        res.writeHead(400, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // If root, serve index.html
  if (pathname === '/' || pathname === '') {
    return serveFile(path.join(ROOT_DIR, 'index.html'), res);
  }

  // Check if requesting an existing file in directory
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, res);
    }

    // SPA Route Fallback:
    // Any subpage (/salesPradhish, /salesNagaraju, /sales<Any>, etc.) serves index.html
    return serveFile(path.join(ROOT_DIR, 'index.html'), res);
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Server Error: ${err.message}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(content);
  });
}

function startServer(port) {
  const server = http.createServer(requestHandler);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Sri Govinda Sales Server running at http://localhost:${port}/`);
  });
  server.on('error', (err) => {
    console.warn(`Could not bind to port ${port}:`, err.message);
  });
  return server;
}

// Start primary port (3001)
startServer(PRIMARY_PORT);

// Also bind secondary port (3000) if free
if (SECONDARY_PORT) {
  startServer(SECONDARY_PORT);
}
