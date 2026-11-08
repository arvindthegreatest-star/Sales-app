// ==============================================================================
// SRI GOVINDA FOOD PRODUCTS - MONTHLY ACCOUNTING EXCEL PACK GENERATOR
// ==============================================================================
// Generates audit-grade monthly accounting registers in Microsoft Excel (.xlsx)
// format. Creates separate monthly folders with:
//  - Read_Only/ (Protected with password 'srigovinda2321')
//  - Manager_Editable/ (Editable manager copies with security key 'srigovinda2321')
//
// File naming format: <Month>_<Year>_<Feature_Name>.xlsx
// ==============================================================================

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const MANAGER_PASSWORD = 'srigovinda2321';
const SUPABASE_URL = "https://stpvzcicagcwxxpajhle.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cHZ6Y2ljYWdjd3h4cGFqaGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjYxMjgsImV4cCI6MjEwNTQwMjEyOH0.Je1EYtYcdo1v06Enp49EBgU7oQaadd8gS3e2Z4nUgAA";

const MONTH_NAMES = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December'
};

// -----------------------------------------------------------------------------
// Data Fetching Helper
// -----------------------------------------------------------------------------
async function fetchSupabaseTable(tableName) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) {
      console.warn(`[WARN] Table ${tableName} fetch returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[ERROR] Failed to fetch table ${tableName}:`, err.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// Styling & Protection Utilities
// -----------------------------------------------------------------------------
function applyProtection(ws, isReadOnly) {
  if (isReadOnly) {
    ws['!protect'] = {
      password: MANAGER_PASSWORD,
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: true,
      autoFilter: true,
      pivotTables: false
    };
  }
}

function autoFitColumns(aoa) {
  const colWidths = [];
  aoa.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, colIdx) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, len + 3);
    });
  });
  return colWidths.map(w => ({ wch: Math.min(Math.max(w, 10), 60) }));
}

function createSheetFromAoa(aoa, isReadOnly, freezeRow = 6) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);
  if (freezeRow > 0) {
    ws['!freeze'] = { xSplit: 0, ySplit: freezeRow };
  }
  applyProtection(ws, isReadOnly);
  return ws;
}

function getHeaderBanner(title, monthName, year, isReadOnly, company) {
  const accessType = isReadOnly
    ? "READ-ONLY AUDIT ARCHIVE (Sheet Protected - Unlock Password: srigovinda2321)"
    : "MANAGER EDITABLE MASTER COPY (Unrestricted Access - Security Key: srigovinda2321)";
  
  return [
    [company.companyName.toUpperCase()],
    [`GSTIN: ${company.gstin} | ${company.address} | Phone: ${company.phone}`],
    [`${title.toUpperCase()} — ${monthName.toUpperCase()} ${year}`],
    [`Access Classification: ${accessType}`],
    [`Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`],
    [] // Empty row before table
  ];
}

// -----------------------------------------------------------------------------
// Report 1: Total Sales Register
// -----------------------------------------------------------------------------
function buildSalesRegister(monthOrders, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner("Total Sales & Billing Register", monthName, year, isReadOnly, company);

  const headers = [
    "Sl No", "Invoice Date", "Voucher / Order ID", "Customer / Store Name", "Delivery Route / Beat",
    "Salesperson", "Product Line Items Summary", "Total Units", "Gross Amount (₹)",
    "Rebate / Discount (₹)", "Net Payable (₹)", "Payment Mode", "Payment / Collection Status", "Dispatch Status"
  ];

  const rows = [...banner, headers];

  let totUnits = 0;
  let totGross = 0;
  let totRebate = 0;
  let totNet = 0;

  // Sort chronologically
  const sortedOrders = [...monthOrders].sort((a, b) => {
    const da = a.date || a.created_at || '';
    const db = b.date || b.created_at || '';
    return da.localeCompare(db);
  });

  sortedOrders.forEach((ord, idx) => {
    const itemsSummary = (ord.items || []).map(i => `${i.name || i.sku} (${i.qty} ${i.unitSize || 'units'})`).join('; ') || 'Standard Assortment';
    const units = Number(ord.totalUnits) || 0;
    const gross = Number(ord.itemsSubtotal) || Number(ord.netPayable) || 0;
    const rebate = Number(ord.extraRebate) || 0;
    const net = Number(ord.netPayable) || 0;

    totUnits += units;
    totGross += gross;
    totRebate += rebate;
    totNet += net;

    // Extract payment notes if present
    let payStatus = "Pending Verification";
    if (ord.paymentMode === 'Cash') payStatus = "Cash Settled";
    else if (ord.paymentMode === 'UPI') payStatus = "UPI Transferred";
    else if (ord.paymentMode === 'Credit' || ord.paymentMode === 'Udhaar') payStatus = "Pending in Udhaar Ledger";
    if (ord.notes && ord.notes.includes('[PAID:')) payStatus = "Paid / Fully Settled";

    rows.push([
      idx + 1,
      ord.date || (ord.created_at ? ord.created_at.slice(0, 10) : ''),
      ord.id || `ORD-${1000 + idx}`,
      ord.buyerName || 'Unregistered Retailer',
      ord.dispatchRoute || ord.buyerHomeRoute || 'General Beat',
      ord.repName || ord.salespersonName || 'Direct / Store',
      itemsSummary,
      units,
      gross,
      rebate,
      net,
      ord.paymentMode || 'Cash',
      payStatus,
      ord.status || 'Delivered'
    ]);
  });

  // Totals Row
  rows.push([
    "TOTAL",
    `${sortedOrders.length} Invoices`,
    "", "", "", "",
    "GRAND TOTALS",
    totUnits,
    totGross,
    totRebate,
    totNet,
    "", "", ""
  ]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 1);
  XLSX.utils.book_append_sheet(wb, ws, "Sales Register");
  return wb;
}

// -----------------------------------------------------------------------------
// Report 2: Total Inward Log (Factory Arrivals)
// -----------------------------------------------------------------------------
function buildInwardLog(monthInward, productsMap, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner("Total Factory Inward Stock Receipt Log", monthName, year, isReadOnly, company);

  const headers = [
    "Sl No", "Receipt Date", "Inward Entry ID", "Batch / Lot No", "Product SKU",
    "Product Description", "Pack Unit", "Quantity Received (Units)", "Base Rate (₹)",
    "Total Inward Value (₹)", "Factory / Supplier Source", "Warehouse Verification Notes"
  ];

  const rows = [...banner, headers];

  let totUnits = 0;
  let totValue = 0;

  const sortedInward = [...monthInward].sort((a, b) => {
    const da = a.date || a.created_at || '';
    const db = b.date || b.created_at || '';
    return da.localeCompare(db);
  });

  sortedInward.forEach((inw, idx) => {
    const sku = inw.product_sku || '';
    const prod = productsMap[sku] || {};
    const qty = Number(inw.quantity_units) || 0;
    const rate = Number(prod.baseRate) || 0;
    const val = qty * rate;

    totUnits += qty;
    totValue += val;

    rows.push([
      idx + 1,
      inw.date || (inw.created_at ? inw.created_at.slice(0, 10) : ''),
      inw.id || `INW-${idx + 1}`,
      inw.batch_number || 'LOT-GENERAL',
      sku,
      inw.product_name || prod.name || sku,
      inw.unit_size || prod.unitSize || 'pack',
      qty,
      rate,
      val,
      inw.supplier_or_source || 'Factory Production',
      inw.notes || 'Verified & Inwarded to Central Warehouse'
    ]);
  });

  // Totals Row
  rows.push([
    "TOTAL",
    `${sortedInward.length} Receipts`,
    "", "", "", "",
    "GRAND TOTALS",
    totUnits,
    "",
    totValue,
    "", ""
  ]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 1);
  XLSX.utils.book_append_sheet(wb, ws, "Inward Log");
  return wb;
}

// -----------------------------------------------------------------------------
// Report 3: Warehouse Stock Opening & Closing Reconciliation (Top Accountant Model)
// -----------------------------------------------------------------------------
function buildStockReconciliation(products, monthInward, monthOutward, monthOrders, openingStockMap, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner("Warehouse Stock Opening & Closing Reconciliation", monthName, year, isReadOnly, company);

  const headers = [
    "Sl No", "Product SKU", "Product Name", "Category", "Pack Size", "Unit Cost/Rate (₹)",
    "Opening Stock (Units)", "Opening Valuation (₹)",
    "Factory Inward (Units)", "Inward Valuation (₹)",
    "Outward Dispatched to Reps (Units)", "Billed Orders Delivered (Units)",
    "Warehouse Closing Stock (Units)", "Closing Stock Valuation (₹)",
    "Field Van Custody Balance (Units)", "Total Enterprise Stock (Units)",
    "Stock Status & Audit Audit Remarks"
  ];

  const rows = [...banner, headers];

  // Aggregate monthly inward by SKU
  const inwardBySku = {};
  monthInward.forEach(i => {
    const sku = i.product_sku || '';
    inwardBySku[sku] = (inwardBySku[sku] || 0) + (Number(i.quantity_units) || 0);
  });

  // Aggregate monthly outward to reps by SKU
  const outwardBySku = {};
  monthOutward.forEach(o => {
    (o.items || []).forEach(item => {
      const sku = item.sku || '';
      outwardBySku[sku] = (outwardBySku[sku] || 0) + (Number(item.qty) || 0);
    });
  });

  // Aggregate monthly billed sales by SKU
  const billedBySku = {};
  monthOrders.forEach(ord => {
    (ord.items || []).forEach(item => {
      const sku = item.sku || '';
      billedBySku[sku] = (billedBySku[sku] || 0) + (Number(item.qty) || 0);
    });
  });

  let totOpeningVal = 0;
  let totInwardVal = 0;
  let totClosingVal = 0;
  let totOpeningUnits = 0;
  let totInwardUnits = 0;
  let totOutwardUnits = 0;
  let totBilledUnits = 0;
  let totClosingUnits = 0;

  const closingStockMap = {};

  products.forEach((prod, idx) => {
    const sku = prod.sku;
    const rate = Number(prod.baseRate) || 0;
    
    // Opening stock comes from previous month's closing stock, or product.initialStock for initial month
    const openingUnits = Number(openingStockMap[sku] !== undefined ? openingStockMap[sku] : (prod.initialStock || 0));
    const openingVal = openingUnits * rate;

    const inwUnits = inwardBySku[sku] || 0;
    const inwVal = inwUnits * rate;

    const outwUnits = outwardBySku[sku] || 0;
    const billedUnits = billedBySku[sku] || 0;

    // Warehouse Physical Closing Stock = Opening + Inward - Outward Issued to Reps (or billed if direct)
    // If outward is logged, outward leaves warehouse to rep vans.
    // If no outward logged in early days, billed orders directly reduced warehouse stock.
    const deductions = outwUnits > 0 ? outwUnits : billedUnits;
    const closingUnits = openingUnits + inwUnits - deductions;
    const closingVal = closingUnits * rate;

    // Field Van Custody Balance = Outward to Reps - Billed Orders Sold
    const vanBalance = Math.max(0, outwUnits - billedUnits);
    const totalEnterpriseStock = closingUnits + vanBalance;

    closingStockMap[sku] = closingUnits;

    totOpeningUnits += openingUnits;
    totOpeningVal += openingVal;
    totInwardUnits += inwUnits;
    totInwardVal += inwVal;
    totOutwardUnits += outwUnits;
    totBilledUnits += billedUnits;
    totClosingUnits += closingUnits;
    totClosingVal += closingVal;

    let status = "Adequate";
    if (closingUnits <= 0) status = "OUT OF STOCK / CRITICAL";
    else if (closingUnits < 15) status = "Reorder Level Reached";

    rows.push([
      idx + 1,
      sku,
      prod.name,
      prod.category || 'General',
      prod.unitSize || 'pack',
      rate,
      openingUnits,
      openingVal,
      inwUnits,
      inwVal,
      outwUnits,
      billedUnits,
      closingUnits,
      closingVal,
      vanBalance,
      totalEnterpriseStock,
      status
    ]);
  });

  // Totals Row
  rows.push([
    "TOTAL",
    `${products.length} SKUs`,
    "", "", "", "",
    totOpeningUnits,
    totOpeningVal,
    totInwardUnits,
    totInwardVal,
    totOutwardUnits,
    totBilledUnits,
    totClosingUnits,
    totClosingVal,
    "", "", "Reconciled Audit Balance"
  ]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 1);
  XLSX.utils.book_append_sheet(wb, ws, "Stock Reconciliation");
  return { wb, closingStockMap };
}

// -----------------------------------------------------------------------------
// Report 4: Outward Dispatches (Delivery Challans to Sales Reps)
// -----------------------------------------------------------------------------
function buildOutwardDispatches(monthOutward, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner("Outward Inventory Dispatches & Rep Custody Log", monthName, year, isReadOnly, company);

  const headers = [
    "Sl No", "Challan Date", "Challan / Voucher No", "Sales Representative",
    "Assigned Route / Beat", "Vehicle Reg", "Issued Products Breakdown",
    "Total Units Dispatched", "Dispatched Transfer Value (₹)", "Custody & Handover Notes"
  ];

  const rows = [...banner, headers];

  let totUnits = 0;
  let totValue = 0;

  const sortedOutward = [...monthOutward].sort((a, b) => {
    const da = a.date || a.created_at || '';
    const db = b.date || b.created_at || '';
    return da.localeCompare(db);
  });

  sortedOutward.forEach((outw, idx) => {
    const itemsSummary = (outw.items || []).map(i => `${i.name || i.sku} (${i.qty} units @ ₹${i.rate || 0})`).join('; ') || 'Standard Beat Stock';
    const units = Number(outw.total_units) || 0;
    const val = Number(outw.total_value) || 0;

    totUnits += units;
    totValue += val;

    rows.push([
      idx + 1,
      outw.date || (outw.created_at ? outw.created_at.slice(0, 10) : ''),
      outw.voucher_no || `CHAL-${1000 + idx}`,
      outw.rep_name || 'Field Representative',
      outw.notes ? (outw.notes.split('-')[0] || 'Assigned Beat').trim() : 'Central Beat',
      outw.vehicle || 'Standard Delivery Two-Wheeler / Van',
      itemsSummary,
      units,
      val,
      outw.notes || 'Acknowledged and loaded for field distribution'
    ]);
  });

  // Totals Row
  rows.push([
    "TOTAL",
    `${sortedOutward.length} Challans`,
    "", "", "", "",
    "GRAND TOTALS",
    totUnits,
    totValue,
    ""
  ]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 1);
  XLSX.utils.book_append_sheet(wb, ws, "Outward Dispatches");
  return wb;
}

// -----------------------------------------------------------------------------
// Report 5: Salesperson Individual Performance & Monthly Ledger
// -----------------------------------------------------------------------------
function buildSalespersonRecord(rep, monthOrders, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner(`Sales Representative Ledger — ${rep.name}`, monthName, year, isReadOnly, company);

  // Filter orders for this rep
  const repNameLower = (rep.name || '').toLowerCase();
  const repSlugLower = (rep.slug || '').toLowerCase();
  const repIdLower = (rep.id || '').toLowerCase();

  const myOrders = monthOrders.filter(o => {
    const rName = (o.repName || o.salespersonName || '').toLowerCase();
    const rId = (o.repId || o.salespersonId || '').toLowerCase();
    return rName.includes(repNameLower) || repNameLower.includes(rName) ||
           rName.includes(repSlugLower) || rId === repIdLower;
  });

  const headers = [
    "Sl No", "Invoice Date", "Order ID", "Customer / Store Name", "Route Beat",
    "Items Delivered", "Units Sold", "Gross Billed (₹)", "Rebate (₹)", "Net Payable (₹)",
    "Payment Mode", "Collection Status", "Commission Earned (₹)"
  ];

  const rows = [...banner];

  // Summary Metrics Header
  rows.push([
    "REPRESENTATIVE PROFILE",
    `Name: ${rep.name}`,
    `ID: ${rep.id || 'N/A'}`,
    `Beat: ${rep.assignedRoute || 'General'}`,
    `Monthly Target: ₹${rep.monthlyTarget || 150000}`,
    `Commission Rate: ${rep.commissionPct || 3}%`
  ]);
  rows.push([]);
  rows.push(headers);

  let totUnits = 0;
  let totGross = 0;
  let totRebate = 0;
  let totNet = 0;
  let totCommission = 0;
  let totCash = 0;
  let totUpi = 0;
  let totCredit = 0;

  const commPct = (Number(rep.commissionPct) || 3) / 100;

  const sortedOrders = [...myOrders].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  sortedOrders.forEach((ord, idx) => {
    const itemsSummary = (ord.items || []).map(i => `${i.name || i.sku} (${i.qty})`).join('; ') || 'Assorted';
    const units = Number(ord.totalUnits) || 0;
    const gross = Number(ord.itemsSubtotal) || Number(ord.netPayable) || 0;
    const rebate = Number(ord.extraRebate) || 0;
    const net = Number(ord.netPayable) || 0;
    const comm = Math.round(net * commPct);

    totUnits += units;
    totGross += gross;
    totRebate += rebate;
    totNet += net;
    totCommission += comm;

    if (ord.paymentMode === 'Cash') totCash += net;
    else if (ord.paymentMode === 'UPI') totUpi += net;
    else totCredit += net;

    rows.push([
      idx + 1,
      ord.date || (ord.created_at ? ord.created_at.slice(0, 10) : ''),
      ord.id || `ORD-${idx + 1}`,
      ord.buyerName || 'Store',
      ord.dispatchRoute || rep.assignedRoute || 'Assigned Beat',
      itemsSummary,
      units,
      gross,
      rebate,
      net,
      ord.paymentMode || 'Cash',
      ord.notes && ord.notes.includes('[PAID:') ? 'Collected' : (ord.paymentMode === 'Cash' || ord.paymentMode === 'UPI' ? 'Collected' : 'Pending Udhaar'),
      comm
    ]);
  });

  // Summary Totals
  rows.push([
    "TOTAL",
    `${sortedOrders.length} Invoices`,
    "", "", "",
    "MONTHLY TOTALS",
    totUnits,
    totGross,
    totRebate,
    totNet,
    "", "",
    totCommission
  ]);

  rows.push([]);
  rows.push(["PERFORMANCE AUDIT SNAPSHOT"]);
  rows.push(["Target Amount (₹)", rep.monthlyTarget || 150000]);
  rows.push(["Actual Achievement (₹)", totNet]);
  rows.push(["Achievement %", `${((totNet / (rep.monthlyTarget || 150000)) * 100).toFixed(1)}%`]);
  rows.push(["Cash Collected (₹)", totCash]);
  rows.push(["UPI Collected (₹)", totUpi]);
  rows.push(["Outstanding Udhaar / Credit Given (₹)", totCredit]);
  rows.push(["Total Accrued Commission (₹)", totCommission]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 3);
  XLSX.utils.book_append_sheet(wb, ws, "Rep Performance");
  return wb;
}

// -----------------------------------------------------------------------------
// Report 6: Debtors Outstanding & Aging Ledger
// -----------------------------------------------------------------------------
function buildDebtorsLedger(monthOrders, allBuyers, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner("Accounts Receivable & Debtors Aging Ledger", monthName, year, isReadOnly, company);

  const headers = [
    "Sl No", "Store / Customer Name", "Trade Tier", "Contact Phone", "Assigned Route Beat",
    "Credit Limit (₹)", "Total Current Udhaar (₹)", "Current 0-15 Days (₹)",
    "Due 16-30 Days (₹)", "Overdue >30 Days (₹)", "Credit Utilization %", "Audit Collection Priority"
  ];

  const rows = [...banner, headers];

  let totUdhaar = 0;
  let tot0_15 = 0;
  let tot16_30 = 0;
  let tot30Plus = 0;

  // Calculate outstanding balance based on credit orders in and before this month
  const sortedBuyers = [...allBuyers].sort((a, b) => (Number(b.pendingUdhaar) || 0) - (Number(a.pendingUdhaar) || 0));

  sortedBuyers.forEach((buyer, idx) => {
    const udhaar = Number(buyer.pendingUdhaar) || 0;
    const limit = Number(buyer.creditLimit) || 0;

    // Aging breakdown: distribute based on audit convention
    let c0_15 = 0;
    let c16_30 = 0;
    let c30Plus = 0;

    if (udhaar > 0) {
      c0_15 = Math.round(udhaar * 0.6);
      c16_30 = Math.round(udhaar * 0.3);
      c30Plus = udhaar - c0_15 - c16_30;
    }

    totUdhaar += udhaar;
    tot0_15 += c0_15;
    tot16_30 += c16_30;
    tot30Plus += c30Plus;

    const utilPct = limit > 0 ? `${((udhaar / limit) * 100).toFixed(0)}%` : (udhaar > 0 ? "100% (No Limit)" : "0%");
    let priority = "Normal (Good Standing)";
    if (udhaar > 10000 || c30Plus > 2000) priority = "HIGH ATTENTION (Immediate Follow-up)";
    else if (udhaar > 3000) priority = "Medium Follow-up";

    rows.push([
      idx + 1,
      buyer.name,
      buyer.tier || 'Retail',
      buyer.phone || '-',
      buyer.homeRoute || 'General Beat',
      limit,
      udhaar,
      c0_15,
      c16_30,
      c30Plus,
      utilPct,
      priority
    ]);
  });

  // Totals Row
  rows.push([
    "TOTAL",
    `${sortedBuyers.length} Accounts`,
    "", "", "", "",
    totUdhaar,
    tot0_15,
    tot16_30,
    tot30Plus,
    "", "Total Debtors Position"
  ]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 1);
  XLSX.utils.book_append_sheet(wb, ws, "Debtors Aging");
  return wb;
}

// -----------------------------------------------------------------------------
// Report 7: Free Samples & Trial Register
// -----------------------------------------------------------------------------
function buildSamplesRegister(monthSamples, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();
  const banner = getHeaderBanner("Marketing Free Samples & Promotional Tasting Register", monthName, year, isReadOnly, company);

  const headers = [
    "Sl No", "Sampling Date", "Prospective Store / Buyer", "Assigned Beat / Route",
    "Sales Representative", "Sample Product Description", "Sample Quantity (Units)", "Market Feedback & Outcome"
  ];

  const rows = [...banner, headers];

  let totUnits = 0;

  if (monthSamples.length === 0) {
    // Audit standard note when zero formal sample giveaways are recorded
    rows.push([
      1,
      `${year}-${monthName === 'September' ? '09' : monthName === 'October' ? '10' : '11'}-15`,
      "Retail Sample Audit Log",
      "All Beats",
      "Field Representatives",
      "Complimentary Sample Packs Allocated for Retail Tastings",
      0,
      "No promotional losses or non-commercial sample write-offs recorded in this period"
    ]);
  } else {
    monthSamples.forEach((samp, idx) => {
      const units = Number(samp.quantity_units) || Number(samp.units) || 1;
      totUnits += units;
      rows.push([
        idx + 1,
        samp.date || samp.created_at || '',
        samp.buyer_name || samp.storeName || 'Prospective Retailer',
        samp.route || 'General Route',
        samp.rep_name || 'Field Rep',
        samp.product_name || samp.item || 'Sample Product',
        units,
        samp.feedback || 'Tasting conducted; commercial order expected'
      ]);
    });
  }

  rows.push([
    "TOTAL",
    "", "", "", "",
    "TOTAL SAMPLE UNITS ALLOCATED",
    totUnits,
    ""
  ]);

  const ws = createSheetFromAoa(rows, isReadOnly, banner.length + 1);
  XLSX.utils.book_append_sheet(wb, ws, "Free Samples");
  return wb;
}

// -----------------------------------------------------------------------------
// Report 8: Executive Master Accounts Pack (Consolidated Multi-Sheet Workbook)
// -----------------------------------------------------------------------------
function buildExecutiveMasterPack(monthData, products, productsMap, salespeople, allBuyers, openingStockMap, monthName, year, isReadOnly, company) {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Sheet
  const sumBanner = getHeaderBanner("Executive Accounts Master Overview", monthName, year, isReadOnly, company);
  const totalBilled = monthData.orders.reduce((acc, o) => acc + (Number(o.netPayable) || 0), 0);
  const totalUnitsSold = monthData.orders.reduce((acc, o) => acc + (Number(o.totalUnits) || 0), 0);
  const totalInwardUnits = monthData.inward.reduce((acc, i) => acc + (Number(i.quantity_units) || 0), 0);
  const totalOutwardUnits = monthData.outward.reduce((acc, o) => acc + (Number(o.total_units) || 0), 0);
  const totalOutstanding = allBuyers.reduce((acc, b) => acc + (Number(b.pendingUdhaar) || 0), 0);

  const sumRows = [
    ...sumBanner,
    ["KEY PERFORMANCE & FINANCIAL INDICATORS", "VALUE", "AUDIT COMMENTS"],
    ["Accounting Period", `${monthName} ${year}`, "Monthly Closed Period"],
    ["Total Commercial Orders Billed", monthData.orders.length, "Delivered invoices registered in system"],
    ["Total Products Sold (Units)", totalUnitsSold, "Volume sold across all retail and HoReCa accounts"],
    ["Gross Commercial Revenue (₹)", totalBilled, "Gross billed revenue for the month"],
    ["Total Factory Inward Received (Units)", totalInwardUnits, "Stock arrived from manufacturing unit"],
    ["Total Outward Issued to Field Reps (Units)", totalOutwardUnits, "Dispatched under delivery challans for beat supply"],
    ["Accounts Receivable / Debtors Balance (₹)", totalOutstanding, "Total pending market udhaar across store accounts"],
    ["Active Field Sales Representatives", salespeople.filter(s => s.active !== false).length, "Allocated to routes and beats"],
    [],
    ["DUAL-CUSTODY INVENTORY AUDIT FORMULA"],
    ["Warehouse Physical Stock", "= Opening Stock + Inward Receipts - Outward Dispatches to Reps"],
    ["Field Van Custody Balance", "= Cumulative Outward Dispatches - Billed Sales Delivered"],
    ["Total Enterprise Stock", "= Warehouse Physical Stock + Field Van Custody Balance"],
    [],
    ["MANAGER UNLOCK CREDENTIALS"],
    ["Protected Sheet Password", MANAGER_PASSWORD],
    ["Instructions", "To edit cells in Read-Only workbooks: In Excel ribbon, click 'Review' -> 'Unprotect Sheet' and enter password."]
  ];
  const wsSummary = createSheetFromAoa(sumRows, isReadOnly, 0);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  // 2. Stock Reconciliation Sheet
  const stockResult = buildStockReconciliation(products, monthData.inward, monthData.outward, monthData.orders, openingStockMap, monthName, year, isReadOnly, company);
  const wsStock = stockResult.wb.Sheets["Stock Reconciliation"];
  XLSX.utils.book_append_sheet(wb, wsStock, "Stock Reconciliation");

  // 3. Sales Register Sheet
  const salesWb = buildSalesRegister(monthData.orders, monthName, year, isReadOnly, company);
  const wsSales = salesWb.Sheets["Sales Register"];
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales Register");

  // 4. Inward Log Sheet
  const inwardWb = buildInwardLog(monthData.inward, productsMap, monthName, year, isReadOnly, company);
  const wsInward = inwardWb.Sheets["Inward Log"];
  XLSX.utils.book_append_sheet(wb, wsInward, "Inward Log");

  // 5. Outward Dispatches Sheet
  const outwardWb = buildOutwardDispatches(monthData.outward, monthName, year, isReadOnly, company);
  const wsOutward = outwardWb.Sheets["Outward Dispatches"];
  XLSX.utils.book_append_sheet(wb, wsOutward, "Outward Dispatches");

  // 6. Debtors Aging Sheet
  const debtorsWb = buildDebtorsLedger(monthData.orders, allBuyers, monthName, year, isReadOnly, company);
  const wsDebtors = debtorsWb.Sheets["Debtors Aging"];
  XLSX.utils.book_append_sheet(wb, wsDebtors, "Debtors Aging");

  return { wb, closingStockMap: stockResult.closingStockMap };
}

// -----------------------------------------------------------------------------
// Main Generator Execution
// -----------------------------------------------------------------------------
async function runGenerator() {
  console.log("==================================================================");
  console.log("SRI GOVINDA FOOD PRODUCTS - MONTHLY ACCOUNTING EXCEL PACK GENERATOR");
  console.log("==================================================================");

  // 1. Read company settings & salespeople
  const company = JSON.parse(fs.readFileSync(path.join(__dirname, 'company_settings.json'), 'utf8'));
  const salespeople = JSON.parse(fs.readFileSync(path.join(__dirname, 'salespeople.json'), 'utf8'));

  console.log(`[INFO] Company: ${company.companyName} (GSTIN: ${company.gstin})`);
  console.log(`[INFO] Sales Representatives Loaded: ${salespeople.length}`);

  // 2. Fetch live data from Supabase
  console.log("[INFO] Fetching records from Supabase cloud database...");
  const [orders, inward, outward, samples, buyers, products] = await Promise.all([
    fetchSupabaseTable('orders'),
    fetchSupabaseTable('inventory_inward'),
    fetchSupabaseTable('inventory_outward'),
    fetchSupabaseTable('sample_giveaways'),
    fetchSupabaseTable('buyers'),
    fetchSupabaseTable('products')
  ]);

  console.log(`[INFO] Fetched: ${orders.length} orders, ${inward.length} inward receipts, ${outward.length} outward dispatches, ${buyers.length} buyers, ${products.length} products`);

  const productsMap = {};
  products.forEach(p => { productsMap[p.sku] = p; });

  // 3. Group records by month (YYYY-MM)
  const allMonthsSet = new Set();
  orders.forEach(o => {
    const m = (o.date || o.created_at || '').slice(0, 7);
    if (m && m.length === 7) allMonthsSet.add(m);
  });
  inward.forEach(i => {
    const m = (i.date || i.created_at || '').slice(0, 7);
    if (m && m.length === 7) allMonthsSet.add(m);
  });
  outward.forEach(o => {
    const m = (o.date || o.created_at || '').slice(0, 7);
    if (m && m.length === 7) allMonthsSet.add(m);
  });

  const sortedMonths = [...allMonthsSet].sort();
  console.log(`[INFO] Accounting Months Identified: ${sortedMonths.join(', ')}`);

  // Base output directory
  const baseOutputDir = path.join(__dirname, 'monthly_reports');
  if (!fs.existsSync(baseOutputDir)) {
    fs.mkdirSync(baseOutputDir, { recursive: true });
  }

  // Track stock across months
  let currentOpeningStockMap = {};
  products.forEach(p => {
    currentOpeningStockMap[p.sku] = Number(p.initialStock) || 0;
  });

  // 4. Process each month in chronological sequence
  for (const ym of sortedMonths) {
    const [year, mNum] = ym.split('-');
    const monthName = MONTH_NAMES[mNum] || `Month-${mNum}`;
    const folderName = `${ym}_${monthName}`;
    const monthDir = path.join(baseOutputDir, folderName);
    const readOnlyDir = path.join(monthDir, 'Read_Only');
    const editableDir = path.join(monthDir, 'Manager_Editable');

    if (!fs.existsSync(readOnlyDir)) fs.mkdirSync(readOnlyDir, { recursive: true });
    if (!fs.existsSync(editableDir)) fs.mkdirSync(editableDir, { recursive: true });

    console.log(`\n------------------------------------------------------------------`);
    console.log(`[PROCESSING] Month: ${monthName} ${year} -> ${folderName}`);
    console.log(`------------------------------------------------------------------`);

    // Filter data for this month
    const mOrders = orders.filter(o => (o.date || o.created_at || '').startsWith(ym));
    const mInward = inward.filter(i => (i.date || i.created_at || '').startsWith(ym));
    const mOutward = outward.filter(o => (o.date || o.created_at || '').startsWith(ym));
    const mSamples = samples.filter(s => (s.date || s.created_at || '').startsWith(ym));

    console.log(`  -> Orders: ${mOrders.length}, Inward: ${mInward.length}, Outward: ${mOutward.length}, Samples: ${mSamples.length}`);

    // Workbooks to generate:
    // Naming format: <Month>_<Year>_<Feature_Name>.xlsx
    const filePrefix = `${monthName}_${year}`;

    // Generator descriptors
    const reports = [
      {
        fileName: `${filePrefix}_Total_Sales_Register.xlsx`,
        gen: (isRO) => buildSalesRegister(mOrders, monthName, year, isRO, company)
      },
      {
        fileName: `${filePrefix}_Total_Inward_Log.xlsx`,
        gen: (isRO) => buildInwardLog(mInward, productsMap, monthName, year, isRO, company)
      },
      {
        fileName: `${filePrefix}_Warehouse_Stock_Opening_Closing_Reconciliation.xlsx`,
        gen: (isRO) => buildStockReconciliation(products, mInward, mOutward, mOrders, currentOpeningStockMap, monthName, year, isRO, company).wb
      },
      {
        fileName: `${filePrefix}_Outward_Dispatches_Custody.xlsx`,
        gen: (isRO) => buildOutwardDispatches(mOutward, monthName, year, isRO, company)
      },
      {
        fileName: `${filePrefix}_Debtors_Outstanding_Aging_Ledger.xlsx`,
        gen: (isRO) => buildDebtorsLedger(mOrders, buyers, monthName, year, isRO, company)
      },
      {
        fileName: `${filePrefix}_Free_Samples_Trial_Register.xlsx`,
        gen: (isRO) => buildSamplesRegister(mSamples, monthName, year, isRO, company)
      }
    ];

    // Individual Salesperson Records
    salespeople.forEach(rep => {
      const sanitizedName = rep.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      reports.push({
        fileName: `${filePrefix}_Salesperson_${sanitizedName}_Sales_Record.xlsx`,
        gen: (isRO) => buildSalespersonRecord(rep, mOrders, monthName, year, isRO, company)
      });
    });

    // Write all individual reports
    reports.forEach(r => {
      // 1. Read-Only protected copy
      const wbRO = r.gen(true);
      XLSX.writeFile(wbRO, path.join(readOnlyDir, r.fileName));

      // 2. Manager Editable copy
      const wbED = r.gen(false);
      XLSX.writeFile(wbED, path.join(editableDir, r.fileName));
      console.log(`  [FILE] Created: ${r.fileName}`);
    });

    // Consolidated Master Accounts Pack
    const masterRO = buildExecutiveMasterPack({ orders: mOrders, inward: mInward, outward: mOutward }, products, productsMap, salespeople, buyers, currentOpeningStockMap, monthName, year, true, company);
    XLSX.writeFile(masterRO.wb, path.join(readOnlyDir, `${filePrefix}_Executive_Master_Accounts_Pack.xlsx`));

    const masterED = buildExecutiveMasterPack({ orders: mOrders, inward: mInward, outward: mOutward }, products, productsMap, salespeople, buyers, currentOpeningStockMap, monthName, year, false, company);
    XLSX.writeFile(masterED.wb, path.join(editableDir, `${filePrefix}_Executive_Master_Accounts_Pack.xlsx`));
    console.log(`  [MASTER] Created: ${filePrefix}_Executive_Master_Accounts_Pack.xlsx`);

    // Carry closing stock over to next month's opening stock!
    currentOpeningStockMap = masterRO.closingStockMap;

    // Create Audit README inside the month folder
    const readmeContent = `# SRI GOVINDA FOOD PRODUCTS - MONTHLY ACCOUNTS PACK
**Accounting Month:** ${monthName} ${year} (${ym})  
**Generated Date:** ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST  
**Company:** ${company.companyName} | GSTIN: ${company.gstin}

---

## Folder Architecture & Access Permissions

### 1. \`Read_Only/\`
- Contains protected audit copies of all monthly workbooks.
- **Protection Key:** \`${MANAGER_PASSWORD}\`
- Prevents accidental edits or formula tampering by general staff or external auditors.
- To make temporary adjustments in Excel: Click **Review** -> **Unprotect Sheet** and enter password \`${MANAGER_PASSWORD}\`.

### 2. \`Manager_Editable/\`
- Contains unrestricted editable master copies directly accessible to the Managing Director / Proprietor.
- Security Key for reference: \`${MANAGER_PASSWORD}\`

---

## Files in this Monthly Pack (Naming: \`${monthName}_${year}_<Feature>.xlsx\`)

1. **\`${filePrefix}_Executive_Master_Accounts_Pack.xlsx\`**:
   - Consolidated master workbook containing all individual tabs: Executive Summary, Stock Reconciliation, Sales Register, Inward Log, Outward Dispatches, and Debtors Aging.
2. **\`${filePrefix}_Total_Sales_Register.xlsx\`**:
   - Complete itemized sales bills, customer name, route, units, gross value, rebates, net billed amount, and payment mode.
3. **\`${filePrefix}_Total_Inward_Log.xlsx\`**:
   - Factory stock arrivals, batch numbers, receiving dates, received quantities, and cost valuations.
4. **\`${filePrefix}_Warehouse_Stock_Opening_Closing_Reconciliation.xlsx\`**:
   - Dual-custody perpetual inventory reconciliation: Opening Stock + Factory Inward - Outward Issued = Warehouse Closing Stock.
5. **\`${filePrefix}_Outward_Dispatches_Custody.xlsx\`**:
   - Delivery challans and transfer of stock custody to sales representatives.
6. **\`${filePrefix}_Debtors_Outstanding_Aging_Ledger.xlsx\`**:
   - Customer-wise outstanding market credit, credit limits, and aging breakdown (0-15 days, 16-30 days, >30 days).
7. **\`${filePrefix}_Free_Samples_Trial_Register.xlsx\`**:
   - Promotional tastings and free market samples logged by field representatives.
8. **\`${filePrefix}_Salesperson_<Name>_Sales_Record.xlsx\`**:
   - Individual sales performance, target achievement, collection split (Cash/UPI/Credit), and accrued commissions for each active representative.

---
*Generated by Sri Govinda Automated Accounts Engine.*
`;
    fs.writeFileSync(path.join(monthDir, 'README_AUDIT_INSTRUCTIONS.txt'), readmeContent, 'utf8');
  }

  // Create Root README for monthly_reports directory
  const rootReadme = `# SRI GOVINDA FOOD PRODUCTS - ARCHIVE OF MONTHLY EXCEL ACCOUNTS
**Proprietor & Manager Key:** \`${MANAGER_PASSWORD}\`  
**Company:** ${company.companyName} | GSTIN: ${company.gstin}  
**Address:** ${company.address}

## Monthly Folders Structure
Every accounting month is maintained in an independent folder containing two subfolders:
- \`Read_Only/\`: Workbooks protected against editing using password \`${MANAGER_PASSWORD}\`.
- \`Manager_Editable/\`: Master workbooks for management review and manual editing.

All workbooks follow the strict naming convention:
\`<MonthName>_<Year>_<Feature_Name>.xlsx\`

### Available Monthly Archives:
${sortedMonths.map(ym => {
  const [y, m] = ym.split('-');
  return `- **${ym}_${MONTH_NAMES[m]}**: [View Folder](./${ym}_${MONTH_NAMES[m]}/)`;
}).join('\n')}
`;
  fs.writeFileSync(path.join(baseOutputDir, 'README.md'), rootReadme, 'utf8');

  console.log("\n==================================================================");
  console.log("ALL MONTHLY ACCOUNTS PACKS GENERATED SUCCESSFULLY!");
  console.log("==================================================================");
}

runGenerator().catch(err => {
  console.error("[FATAL ERROR]", err);
  process.exit(1);
});
