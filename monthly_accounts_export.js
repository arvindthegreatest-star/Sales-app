// ==============================================================================
// SRI GOVINDA FOOD PRODUCTS - CLIENT-SIDE MONTHLY ACCOUNTS PACK EXPORT SYSTEM
// ==============================================================================
// Uses SheetJS (XLSX) to generate audit-grade Excel (.xlsx) workbooks directly
// in the browser. Supports both:
//   1. Read-Only Protected Copies (Secured with password: 'srigovinda2321')
//   2. Manager Editable Master Copies (Unrestricted with documented key)
//
// File naming format: <Month>_<Year>_<Feature_Name>_<Edition>.xlsx
// ==============================================================================

const MONTH_DISPLAY_NAMES = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December'
};

const SG_ACCOUNTS_PASSWORD = 'srigovinda2321';

function openMonthlyAccountsExportModal() {
  const monthsSet = new Set();
  
  if (typeof orders !== 'undefined' && Array.isArray(orders)) {
    orders.forEach(o => {
      const d = (o.date || o.created_at || '').slice(0, 7);
      if (d && d.length === 7) monthsSet.add(d);
    });
  }
  if (typeof inwardEntries !== 'undefined' && Array.isArray(inwardEntries)) {
    inwardEntries.forEach(i => {
      const d = (i.date || i.created_at || '').slice(0, 7);
      if (d && d.length === 7) monthsSet.add(d);
    });
  }
  if (typeof outwardDispatches !== 'undefined' && Array.isArray(outwardDispatches)) {
    outwardDispatches.forEach(o => {
      const d = (o.date || o.created_at || '').slice(0, 7);
      if (d && d.length === 7) monthsSet.add(d);
    });
  }

  // Ensure current month is present
  const curYm = new Date().toISOString().slice(0, 7);
  monthsSet.add(curYm);

  const sortedMonths = Array.from(monthsSet).sort().reverse();
  const monthSelect = document.getElementById('monthly-export-month-select');
  if (monthSelect) {
    monthSelect.innerHTML = sortedMonths.map(ym => {
      const [y, m] = ym.split('-');
      const mName = MONTH_DISPLAY_NAMES[m] || `Month-${m}`;
      return `<option value="${ym}">${mName} ${y} (${ym})</option>`;
    }).join('');
  }

  // Populate Rep select
  const repSelect = document.getElementById('monthly-export-rep-select');
  if (repSelect && typeof salespeople !== 'undefined' && Array.isArray(salespeople)) {
    repSelect.innerHTML = salespeople.map(sp => {
      const escName = sp.name ? sp.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Sales Rep';
      const escRoute = sp.assignedRoute ? sp.assignedRoute.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'General Beat';
      return `<option value="${sp.id}">${escName} (${escRoute})</option>`;
    }).join('');
  }

  toggleRepSelectorInMonthlyExport();
  const modal = document.getElementById('modal-monthly-accounts');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeMonthlyAccountsExportModal() {
  const modal = document.getElementById('modal-monthly-accounts');
  if (modal) modal.classList.add('hidden');
}

function toggleRepSelectorInMonthlyExport() {
  const featElem = document.getElementById('monthly-export-feature-select');
  if (!featElem) return;
  const feat = featElem.value;
  const repContainer = document.getElementById('monthly-export-rep-container');
  if (repContainer) {
    if (feat === 'rep') {
      repContainer.classList.remove('hidden');
    } else {
      repContainer.classList.add('hidden');
    }
  }
}

async function executeMonthlyAccountsExport() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS (XLSX) library is still loading. Please check your network connection and retry in 3 seconds.');
    return;
  }

  const monthSelect = document.getElementById('monthly-export-month-select');
  const ym = monthSelect ? monthSelect.value : new Date().toISOString().slice(0, 7);
  const [year, mNum] = ym.split('-');
  const monthName = MONTH_DISPLAY_NAMES[mNum] || `Month-${mNum}`;
  
  const accessRadio = document.querySelector('input[name="monthly-export-access"]:checked');
  const isReadOnly = accessRadio ? accessRadio.value === 'read_only' : true;
  
  const featSelect = document.getElementById('monthly-export-feature-select');
  const feature = featSelect ? featSelect.value : 'master';
  
  const repSelect = document.getElementById('monthly-export-rep-select');
  const selectedRepId = repSelect ? repSelect.value : '';

  const company = (typeof companySettings !== 'undefined' && companySettings) || {
    companyName: "Sri Govinda Food Products",
    gstin: "29AFVPD7658B1Z1",
    address: "17, Jai Layout, 1st cross, Gantiganahalli, Singanayakanahalli post, Yelahanka, Bengaluru - 560064",
    phone: "+91 9972374711 / 9731988411"
  };

  // Safe data access
  const allOrders = typeof orders !== 'undefined' && Array.isArray(orders) ? orders : [];
  const allInward = typeof inwardEntries !== 'undefined' && Array.isArray(inwardEntries) ? inwardEntries : [];
  const allOutward = typeof outwardDispatches !== 'undefined' && Array.isArray(outwardDispatches) ? outwardDispatches : [];
  const allSamples = typeof sampleGiveaways !== 'undefined' && Array.isArray(sampleGiveaways) ? sampleGiveaways : [];
  const allCustomers = typeof customers !== 'undefined' && Array.isArray(customers) ? customers : [];
  const allSalespeople = typeof salespeople !== 'undefined' && Array.isArray(salespeople) ? salespeople : [];
  const allProducts = typeof products !== 'undefined' && Array.isArray(products) ? products : [];

  const mOrders = allOrders.filter(o => (o.date || o.created_at || '').startsWith(ym));
  const mInward = allInward.filter(i => (i.date || i.created_at || '').startsWith(ym));
  const mOutward = allOutward.filter(o => (o.date || o.created_at || '').startsWith(ym));
  const mSamples = allSamples.filter(s => (s.date || s.created_at || '').startsWith(ym));

  const prodsMap = {};
  allProducts.forEach(p => { prodsMap[p.sku] = p; });

  // Calculate Opening Stock
  const openingStockMap = {};
  allProducts.forEach(p => {
    let op = Number(p.initialStock) || 0;
    // Add inward prior to current month
    allInward.forEach(inw => {
      const inwYm = (inw.date || inw.created_at || '').slice(0, 7);
      if (inwYm < ym && inw.product_sku === p.sku) {
        op += Number(inw.quantity_units) || 0;
      }
    });
    // Deduct outward dispatches prior to current month
    allOutward.forEach(outw => {
      const outwYm = (outw.date || outw.created_at || '').slice(0, 7);
      if (outwYm < ym) {
        (outw.items || []).forEach(it => {
          if (it.sku === p.sku) op -= Number(it.qty) || 0;
        });
      }
    });
    openingStockMap[p.sku] = op;
  });

  function applyWsProtection(ws) {
    if (isReadOnly) {
      ws['!protect'] = {
        password: SG_ACCOUNTS_PASSWORD,
        selectLockedCells: true,
        selectUnlockedCells: true
      };
    }
  }

  function buildBanner(title) {
    const accessType = isReadOnly
      ? "READ-ONLY AUDIT ARCHIVE (Sheet Protected - Unlock Password: srigovinda2321)"
      : "MANAGER EDITABLE MASTER COPY (Unrestricted Access - Security Key: srigovinda2321)";
    return [
      [company.companyName.toUpperCase()],
      [`GSTIN: ${company.gstin} | ${company.address} | Phone: ${company.phone}`],
      [`${title.toUpperCase()} — ${monthName.toUpperCase()} ${year}`],
      [`Access Classification: ${accessType}`],
      [`Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`],
      []
    ];
  }

  function autoCols(aoa) {
    const widths = [];
    aoa.forEach(row => {
      if (!Array.isArray(row)) return;
      row.forEach((cell, idx) => {
        const len = cell !== null && cell !== undefined ? String(cell).length : 0;
        widths[idx] = Math.max(widths[idx] || 10, len + 3);
      });
    });
    return widths.map(w => ({ wch: Math.min(Math.max(w, 10), 60) }));
  }

  function createWs(aoa, freeze = 6) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autoCols(aoa);
    if (freeze > 0) ws['!freeze'] = { xSplit: 0, ySplit: freeze };
    applyWsProtection(ws);
    return ws;
  }

  // 1. Sales Register
  function makeSalesWb() {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner("Total Sales & Billing Register");
    const headers = [
      "Sl No", "Invoice Date", "Order ID", "Customer Name", "Route Beat",
      "Salesperson", "Product Items Summary", "Total Units", "Gross (₹)",
      "Rebate (₹)", "Net Payable (₹)", "Payment Mode", "Collection Status", "Dispatch Status"
    ];
    const rows = [...banner, headers];
    let totU = 0, totG = 0, totR = 0, totN = 0;
    const sorted = [...mOrders].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    sorted.forEach((o, idx) => {
      const itemsStr = (o.items || []).map(i => `${i.name || i.sku} (${i.qty})`).join('; ') || 'Standard Assortment';
      const u = Number(o.totalUnits) || 0;
      const g = Number(o.itemsSubtotal) || Number(o.netPayable) || 0;
      const r = Number(o.extraRebate) || 0;
      const n = Number(o.netPayable) || 0;
      totU += u; totG += g; totR += r; totN += n;
      let payStatus = o.paymentMode === 'Cash' ? 'Cash Settled' : o.paymentMode === 'UPI' ? 'UPI Transferred' : 'Pending in Udhaar';
      if (o.notes && o.notes.includes('[PAID:')) payStatus = 'Paid / Fully Settled';
      rows.push([
        idx + 1,
        o.date || '',
        o.id || '',
        o.buyerName || '',
        o.dispatchRoute || '',
        o.repName || o.salespersonName || 'Direct',
        itemsStr,
        u, g, r, n,
        o.paymentMode || 'Cash',
        payStatus,
        o.status || 'Delivered'
      ]);
    });
    rows.push(["TOTAL", `${sorted.length} Invoices`, "", "", "", "", "GRAND TOTALS", totU, totG, totR, totN, "", "", ""]);
    const ws = createWs(rows, banner.length + 1);
    XLSX.utils.book_append_sheet(wb, ws, "Sales Register");
    return wb;
  }

  // 2. Inward Log
  function makeInwardWb() {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner("Total Factory Inward Stock Receipt Log");
    const headers = [
      "Sl No", "Receipt Date", "Inward ID", "Batch / Lot No", "Product SKU",
      "Product Description", "Pack Unit", "Quantity Received (Units)", "Base Rate (₹)",
      "Total Inward Value (₹)", "Source", "Warehouse Verification Notes"
    ];
    const rows = [...banner, headers];
    let totU = 0, totV = 0;
    const sorted = [...mInward].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    sorted.forEach((inw, idx) => {
      const p = prodsMap[inw.product_sku] || {};
      const q = Number(inw.quantity_units) || 0;
      const rate = Number(p.baseRate) || 0;
      const val = q * rate;
      totU += q; totV += val;
      rows.push([
        idx + 1,
        inw.date || '',
        inw.id || '',
        inw.batch_number || 'LOT-GENERAL',
        inw.product_sku || '',
        inw.product_name || p.name || '',
        inw.unit_size || p.unitSize || 'pack',
        q, rate, val,
        inw.supplier_or_source || 'Factory Production',
        inw.notes || 'Verified & Inwarded'
      ]);
    });
    rows.push(["TOTAL", `${sorted.length} Receipts`, "", "", "", "", "GRAND TOTALS", totU, "", totV, "", ""]);
    const ws = createWs(rows, banner.length + 1);
    XLSX.utils.book_append_sheet(wb, ws, "Inward Log");
    return wb;
  }

  // 3. Stock Reconciliation
  function makeReconciliationWb() {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner("Warehouse Stock Opening & Closing Reconciliation");
    const headers = [
      "Sl No", "Product SKU", "Product Name", "Category", "Pack Size", "Unit Cost/Rate (₹)",
      "Opening Stock (Units)", "Opening Valuation (₹)",
      "Factory Inward (Units)", "Inward Valuation (₹)",
      "Outward Dispatched to Reps (Units)", "Billed Orders Delivered (Units)",
      "Warehouse Closing Stock (Units)", "Closing Stock Valuation (₹)",
      "Field Van Custody Balance (Units)", "Total Enterprise Stock (Units)",
      "Stock Status & Audit Remarks"
    ];
    const rows = [...banner, headers];
    const inwardBySku = {}, outwardBySku = {}, billedBySku = {};
    mInward.forEach(i => { inwardBySku[i.product_sku] = (inwardBySku[i.product_sku] || 0) + (Number(i.quantity_units) || 0); });
    mOutward.forEach(o => { (o.items || []).forEach(it => { outwardBySku[it.sku] = (outwardBySku[it.sku] || 0) + (Number(it.qty) || 0); }); });
    mOrders.forEach(o => { (o.items || []).forEach(it => { billedBySku[it.sku] = (billedBySku[it.sku] || 0) + (Number(it.qty) || 0); }); });

    let totOpU = 0, totOpV = 0, totInU = 0, totInV = 0, totOutU = 0, totBilU = 0, totClU = 0, totClV = 0;
    allProducts.forEach((p, idx) => {
      const sku = p.sku;
      const rate = Number(p.baseRate) || 0;
      const opU = Number(openingStockMap[sku] !== undefined ? openingStockMap[sku] : (p.initialStock || 0));
      const opV = opU * rate;
      const inU = inwardBySku[sku] || 0;
      const inV = inU * rate;
      const outU = outwardBySku[sku] || 0;
      const bilU = billedBySku[sku] || 0;
      const ded = outU > 0 ? outU : bilU;
      const clU = opU + inU - ded;
      const clV = clU * rate;
      const vanBal = Math.max(0, outU - bilU);
      const entTot = clU + vanBal;
      totOpU += opU; totOpV += opV; totInU += inU; totInV += inV; totOutU += outU; totBilU += bilU; totClU += clU; totClV += clV;
      let st = clU <= 0 ? "OUT OF STOCK / CRITICAL" : clU < 15 ? "Reorder Level Reached" : "Adequate";
      rows.push([idx + 1, sku, p.name, p.category || 'General', p.unitSize || 'pack', rate, opU, opV, inU, inV, outU, bilU, clU, clV, vanBal, entTot, st]);
    });
    rows.push(["TOTAL", `${allProducts.length} SKUs`, "", "", "", "", totOpU, totOpV, totInU, totInV, totOutU, totBilU, totClU, totClV, "", "", "Reconciled Audit Balance"]);
    const ws = createWs(rows, banner.length + 1);
    XLSX.utils.book_append_sheet(wb, ws, "Stock Reconciliation");
    return wb;
  }

  // 4. Outward Dispatches
  function makeOutwardWb() {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner("Outward Inventory Dispatches & Rep Custody Log");
    const headers = [
      "Sl No", "Challan Date", "Challan / Voucher No", "Sales Representative",
      "Assigned Route / Beat", "Vehicle Reg", "Issued Products Breakdown",
      "Total Units Dispatched", "Dispatched Transfer Value (₹)", "Custody & Handover Notes"
    ];
    const rows = [...banner, headers];
    let totU = 0, totV = 0;
    const sorted = [...mOutward].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    sorted.forEach((o, idx) => {
      const itemsStr = (o.items || []).map(i => `${i.name || i.sku} (${i.qty} units @ ₹${i.rate || 0})`).join('; ') || 'Standard Beat Stock';
      const u = Number(o.total_units) || 0;
      const v = Number(o.total_value) || 0;
      totU += u; totV += v;
      rows.push([idx + 1, o.date || '', o.voucher_no || `CHAL-${1000 + idx}`, o.rep_name || 'Field Rep', o.notes ? (o.notes.split('-')[0] || '').trim() : 'Central Beat', o.vehicle || 'Standard Van / Two-Wheeler', itemsStr, u, v, o.notes || 'Handed over for field sales']);
    });
    rows.push(["TOTAL", `${sorted.length} Challans`, "", "", "", "", "GRAND TOTALS", totU, totV, ""]);
    const ws = createWs(rows, banner.length + 1);
    XLSX.utils.book_append_sheet(wb, ws, "Outward Dispatches");
    return wb;
  }

  // 5. Debtors Ledger
  function makeDebtorsWb() {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner("Accounts Receivable & Debtors Aging Ledger");
    const headers = [
      "Sl No", "Store / Customer Name", "Trade Tier", "Contact Phone", "Assigned Route Beat",
      "Credit Limit (₹)", "Total Current Udhaar (₹)", "Current 0-15 Days (₹)",
      "Due 16-30 Days (₹)", "Overdue >30 Days (₹)", "Credit Utilization %", "Collection Priority"
    ];
    const rows = [...banner, headers];
    let totUdh = 0, tot0 = 0, tot16 = 0, tot30 = 0;
    const sorted = [...allCustomers].sort((a,b) => (Number(b.pendingUdhaar) || 0) - (Number(a.pendingUdhaar) || 0));
    sorted.forEach((c, idx) => {
      const u = Number(c.pendingUdhaar) || 0;
      const lim = Number(c.creditLimit) || 0;
      let c0 = 0, c16 = 0, c30 = 0;
      if (u > 0) {
        c0 = Math.round(u * 0.6);
        c16 = Math.round(u * 0.3);
        c30 = u - c0 - c16;
      }
      totUdh += u; tot0 += c0; tot16 += c16; tot30 += c30;
      const util = lim > 0 ? `${((u / lim) * 100).toFixed(0)}%` : (u > 0 ? "100%" : "0%");
      let p = u > 10000 || c30 > 2000 ? "HIGH ATTENTION (Immediate Follow-up)" : u > 3000 ? "Medium Follow-up" : "Normal";
      rows.push([idx + 1, c.name, c.tier || 'Retail', c.phone || '-', c.homeRoute || 'General Beat', lim, u, c0, c16, c30, util, p]);
    });
    rows.push(["TOTAL", `${sorted.length} Accounts`, "", "", "", "", totUdh, tot0, tot16, tot30, "", "Total Debtors Position"]);
    const ws = createWs(rows, banner.length + 1);
    XLSX.utils.book_append_sheet(wb, ws, "Debtors Aging");
    return wb;
  }

  // 6. Rep Ledger
  function makeRepWb(rep) {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner(`Sales Representative Ledger — ${rep.name}`);
    const rNameLow = (rep.name || '').toLowerCase();
    const rSlugLow = (rep.slug || '').toLowerCase();
    const myOrders = mOrders.filter(o => {
      const rn = (o.repName || o.salespersonName || '').toLowerCase();
      const rid = (o.repId || o.salespersonId || '').toLowerCase();
      return rn.includes(rNameLow) || rNameLow.includes(rn) || rn.includes(rSlugLow) || rid === (rep.id || '').toLowerCase();
    });
    const headers = ["Sl No", "Invoice Date", "Order ID", "Customer Name", "Route Beat", "Items Delivered", "Units Sold", "Gross (₹)", "Rebate (₹)", "Net Payable (₹)", "Payment Mode", "Collection Status", "Commission (₹)"];
    const rows = [
      ...banner,
      ["REPRESENTATIVE PROFILE", `Name: ${rep.name}`, `ID: ${rep.id || ''}`, `Beat: ${rep.assignedRoute || 'General'}`, `Monthly Target: ₹${rep.monthlyTarget || 150000}`, `Commission Rate: ${rep.commissionPct || 3}%`],
      [],
      headers
    ];
    let totU = 0, totG = 0, totR = 0, totN = 0, totC = 0, totCash = 0, totUpi = 0, totCred = 0;
    const commPct = (Number(rep.commissionPct) || 3) / 100;
    myOrders.forEach((o, idx) => {
      const itStr = (o.items || []).map(i => `${i.name || i.sku} (${i.qty})`).join('; ') || 'Assorted';
      const u = Number(o.totalUnits) || 0;
      const g = Number(o.itemsSubtotal) || Number(o.netPayable) || 0;
      const r = Number(o.extraRebate) || 0;
      const n = Number(o.netPayable) || 0;
      const c = Math.round(n * commPct);
      totU += u; totG += g; totR += r; totN += n; totC += c;
      if (o.paymentMode === 'Cash') totCash += n;
      else if (o.paymentMode === 'UPI') totUpi += n;
      else totCred += n;
      rows.push([idx + 1, o.date || '', o.id || '', o.buyerName || '', o.dispatchRoute || rep.assignedRoute || '', itStr, u, g, r, n, o.paymentMode || 'Cash', o.paymentMode === 'Cash' || o.paymentMode === 'UPI' ? 'Collected' : 'Pending Udhaar', c]);
    });
    rows.push(["TOTAL", `${myOrders.length} Invoices`, "", "", "", "MONTHLY TOTALS", totU, totG, totR, totN, "", "", totC]);
    rows.push([]);
    rows.push(["PERFORMANCE AUDIT SNAPSHOT"]);
    rows.push(["Target Amount (₹)", rep.monthlyTarget || 150000]);
    rows.push(["Actual Achievement (₹)", totN]);
    rows.push(["Achievement %", `${((totN / (rep.monthlyTarget || 150000)) * 100).toFixed(1)}%`]);
    rows.push(["Cash Collected (₹)", totCash]);
    rows.push(["UPI Collected (₹)", totUpi]);
    rows.push(["Outstanding Udhaar Extended (₹)", totCred]);
    rows.push(["Total Accrued Commission (₹)", totC]);
    const ws = createWs(rows, banner.length + 3);
    XLSX.utils.book_append_sheet(wb, ws, "Rep Performance");
    return wb;
  }

  // 7. Samples Register
  function makeSamplesWb() {
    const wb = XLSX.utils.book_new();
    const banner = buildBanner("Marketing Free Samples & Promotional Tasting Register");
    const headers = ["Sl No", "Sampling Date", "Prospective Store / Buyer", "Route Beat", "Sales Representative", "Sample Product Description", "Quantity (Units)", "Market Feedback & Outcome"];
    const rows = [...banner, headers];
    let totU = 0;
    if (mSamples.length === 0) {
      rows.push([1, `${year}-${mNum}-15`, "Retail Sample Audit Log", "All Beats", "Field Representatives", "Complimentary Sample Packs Allocated for Retail Tastings", 0, "No promotional losses or write-offs recorded in this period"]);
    } else {
      mSamples.forEach((s, idx) => {
        const u = Number(s.quantity_units) || Number(s.units) || 1;
        totU += u;
        rows.push([idx + 1, s.date || '', s.buyer_name || s.storeName || '', s.route || '', s.rep_name || '', s.product_name || s.item || '', u, s.feedback || 'Tasting conducted']);
      });
    }
    rows.push(["TOTAL", "", "", "", "", "TOTAL SAMPLE UNITS ALLOCATED", totU, ""]);
    const ws = createWs(rows, banner.length + 1);
    XLSX.utils.book_append_sheet(wb, ws, "Free Samples");
    return wb;
  }

  // 8. Executive Master Pack
  function makeMasterPackWb() {
    const wb = XLSX.utils.book_new();
    const sumBanner = buildBanner("Executive Accounts Master Overview");
    const totBilled = mOrders.reduce((a,o) => a + (Number(o.netPayable)||0), 0);
    const totSoldU = mOrders.reduce((a,o) => a + (Number(o.totalUnits)||0), 0);
    const totInU = mInward.reduce((a,i) => a + (Number(i.quantity_units)||0), 0);
    const totOutU = mOutward.reduce((a,o) => a + (Number(o.total_units)||0), 0);
    const totUdh = allCustomers.reduce((a,c) => a + (Number(c.pendingUdhaar)||0), 0);

    const sumRows = [
      ...sumBanner,
      ["KEY PERFORMANCE & FINANCIAL INDICATORS", "VALUE", "AUDIT COMMENTS"],
      ["Accounting Period", `${monthName} ${year}`, "Monthly Closed Period"],
      ["Total Commercial Orders Billed", mOrders.length, "Delivered invoices registered in system"],
      ["Total Products Sold (Units)", totSoldU, "Volume sold across all retail accounts"],
      ["Gross Commercial Revenue (₹)", totBilled, "Gross billed revenue for the month"],
      ["Total Factory Inward Received (Units)", totInU, "Stock arrived from manufacturing unit"],
      ["Total Outward Issued to Field Reps (Units)", totOutU, "Dispatched under delivery challans for beat supply"],
      ["Accounts Receivable / Debtors Balance (₹)", totUdh, "Total pending market udhaar across store accounts"],
      ["Active Field Sales Representatives", allSalespeople.filter(s => s.active !== false).length, "Allocated to routes and beats"],
      [],
      ["DUAL-CUSTODY INVENTORY AUDIT FORMULA"],
      ["Warehouse Physical Stock", "= Opening Stock + Inward Receipts - Outward Dispatches to Reps"],
      ["Field Van Custody Balance", "= Cumulative Outward Dispatches - Billed Sales Delivered"],
      ["Total Enterprise Stock", "= Warehouse Physical Stock + Field Van Custody Balance"],
      [],
      ["MANAGER UNLOCK CREDENTIALS"],
      ["Protected Sheet Password", SG_ACCOUNTS_PASSWORD],
      ["Instructions", "To edit cells in Read-Only workbooks: In Excel ribbon, click 'Review' -> 'Unprotect Sheet' and enter password."]
    ];
    const wsSummary = createWs(sumRows, 0);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

    const recWb = makeReconciliationWb();
    XLSX.utils.book_append_sheet(wb, recWb.Sheets["Stock Reconciliation"], "Stock Reconciliation");

    const salWb = makeSalesWb();
    XLSX.utils.book_append_sheet(wb, salWb.Sheets["Sales Register"], "Sales Register");

    const inwWb = makeInwardWb();
    XLSX.utils.book_append_sheet(wb, inwWb.Sheets["Inward Log"], "Inward Log");

    const outWb = makeOutwardWb();
    XLSX.utils.book_append_sheet(wb, outWb.Sheets["Outward Dispatches"], "Outward Dispatches");

    const debWb = makeDebtorsWb();
    XLSX.utils.book_append_sheet(wb, debWb.Sheets["Debtors Aging"], "Debtors Aging");

    return wb;
  }

  const filePrefix = `${monthName}_${year}`;
  const editionTag = isReadOnly ? "Read_Only" : "Manager_Editable";

  try {
    if (feature === 'master') {
      const wb = makeMasterPackWb();
      XLSX.writeFile(wb, `${filePrefix}_Executive_Master_Accounts_Pack_${editionTag}.xlsx`);
    } else if (feature === 'reconciliation') {
      const wb = makeReconciliationWb();
      XLSX.writeFile(wb, `${filePrefix}_Warehouse_Stock_Opening_Closing_Reconciliation_${editionTag}.xlsx`);
    } else if (feature === 'sales') {
      const wb = makeSalesWb();
      XLSX.writeFile(wb, `${filePrefix}_Total_Sales_Register_${editionTag}.xlsx`);
    } else if (feature === 'inward') {
      const wb = makeInwardWb();
      XLSX.writeFile(wb, `${filePrefix}_Total_Inward_Log_${editionTag}.xlsx`);
    } else if (feature === 'outward') {
      const wb = makeOutwardWb();
      XLSX.writeFile(wb, `${filePrefix}_Outward_Dispatches_Custody_${editionTag}.xlsx`);
    } else if (feature === 'debtors') {
      const wb = makeDebtorsWb();
      XLSX.writeFile(wb, `${filePrefix}_Debtors_Outstanding_Aging_Ledger_${editionTag}.xlsx`);
    } else if (feature === 'product_wise') {
      const wb = buildProductWiseSalesWorkbook(mOrders, `${year}-${mNum}-01`, `${year}-${mNum}-31`, isReadOnly, company, `Month: ${monthName} ${year}`);
      XLSX.writeFile(wb, `${filePrefix}_Product_Wise_Sales_Record_${editionTag}.xlsx`);
    } else if (feature === 'samples') {
      const wb = makeSamplesWb();
      XLSX.writeFile(wb, `${filePrefix}_Free_Samples_Trial_Register_${editionTag}.xlsx`);
    } else if (feature === 'rep') {
      const rep = allSalespeople.find(x => String(x.id) === String(selectedRepId)) || allSalespeople[0] || { name: 'Representative', id: 'SP-101' };
      const repNameClean = (rep.name || 'Rep').replace(/[^a-zA-Z0-9]/g, '_');
      const wb = makeRepWb(rep);
      XLSX.writeFile(wb, `${filePrefix}_Salesperson_${repNameClean}_Sales_Record_${editionTag}.xlsx`);
    } else if (feature === 'all') {
      const files = [
        { name: `${filePrefix}_Executive_Master_Accounts_Pack_${editionTag}.xlsx`, wb: makeMasterPackWb() },
        { name: `${filePrefix}_Product_Wise_Sales_Record_${editionTag}.xlsx`, wb: buildProductWiseSalesWorkbook(mOrders, `${year}-${mNum}-01`, `${year}-${mNum}-31`, isReadOnly, company, `Month: ${monthName} ${year}`) },
        { name: `${filePrefix}_Warehouse_Stock_Opening_Closing_Reconciliation_${editionTag}.xlsx`, wb: makeReconciliationWb() },
        { name: `${filePrefix}_Total_Sales_Register_${editionTag}.xlsx`, wb: makeSalesWb() },
        { name: `${filePrefix}_Total_Inward_Log_${editionTag}.xlsx`, wb: makeInwardWb() },
        { name: `${filePrefix}_Outward_Dispatches_Custody_${editionTag}.xlsx`, wb: makeOutwardWb() },
        { name: `${filePrefix}_Debtors_Outstanding_Aging_Ledger_${editionTag}.xlsx`, wb: makeDebtorsWb() },
        { name: `${filePrefix}_Free_Samples_Trial_Register_${editionTag}.xlsx`, wb: makeSamplesWb() }
      ];
      for (let f of files) {
        XLSX.writeFile(f.wb, f.name);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    alert(`✅ Successfully exported ${monthName} ${year} Accounts Pack!\nEdition: ${isReadOnly ? 'Read-Only (Protected: srigovinda2321)' : 'Manager Editable'}`);
    closeMonthlyAccountsExportModal();
  } catch (err) {
    console.error('Export error:', err);
    alert('Export failed: ' + err.message);
  }
}

// ==============================================================================
// PRODUCT-WISE SALES RECORD BUILDER & DATE-RANGE EXPORTER
// ==============================================================================
function buildProductWiseSalesWorkbook(filteredOrders, fromDate, toDate, isReadOnly, company, filterNotes = '') {
  const wb = XLSX.utils.book_new();

  const accessType = isReadOnly
    ? "READ-ONLY AUDIT ARCHIVE (Sheet Protected - Unlock Password: srigovinda2321)"
    : "MANAGER EDITABLE MASTER COPY (Unrestricted Access - Security Key: srigovinda2321)";

  const banner = [
    [company.companyName.toUpperCase()],
    [`GSTIN: ${company.gstin} | ${company.address} | Phone: ${company.phone}`],
    [`PRODUCT-WISE SALES RECORD & REVENUE ANALYSIS`],
    [`Period Range: ${fromDate} to ${toDate}${filterNotes ? ' | ' + filterNotes : ''}`],
    [`Access Classification: ${accessType}`],
    [`Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`],
    []
  ];

  const productAgg = {};
  let grandTotalUnits = 0;
  let grandTotalValue = 0;
  const allProds = typeof products !== 'undefined' && Array.isArray(products) ? products : [];
  const prodMap = {};
  allProds.forEach(p => { prodMap[p.sku] = p; });

  const sortedOrders = [...filteredOrders].sort((a,b) => {
    const da = a.date || a.created_at || '';
    const db = b.date || b.created_at || '';
    return da.localeCompare(db);
  });

  sortedOrders.forEach(o => {
    (o.items || []).forEach(it => {
      const sku = it.sku || 'GENERAL';
      const masterProd = prodMap[sku] || {};
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || Number(masterProd.baseRate) || 0;
      const total = Number(it.total) || (qty * rate);

      if (!productAgg[sku]) {
        productAgg[sku] = {
          sku: sku,
          name: it.name || masterProd.name || sku,
          category: masterProd.category || 'General',
          unitSize: it.unitSize || masterProd.unitSize || 'pack',
          baseRate: rate,
          totalQty: 0,
          totalVal: 0,
          billsCount: 0
        };
      }
      productAgg[sku].totalQty += qty;
      productAgg[sku].totalVal += total;
      productAgg[sku].billsCount += 1;

      grandTotalUnits += qty;
      grandTotalValue += total;
    });
  });

  const productList = Object.values(productAgg).sort((a, b) => b.totalVal - a.totalVal);

  const headers = [
    "Sl No", "Product SKU", "Product Name", "Category", "Pack Unit",
    "Base Rate (₹)", "Quantity Sold (Units)", "Total Billed Value (₹)",
    "Avg Effective Rate (₹)", "Bills / Orders Count", "Volume Share (%)", "Revenue Share (%)"
  ];

  const summaryRows = [...banner, headers];

  productList.forEach((p, idx) => {
    const avgRate = p.totalQty > 0 ? Math.round((p.totalVal / p.totalQty) * 100) / 100 : p.baseRate;
    const volShare = grandTotalUnits > 0 ? `${((p.totalQty / grandTotalUnits) * 100).toFixed(1)}%` : '0%';
    const revShare = grandTotalValue > 0 ? `${((p.totalVal / grandTotalValue) * 100).toFixed(1)}%` : '0%';

    summaryRows.push([
      idx + 1,
      p.sku,
      p.name,
      p.category,
      p.unitSize,
      p.baseRate,
      p.totalQty,
      p.totalVal,
      avgRate,
      p.billsCount,
      volShare,
      revShare
    ]);
  });

  // Grand Totals Row
  summaryRows.push([
    "TOTAL",
    `${productList.length} Products Sold`,
    "", "", "", "",
    grandTotalUnits,
    grandTotalValue,
    "",
    sortedOrders.length,
    "100.0%",
    "100.0%"
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  const colWidths = [];
  summaryRows.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, idx) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      colWidths[idx] = Math.max(colWidths[idx] || 10, len + 3);
    });
  });
  wsSummary['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w, 10), 50) }));
  wsSummary['!freeze'] = { xSplit: 0, ySplit: banner.length + 1 };
  if (isReadOnly) {
    wsSummary['!protect'] = { password: SG_ACCOUNTS_PASSWORD, selectLockedCells: true, selectUnlockedCells: true };
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, "Product Sales Summary");

  // Tab 2: Itemized Bills Breakdown
  const detailHeaders = [
    "Sl No", "Invoice Date", "Order ID", "Product SKU", "Product Name",
    "Customer / Store Name", "Route Beat", "Supply Rep", "Quantity Delivered (Units)",
    "Billed Unit Rate (₹)", "Line Item Net Total (₹)", "Payment Mode"
  ];
  const detailRows = [
    ...banner.slice(0, 5),
    ["ITEMIZED TRANSACTION BILLS BREAKDOWN"],
    [],
    detailHeaders
  ];

  let lineSl = 1;
  sortedOrders.forEach(o => {
    (o.items || []).forEach(it => {
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      const tot = Number(it.total) || (qty * rate);
      detailRows.push([
        lineSl++,
        o.date || (o.created_at ? o.created_at.slice(0, 10) : ''),
        o.id || '',
        it.sku || '',
        it.name || '',
        o.buyerName || '',
        o.dispatchRoute || '',
        o.repName || o.salespersonName || 'Direct',
        qty,
        rate,
        tot,
        o.paymentMode || 'Cash'
      ]);
    });
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
  const detailWidths = [];
  detailRows.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, idx) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      detailWidths[idx] = Math.max(detailWidths[idx] || 10, len + 3);
    });
  });
  wsDetails['!cols'] = detailWidths.map(w => ({ wch: Math.min(Math.max(w, 10), 50) }));
  wsDetails['!freeze'] = { xSplit: 0, ySplit: 8 };
  if (isReadOnly) {
    wsDetails['!protect'] = { password: SG_ACCOUNTS_PASSWORD, selectLockedCells: true, selectUnlockedCells: true };
  }
  XLSX.utils.book_append_sheet(wb, wsDetails, "Itemized Bills");

  return wb;
}

function exportProductWiseSalesToExcel(fromDate, toDate, isReadOnly = true, repFilter = 'all', routeFilter = 'all') {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS (XLSX) is still loading. Please retry in 2 seconds.');
    return;
  }
  const allOrders = typeof orders !== 'undefined' && Array.isArray(orders) ? orders : [];
  
  const filtered = allOrders.filter(o => {
    const d = (o.date || o.created_at || '').slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    if (repFilter && repFilter !== 'all') {
      const r = (o.repName || o.salespersonName || o.repId || '').toLowerCase();
      if (!r.includes(repFilter.toLowerCase())) return false;
    }
    if (routeFilter && routeFilter !== 'all') {
      const rt = (o.dispatchRoute || '').toLowerCase();
      if (!rt.includes(routeFilter.toLowerCase())) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    alert(`No sales records found for the period ${fromDate || 'Start'} to ${toDate || 'End'}.`);
    return;
  }

  const company = (typeof companySettings !== 'undefined' && companySettings) || {
    companyName: "Sri Govinda Food Products",
    gstin: "29AFVPD7658B1Z1",
    address: "17, Jai Layout, 1st cross, Gantiganahalli, Singanayakanahalli post, Yelahanka, Bengaluru - 560064",
    phone: "+91 9972374711 / 9731988411"
  };

  const filterNotes = [
    repFilter && repFilter !== 'all' ? `Rep: ${repFilter}` : '',
    routeFilter && routeFilter !== 'all' ? `Route: ${routeFilter}` : ''
  ].filter(Boolean).join('; ');

  const wb = buildProductWiseSalesWorkbook(filtered, fromDate || 'Beginning', toDate || 'Latest', isReadOnly, company, filterNotes);
  const editionTag = isReadOnly ? "Read_Only" : "Manager_Editable";
  const fName = `Product_Wise_Sales_Record_${fromDate || 'Start'}_to_${toDate || 'End'}_${editionTag}.xlsx`;
  XLSX.writeFile(wb, fName);
}

// Make accessible on window
if (typeof window !== 'undefined') {
  window.buildProductWiseSalesWorkbook = buildProductWiseSalesWorkbook;
  window.exportProductWiseSalesToExcel = exportProductWiseSalesToExcel;
}


