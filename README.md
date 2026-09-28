# Sri Govinda Sales & Inventory Management Platform

> Realtime commercial distribution, field sales ordering, live inventory tally, customer quotations, and field sales official PWA suite built for **Sri Govinda Food Products**.

---

## 🌟 Overview

The **Sri Govinda Sales Suite** is a unified Progressive Web Application (PWA) with a **Supabase PostgreSQL & Realtime** backend (with seamless offline `localStorage` fallback).

The entire application runs from a unified file (`index.html`) supporting multiple roles and capabilities:

1. **👔 Manager Cockpit (`index.html?manager=true`)**
   * **Executive KPI Cockpit:** Real-time revenue booked, cash collections, active officers, and order metrics.
   * **Sales Team & Performance Analytics:** Track individual sales officers across Daily (Today), Weekly, Monthly, Quarterly, Yearly, and All-Time with dynamic target progress bars.
   * **Add & Manage Sales Officials:** Comprehensive onboarding of sales officers with Officer ID, Mobile/WhatsApp, Beat/Route, Vehicle mode, Monthly Target, Commission %, and Date of Joining.
   * **1-Click WhatsApp PWA Distribution:** Send customized PWA installation links to field reps with a single tap.
   * **Live Stock & Inward Inventory:** Real-time inventory tally with batch tracking and low-stock alerts.
   * **Customer Quotation Engine:** Multi-item customer quotations with approved rates automatically reflected in order booking.
   * **Tax Invoices & Thermal Receipts:** Full GST tax invoice generation (PDF & JPEG downloads) and WhatsApp bill sharing.

2. **🛵 Sales Officer Field PWA (`index.html?rep=SP-101`)**
   * **Personalized Title & Persona:** Named after the specific sales officer working on that page.
   * **1-Step Order Entry & Instant Billing:** One-tap order booking with customer quotation pricing, warehouse stock deduction, and instant bill generation/WhatsApp delivery.
   * **Personal Officer Dashboard:** Live contrast of Monthly Target vs Achieved (₹), today's orders/sales, and recent booked orders stream.
   * **Installable PWA:** Can be pinned to any Android or iOS home screen as a standalone mobile app.

---

## 📁 Repository Structure

```
sales-app/
├── index.html            # Unified Single-Page Application (Manager Hub & Field Sales PWA)
├── manifest.json         # PWA Web App Manifest
├── sw.js                 # PWA Service Worker (Offline caching & field resilience)
├── icon-192.png          # App Icon (192x192)
├── icon-512.png          # App Icon (512x512)
├── config.js             # Central Supabase credentials configuration
├── supabase_schema.sql   # PostgreSQL DDL, RLS policies, and realtime publications
├── README.md             # Documentation
└── .gitignore            # Git ignore rules
```

---

## 🚀 Quick Start & Supabase Setup

### 1. Database Setup (Supabase)
1. In your Supabase Project dashboard, open the **SQL Editor**.
2. Run [`supabase_schema.sql`](supabase_schema.sql) to set up tables (`routes`, `buyers`, `products`, `contract_pricing`, `orders`, `inventory_inward`, `sample_giveaways`, `salespeople`).
3. Realtime publications and RLS policies are automatically configured.

### 2. Configure Credentials
Edit [`config.js`](config.js) with your project URL and public anon key:
```javascript
window.SRI_GOVINDA_CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsIn..."
};
```

---

## 🌐 Deploy to GitHub Pages

1. In GitHub, go to **Settings** -> **Pages**.
2. Under **Branch**, select `main` and folder `/ (root)`. Click **Save**.
3. Live Portal: `https://arvindthegreatest-star.github.io/Sales-app/`
   * Rep Link format: `https://arvindthegreatest-star.github.io/Sales-app/?rep=SP-101`
   * Manager Link: `https://arvindthegreatest-star.github.io/Sales-app/?manager=true`
