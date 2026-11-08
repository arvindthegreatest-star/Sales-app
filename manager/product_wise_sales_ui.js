// ==============================================================================
// SRI GOVINDA FOOD PRODUCTS - PRODUCT-WISE SALES RECORD (DATE-TO-DATE AUDIT)
// ==============================================================================
// Provides interactive date-range aggregation, SKU volume & turnover analytics,
// order penetration statistics, itemized bill drilldown, and audit-grade Excel export.
// ==============================================================================

let currentProductSalesPreset = 'all';

// Local date formatter (YYYY-MM-DD) avoiding UTC timezone shifts
function formatLocalYMD(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) {
    d = new Date();
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Resilient helper to fetch orders from memory or persistent storage
function getProductSalesOrders() {
  let list = [];
  try {
    if (typeof window !== 'undefined' && Array.isArray(window.orders) && window.orders.length > 0) {
      list = window.orders;
    } else if (typeof orders !== 'undefined' && Array.isArray(orders) && orders.length > 0) {
      list = orders;
    }
  } catch (e) {}

  if (!list || list.length === 0) {
    try {
      const delOrderSet = new Set(JSON.parse(localStorage.getItem('sg_deleted_order_ids') || '[]').map(String));
      const raw = localStorage.getItem('sg_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed.filter(o => o && o.id && !delOrderSet.has(String(o.id)));
        }
      }
    } catch (e) {}
  }
  return list || [];
}

// Resilient helper to fetch master products
function getProductSalesProducts() {
  let list = [];
  try {
    if (typeof window !== 'undefined' && Array.isArray(window.products) && window.products.length > 0) {
      list = window.products;
    } else if (typeof products !== 'undefined' && Array.isArray(products) && products.length > 0) {
      list = products;
    }
  } catch (e) {}

  if (!list || list.length === 0) {
    try {
      const delProdSet = new Set(JSON.parse(localStorage.getItem('sg_deleted_product_ids') || '[]').map(s => String(s).trim().toLowerCase()));
      const raw = localStorage.getItem('sg_products');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter(p => p && p.id && !delProdSet.has(String(p.id).trim().toLowerCase()));
        }
      }
    } catch (e) {}
  }
  return list || [];
}

// Normalize date string from order object to YYYY-MM-DD
function extractOrderDate(o) {
  if (!o) return '';
  let d = o.date || o.orderDate || '';
  if (!d && o.created_at) {
    d = String(o.created_at).slice(0, 10);
  }
  if (!d && o.deliveredAt) {
    d = String(o.deliveredAt).slice(0, 10);
  }
  if (typeof d === 'string') {
    d = d.trim();
    // Handle DD-MM-YYYY or DD/MM/YYYY
    if ((d.includes('/') || d.includes('-')) && d.length >= 8 && d.length <= 10) {
      const parts = d.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 2 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
    }
    return d.slice(0, 10);
  }
  return '';
}

// Safely extract line-items from an order
function extractOrderItems(o) {
  if (!o) return [];
  let raw = o.items || o.cart || o.products || [];
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { raw = []; }
  }
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    return Object.values(raw);
  }
  return [];
}

// Initialize default date range on boot or view switch
function initProductSalesDates() {
  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  if (!fromInput || !toInput) return;

  if (!fromInput.value || !toInput.value) {
    // Check if there are orders this month
    const allOrders = getProductSalesOrders();
    const today = new Date();
    const thisMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthOrders = allOrders.filter(o => extractOrderDate(o).startsWith(thisMonthPrefix));

    if (thisMonthOrders.length > 0) {
      setProductSalesDatePreset('this_month');
    } else if (allOrders.length > 0) {
      // If no orders this month but orders exist in prior months, default to All Time so user immediately sees data
      setProductSalesDatePreset('all');
    } else {
      setProductSalesDatePreset('this_month');
    }
  }
}

// Quick Preset Handlers
function setProductSalesDatePreset(preset) {
  currentProductSalesPreset = preset;
  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  if (!fromInput || !toInput) return;

  const today = new Date();

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
    const s = formatLocalYMD(today);
    fromInput.value = s;
    toInput.value = s;
  } else if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = formatLocalYMD(y);
    fromInput.value = s;
    toInput.value = s;
  } else if (preset === 'last7') {
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 6);
    fromInput.value = formatLocalYMD(d7);
    toInput.value = formatLocalYMD(today);
  } else if (preset === 'this_month') {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    fromInput.value = `${y}-${m}-01`;
    toInput.value = formatLocalYMD(today);
  } else if (preset === 'last_month') {
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    fromInput.value = formatLocalYMD(prevMonthStart);
    toInput.value = formatLocalYMD(prevMonthEnd);
  } else if (preset === 'all') {
    fromInput.value = "2025-01-01";
    toInput.value = formatLocalYMD(today);
  }

  onProductSalesFilterChanged();
}

function onProductSalesFilterChanged() {
  renderProductWiseSalesView();
}

// Populate secondary dropdowns (Rep, Route, Category)
function populateProductSalesDropdowns() {
  const allOrders = getProductSalesOrders();
  const prods = getProductSalesProducts();

  const repSelect = document.getElementById('ps-filter-rep');
  if (repSelect) {
    const currentVal = repSelect.value;
    const repSet = new Set();
    const reps = typeof salespeople !== 'undefined' && Array.isArray(salespeople) ? salespeople : (window.salespeople || []);
    reps.forEach(r => { if (r && r.name) repSet.add(r.name.trim()); });
    allOrders.forEach(o => {
      const r = o.repName || o.salespersonName || o.supplyRepName;
      if (r && typeof r === 'string' && r.trim()) repSet.add(r.trim());
    });

    const opts = ['<option value="all">All Sales Personnel</option>'];
    Array.from(repSet).sort().forEach(name => {
      opts.push(`<option value="${escapeProductSalesAttr(name)}">${name}</option>`);
    });
    repSelect.innerHTML = opts.join('');
    if (currentVal && Array.from(repSet).includes(currentVal)) {
      repSelect.value = currentVal;
    }
  }

  const routeSelect = document.getElementById('ps-filter-route');
  if (routeSelect) {
    const currentVal = routeSelect.value;
    const routeSet = new Set();
    const routesList = typeof routes !== 'undefined' && Array.isArray(routes) ? routes : (window.routes || []);
    routesList.forEach(rt => { if (rt && rt.name) routeSet.add(rt.name.trim()); });
    allOrders.forEach(o => {
      if (o.dispatchRoute) routeSet.add(o.dispatchRoute.split(':')[0].trim());
    });

    const opts = ['<option value="all">All Route Beats</option>'];
    Array.from(routeSet).sort().forEach(rt => {
      opts.push(`<option value="${escapeProductSalesAttr(rt)}">${rt}</option>`);
    });
    routeSelect.innerHTML = opts.join('');
    if (currentVal && Array.from(routeSet).includes(currentVal)) {
      routeSelect.value = currentVal;
    }
  }

  const catSelect = document.getElementById('ps-filter-category');
  if (catSelect) {
    const currentVal = catSelect.value;
    const catSet = new Set();
    prods.forEach(p => { if (p && p.category) catSet.add(p.category.trim()); });
    allOrders.forEach(o => {
      const items = extractOrderItems(o);
      items.forEach(it => { if (it && it.category) catSet.add(it.category.trim()); });
    });

    const opts = ['<option value="all">All Product Categories</option>'];
    Array.from(catSet).sort().forEach(c => {
      opts.push(`<option value="${escapeProductSalesAttr(c)}">${c}</option>`);
    });
    catSelect.innerHTML = opts.join('');
    if (currentVal && Array.from(catSet).includes(currentVal)) {
      catSelect.value = currentVal;
    }
  }
}

function escapeProductSalesAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Main Table & Analytics Renderer
function renderProductWiseSalesView() {
  initProductSalesDates();
  populateProductSalesDropdowns();

  const fromInput = document.getElementById('ps-from-date');
  const toInput = document.getElementById('ps-to-date');
  const fromDate = fromInput ? fromInput.value.trim() : '';
  const toDate = toInput ? toInput.value.trim() : '';

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

  const allOrders = getProductSalesOrders();
  const allProds = getProductSalesProducts();

  // Build resilient multi-key product dictionary
  const prodMap = {};
  allProds.forEach(p => {
    if (p) {
      if (p.sku) {
        prodMap[p.sku.trim()] = p;
        prodMap[p.sku.trim().toLowerCase()] = p;
      }
      if (p.id) {
        prodMap[p.id.trim()] = p;
      }
      if (p.name) {
        prodMap[p.name.trim().toLowerCase()] = p;
      }
    }
  });

  // 1. Filter Orders within Date Range & Dimensions
  const filteredOrders = allOrders.filter(o => {
    if (!o || !o.id) return false;

    const d = extractOrderDate(o);
    if (fromDate && d && d < fromDate) return false;
    if (toDate && d && d > toDate) return false;

    if (repFilter && repFilter !== 'all') {
      const r = (o.repName || o.salespersonName || o.supplyRepName || o.customerRepName || '').toLowerCase();
      if (!r.includes(repFilter.toLowerCase())) return false;
    }

    if (routeFilter && routeFilter !== 'all') {
      const rt = (o.dispatchRoute || o.buyerHomeRoute || '').toLowerCase();
      if (!rt.includes(routeFilter.toLowerCase())) return false;
    }

    return true;
  });

  // 2. Aggregate Sales Line Items by Product SKU
  const productAgg = {};
  let grandTotalUnits = 0;
  let grandTotalValue = 0;

  filteredOrders.forEach(o => {
    const items = extractOrderItems(o);
    const orderDateStr = extractOrderDate(o);

    items.forEach(rawIt => {
      let it = rawIt;
      if (typeof it === 'string') {
        try { it = JSON.parse(it); } catch (e) { return; }
      }
      if (!it || typeof it !== 'object') return;

      const qty = Number(it.qty ?? it.quantity ?? it.units ?? it.count ?? 0) || 0;
      if (qty <= 0) return;

      // Product resolution via multi-key map
      const rawSku = (it.sku || '').trim();
      const rawId = String(it.productId || it.product_id || it.id || '').trim();
      const rawName = (it.name || it.productName || it.product_name || '').trim();

      const masterProd = prodMap[rawSku] ||
                         prodMap[rawSku.toLowerCase()] ||
                         prodMap[rawId] ||
                         prodMap[rawName.toLowerCase()] ||
                         {};

      const sku = (masterProd.sku || rawSku || (masterProd.name || rawName || 'GENERAL')).trim();
      const name = masterProd.name || rawName || sku;
      const category = masterProd.category || it.category || 'General';
      const unitSize = masterProd.unitSize || it.unitSize || it.unit_size || 'pack';

      if (catFilter && catFilter !== 'all' && category.toLowerCase() !== catFilter.toLowerCase()) {
        return;
      }

      const rate = Number(it.rate ?? it.unitRate ?? it.price ?? masterProd.baseRate ?? 0);
      const total = Number(it.total ?? it.lineTotal ?? (qty * rate));

      if (!productAgg[sku]) {
        productAgg[sku] = {
          sku: sku,
          name: name,
          category: category,
          unitSize: unitSize,
          baseRate: rate || Number(masterProd.baseRate) || 0,
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
        date: orderDateStr || (o.time ? `${o.date} ${o.time}` : 'Recent'),
        orderId: o.id || '',
        buyerName: o.buyerName || 'Store',
        route: (o.dispatchRoute || o.buyerHomeRoute || '').split(':')[0].trim(),
        rep: o.repName || o.salespersonName || o.supplyRepName || 'Direct',
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

  // Sort by highest turnover value first
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
    const hasTotalOrders = allOrders.length > 0;
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="py-10 text-center text-slate-500">
          <div class="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto px-4">
            <div class="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <i data-lucide="package-search" class="w-6 h-6"></i>
            </div>
            <span class="font-extrabold text-sm text-slate-800">No product sales found between ${fromDate || 'Start'} and ${toDate || 'End'}</span>
            <p class="text-xs text-slate-500 text-center">
              ${hasTotalOrders
                ? `There are <b>${allOrders.length} orders</b> booked in your database outside this selected date window.`
                : `No orders found in your system yet. Generate an order from the 'New Order' tab to see live sales.`}
            </p>
            ${hasTotalOrders ? `
              <button type="button" onclick="setProductSalesDatePreset('all')" class="mt-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                <i data-lucide="calendar-range" class="w-4 h-4"></i> Show All Time Sales (${allOrders.length} Orders)
              </button>
            ` : ''}
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
          <div class="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
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
          <button type="button" onclick="openProductBillsDrilldown('${escapeProductSalesAttr(p.sku)}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-[10px] transition cursor-pointer border border-indigo-200 flex items-center gap-1 mx-auto">
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

  // Store active product map for drilldown
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
    tbody.innerHTML = item.ordersList.map(ord => `
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
  const fromDate = fromInput ? fromInput.value.trim() : '';
  const toDate = toInput ? toInput.value.trim() : '';

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
  const fromDate = fromInput ? fromInput.value.trim() : '';
  const toDate = toInput ? toInput.value.trim() : '';

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

// Function to bridge from Order History to Product Sales seamlessly
function openProductSalesForHistory(preset) {
  setTab('product-sales');
  if (preset) {
    setProductSalesDatePreset(preset);
  } else {
    renderProductWiseSalesView();
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.getProductSalesOrders = getProductSalesOrders;
  window.getProductSalesProducts = getProductSalesProducts;
  window.initProductSalesDates = initProductSalesDates;
  window.setProductSalesDatePreset = setProductSalesDatePreset;
  window.onProductSalesFilterChanged = onProductSalesFilterChanged;
  window.renderProductWiseSalesView = renderProductWiseSalesView;
  window.openProductBillsDrilldown = openProductBillsDrilldown;
  window.closeProductBillsDrilldown = closeProductBillsDrilldown;
  window.exportCurrentProductWiseSalesExcel = exportCurrentProductWiseSalesExcel;
  window.shareProductWiseSalesWhatsApp = shareProductWiseSalesWhatsApp;
  window.openProductSalesForHistory = openProductSalesForHistory;
}
