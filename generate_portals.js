const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const spPath = path.join(ROOT_DIR, 'salespeople.json');
const tmplPath = path.join(ROOT_DIR, 'sales_portal_template.html');

const salespeople = JSON.parse(fs.readFileSync(spPath, 'utf8'));
const template = fs.readFileSync(tmplPath, 'utf8');

// Ensure base directories exist
const repBaseDir = path.join(ROOT_DIR, 'rep');
if (!fs.existsSync(repBaseDir)) fs.mkdirSync(repBaseDir, { recursive: true });

const managerDir = path.join(ROOT_DIR, 'manager');
if (!fs.existsSync(managerDir)) fs.mkdirSync(managerDir, { recursive: true });

salespeople.forEach(sp => {
  const slug = (sp.slug || sp.name || 'rep').toLowerCase().replace(/[^a-z0-9]/g, '');
  const repDir = path.join(repBaseDir, slug);
  if (!fs.existsSync(repDir)) fs.mkdirSync(repDir, { recursive: true });

  let content = template
    .replace(/{{ID}}/g, sp.id || 'SP-101')
    .replace(/{{NAME}}/g, sp.name || 'Sales Official')
    .replace(/{{SLUG}}/g, slug)
    .replace(/{{PHONE}}/g, sp.phone || '')
    .replace(/{{ROUTE}}/g, sp.assignedRoute || 'General Beat')
    .replace(/{{MONTHLY_TARGET}}/g, String(sp.monthlyTarget || 150000))
    .replace(/{{COMMISSION_PCT}}/g, String(sp.commissionPct || 3.0))
    .replace(/{{DAILY_TARGET}}/g, String(sp.dailyOrderTarget || 6))
    .replace(/{{VEHICLE}}/g, sp.vehicleType || 'Two-Wheeler');

  // 1. Write dedicated /rep/<slug>/index.html
  const repIndexPath = path.join(repDir, 'index.html');
  fs.writeFileSync(repIndexPath, content, 'utf8');
  console.log(`Regenerated /rep/${slug}/index.html for ${sp.name}`);

  // 2. Generate dedicated isolated PWA manifest for salesperson
  const firstName = (sp.name || 'Sales').split(' ')[0];
  const repManifestData = {
    id: `/rep/${slug}/`,
    name: `Sri Govinda - ${sp.name}`,
    short_name: `${firstName} Portal`,
    description: `Sri Govinda Food Products - Field Sales Order Entry & Instant Billing Terminal for ${sp.name}`,
    start_url: `/rep/${slug}/`,
    scope: `/rep/${slug}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };
  const repManifestPath = path.join(repDir, 'manifest.json');
  fs.writeFileSync(repManifestPath, JSON.stringify(repManifestData, null, 2), 'utf8');

  // 3. Generate root manifest_<slug>.json for backwards compatibility (isolated scope)
  const rootManifestPath = path.join(ROOT_DIR, `manifest_${slug}.json`);
  fs.writeFileSync(rootManifestPath, JSON.stringify(repManifestData, null, 2), 'utf8');

  // 4. Generate root sales_<slug>.html redirect to /rep/<slug>/
  const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=/rep/${slug}/">
  <script>window.location.replace('/rep/${slug}/');</script>
  <title>Opening ${sp.name} Portal...</title>
</head>
<body style="background:#020617;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <h2 style="font-size:18px;margin-bottom:8px;">Opening ${sp.name} Portal...</h2>
    <p><a href="/rep/${slug}/" style="color:#10b981;font-weight:bold;text-decoration:none;">Click here if not redirected automatically</a></p>
  </div>
</body>
</html>`;
  fs.writeFileSync(path.join(ROOT_DIR, `sales_${slug}.html`), redirectHtml, 'utf8');
});

// Manager isolated PWA manifest
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
    {
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ]
};
fs.writeFileSync(path.join(managerDir, 'manifest.json'), JSON.stringify(managerManifestData, null, 2), 'utf8');
fs.writeFileSync(path.join(ROOT_DIR, 'manifest.json'), JSON.stringify(managerManifestData, null, 2), 'utf8');

// Copy index.html to /manager/index.html
if (fs.existsSync(path.join(ROOT_DIR, 'index.html'))) {
  fs.copyFileSync(path.join(ROOT_DIR, 'index.html'), path.join(managerDir, 'index.html'));
  console.log('Synchronized /manager/index.html');
}

console.log('All sales portals, isolated manifests, and manager portal successfully regenerated!');
