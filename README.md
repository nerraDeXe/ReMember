# ReMember — Enterprise Membership Management System

A web-based Membership Management System engineered with **React**, **Tailwind CSS**, and **Node.js / Express** with MongoDB, JWT Authentication, Role-Based Access Control (RBAC), and Google Wallet digital passes.

---

## 🌟 Key Features & Requirements Matrix

| Requirement | Implementation | Status |
|---|---|---|
| **Secure Online Registration** | Multi-field validation, password hashing with bcrypt, unique membership ID (`MEM-2026-XXXX`). | ✅ Complete |
| **JWT Session Authentication** | Secure Bearer JWT token issuance and validation across all member & admin routes. | ✅ Complete |
| **Role-Based Access Control (RBAC)** | Strict Node.js RBAC middleware (`requireRole('admin')`) denying standard members (403 Forbidden). | ✅ Complete |
| **Member Dashboard** | Immediate view of membership status, tier badge, expiration date, and quick renewal. | ✅ Complete |
| **MongoDB Profile Persistence** | Full personal profile updating (bio, phone, address, preferences) stored in MongoDB. | ✅ Complete |
| **Renewal Payment Gateway** | Integrated checkout gateway with instant invoice generation, renewal validity calculation, and decline testing. | ✅ Complete |
| **Google Wallet Digital Pass** | Generic Pass Object generator with QR/Code128 barcode, holographic card styling, and "Add to Google Wallet" button. | ✅ Complete |
| **Automated Google Wallet Sync** | Admin tier changes automatically trigger REST API calls to update the Google Wallet object in real time. | ✅ Complete |
| **Events Calendar & RSVP** | Interactive event cards with capacity meters, tier access restrictions, and live RSVP. | ✅ Complete |
| **Automated Email Confirmations** | HTML confirmation emails dispatched upon registration, payment renewal, and event RSVPs with in-app email center. | ✅ Complete |
| **Historical Invoices & Download** | Full billing history with status pills, printable receipt modal (`InvoiceModal`), and JSON/metadata download. | ✅ Complete |
| **Protected Admin Dashboard** | High-level executive KPIs (Total Revenue, MRR, ARR, active vs. registered members, paid invoices). | ✅ Complete |
| **Paginated & Searchable Members List** | Dynamic filtering by name, email, tier, and status with pagination controls. | ✅ Complete |
| **Manual Status Control** | Admin buttons to manually approve, suspend, or revoke any member account. | ✅ Complete |
| **Custom Tiers & Pricing CRUD** | Admin interface to create, modify, and delete tiers with custom prices, billing cycles, and perks. | ✅ Complete |
| **Event Listing Management** | Admin tool to publish new events specifying date, venue, capacity, and allowed membership tiers. | ✅ Complete |
| **Financial Analytics** | Breakdown of revenue from subscriptions vs. event ticketing with visual progress bars. | ✅ Complete |
| **Segmented CSV Export** | Dynamic CSV file generator exporting filtered member segments for external reporting. | ✅ Complete |
| **Audit Activity Log** | Immutable log recording registrations, profile edits, payment failures, tier adjustments, and wallet syncs. | ✅ Complete |

---

## 🚀 Quick Start Guide

### 1. Backend Server
Set `MONGODB_URI` in `backend/.env` using `backend/.env.example` as a guide. The backend requires MongoDB to be available and does not store a local database copy.
Configure SMTP to send account verification emails. See [account and organisation setup](backend/ACCOUNT_FLOW.md) for the new signup flow and required email settings.

```bash
cd backend
npm install
npm start
# Runs on http://localhost:5000
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
# Accessible at http://localhost:5173
```

---

## 🔑 Demo Account Credentials

| Persona | Email | Password | Role | Pre-configured Tier |
|---|---|---|---|---|
| **Chief Administrator** | `admin@remember.io` | `AdminPass123!` | `admin` | Platinum Elite |
| **Gold VIP Member** | `member@remember.io` | `MemberPass123!` | `member` | Gold VIP |
| **Platinum Member** | `alex.chen@techcorp.io` | `MemberPass123!` | `member` | Platinum Elite |
| **Pending Member** | `sarah.jenkins@designstudio.co` | `MemberPass123!` | `member` | Silver Patron |
| **Suspended Member** | `marcus.vance@venturelabs.com` | `MemberPass123!` | `member` | Bronze Explorer |

*Tip: The navbar includes a **"⚡ Switch to Admin / Member"** toggle button for instant persona switching during review.*

---

## 🧪 Automated End-to-End Test Suite

Run the full verification test suite:
```bash
cd backend
node test_suite.js
```
*Result: 29/29 tests pass with zero failures.*
