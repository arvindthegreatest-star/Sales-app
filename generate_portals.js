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
});
console.log('All sales portals successfully regenerated!');
