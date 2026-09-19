# Sri Govinda Sales & Inventory Management Platform

> Realtime commercial distribution, field sales ordering, live inventory tally, and free sample tracking suite built for **Sri Govinda Food Products**.

---

## 🌟 Overview

The **Sri Govinda Sales Suite** is a zero-build, client-side web application paired with a **Supabase PostgreSQL & Realtime** backend (with automatic offline `localStorage` fallback).

The platform provides two dedicated operational interfaces:

1. **👔 Manager Hub (`sri_govinda_admin_manager_platform.html`)**
   * **Executive KPI Dashboard:** Real-time revenue booked, cash collections, active reps, and orders count with Chart.js visualization.
   * **Master PIN Security Gate:** 4-digit PIN gate (`7890` default) with session lock/unlock.
   * **Live Inventory Tally:** Automatic calculation ($\text{Opening} + \text{Inward} - \text{Sold} - \text{Samples} = \text{Balance}$) with batch lot tracking and low-stock alerts.
   * **Free Sample & Tasting Tracker:** Specialized tasting ledger for restaurant chefs and retailers with lead conversion tracking.
   * **Beat & Route Management:** Assign routes, cutoff times, and delivery vehicles (Tata Ace, 3-Wheelers, E-cargo bikes).
   * **Store Directory & Udhaar Ledger:** Customer credit limits, pending udhaar, and buyer tier discounts (**HoReCa**, **Wholesale**, **Retail**, **Caterer**).
   * **Contract Pricing Engine:** Negotiated pricing matrix per store/product.
   * **Master Order Ledger & Thermal Receipts:** 80mm ESC/POS print stylesheets and PapaParse CSV exports.

2. **🛵 Sales Rep Mobile Terminal (`reps/sales_rep_mobile_terminal.html`)**
   * **Mobile-First Touch Catalog:** Fast `+` / `-` ordering, cart view, and catalog search.
   * **Daily Quota Progress Bar:** Live target tracker (₹ booked vs. quota), cash-in-bag counter, and samples handed out.
   * **Commercial Sale vs. Free Sample Mode:** Toggle between revenue billing and zero-cost chef tasting giveaways.
   * **1-Click WhatsApp Invoicing:** Generates formatted order bills with direct `wa.me` links.
   * **80mm Thermal Receipt Printing:** Bluetooth mobile printer ready.

---

## 📁 Repository Structure

```
sales-app/
├── index.html                               # Portal launcher & landing page
├── sri_govinda_admin_manager_platform.html  # Manager Hub & Commercial Cockpit
├── config.js                                # Central Supabase credentials config
├── supabase_schema.sql                      # Complete PostgreSQL DDL, RLS, and seed data
├── .gitignore
├── README.md
└── reps/
    └── sales_rep_mobile_terminal.html       # Field Sales Rep Mobile Terminal
```

---

## 🚀 Quick Start & Supabase Backend Setup

### 1. Database Setup (Supabase)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Copy and run the entire contents of [`supabase_schema.sql`](supabase_schema.sql).
   * Creates all 8 tables (`routes`, `buyers`, `products`, `contract_pricing`, `orders`, `inventory_inward`, `sample_giveaways`, `reps`).
   * Configures Row Level Security (RLS) policies.
   * Adds tables to the `supabase_realtime` publication for instant websocket synchronization.
   * Seeds initial Sri Govinda spice products, routes, and stores.

### 2. Configure Credentials
Open [`config.js`](config.js) and paste your Supabase Project URL and anon public API key:

```javascript
window.SRI_GOVINDA_CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsIn..."
};
```

---

## 🌐 Deploy to GitHub Pages (Free Hosting)

To access the app from any mobile phone or computer:

1. Push this repository to GitHub.
2. In your GitHub repository, go to **Settings** -> **Pages**.
3. Under **Branch**, select `main` and folder `/ (root)`. Click **Save**.
4. Your app will be live at:
   ```
   https://arvindthegreatest-star.github.io/Sales-app/
   ```
   * Sales reps can bookmark `https://arvindthegreatest-star.github.io/Sales-app/reps/sales_rep_mobile_terminal.html` on their smartphones.
   * Managers can access `https://arvindthegreatest-star.github.io/Sales-app/sri_govinda_admin_manager_platform.html` on PCs/tablets.
