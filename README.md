# 🧾 Smart Billing App

A comprehensive, production-ready, cross-platform billing, invoicing, and inventory management system designed for shopkeepers and small businesses.

This project features two main client applications sharing the same backend database layout:
1. 📱 **Mobile App** — Built using **React Native** (iOS & Android) with TypeScript.
2. 💻 **Web App** — Built using **React, Vite, & TypeScript** (wrapped via **Capacitor** for hybrid deployment).
3. ⚡ **Backend** — Powered by **Supabase** (PostgreSQL, Realtime, Row-Level Security, Database Triggers).

---

## ✨ Feature Highlights

*   👤 **Secure Authentication & Onboarding**
    *   Sign up and Log in securely using Supabase Auth.
    *   Automatic profile creation on registration with default "user" role.
    *   **Awaiting Admin Approval (Frozen State):** New shopkeeper accounts start in a "frozen" state, letting you screen registrations before giving them access.
*   📊 **Business Dashboard & Analytics**
    *   Visual sales charts and revenue metrics.
    *   Quick summaries of pending/paid invoices, top items, and low stock counts.
*   🧾 **Advanced Invoicing & Billing**
    *   Generate clean, sequential invoice numbers (e.g. `INV-1001`, `INV-1002`).
    *   Flexible line items with quantity, rate, batch number, expiry date, and per-line discount percentage.
    *   Invoice-wide parameters: discount amount, tax percentage, tax amount, and custom note extras.
    *   Support for multiple store formats with customized bill metadata:
        *   **Grocery, Apparel, Electronics, Services:** General invoicing.
        *   **Restaurant:** Table number, order type (dine-in/takeaway), and service charges.
        *   **Medical Store:** Track batch numbers and expiry dates.
    *   📄 PDF Invoice generation and native share sheet integration.
*   📦 **Inventory & Stock Management** (Admin-Gated per User)
    *   Optional per-item stock tracking.
    *   Real-time stock ledger tracking movements (sale, restock, adjustment, return, opening).
    *   Low stock threshold alerts (reorder levels).
    *   Batched stock expiry date reminders (ideal for medical stores/pharmacies).
*   👥 **Customer Directory**
    *   Quick autocomplete/suggestions during billing.
    *   Ability to freeze specific customer accounts to prevent further billing.
*   🛡️ **Enterprise Security (Strict Data Isolation)**
    *   Row-Level Security (RLS) is enabled on all tables.
    *   Every user operates in complete isolation — users can **only** read and write their own customers, items, bills, stock movements, and settings.
*   🔑 **Admin Gated Management Panel**
    *   Admin-only screens to approve new users, extend free trials, freeze/unfreeze accounts, or turn on the Inventory module for specific shops.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile** | React Native, TypeScript, React Navigation, React Native Config, AsyncStorage |
| **Web** | React, Vite, TypeScript, React Router DOM, TailwindCSS / CSS Modules |
| **Backend & DB** | Supabase, PostgreSQL, PL/pgSQL (Triggers & Security Definer Functions) |
| **Hybrid Bridge**| Capacitor |

---

## 🚀 Getting Started

### 📋 Prerequisites
*   [Node.js](https://nodejs.org/) (Version `>= 22.11.0` recommended)
*   [Supabase Account](https://supabase.com/)

---

### 1. Database Setup (Supabase)

1.  Create a new project in your **Supabase Dashboard**.
2.  Navigate to **SQL Editor** → **New Query**.
3.  Paste the contents of `supabase/schema.sql` into the editor and click **Run**.
    *   This creates the required tables (`profiles`, `subscriptions`, `customers`, `items`, `bills`, `bill_items`, `settings`, `stock_movements`).
    *   It configures the trigram indices for fast search, triggers for auto-creating profiles on signup, and all RLS policies.
4.  *(Optional)* To make a profile an Admin, run this SQL in the editor:
    ```sql
    UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
    ```

---

### 2. Configure Environment Variables

This project uses environment variables so that your database credentials are never committed to version control.

#### Mobile (React Native)
1.  In the root folder, copy the example environment file:
    ```sh
    cp .env.example .env
    ```
2.  Open `.env` and fill in your Supabase connection parameters:
    ```env
    SUPABASE_URL=https://your-project-id.supabase.co
    SUPABASE_ANON_KEY=your-anon-key-here
    ```

#### Web App
1.  In the `web/` folder, copy the web environment file:
    ```sh
    cp web/.env.example web/.env
    ```
2.  Open `web/.env` and configure:
    ```env
    VITE_SUPABASE_URL=https://your-project-id.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key-here
    ```

---

### 3. Installation & Run

#### Mobile App (React Native)
From the root directory, install dependencies:
```sh
npm install
```

Start the Metro development server:
```sh
npm start
```

Build and run on your platform of choice (ensure you have Android Studio / Xcode tools configured):
```sh
# Android
npm run android

# iOS
bundle install
bundle exec pod install
npm run ios
```

#### Web App (Vite)
Navigate to the `web/` directory:
```sh
cd web
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Repository Structure

```
Billing-app/
├── src/                      # 📱 React Native application source code
│   ├── components/common/    # Reusable UI elements (Loading, buttons, text fields)
│   ├── config/               # App configuration (store configurations, constants)
│   ├── context/              # Context Providers (Auth, Settings, Subscriptions)
│   ├── hooks/                # Custom React Hooks
│   ├── lib/                  # Native library initializations (Supabase client)
│   ├── navigation/           # Mobile routers (Auth stack, Admin stack, main tabs)
│   ├── screens/              # UI screens (Dashboard, Billing, History, Inventory, Admin)
│   ├── services/             # Database fetch / mutation calls
│   ├── theme/                # Visual theme configuration (colors, layouts)
│   ├── types/                # Core typescript model interfaces
│   └── utils/                # Calculation, validation, and PDF invoice helpers
├── web/                      # 💻 Vite Web / Capacitor project
│   ├── src/                  # React web source code
│   │   ├── components/       # Layouts, UI, and autocomplete widgets
│   │   ├── pages/            # Web page screens (mirror of React Native screens)
│   │   └── services/         # Database services
│   ├── capacitor.config.ts   # Hybrid app wrapper config
│   └── vite.config.ts        # Vite build manager configuration
└── supabase/                 # ⚡ Database migrations and SQL configurations
    └── schema.sql            # Core database schema containing tables, triggers, and RLS policies
```

---

## 🛡️ Security & Privacy Architecture
This app runs under a strict zero-trust database design using **Supabase Row-Level Security (RLS)**:
*   **Anon Key Isolation:** The client uses the public `anon` key. The database enforces that the authenticated user (`auth.uid()`) must match the `user_id` of the row being accessed.
*   **Zero Admin Leakage:** Admin roles are only permitted to manage registration profiles and trial subscription end dates. Admins cannot read or modify any shopkeeper's bills, customer profiles, or inventory ledgers. Your store data remains 100% private.

---

## 📄 License
This project is licensed under the MIT License.
