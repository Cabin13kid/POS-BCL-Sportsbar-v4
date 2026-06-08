import React, { useEffect, useMemo, useState } from "react";
import { api, formatEUR, CATEGORIES, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Check, Trash2, Plus, Minus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Orders() {
  const { user } = useAuth();
  const role = user?.role;
  const canDelete = role === "admin" || role === "manager";

  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("open");
  const [menu, setMenu] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addOrder, setAddOrder] = useState(null);
  const [addCat, setAddCat] = useState(CATEGORIES[0]);
  const [addCart, setAddCart] = useState([]);

  const load = async () => {
    const r = await api.get(`/orders?status=${tab}`);
    setOrders(r.data);
  };

  useEffect(() => {
    api.get("/menu").then((r) => setMenu(r.data));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const markPaid = async (o) => {
    await api.post(`/orders/${o.id}/pay`);
    toast.success("Bestelling afgerekend");
    load();
  };

  const del = async (o) => {
    if (!window.confirm("Bestelling verwijderen?")) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast.success("Verwijderd");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const openAdd = (o) => {
    setAddOrder(o);
    setAddCart([]);
    setAddCat(CATEGORIES[0]);
    setAddOpen(true);
  };

  const addItemToCart = (m) =>
    setAddCart((c) => {
      const ex = c.find((i) => i.menu_item_id === m.id);
      if (ex)
        return c.map((i) =>
          i.menu_item_id === m.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...c, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }];
    });

  const changeQty = (id, d) =>
    setAddCart((c) =>
      c
        .map((i) =>
          i.menu_item_id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i,
        )
        .filter((i) => i.qty > 0),
    );

  const submitAdd = async () => {
    if (addCart.length === 0) {
      toast.error("Selecteer items om toe te voegen");
      return;
    }
    try {
      await api.post(`/orders/${addOrder.id}/items`, { items: addCart });
      toast.success("Items toegevoegd");
      setAddOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const itemsForCat = useMemo(
    () => menu.filter((m) => m.category === addCat),
    [menu, addCat],
  );
  const addTotal = addCart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bestellingen</h1>
          <p className="text-sm text-slate-400 mt-0.5">Open + betaalde bestellingen, items toevoegen aan open</p>
        </div>
        <div className="inline-flex rounded-full bg-slate-900 border border-slate-800 p-1">
          {[
            { v: "open", l: "Open" },
            { v: "paid", l: "Betaald" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setTab(o.v)}
              data-testid={`orders-tab-${o.v}`}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            Geen {tab === "open" ? "openstaande" : "afgeronde"} bestellingen.
          </div>
        )}
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
            data-testid={`order-card-${o.id}`}
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

            <ul className="mt-4 space-y-1">
              {o.items.map((it, idx) => (
                <li
                  key={idx}
                  className="flex justify-between text-sm border-b border-slate-800/60 py-1.5"
                >
                  <span>
                    <span className="font-mono tabular text-slate-500 mr-2">
                      {it.qty}×
                    </span>
                    {it.name}
                  </span>
                  <span className="font-mono tabular text-slate-300">
                    {formatEUR(it.price * it.qty)}
                  </span>
                </li>
              ))}
            </ul>

            {o.note && (
              <div className="mt-3 text-xs text-slate-400 bg-slate-950 rounded-md p-2 border border-slate-800">
                {o.note}
              </div>
            )}

            {o.discount > 0 && (
              <div className="flex items-baseline justify-between mt-3 text-sm">
                <span className="text-emerald-400">Korting</span>
                <span className="font-mono tabular text-emerald-400">−{formatEUR(o.discount)}</span>
              </div>
            )}
            <div className="flex items-end justify-between mt-4">
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Totaal
              </span>
              <span className="text-2xl font-mono tabular font-bold text-amber-400">
                {formatEUR(o.total)}
              </span>
            </div>

            <div className="flex gap-2 mt-4">
              {o.status === "open" && (
                <>
                  <button
                    onClick={() => openAdd(o)}
                    data-testid={`add-items-${o.id}`}
                    className="h-10 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Items
                  </button>
                  <button
                    onClick={() => markPaid(o)}
                    data-testid={`pay-order-${o.id}`}
                    className="flex-1 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold text-sm flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4" /> Afrekenen
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  onClick={() => del(o)}
                  className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Items toevoegen aan {addOrder?.table_name || "Bar"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setAddCat(c)}
                className={`h-9 px-3 rounded-full text-sm font-medium transition-colors ${
                  addCat === c
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto scrollbar-thin">
            {itemsForCat.map((m) => (
              <button
                key={m.id}
                onClick={() => addItemToCart(m)}
                data-testid={`add-menu-${m.name}`}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-left"
              >
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs font-mono tabular text-amber-400">{formatEUR(m.price)}</div>
              </button>
            ))}
          </div>

          {addCart.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-slate-800">
              {addCart.map((i) => (
                <div
                  key={i.menu_item_id}
                  className="flex items-center justify-between text-sm bg-slate-950 rounded-lg px-3 py-2"
                >
                  <span className="flex-1 truncate">{i.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(i.menu_item_id, -1)} className="h-6 w-6 rounded bg-slate-800">
                      <Minus className="h-3 w-3 mx-auto" />
                    </button>
                    <span className="w-6 text-center font-mono tabular">{i.qty}</span>
                    <button onClick={() => changeQty(i.menu_item_id, 1)} className="h-6 w-6 rounded bg-slate-800">
                      <Plus className="h-3 w-3 mx-auto" />
                    </button>
                  </div>
                  <span className="ml-3 font-mono tabular w-16 text-right text-slate-300">
                    {formatEUR(i.price * i.qty)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-sm">
                <span className="text-slate-500">Toe te voegen</span>
                <span className="font-mono tabular text-amber-400 font-semibold">
                  {formatEUR(addTotal)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={submitAdd}
              disabled={addCart.length === 0}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold disabled:opacity-50"
              data-testid="submit-add-items-btn"
            >
              Toevoegen aan bestelling
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
