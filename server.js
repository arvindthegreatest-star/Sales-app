const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
// Single port architecture - defaults to 3005 (or passed argument / PORT env), doing away with port 3001!
const PORT = parseInt(process.env.PORT || process.argv[2] || '3005', 10);

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

const DEFAULT_SALESPEOPLE = [
  { id: 'SP-101', name: 'Ramesh Kumar', slug: 'ramesh', phone: '+91 9731988411', email: '', assignedRoute: 'Yelahanka Beat 1', monthlyTarget: 150000, commissionPct: 3.0, vehicleType: 'Two-Wheeler', dailyOrderTarget: 6, joiningDate: '2025-01-01', address: 'Bengaluru', active: true },
  { id: 'SP-325', name: 'Pradhish', slug: 'pradhish', phone: '11111111', email: '', assignedRoute: 'east bangalore', monthlyTarget: 30000, commissionPct: 3.0, vehicleType: 'Two-Wheeler', dailyOrderTarget: 6, joiningDate: '2026-09-29', address: 'Bengaluru', active: true },
  { id: 'SP-103', name: 'Nagaraju', slug: 'nagaraju', phone: '+91 9845012345', email: '', assignedRoute: 'Vidyaranyapura Beat 3', monthlyTarget: 150000, commissionPct: 3.0, vehicleType: 'Two-Wheeler', dailyOrderTarget: 6, joiningDate: '2025-01-01', address: 'Bengaluru', active: true },
  { id: 'SP-104', name: 'Sales Official 4', slug: 'salesofficial4', phone: '', email: '', assignedRoute: 'Jakkur Beat 4', monthlyTarget: 150000, commissionPct: 3.0, vehicleType: 'Two-Wheeler', dailyOrderTarget: 6, joiningDate: '2025-01-01', address: 'Bengaluru', active: true },
  { id: 'SP-105', name: 'Kavitha', slug: 'kavitha', phone: '+91 9123456780', email: '', assignedRoute: 'Yelahanka Beat 5', monthlyTarget: 180000, commissionPct: 3.5, vehicleType: 'Two-Wheeler', dailyOrderTarget: 8, joiningDate: '2025-01-01', address: 'Bengaluru', active: true }
];

// ==============================================================================
// SALES PORTAL GENERATOR ENGINE
// ==============================================================================
function generateSalesPortalFile(salesperson) {
  const templatePath = path.join(ROOT_DIR, 'sales_portal_template.html');
  if (!fs.existsSync(templatePath)) {
    console.error("Template not found:", templatePath);
    return null;
  }
  let content = fs.readFileSync(templatePath, 'utf8');

  const slug = (salesperson.slug || salesperson.name || 'rep')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const repBaseDir = path.join(ROOT_DIR, 'rep');
  if (!fs.existsSync(repBaseDir)) fs.mkdirSync(repBaseDir, { recursive: true });
  const repDir = path.join(repBaseDir, slug);
  if (!fs.existsSync(repDir)) fs.mkdirSync(repDir, { recursive: true });

  const fileName = `sales_${slug}.html`;
  const filePath = path.join(ROOT_DIR, fileName);

  content = content
    .replace(/{{ID}}/g, salesperson.id || 'SP-101')
    .replace(/{{NAME}}/g, salesperson.name || 'Sales Official')
    .replace(/{{SLUG}}/g, slug)
    .replace(/{{PHONE}}/g, salesperson.phone || '')
    .replace(/{{ROUTE}}/g, salesperson.assignedRoute || 'General Beat')
    .replace(/{{MONTHLY_TARGET}}/g, String(salesperson.monthlyTarget || 150000))
    .replace(/{{COMMISSION_PCT}}/g, String(salesperson.commissionPct || 3.0))
    .replace(/{{DAILY_TARGET}}/g, String(salesperson.dailyOrderTarget || 6))
    .replace(/{{VEHICLE}}/g, salesperson.vehicleType || 'Two-Wheeler');

  // 1. Write dedicated /rep/<slug>/index.html
  fs.writeFileSync(path.join(repDir, 'index.html'), content, 'utf8');

  // 2. Generate dedicated isolated PWA manifest for salesperson
  try {
    const firstName = (salesperson.name || 'Rep').split(' ')[0];
    const manifestData = {
      id: `/rep/${slug}/`,
      name: `Sri Govinda - ${salesperson.name}`,
      short_name: `${firstName} Portal`,
      description: `Sri Govinda Food Products - Field Sales Order Entry & Instant Billing Terminal for ${salesperson.name}`,
      start_url: `/rep/${slug}/`,
      scope: `/rep/${slug}/`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#020617",
      theme_color: "#020617",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    };
    fs.writeFileSync(path.join(repDir, 'manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');
    fs.writeFileSync(path.join(ROOT_DIR, `manifest_${slug}.json`), JSON.stringify(manifestData, null, 2), 'utf8');
  } catch(e) {}

  // 3. Write root sales_<slug>.html with auto-redirect to /rep/<slug>/
  const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=/rep/${slug}/">
  <script>window.location.replace('/rep/${slug}/');</script>
  <title>Opening ${salesperson.name} Portal...</title>
</head>
<body style="background:#020617;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h2 style="font-size:18px;margin-bottom:8px;">Opening ${salesperson.name} Portal...</h2>
    <p><a href="/rep/${slug}/" style="color:#10b981;font-weight:bold;text-decoration:none;">Click here if not redirected automatically</a></p>
  </div>
</body>
</html>`;
  fs.writeFileSync(filePath, redirectHtml, 'utf8');

  console.log(`Generated dedicated sales portal: /rep/${slug}/ for ${salesperson.name}`);
  return { fileName, filePath, slug, url: `/rep/${slug}/` };
}

function ensureAllSalesPortalsExist() {
  const spPath = path.join(ROOT_DIR, 'salespeople.json');
  let list = DEFAULT_SALESPEOPLE;
  if (fs.existsSync(spPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(spPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) list = data;
    } catch (e) {
      console.warn("Could not read salespeople.json, using defaults:", e);
    }
  } else {
    try {
      fs.writeFileSync(spPath, JSON.stringify(list, null, 2), 'utf8');
    } catch(e) {}
  }

  const generated = [];
  list.forEach(sp => {
    const res = generateSalesPortalFile(sp);
    if (res) generated.push(res);
  });

  // Ensure manager portal directory and isolated manifest exist
  try {
    const managerDir = path.join(ROOT_DIR, 'manager');
    if (!fs.existsSync(managerDir)) fs.mkdirSync(managerDir, { recursive: true });
    const managerManifestData = {
      id: "/manager/",
      name: "Sri Govinda Manager Hub",
      short_name: "SG Manager",
      description: "Sri Govinda Food Products - Management, Dispatch, Inventory & Executive Analytics Console",
      start_url: "/manager/",
      scope: "/manager/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#020617",
      theme_color: "#020617",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    };
    fs.writeFileSync(path.join(managerDir, 'manifest.json'), JSON.stringify(managerManifestData, null, 2), 'utf8');
    fs.writeFileSync(path.join(ROOT_DIR, 'manifest.json'), JSON.stringify(managerManifestData, null, 2), 'utf8');
    if (fs.existsSync(path.join(ROOT_DIR, 'index.html'))) {
      fs.copyFileSync(path.join(ROOT_DIR, 'index.html'), path.join(managerDir, 'index.html'));
    }
  } catch(e) {}

  return generated;
}

// ==============================================================================
// HTTP REQUEST HANDLER
// ==============================================================================
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

  // API: Get Salespeople List
  if (pathname === '/api/salespeople' && req.method === 'GET') {
    const spPath = path.join(ROOT_DIR, 'salespeople.json');
    let list = DEFAULT_SALESPEOPLE;
    if (fs.existsSync(spPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(spPath, 'utf8'));
        if (Array.isArray(data) && data.length > 0) list = data;
      } catch (e) {}
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    return res.end(JSON.stringify(list));
  }

  // API: Save & Generate Sales Portals
  if (pathname === '/api/salespeople' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const list = JSON.parse(body);
        if (!Array.isArray(list)) throw new Error("Expected array of salespeople");
        const spPath = path.join(ROOT_DIR, 'salespeople.json');
        fs.writeFileSync(spPath, JSON.stringify(list, null, 2), 'utf8');

        // Generate files for every sales official!
        const generated = [];
        list.forEach(sp => {
          const res = generateSalesPortalFile(sp);
          if (res) generated.push(res);
        });

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ success: true, salespeople: list, generated }));
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

  // API: Generate single sales portal on the fly
  if (pathname === '/api/generate-sales-portal' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const sp = JSON.parse(body);
        const resObj = generateSalesPortalFile(sp);
        if (!resObj) throw new Error("Could not generate portal file");

        // Also update salespeople.json
        const spPath = path.join(ROOT_DIR, 'salespeople.json');
        let list = DEFAULT_SALESPEOPLE;
        if (fs.existsSync(spPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(spPath, 'utf8'));
            if (Array.isArray(data)) list = data;
          } catch(e) {}
        }
        const existingIdx = list.findIndex(x => x.id === sp.id || x.slug === sp.slug);
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...sp };
        } else {
          list.push(sp);
        }
        fs.writeFileSync(spPath, JSON.stringify(list, null, 2), 'utf8');

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ success: true, ...resObj }));
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

  // 1. Subdomain routing (e.g. ramesh.domain.com or ramesh.localhost:3005)
  const host = (req.headers.host || '').toLowerCase();
  const hostNoPort = host.split(':')[0];
  const hostParts = hostNoPort.split('.');
  if (hostParts.length >= 2) {
    const sub = hostParts[0];
    if (sub !== 'www' && sub !== 'app' && sub !== 'sales' && sub !== 'localhost') {
      const repIndexPath = path.join(ROOT_DIR, 'rep', sub, 'index.html');
      if (fs.existsSync(repIndexPath)) {
        if (pathname === '/' || pathname === '' || pathname === '/index.html') {
          return serveFile(repIndexPath, res);
        }
        if (pathname === '/manifest.json') {
          return serveFile(path.join(ROOT_DIR, 'rep', sub, 'manifest.json'), res);
        }
      }
    }
  }

  // 2. Manager Hub routing (/manager/ or /manager)
  if (pathname === '/manager' || pathname === '/manager/' || pathname === '/manager/index.html') {
    const managerIndex = path.join(ROOT_DIR, 'manager', 'index.html');
    if (fs.existsSync(managerIndex)) return serveFile(managerIndex, res);
    return serveFile(path.join(ROOT_DIR, 'index.html'), res);
  }

  // 3. Isolated Representative directory routing (/rep/<slug>/)
  if (pathname.startsWith('/rep/')) {
    const subPath = pathname.substring(5); // after /rep/
    const parts = subPath.split('/').filter(Boolean);
    if (parts.length === 1 && !pathname.endsWith('/')) {
      res.writeHead(301, { Location: `/rep/${parts[0]}/` });
      return res.end();
    }
    const slug = parts[0];
    const targetFile = parts.length > 1 ? parts.slice(1).join('/') : 'index.html';
    const repFilePath = path.join(ROOT_DIR, 'rep', slug, targetFile);
    if (fs.existsSync(repFilePath)) {
      return serveFile(repFilePath, res);
    }
  }

  // 4. Root "/" serves index.html (Manager Hub)
  if (pathname === '/' || pathname === '') {
    return serveFile(path.join(ROOT_DIR, 'index.html'), res);
  }

  // 5. Existing static file check
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, res);
    }

    // Dynamic Sales Official Slug URL (e.g. /ramesh or /sales_ramesh.html -> redirect to /rep/ramesh/)
    const cleanSlug = pathname.replace(/^\/+/, '').replace(/^sales_/, '').replace(/\.html$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const directRepFile = path.join(ROOT_DIR, 'rep', cleanSlug, 'index.html');
    if (fs.existsSync(directRepFile)) {
      res.writeHead(302, { Location: `/rep/${cleanSlug}/` });
      return res.end();
    }

    // Default Fallback: Serve index.html
    return serveFile(path.join(ROOT_DIR, 'index.html'), res);
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';
  if (path.basename(filePath) === 'manifest.json' || filePath.includes('manifest')) {
    contentType = 'application/manifest+json; charset=utf-8';
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Server Error: ${err.message}`);
      return;
    }

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': (ext === '.html' || filePath.endsWith('sw.js')) ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    };

    if (filePath.endsWith('sw.js')) {
      headers['Service-Worker-Allowed'] = '/';
    }

    res.writeHead(200, headers);
    res.end(content);
  });
}

function startServer(port) {
  const server = http.createServer(requestHandler);
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n===============================================================`);
    console.log(` Sri Govinda Multi-File Sales System (sales duplicate)`);
    console.log(` Manager Hub:             http://localhost:${port}/`);
    console.log(` Ramesh Kumar Portal:     http://localhost:${port}/sales_ramesh.html`);
    console.log(` Pradhish Portal:         http://localhost:${port}/sales_pradhish.html`);
    console.log(` Nagaraju Portal:         http://localhost:${port}/sales_nagaraju.html`);
    console.log(`===============================================================\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, attempting port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(`Could not bind to port ${port}:`, err.message);
    }
  });
  return server;
}

// Generate all initial sales portals on server start
ensureAllSalesPortalsExist();

// Start Single Server
startServer(PORT);
