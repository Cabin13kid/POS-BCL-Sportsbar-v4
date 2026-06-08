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

## Implemented (2026-02 → 2026-06)
- ✅ Auth (JWT, 3 roles) + Gebruikersbeheer
- ✅ Menu / Voorraad / Plattegrond CRUD
- ✅ POS / Bestellingen / Orders flow
- ✅ Promoties: types `order_percent`, `item_fixed`, `item_percent` met optionele start/eind + active toggle
- ✅ **Meerdere promoties per bestelling** (additief, gecapped op subtotal)
- ✅ **Later promoties toevoegen** via PUT /api/orders/{id}/promotions
- ✅ **Bestelling detail dialog** (klik kaart → items, promo toggle, items toevoegen, afrekenen)
- ✅ **Nieuwe bestelling tab** in Bestellingen pagina (verplaatst van POS)
- ✅ **Dashboard** op `/`: omzet vandaag, open/afgerond counts, voorraad alarm (<6 stuks), shift notities (CRUD)
- ✅ Hernoemd naar **BARTRACK BCL**

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
