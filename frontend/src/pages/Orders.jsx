import React, { useEffect, useMemo, useState } from "react";
import { api, formatEUR, CATEGORIES, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Check,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ChevronRight,
  Tag,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function Orders() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "manager";

  const [tab, setTab] = useState("open"); // open | paid | new
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [promos, setPromos] = useState([]);

  // detail dialog
  const [detail, setDetail] = useState(null); // order
  const [detailCat, setDetailCat] = useState(CATEGORIES[0]);
  const [detailAddCart, setDetailAddCart] = useState([]);

  const load = async () => {
    if (tab === "new") return;
    const r = await api.get(`/orders?status=${tab}`);
    setOrders(r.data);
  };

  const loadRefs = async () => {
    const [m, t, p] = await Promise.all([
      api.get("/menu"),
      api.get("/tables"),
      api.get("/promotions"),
    ]);
    setMenu(m.data);
    setTables(t.data);
    setPromos(p.data);
  };

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const markPaid = async (o) => {
    await api.post(`/orders/${o.id}/pay`);
    toast.success("Bestelling afgerekend");
    load();
    if (detail?.id === o.id) setDetail(null);
  };

  const del = async (o) => {
    if (!window.confirm("Bestelling verwijderen?")) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast.success("Verwijderd");
      load();
      if (detail?.id === o.id) setDetail(null);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const openDetail = (o) => {
    setDetail(o);
    setDetailAddCart([]);
    setDetailCat(CATEGORIES[0]);
  };

  // Detail: add items to cart
  const addToDetailCart = (m) =>
    setDetailAddCart((c) => {
      const ex = c.find((i) => i.menu_item_id === m.id);
      if (ex)
        return c.map((i) =>
          i.menu_item_id === m.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...c, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }];
    });

  const changeDetailQty = (id, d) =>
    setDetailAddCart((c) =>
      c
        .map((i) =>
          i.menu_item_id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i,
        )
        .filter((i) => i.qty > 0),
    );

  const submitDetailItems = async () => {
    if (detailAddCart.length === 0) return;
    try {
      const r = await api.post(`/orders/${detail.id}/items`, {
        items: detailAddCart,
      });
      toast.success("Items toegevoegd");
      setDetailAddCart([]);
      setDetail(r.data);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const toggleDetailPromo = async (promoId) => {
    const current = detail.promotion_ids || [];
    const next = current.includes(promoId)
      ? current.filter((x) => x !== promoId)
      : [...current, promoId];
    try {
      const r = await api.put(`/orders/${detail.id}/promotions`, {
        promotion_ids: next,
      });
      setDetail(r.data);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const detailAddTotal = detailAddCart.reduce(
    (s, i) => s + i.price * i.qty,
    0,
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bestellingen</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Nieuwe bestelling, open + betaalde bestellingen
          </p>
        </div>
        <div className="inline-flex rounded-full bg-slate-900 border border-slate-800 p-1">
          {[
            { v: "new", l: "Nieuwe", testid: "tab-new" },
            { v: "open", l: "Open", testid: "tab-open" },
            { v: "paid", l: "Betaald", testid: "tab-paid" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setTab(o.v)}
              data-testid={o.testid}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === o.v
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" && (
        <NewOrderForm
          menu={menu}
          tables={tables}
          promos={promos.filter((p) => p.active)}
          onCreated={() => {
            toast.success("Bestelling aangemaakt");
            setTab("open");
          }}
        />
      )}

      {tab !== "new" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              Geen {tab === "open" ? "openstaande" : "afgeronde"} bestellingen.
            </div>
          )}
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => openDetail(o)}
              data-testid={`order-card-${o.id}`}
              className="text-left rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-amber-500/40 hover:bg-slate-900/70 transition-all p-5 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {o.table_name || "Bar"}
                  </div>
                  <div className="text-sm text-slate-300 mt-0.5">
                    {new Date(o.created_at).toLocaleString("nl-NL")}
                  </div>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${
                    o.status === "open"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                {o.items.length} {o.items.length === 1 ? "regel" : "regels"} ·{" "}
                {o.items.reduce((s, i) => s + i.qty, 0)} items
                {o.promotion_ids?.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-400">
                    <Tag className="h-3 w-3" /> {o.promotion_ids.length} promo
                  </span>
                )}
              </div>

              <div className="flex items-end justify-between mt-4">
                {o.discount > 0 ? (
                  <div className="text-xs text-emerald-400 font-mono tabular">
                    −{formatEUR(o.discount)} korting
                  </div>
                ) : (
                  <span />
                )}
                <span className="text-2xl font-mono tabular font-bold text-amber-400">
                  {formatEUR(o.total)}
                </span>
              </div>

              <div className="mt-3 text-xs text-slate-500 inline-flex items-center gap-1 group-hover:text-amber-400">
                Klik voor detail <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-thin">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3 pr-8">
                  <span>
                    {detail.table_name || "Bar"}
                    <span className="ml-3 text-xs font-mono tabular text-slate-500">
                      {new Date(detail.created_at).toLocaleString("nl-NL")}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${
                      detail.status === "open"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {detail.status}
                  </span>
                </DialogTitle>
              </DialogHeader>

              {/* Items */}
              <section>
                <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2">
                  Items ({detail.items.length})
                </h3>
                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  {detail.items.map((it, i) => (
                    <div
                      key={`${it.menu_item_id}-${it.price}-${i}`}
                      className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 last:border-b-0"
                    >
                      <span className="text-sm">
                        <span className="font-mono tabular text-slate-500 mr-2">
                          {it.qty}×
                        </span>
                        {it.name}
                      </span>
                      <span className="font-mono tabular text-slate-300">
                        {formatEUR(it.price * it.qty)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Promos */}
              {detail.status === "open" && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2">
                    Promoties ({(detail.promotion_ids || []).length} actief)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {promos.length === 0 && (
                      <div className="text-sm text-slate-500 col-span-2">
                        Geen promoties beschikbaar.
                      </div>
                    )}
                    {promos.map((p) => {
                      const on = (detail.promotion_ids || []).includes(p.id);
                      const valLabel =
                        p.type === "order_percent"
                          ? `${p.value}% op bestelling`
                          : p.type === "item_percent"
                          ? `${p.value}% op items`
                          : `${formatEUR(p.value)} per item`;
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleDetailPromo(p.id)}
                          disabled={!p.active}
                          data-testid={`toggle-promo-${p.name}`}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            on
                              ? "bg-emerald-500/10 border-emerald-500/40"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700"
                          } ${!p.active && "opacity-50 cursor-not-allowed"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{p.name}</span>
                            {on && <Check className="h-4 w-4 text-emerald-400" />}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {valLabel}
                            {!p.active && " · inactief"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Add items */}
              {detail.status === "open" && (
                <section>
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2">
                    Items toevoegen
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setDetailCat(c)}
                        className={`h-7 px-2.5 rounded-full text-xs font-medium ${
                          detailCat === c
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto scrollbar-thin">
                    {menu
                      .filter((m) => m.category === detailCat)
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => addToDetailCart(m)}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-left"
                        >
                          <div className="text-sm font-medium leading-tight">
                            {m.name}
                          </div>
                          <div className="text-xs font-mono tabular text-amber-400">
                            {formatEUR(m.price)}
                          </div>
                        </button>
                      ))}
                  </div>

                  <AnimatePresence>
                    {detailAddCart.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-1.5"
                      >
                        {detailAddCart.map((i) => (
                          <div
                            key={i.menu_item_id}
                            className="flex items-center justify-between text-sm bg-slate-950 rounded-lg px-3 py-2"
                          >
                            <span className="flex-1 truncate">{i.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => changeDetailQty(i.menu_item_id, -1)}
                                className="h-6 w-6 rounded bg-slate-800"
                              >
                                <Minus className="h-3 w-3 mx-auto" />
                              </button>
                              <span className="w-6 text-center font-mono tabular">
                                {i.qty}
                              </span>
                              <button
                                onClick={() => changeDetailQty(i.menu_item_id, 1)}
                                className="h-6 w-6 rounded bg-slate-800"
                              >
                                <Plus className="h-3 w-3 mx-auto" />
                              </button>
                            </div>
                            <span className="ml-3 w-16 text-right font-mono tabular">
                              {formatEUR(i.price * i.qty)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs text-slate-500">
                            + {formatEUR(detailAddTotal)}
                          </span>
                          <Button
                            onClick={submitDetailItems}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold h-9"
                            data-testid="detail-submit-add"
                          >
                            Toevoegen
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              )}

              {/* Totals */}
              <section className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotaal</span>
                  <span className="font-mono tabular">
                    {formatEUR(detail.subtotal || detail.total + detail.discount)}
                  </span>
                </div>
                {detail.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span>Korting</span>
                    <span className="font-mono tabular">−{formatEUR(detail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-800">
                  <span className="text-xs uppercase tracking-widest text-slate-500">
                    Totaal
                  </span>
                  <span className="text-2xl font-mono tabular font-bold text-amber-400">
                    {formatEUR(detail.total)}
                  </span>
                </div>
              </section>

              <DialogFooter className="gap-2">
                {detail.status === "open" && (
                  <Button
                    onClick={() => markPaid(detail)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold"
                    data-testid="detail-pay-btn"
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Afrekenen
                  </Button>
                )}
                {canDelete && (
                  <Button
                    onClick={() => del(detail)}
                    variant="ghost"
                    className="text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Verwijderen
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===== Nieuwe bestelling formulier (uitgesneden POS) ===== */
function NewOrderForm({ menu, tables, promos, onCreated }) {
  const [selectedTable, setSelectedTable] = useState(null);
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState("");
  const [pickedPromos, setPickedPromos] = useState([]);
  const [busy, setBusy] = useState(false);

  const itemsForCat = useMemo(
    () => menu.filter((m) => m.category === cat),
    [menu, cat],
  );

  const addItem = (m) =>
    setCart((c) => {
      const ex = c.find((i) => i.menu_item_id === m.id);
      if (ex)
        return c.map((i) =>
          i.menu_item_id === m.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...c, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }];
    });

  const changeQty = (id, d) =>
    setCart((c) =>
      c
        .map((i) =>
          i.menu_item_id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i,
        )
        .filter((i) => i.qty > 0),
    );

  const togglePromo = (id) =>
    setPickedPromos((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  let discount = 0;
  pickedPromos.forEach((id) => {
    const p = promos.find((pp) => pp.id === id);
    if (!p) return;
    if (p.type === "order_percent") discount += subtotal * (p.value / 100);
    else {
      const ids = new Set(p.menu_item_ids || []);
      cart.forEach((i) => {
        if (!ids.has(i.menu_item_id)) return;
        if (p.type === "item_fixed") discount += p.value * i.qty;
        if (p.type === "item_percent") discount += i.price * i.qty * (p.value / 100);
      });
    }
  });
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
        promotion_ids: pickedPromos,
      });
      setCart([]);
      setNote("");
      setPickedPromos([]);
      setSelectedTable(null);
      onCreated?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-6">
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">
            Tafels
          </h2>
          <div className="flex flex-wrap gap-2">
            {tables.length === 0 && (
              <div className="text-sm text-slate-500">
                Geen tafels — voeg toe in Plattegrond
              </div>
            )}
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTable(t)}
                data-testid={`new-table-${t.name}`}
                className={`h-11 px-4 rounded-xl border text-sm font-medium ${
                  selectedTable?.id === t.id
                    ? "bg-amber-500 text-slate-950 border-amber-400"
                    : "bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-2">
            Categorieën
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                data-testid={`new-cat-${c}`}
                className={`h-9 px-3 rounded-full text-sm font-medium ${
                  cat === c
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {itemsForCat.map((m) => (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => addItem(m)}
                data-testid={`new-menu-${m.name}`}
                className="aspect-[5/4] p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left flex flex-col justify-between"
              >
                <div className="text-sm font-semibold leading-tight">{m.name}</div>
                <div className="font-mono tabular text-amber-400 font-semibold">
                  {formatEUR(m.price)}
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </div>

      <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 space-y-4 lg:self-start lg:sticky lg:top-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-amber-400" />
          <h3 className="font-semibold tracking-tight">Bestelling</h3>
          {selectedTable && (
            <button
              onClick={() => setSelectedTable(null)}
              className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40 text-xs"
            >
              {selectedTable.name} <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-1.5">
          {cart.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-500">
              Tik artikelen aan
            </div>
          )}
          {cart.map((i) => (
            <div
              key={i.menu_item_id}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center gap-2"
              data-testid={`new-cart-${i.name}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{i.name}</div>
                <div className="text-xs text-slate-500 font-mono tabular">
                  {formatEUR(i.price)} × {i.qty}
                </div>
              </div>
              <button
                onClick={() => changeQty(i.menu_item_id, -1)}
                className="h-6 w-6 rounded bg-slate-800"
              >
                <Minus className="h-3 w-3 mx-auto" />
              </button>
              <span className="w-5 text-center font-mono tabular text-sm">{i.qty}</span>
              <button
                onClick={() => changeQty(i.menu_item_id, 1)}
                className="h-6 w-6 rounded bg-slate-800"
              >
                <Plus className="h-3 w-3 mx-auto" />
              </button>
            </div>
          ))}
        </div>

        {promos.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1.5">
              Promoties
            </div>
            <div className="space-y-1">
              {promos.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={pickedPromos.includes(p.id)}
                    onChange={() => togglePromo(p.id)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm flex-1">{p.name}</span>
                  <span className="text-xs text-amber-400 font-mono">
                    {p.type === "order_percent"
                      ? `${p.value}%`
                      : p.type === "item_percent"
                      ? `${p.value}% items`
                      : formatEUR(p.value)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notitie (optioneel)"
          rows={2}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm resize-none"
        />

        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotaal</span>
            <span className="font-mono tabular text-slate-400">{formatEUR(subtotal)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">Korting</span>
            <span className="font-mono tabular text-emerald-400">−{formatEUR(discount)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-widest text-slate-500">Totaal</span>
          <span className="text-2xl font-mono tabular font-bold text-amber-400">
            {formatEUR(total)}
          </span>
        </div>
        <Button
          onClick={submit}
          disabled={busy || cart.length === 0}
          className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold disabled:opacity-50"
          data-testid="new-submit-btn"
        >
          {busy ? "Bezig…" : "Bestelling plaatsen"}
        </Button>
      </aside>
    </div>
  );
}
