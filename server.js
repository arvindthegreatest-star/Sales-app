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

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Generated dedicated sales portal: ${fileName} for ${salesperson.name}`);

  // Generate dedicated PWA manifest for salesperson
  try {
    const manifestData = {
      name: `Sri Govinda - ${salesperson.name}`,
      short_name: `${(salesperson.name || 'Rep').split(' ')[0]} Portal`,
      description: `Sri Govinda Food Products - Field Sales Order Entry & Instant Billing Terminal for ${salesperson.name}`,
      start_url: `./sales_${slug}.html`,
      scope: "./",
      display: "standalone",
      orientation: "portrait",
      background_color: "#020617",
      theme_color: "#020617",
      icons: [
        { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    };
    fs.writeFileSync(path.join(ROOT_DIR, `manifest_${slug}.json`), JSON.stringify(manifestData, null, 2), 'utf8');
  } catch(e) {}

  return { fileName, filePath, slug, url: `/${fileName}` };
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

  // If root, serve index.html (Manager Hub)
  if (pathname === '/' || pathname === '') {
    return serveFile(path.join(ROOT_DIR, 'index.html'), res);
  }

  // Check if requesting an existing file in directory (e.g. sales_ramesh.html, icon.png, config.js)
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, res);
    }

    // Dynamic Sales Official Slug URL (e.g. /ramesh -> serves sales_ramesh.html)
    const cleanSlug = pathname.replace(/^\/+/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const directSalesFile = path.join(ROOT_DIR, `sales_${cleanSlug}.html`);
    if (fs.existsSync(directSalesFile)) {
      return serveFile(directSalesFile, res);
    }

    // Default Fallback: Serve index.html
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
