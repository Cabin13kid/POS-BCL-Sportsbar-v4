import React, { useEffect, useState } from "react";
import { api, formatEUR, formatApiErrorDetail } from "@/lib/api";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Tag, Percent } from "lucide-react";

const emptyForm = {
  name: "",
  type: "order_percent",
  value: 10,
  menu_item_ids: [],
  active: true,
  starts_at: "",
  ends_at: "",
};

export default function Promotions() {
  const [promos, setPromos] = useState([]);
  const [menu, setMenu] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [p, m] = await Promise.all([api.get("/promotions"), api.get("/menu")]);
    setPromos(p.data);
    setMenu(m.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      value: p.value,
      menu_item_ids: p.menu_item_ids || [],
      active: p.active,
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        name: form.name,
        type: form.type,
        value: Number(form.value),
        menu_item_ids: form.type === "item_fixed" ? form.menu_item_ids : [],
        active: form.active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      if (editing) await api.put(`/promotions/${editing.id}`, payload);
      else await api.post("/promotions", payload);
      toast.success(editing ? "Promotie bijgewerkt" : "Promotie aangemaakt");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Verwijder promotie "${p.name}"?`)) return;
    await api.delete(`/promotions/${p.id}`);
    toast.success("Verwijderd");
    load();
  };

  const toggleItem = (id) =>
    setForm((f) => ({
      ...f,
      menu_item_ids: f.menu_item_ids.includes(id)
        ? f.menu_item_ids.filter((x) => x !== id)
        : [...f.menu_item_ids, id],
    }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promoties</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            % korting over bestelling of vaste korting per item — met tijdsperiode
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          data-testid="add-promo-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Promotie
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {promos.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            Nog geen promoties.
          </div>
        )}
        {promos.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border p-5 ${
              p.active
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-slate-800 bg-slate-900/40"
            }`}
            data-testid={`promo-card-${p.name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {p.type === "order_percent" ? (
                  <Percent className="h-4 w-4 text-amber-400" />
                ) : (
                  <Tag className="h-4 w-4 text-amber-400" />
                )}
                <h3 className="font-semibold tracking-tight">{p.name}</h3>
              </div>
              <span
                className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                  p.active
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                    : "bg-slate-800 text-slate-500 border-slate-700"
                }`}
              >
                {p.active ? "Actief" : "Inactief"}
              </span>
            </div>

            <div className="mt-4 text-3xl font-mono tabular font-bold text-amber-400">
              {p.type === "order_percent"
                ? `${p.value}%`
                : formatEUR(p.value)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {p.type === "order_percent"
                ? "korting over hele bestelling"
                : `vaste korting per item (${p.menu_item_ids.length} items)`}
            </p>

            {(p.starts_at || p.ends_at) && (
              <p className="mt-3 text-xs text-slate-500 font-mono">
                {p.starts_at
                  ? new Date(p.starts_at).toLocaleString("nl-NL")
                  : "—"}
                {" → "}
                {p.ends_at ? new Date(p.ends_at).toLocaleString("nl-NL") : "—"}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => openEdit(p)}
                className="flex-1 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium"
              >
                <Pencil className="h-3.5 w-3.5 inline mr-1" /> Bewerken
              </button>
              <button
                onClick={() => remove(p)}
                className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Promotie bewerken" : "Nieuwe promotie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Naam</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="bv. Happy Hour"
                className="bg-slate-950 border-slate-800"
                data-testid="promo-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800" data-testid="promo-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                    <SelectItem value="order_percent">% over bestelling</SelectItem>
                    <SelectItem value="item_fixed">€ vast per item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.type === "order_percent" ? "Percentage" : "Bedrag (€)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="bg-slate-950 border-slate-800 font-mono"
                  data-testid="promo-value-input"
                />
              </div>
            </div>

            {form.type === "item_fixed" && (
              <div>
                <Label>Geldig voor items</Label>
                <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 scrollbar-thin">
                  {menu.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-900 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.menu_item_ids.includes(m.id)}
                        onChange={() => toggleItem(m.id)}
                        className="accent-amber-500"
                      />
                      <span className="text-sm flex-1">{m.name}</span>
                      <span className="text-xs text-slate-500">{m.category}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start (optioneel)</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div>
                <Label>Eind (optioneel)</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950">
              <div>
                <div className="text-sm font-medium">Actief</div>
                <div className="text-xs text-slate-500">
                  Inactieve promoties zijn niet toepasbaar
                </div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
                data-testid="promo-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={save}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              data-testid="save-promo-btn"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
