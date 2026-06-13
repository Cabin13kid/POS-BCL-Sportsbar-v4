import React, { useEffect, useState } from "react";
import { api, formatEUR, CATEGORIES, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Link2 } from "lucide-react";

const emptyForm = {
  name: "",
  category: CATEGORIES[0],
  price: 0,
  inventory_id: "__none__",
};

export default function MenuManagement() {
  const [items, setItems] = useState([]);
  const [inv, setInv] = useState([]);
  const [filter, setFilter] = useState("Alle");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [m, i] = await Promise.all([api.get("/menu"), api.get("/inventory")]);
    setItems(m.data);
    setInv(i.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    setForm({
      name: it.name,
      category: it.category,
      price: it.price,
      inventory_id: it.inventory_id || "__none__",
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        inventory_id: form.inventory_id === "__none__" ? null : form.inventory_id,
      };
      if (editing) await api.put(`/menu/${editing.id}`, payload);
      else await api.post("/menu", payload);
      toast.success(editing ? "Menu item bijgewerkt" : "Menu item toegevoegd");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (it) => {
    if (!window.confirm(`Verwijder ${it.name}?`)) return;
    await api.delete(`/menu/${it.id}`);
    toast.success("Verwijderd");
    load();
  };

  const filtered =
    filter === "Alle" ? items : items.filter((i) => i.category === filter);
  const invMap = Object.fromEntries(inv.map((i) => [i.id, i]));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Beheer artikelen en koppel aan voorraad
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          data-testid="add-menu-item-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Menu item
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["Alle", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            data-testid={`menu-filter-${c}`}
            className={`h-9 px-3 rounded-full text-sm font-medium transition-colors ${
              filter === c
                ? "bg-amber-500 text-slate-950"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-3 font-medium">Naam</th>
              <th className="text-left p-3 font-medium">Categorie</th>
              <th className="text-right p-3 font-medium">Prijs</th>
              <th className="text-left p-3 font-medium">Voorraad-koppeling</th>
              <th className="text-right p-3 font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Geen artikelen
                </td>
              </tr>
            )}
            {filtered.map((it) => {
              const linked = it.inventory_id ? invMap[it.inventory_id] : null;
              return (
                <tr
                  key={it.id}
                  className="border-t border-slate-800 hover:bg-slate-900/50"
                  data-testid={`menu-row-${it.name}`}
                >
                  <td className="p-3 font-medium">{it.name}</td>
                  <td className="p-3 text-slate-400">{it.category}</td>
                  <td className="p-3 text-right font-mono tabular text-amber-400">
                    {formatEUR(it.price)}
                  </td>
                  <td className="p-3 text-slate-400">
                    {linked ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <Link2 className="h-3.5 w-3.5" />
                        {linked.name}
                      </span>
                    ) : (
                      <span className="text-slate-600">— geen —</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => openEdit(it)} className="p-1.5 text-slate-400 hover:text-amber-400">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(it)} className="p-1.5 text-slate-400 hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle>{editing ? "Menu item bewerken" : "Nieuw menu item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Naam</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-slate-950 border-slate-800"
                data-testid="menu-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categorie</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800" data-testid="menu-category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prijs (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="bg-slate-950 border-slate-800 font-mono"
                  data-testid="menu-price-input"
                />
              </div>
            </div>
            <div>
              <Label>Koppel aan voorraad item</Label>
              <Select
                value={form.inventory_id}
                onValueChange={(v) => setForm({ ...form, inventory_id: v })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800" data-testid="menu-inv-select">
                  <SelectValue placeholder="Geen" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-50 max-h-72">
                  <SelectItem value="__none__">— Geen koppeling —</SelectItem>
                  {inv.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={save}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              data-testid="save-menu-btn"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
