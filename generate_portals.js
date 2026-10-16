const fs = require('fs');
const path = require('path');

const spPath = path.join(__dirname, 'salespeople.json');
const tmplPath = path.join(__dirname, 'sales_portal_template.html');

const salespeople = JSON.parse(fs.readFileSync(spPath, 'utf8'));
const template = fs.readFileSync(tmplPath, 'utf8');

salespeople.forEach(sp => {
  const slug = (sp.slug || sp.name || 'rep').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `sales_${slug}.html`;
  const filePath = path.join(__dirname, fileName);

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

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Regenerated ${fileName} for ${sp.name}`);

  // Generate dedicated PWA manifest for salesperson
  const manifestData = {
    name: `Sri Govinda - ${sp.name}`,
    short_name: `${sp.name.split(' ')[0]} Portal`,
    description: `Sri Govinda Food Products - Field Sales Order Entry & Instant Billing Terminal for ${sp.name}`,
    start_url: `./sales_${slug}.html`,
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "./icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "./icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };
  const manifestPath = path.join(__dirname, `manifest_${slug}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`Generated manifest_${slug}.json for ${sp.name}`);
});
console.log('All sales portals and manifests successfully regenerated!');
