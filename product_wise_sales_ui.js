// ==============================================================================
// SRI GOVINDA FOOD PRODUCTS - PRODUCT-WISE SALES RECORD (DATE-TO-DATE AUDIT)
// ==============================================================================
// Provides interactive date-range aggregation, SKU volume & turnover analytics,
// order penetration statistics, itemized bill drilldown, and audit-grade Excel export.
// ==============================================================================

let currentProductSalesPreset = 'this_month';

// Initialize default date range on boot or view switch
function initProductSalesDates() {
  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  if (!fromInput || !toInput) return;

  if (!fromInput.value || !toInput.value) {
    setProductSalesDatePreset('this_month');
  }
}

// Quick Preset Handlers
function setProductSalesDatePreset(preset) {
  currentProductSalesPreset = preset;
  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  if (!fromInput || !toInput) return;

  const today = new Date();
  const formatYMD = (d) => d.toISOString().slice(0, 10);

  // Update preset button active styling
  ['today', 'yesterday', 'last7', 'this_month', 'last_month', 'all'].forEach(p => {
    const btn = document.getElementById(`ps-btn-${p}`);
    if (btn) {
      if (p === preset) {
        btn.className = "px-2.5 py-1 rounded-lg text-xs font-bold transition bg-white text-indigo-700 shadow-2xs cursor-pointer";
      } else {
        btn.className = "px-2.5 py-1 rounded-lg text-xs font-bold transition text-slate-600 hover:text-slate-900 cursor-pointer";
      }
    }
  });

  if (preset === 'today') {
    const s = formatYMD(today);
    fromInput.value = s;
    toInput.value = s;
  } else if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = formatYMD(y);
    fromInput.value = s;
    toInput.value = s;
  } else if (preset === 'last7') {
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 6);
    fromInput.value = formatYMD(d7);
    toInput.value = formatYMD(today);
  } else if (preset === 'this_month') {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    fromInput.value = `${y}-${m}-01`;
    toInput.value = formatYMD(today);
  } else if (preset === 'last_month') {
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    fromInput.value = formatYMD(prevMonthStart);
    toInput.value = formatYMD(prevMonthEnd);
  } else if (preset === 'all') {
    fromInput.value = "2025-01-01";
    toInput.value = formatYMD(today);
  }

  onProductSalesFilterChanged();
}

function onProductSalesFilterChanged() {
  renderProductWiseSalesView();
}

// Populate secondary dropdowns (Rep, Route, Category)
function populateProductSalesDropdowns() {
  const repSelect = document.getElementById('ps-filter-rep');
  if (repSelect && repSelect.children.length <= 1) {
    const currentVal = repSelect.value;
    const reps = typeof salespeople !== 'undefined' && Array.isArray(salespeople) ? salespeople : [];
    const opts = ['<option value="all">All Sales Personnel</option>'];
    reps.forEach(r => {
      opts.push(`<option value="${r.name}">${r.name} (${r.assignedRoute || 'Beat'})</option>`);
    });
    repSelect.innerHTML = opts.join('');
    if (currentVal) repSelect.value = currentVal;
  }

  const routeSelect = document.getElementById('ps-filter-route');
  if (routeSelect && routeSelect.children.length <= 1) {
    const currentVal = routeSelect.value;
    const routesList = typeof routes !== 'undefined' && Array.isArray(routes) ? routes : [];
    const opts = ['<option value="all">All Route Beats</option>'];
    routesList.forEach(rt => {
      opts.push(`<option value="${rt.name}">${rt.name}</option>`);
    });
    routeSelect.innerHTML = opts.join('');
    if (currentVal) routeSelect.value = currentVal;
  }

  const catSelect = document.getElementById('ps-filter-category');
  if (catSelect && catSelect.children.length <= 1) {
    const currentVal = catSelect.value;
    const prods = typeof products !== 'undefined' && Array.isArray(products) ? products : [];
    const cats = Array.from(new Set(prods.map(p => p.category || 'General').filter(Boolean))).sort();
    const opts = ['<option value="all">All Product Categories</option>'];
    cats.forEach(c => {
      opts.push(`<option value="${c}">${c}</option>`);
    });
    catSelect.innerHTML = opts.join('');
    if (currentVal) catSelect.value = currentVal;
  }
}

// Main Table & Analytics Renderer
function renderProductWiseSalesView() {
  initProductSalesDates();
  populateProductSalesDropdowns();

  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  const fromDate = fromInput ? fromInput.value : '';
  const toDate = toInput ? toInput.value : '';

  const searchInput = document.getElementById('ps-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const catFilter = document.getElementById('ps-filter-category') ? document.getElementById('ps-filter-category').value : 'all';
  const repFilter = document.getElementById('ps-filter-rep') ? document.getElementById('ps-filter-rep').value : 'all';
  const routeFilter = document.getElementById('ps-filter-route') ? document.getElementById('ps-filter-route').value : 'all';

  // Update Period Label
  const periodLabel = document.getElementById('ps-period-label');
  if (periodLabel) {
    periodLabel.innerText = `${fromDate || 'Beginning'} → ${toDate || 'Today'}`;
  }

  const allOrders = typeof orders !== 'undefined' && Array.isArray(orders) ? orders : [];
  const allProds = typeof products !== 'undefined' && Array.isArray(products) ? products : [];
  const prodMap = {};
  allProds.forEach(p => { prodMap[p.sku] = p; });

  // 1. Filter Orders within Date Range & Dimensions
  const filteredOrders = allOrders.filter(o => {
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

  // 2. Aggregate Sales Line Items by Product SKU
  const productAgg = {};
  let grandTotalUnits = 0;
  let grandTotalValue = 0;

  filteredOrders.forEach(o => {
    (o.items || []).forEach(it => {
      const sku = it.sku || 'GENERAL';
      const masterProd = prodMap[sku] || {};
      const category = masterProd.category || 'General';

      if (catFilter && catFilter !== 'all' && category.toLowerCase() !== catFilter.toLowerCase()) {
        return;
      }

      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || Number(masterProd.baseRate) || 0;
      const total = Number(it.total) || (qty * rate);

      if (!productAgg[sku]) {
        productAgg[sku] = {
          sku: sku,
          name: it.name || masterProd.name || sku,
          category: category,
          unitSize: it.unitSize || masterProd.unitSize || 'pack',
          baseRate: rate,
          totalQty: 0,
          totalVal: 0,
          ordersCount: 0,
          ordersList: []
        };
      }
      productAgg[sku].totalQty += qty;
      productAgg[sku].totalVal += total;
      productAgg[sku].ordersCount += 1;
      productAgg[sku].ordersList.push({
        date: o.date || (o.created_at ? o.created_at.slice(0, 10) : ''),
        orderId: o.id || '',
        buyerName: o.buyerName || 'Store',
        route: o.dispatchRoute || '',
        rep: o.repName || o.salespersonName || 'Direct',
        qty: qty,
        rate: rate,
        total: total,
        paymentMode: o.paymentMode || 'Cash'
      });

      grandTotalUnits += qty;
      grandTotalValue += total;
    });
  });

  let productList = Object.values(productAgg);

  // Apply Search filter
  if (query) {
    productList = productList.filter(p =>
      p.sku.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  }

  // Sort by highest revenue first
  productList.sort((a, b) => b.totalVal - a.totalVal);

  // 3. Update KPI Cards
  const kpiUnits = document.getElementById('ps-kpi-total-units');
  if (kpiUnits) kpiUnits.innerText = grandTotalUnits.toLocaleString('en-IN');

  const kpiRev = document.getElementById('ps-kpi-total-revenue');
  if (kpiRev) kpiRev.innerText = '₹' + grandTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const kpiOrd = document.getElementById('ps-kpi-orders-count');
  if (kpiOrd) kpiOrd.innerText = filteredOrders.length;

  // Identify top volume & top revenue products
  const topVolumeProd = [...productList].sort((a, b) => b.totalQty - a.totalQty)[0];
  const topRevenueProd = productList[0];

  const topVolName = document.getElementById('ps-kpi-top-volume-name');
  const topVolUnits = document.getElementById('ps-kpi-top-volume-units');
  if (topVolName && topVolUnits) {
    if (topVolumeProd) {
      topVolName.innerText = topVolumeProd.name;
      topVolUnits.innerText = `${topVolumeProd.totalQty.toLocaleString('en-IN')} units (${topVolumeProd.sku})`;
    } else {
      topVolName.innerText = "No sales in range";
      topVolUnits.innerText = "0 units";
    }
  }

  const topRevName = document.getElementById('ps-kpi-top-revenue-name');
  const topRevAmt = document.getElementById('ps-kpi-top-revenue-amount');
  if (topRevName && topRevAmt) {
    if (topRevenueProd) {
      topRevName.innerText = topRevenueProd.name;
      topRevAmt.innerText = `₹${topRevenueProd.totalVal.toLocaleString('en-IN')} (${topRevenueProd.sku})`;
    } else {
      topRevName.innerText = "No sales in range";
      topRevAmt.innerText = "₹0";
    }
  }

  const tableBadge = document.getElementById('ps-table-badge');
  if (tableBadge) tableBadge.innerText = `${productList.length} products sold`;

  // 4. Render Table Body
  const tbody = document.getElementById('ps-table-tbody');
  if (!tbody) return;

  if (productList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="py-12 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center gap-2">
            <i data-lucide="package-search" class="w-8 h-8 text-slate-300"></i>
            <span class="font-bold text-sm">No product sales found for this date range and filter criteria.</span>
            <span class="text-xs text-slate-400">Try adjusting the From/To dates or selecting 'All Time'.</span>
          </div>
        </td>
      </tr>
    `;
    const tfoot = document.getElementById('ps-table-tfoot');
    if (tfoot) tfoot.innerHTML = '';
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = productList.map((p, idx) => {
    const avgRate = p.totalQty > 0 ? (p.totalVal / p.totalQty).toFixed(2) : p.baseRate;
    const volPct = grandTotalUnits > 0 ? ((p.totalQty / grandTotalUnits) * 100).toFixed(1) : '0';
    const revPct = grandTotalValue > 0 ? ((p.totalVal / grandTotalValue) * 100).toFixed(1) : '0';

    return `
      <tr class="hover:bg-slate-50/80 transition group">
        <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3">
          <div class="font-bold text-slate-900 flex items-center gap-1.5">
            <span>${p.name}</span>
            <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">${p.sku}</span>
          </div>
          <div class="text-[10px] text-slate-400 font-medium">${p.unitSize}</div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">${p.category}</span>
        </td>
        <td class="p-3 text-right font-mono text-slate-600 font-semibold">₹${Number(p.baseRate).toLocaleString('en-IN')}</td>
        <td class="p-3 text-right font-mono font-black text-slate-900 text-sm">
          ${p.totalQty.toLocaleString('en-IN')}
        </td>
        <td class="p-3 text-right font-mono font-black text-emerald-600 text-sm">
          ₹${p.totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </td>
        <td class="p-3 text-right font-mono text-slate-600 text-[11px]">₹${avgRate}</td>
        <td class="p-3 text-center font-bold text-slate-700">
          <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono text-[11px]">${p.ordersCount}</span>
        </td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${volPct}%"></div>
            </div>
            <span class="text-[10px] font-bold text-slate-600 w-9 text-right">${volPct}%</span>
          </div>
        </td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${revPct}%"></div>
            </div>
            <span class="text-[10px] font-bold text-slate-600 w-9 text-right">${revPct}%</span>
          </div>
        </td>
        <td class="p-3 text-center">
          <button type="button" onclick="openProductBillsDrilldown('${p.sku}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-[10px] transition cursor-pointer border border-indigo-200 flex items-center gap-1 mx-auto">
            <i data-lucide="eye" class="w-3 h-3"></i> Bills (${p.ordersCount})
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // 5. Render Table Footer (Grand Totals)
  const tfoot = document.getElementById('ps-table-tfoot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td class="p-3 text-center">Σ</td>
        <td class="p-3">GRAND TOTAL (${productList.length} SKUs)</td>
        <td class="p-3"></td>
        <td class="p-3 text-right">-</td>
        <td class="p-3 text-right font-mono font-black text-slate-900 text-sm">${grandTotalUnits.toLocaleString('en-IN')} units</td>
        <td class="p-3 text-right font-mono font-black text-emerald-600 text-sm">₹${grandTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
        <td class="p-3 text-right">-</td>
        <td class="p-3 text-center font-mono">${filteredOrders.length} bills</td>
        <td class="p-3 text-right text-[10px] font-bold text-slate-600">100.0%</td>
        <td class="p-3 text-right text-[10px] font-bold text-slate-600">100.0%</td>
        <td class="p-3"></td>
      </tr>
    `;
  }

  // Store active product list for drilldown
  window.currentProductWiseAggMap = productAgg;

  if (window.lucide) lucide.createIcons();
}

// Itemized Bills Drilldown Modal
function openProductBillsDrilldown(sku) {
  const productAgg = window.currentProductWiseAggMap || {};
  const item = productAgg[sku];
  if (!item) {
    alert("No itemized bills found for this product.");
    return;
  }

  const titleElem = document.getElementById('ps-drilldown-title');
  const subElem = document.getElementById('ps-drilldown-subtitle');
  const sumElem = document.getElementById('ps-drilldown-summary');
  const tbody = document.getElementById('ps-drilldown-tbody');

  if (titleElem) titleElem.innerText = `${item.name} (${item.sku})`;
  if (subElem) subElem.innerText = `Pack: ${item.unitSize} • Base MRP: ₹${item.baseRate} • Category: ${item.category}`;
  if (sumElem) sumElem.innerText = `Total Sold: ${item.totalQty.toLocaleString('en-IN')} units across ${item.ordersCount} invoices • Revenue: ₹${item.totalVal.toLocaleString('en-IN')}`;

  if (tbody) {
    tbody.innerHTML = item.ordersList.map((ord, idx) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-2.5 font-mono text-slate-700 font-bold">${ord.date}</td>
        <td class="p-2.5 font-mono font-bold text-indigo-700">${ord.orderId}</td>
        <td class="p-2.5 font-bold text-slate-900">${ord.buyerName}</td>
        <td class="p-2.5 text-slate-500">${ord.route || '-'}</td>
        <td class="p-2.5 text-slate-600 font-medium">${ord.rep || 'Direct'}</td>
        <td class="p-2.5 text-right font-mono font-black text-slate-900">${ord.qty}</td>
        <td class="p-2.5 text-right font-mono text-slate-600">₹${ord.rate}</td>
        <td class="p-2.5 text-right font-mono font-black text-emerald-600">₹${ord.total.toLocaleString('en-IN')}</td>
        <td class="p-2.5 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${ord.paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-800' : ord.paymentMode === 'UPI' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'}">${ord.paymentMode}</span>
        </td>
      </tr>
    `).join('');
  }

  const modal = document.getElementById('modal-product-bills-drilldown');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeProductBillsDrilldown() {
  const modal = document.getElementById('modal-product-bills-drilldown');
  if (modal) modal.classList.add('hidden');
}

// 1-Click Excel Export for the Active Filtered Range
function exportCurrentProductWiseSalesExcel() {
  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  const fromDate = fromInput ? fromInput.value : '';
  const toDate = toInput ? toInput.value : '';

  const repFilter = document.getElementById('ps-filter-rep') ? document.getElementById('ps-filter-rep').value : 'all';
  const routeFilter = document.getElementById('ps-filter-route') ? document.getElementById('ps-filter-route').value : 'all';

  if (typeof exportProductWiseSalesToExcel === 'function') {
    exportProductWiseSalesToExcel(fromDate, toDate, true, repFilter, routeFilter);
  } else {
    alert('Export engine not ready. Please try again.');
  }
}

// WhatsApp Summary Digest
function shareProductWiseSalesWhatsApp() {
  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  const fromDate = fromInput ? fromInput.value : '';
  const toDate = toInput ? toInput.value : '';

  const productAgg = window.currentProductWiseAggMap || {};
  const list = Object.values(productAgg).sort((a, b) => b.totalVal - a.totalVal);

  if (list.length === 0) {
    alert('No product sales to share for this date range.');
    return;
  }

  const grandUnits = list.reduce((a, p) => a + p.totalQty, 0);
  const grandVal = list.reduce((a, p) => a + p.totalVal, 0);

  let text = `📊 *SRI GOVINDA FOOD PRODUCTS*\n` +
    `*PRODUCT-WISE SALES RECORD*\n` +
    `📅 *Period:* ${fromDate} to ${toDate}\n\n` +
    `📦 *Total Units Sold:* ${grandUnits.toLocaleString('en-IN')} units\n` +
    `💰 *Total Billed Revenue:* ₹${grandVal.toLocaleString('en-IN')}\n` +
    `🛍️ *Distinct SKUs Sold:* ${list.length}\n\n` +
    `🏆 *TOP SELLING PRODUCTS:*\n`;

  list.slice(0, 8).forEach((p, idx) => {
    text += `${idx + 1}. *${p.name}* (${p.unitSize})\n` +
      `   • Units: ${p.totalQty} | Revenue: ₹${p.totalVal.toLocaleString('en-IN')} | Orders: ${p.ordersCount}\n`;
  });

  text += `\n_Generated via Sri Govinda Manager Cockpit_`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Expose globally
if (typeof window !== 'undefined') {
  window.initProductSalesDates = initProductSalesDates;
  window.setProductSalesDatePreset = setProductSalesDatePreset;
  window.onProductSalesFilterChanged = onProductSalesFilterChanged;
  window.renderProductWiseSalesView = renderProductWiseSalesView;
  window.openProductBillsDrilldown = openProductBillsDrilldown;
  window.closeProductBillsDrilldown = closeProductBillsDrilldown;
  window.exportCurrentProductWiseSalesExcel = exportCurrentProductWiseSalesExcel;
  window.shareProductWiseSalesWhatsApp = shareProductWiseSalesWhatsApp;
}
