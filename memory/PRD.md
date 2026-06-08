# BARTRACK — Bar Orders & Inventory PRD

## Problem Statement
Build an interface to track bar orders + inventory. Adjustable floorplan (drag-and-drop canvas + list editor). Seeded menu items in 5 categories (Frisdrank, Non alcoholisch Bier, Alcohol, Snacks, Eten). All inventory starts at 0. Add/edit menu items in UI, link them to inventory. Inventory supports "Trays" tracked separately from loose units (units_per_tray × trays_in_storage). Dutch interface, JWT login, tracking only (no payments).

## User Personas
- **Bar operator/manager** — admin account (admin@bar.nl), manages menu, inventory and floorplan.
- **Bar staff** — uses POS to create tables/orders, view active orders, mark paid.

## Core Requirements
- JWT auth (cookie + Bearer)
- 5 fixed categories (Frisdrank, Non alcoholisch Bier, Alcohol, Snacks, Eten)
- Menu CRUD + price + optional link to inventory item
- Inventory CRUD: loose_units, trays_in_storage, units_per_tray
- Floorplan: drag-and-drop canvas + list view (add/edit/remove tables)
- Orders: create per table, decrement inventory (loose first, then convert tray), mark paid
- All UI in Dutch

## Implemented (2026-02)
- ✅ JWT login with seeded admin
- ✅ Backend FastAPI + Motor + Mongo with 18 seeded items (10 Frisdrank, 4 Non Alcoholisch Bier, 1 Snacks, 3 Eten, 0 Alcohol)
- ✅ Menu CRUD with inventory_id linking
- ✅ Inventory CRUD with trays + loose units logic
- ✅ Floorplan with framer-motion drag-and-drop + list editor
- ✅ POS split-screen (menu grid + ticket)
- ✅ Orders page with open/paid tabs, auto-refresh, decrement inventory + tray conversion
- ✅ Dutch UI throughout
- ✅ Dark mode design (slate-950 / amber-500) with Chivo/Manrope/JetBrains Mono fonts
- ✅ **Role-based access** (admin / manager / werknemer) — 403 enforced server-side, sidebar+routes filtered client-side
- ✅ **Gebruikersbeheer** (admin only) — CRUD users, change role, reset password, self-delete blocked
- ✅ **Promoties** (admin only mutate) — % over bestelling OR vaste € korting per item, met optionele start/eind datetime, actief-toggle, picker in POS
- ✅ **Items toevoegen aan open bestellingen** — POST /api/orders/{id}/items merges qty, recalculates totals (incl. existing promo); blocked on paid orders

## Backlog (P1/P2)
- P1: Order analytics dashboard (omzet per dag/categorie)
- P1: Low-stock alerts + per-product reorder threshold
- P1: Multi-user roles (kassa vs manager)
- P2: Print receipts / send to kitchen
- P2: Stripe payment integration (now tracking-only)
- P2: Real-time order updates via WebSocket
- P2: Order item modifiers / sizes
- P2: Audit log of inventory adjustments

## Next Tasks
- Wait for user feedback before adding analytics or low-stock alerts.
