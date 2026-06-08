import React, { useEffect, useMemo, useState } from "react";
import { api, formatEUR, CATEGORIES, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, ShoppingCart, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function POS() {
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [promos, setPromos] = useState([]);
  const [promoId, setPromoId] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [cart, setCart] = useState([]); // [{menu_item_id, name, price, qty}]
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [m, t, p] = await Promise.all([
      api.get("/menu"),
      api.get("/tables"),
      api.get("/promotions"),
    ]);
    setMenu(m.data);
    setTables(t.data);
    setPromos(p.data.filter((x) => x.active));
  };

  useEffect(() => {
    load();
  }, []);

  const itemsForCat = useMemo(
    () => menu.filter((m) => m.category === cat),
    [menu, cat],
  );

  const addItem = (m) => {
    setCart((c) => {
      const ex = c.find((i) => i.menu_item_id === m.id);
      if (ex)
        return c.map((i) =>
          i.menu_item_id === m.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...c, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }];
    });
  };

  const changeQty = (id, d) =>
    setCart((c) =>
      c
        .map((i) =>
          i.menu_item_id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i,
        )
        .filter((i) => i.qty > 0),
    );

  const removeItem = (id) =>
    setCart((c) => c.filter((i) => i.menu_item_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const activePromo = promos.find((p) => p.id === promoId);
  let discount = 0;
  if (activePromo) {
    if (activePromo.type === "order_percent") {
      discount = subtotal * (activePromo.value / 100);
    } else if (activePromo.type === "item_fixed") {
      const ids = new Set(activePromo.menu_item_ids || []);
      cart.forEach((i) => {
        if (ids.has(i.menu_item_id)) discount += activePromo.value * i.qty;
      });
    }
  }
  discount = Math.min(discount, subtotal);
  const total = subtotal - discount;

  const submit = async () => {
    if (cart.length === 0) {
      toast.error("Bestelling is leeg");
      return;
    }
    setBusy(true);
    try {
      await api.post("/orders", {
        table_id: selectedTable?.id,
        table_name: selectedTable?.name || "Bar",
        items: cart,
        note: note || null,
        promotion_id: promoId || null,
      });
      toast.success(`Bestelling geplaatst (${formatEUR(total)})`);
      setCart([]);
      setNote("");
      setPromoId("");
      setSelectedTable(null);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Selecteer een tafel en tik artikelen aan
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {selectedTable ? (
            <button
              onClick={() => setSelectedTable(null)}
              className="px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40 flex items-center gap-2"
              data-testid="selected-table-chip"
            >
              {selectedTable.name}
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-slate-500">Geen tafel geselecteerd · bar</span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-0">
        {/* Left: tables + menu */}
        <div className="overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {/* Tables */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
              Tafels
            </h2>
            <div className="flex flex-wrap gap-2">
              {tables.length === 0 && (
                <div className="text-sm text-slate-500">
                  Nog geen tafels — voeg ze toe in Plattegrond.
                </div>
              )}
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t)}
                  data-testid={`pos-table-${t.name}`}
                  className={`h-12 px-5 rounded-xl border text-sm font-medium transition-all ${
                    selectedTable?.id === t.id
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                      : "bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </section>

          {/* Categories */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
              Categorieën
            </h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  data-testid={`category-tab-${c}`}
                  className={`h-10 px-4 rounded-full text-sm font-semibold tracking-wide transition-colors ${
                    cat === c
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* Menu Items */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
              {cat}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {itemsForCat.length === 0 && (
                <div className="col-span-full text-sm text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-xl">
                  Geen artikelen in {cat}.
                </div>
              )}
              {itemsForCat.map((m) => (
                <motion.button
                  key={m.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => addItem(m)}
                  data-testid={`menu-item-${m.name}`}
                  className="group aspect-[5/4] p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/70 transition-all text-left flex flex-col justify-between"
                >
                  <div className="text-sm font-semibold text-slate-100 leading-tight">
                    {m.name}
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="font-mono text-lg font-semibold text-amber-400 tabular">
                      {formatEUR(m.price)}
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 transition text-amber-400">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Ticket */}
        <aside className="border-l border-slate-800 bg-slate-900/40 flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-amber-400" />
              <h2 className="font-semibold tracking-tight">Bestelling</h2>
            </div>
            <span className="text-xs text-slate-500">
              {cart.length} {cart.length === 1 ? "regel" : "regels"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
            <AnimatePresence>
              {cart.length === 0 && (
                <div className="text-center py-10 text-sm text-slate-500">
                  Tik artikelen aan om toe te voegen.
                </div>
              )}
              {cart.map((i) => (
                <motion.div
                  key={i.menu_item_id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3"
                  data-testid={`cart-row-${i.name}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    <div className="text-xs text-slate-500 font-mono tabular">
                      {formatEUR(i.price)} × {i.qty}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeQty(i.menu_item_id, -1)}
                      className="h-7 w-7 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
                      data-testid={`cart-dec-${i.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-mono tabular">{i.qty}</span>
                    <button
                      onClick={() => changeQty(i.menu_item_id, 1)}
                      className="h-7 w-7 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
                      data-testid={`cart-inc-${i.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeItem(i.menu_item_id)}
                      className="h-7 w-7 rounded-md text-rose-400 hover:bg-rose-500/10 flex items-center justify-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-5 border-t border-slate-800 bg-slate-950/60 backdrop-blur-xl space-y-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notitie (optioneel)"
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:border-amber-500/50"
              data-testid="cart-note"
            />
            {promos.length > 0 && (
              <select
                value={promoId}
                onChange={(e) => setPromoId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500/50"
                data-testid="cart-promo-select"
              >
                <option value="">— Geen promotie —</option>
                {promos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type === "order_percent" ? `${p.value}%` : formatEUR(p.value)})
                  </option>
                ))}
              </select>
            )}
            {discount > 0 && (
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-500">Subtotaal</span>
                <span className="font-mono tabular text-slate-400">{formatEUR(subtotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-emerald-400">Korting</span>
                <span className="font-mono tabular text-emerald-400">−{formatEUR(discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Totaal
              </span>
              <span
                className="text-2xl font-mono font-bold tabular text-amber-400"
                data-testid="cart-total"
              >
                {formatEUR(total)}
              </span>
            </div>
            <Button
              onClick={submit}
              disabled={busy || cart.length === 0}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold tracking-wide disabled:opacity-50"
              data-testid="submit-order-btn"
            >
              {busy ? "Bezig…" : "Bestelling plaatsen"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
