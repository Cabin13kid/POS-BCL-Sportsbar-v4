import React, { useEffect, useMemo, useState } from "react";
import { api, CATEGORIES, formatApiErrorDetail } from "@/lib/api";
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
import { Plus, Pencil, Trash2, Package, Layers, Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const emptyForm = {
  name: "",
  category: CATEGORIES[0],
  loose_units: 0,
  trays_in_storage: 0,
  units_per_tray: 0,
  alarm_enabled: true,
  alarm_threshold: 6,
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("Alle");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const r = await api.get("/inventory");
    setItems(r.data);
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
      loose_units: it.loose_units,
      trays_in_storage: it.trays_in_storage,
      units_per_tray: it.units_per_tray,
      alarm_enabled: it.alarm_enabled ?? true,
      alarm_threshold: it.alarm_threshold ?? 6,
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        name: form.name,
        category: form.category,
        loose_units: Number(form.loose_units),
        trays_in_storage: Number(form.trays_in_storage),
        units_per_tray: Number(form.units_per_tray),
        alarm_enabled: !!form.alarm_enabled,
        alarm_threshold: Number(form.alarm_threshold) || 0,
      };
      if (editing) await api.put(`/inventory/${editing.id}`, payload);
      else await api.post("/inventory", payload);
      toast.success(editing ? "Voorraad bijgewerkt" : "Voorraad item toegevoegd");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const toggleAlarm = async (it) => {
    try {
      await api.put(`/inventory/${it.id}`, {
        name: it.name,
        category: it.category,
        loose_units: it.loose_units,
        trays_in_storage: it.trays_in_storage,
        units_per_tray: it.units_per_tray,
        alarm_enabled: !it.alarm_enabled,
        alarm_threshold: it.alarm_threshold ?? 6,
      });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (it) => {
    if (!window.confirm(`Verwijder ${it.name}?`)) return;
    await api.delete(`/inventory/${it.id}`);
    toast.success("Verwijderd");
    load();
  };

  const filtered =
    filter === "Alle" ? items : items.filter((i) => i.category === filter);

  const totals = useMemo(() => {
    let loose = 0,
      trays = 0,
      totalUnits = 0;
    items.forEach((i) => {
      loose += i.loose_units;
      trays += i.trays_in_storage;
      totalUnits += i.loose_units + i.trays_in_storage * i.units_per_tray;
    });
    return { loose, trays, totalUnits };
  }, [items]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voorraad</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Losse units, trays en voorraadkoppeling
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          data-testid="add-inv-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Voorraad item
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard label="Losse units" value={totals.loose} icon={Package} />
        <SummaryCard label="Trays in opslag" value={totals.trays} icon={Layers} />
        <SummaryCard label="Totaal beschikbaar" value={totals.totalUnits} accent />
      </div>

      <div className="flex flex-wrap gap-2">
        {["Alle", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            data-testid={`inv-filter-${c}`}
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
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-3 font-medium">Naam</th>
              <th className="text-left p-3 font-medium">Categorie</th>
              <th className="text-right p-3 font-medium">Losse units</th>
              <th className="text-right p-3 font-medium">Trays</th>
              <th className="text-right p-3 font-medium">Units/tray</th>
              <th className="text-right p-3 font-medium">Totaal</th>
              <th className="text-right p-3 font-medium">Alarm</th>
              <th className="text-right p-3 font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500">
                  Geen voorraad items
                </td>
              </tr>
            )}
            {filtered.map((it) => {
              const total = it.loose_units + it.trays_in_storage * it.units_per_tray;
              const threshold = it.alarm_threshold ?? 6;
              const alarmOn = it.alarm_enabled ?? true;
              const triggered = alarmOn && total < threshold;
              return (
                <tr
                  key={it.id}
                  className="border-t border-slate-800 hover:bg-slate-900/60"
                  data-testid={`inv-row-${it.name}`}
                >
                  <td className="p-3 font-medium">{it.name}</td>
                  <td className="p-3 text-slate-400">{it.category}</td>
                  <td className="p-3 text-right font-mono tabular">{it.loose_units}</td>
                  <td className="p-3 text-right font-mono tabular">{it.trays_in_storage}</td>
                  <td className="p-3 text-right font-mono tabular text-slate-500">
                    {it.units_per_tray}
                  </td>
                  <td
                    className={`p-3 text-right font-mono tabular font-semibold ${
                      triggered ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {total}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => toggleAlarm(it)}
                      data-testid={`alarm-toggle-${it.name}`}
                      title={alarmOn ? `Alarm aan (< ${threshold})` : "Alarm uit"}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-colors ${
                        alarmOn
                          ? triggered
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/40"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      {alarmOn ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                      <span className="font-mono tabular">&lt;{threshold}</span>
                    </button>
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
            <DialogTitle>
              {editing ? "Voorraad bewerken" : "Nieuw voorraad item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Naam</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-slate-950 border-slate-800"
                data-testid="inv-name-input"
              />
            </div>
            <div>
              <Label>Categorie</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800" data-testid="inv-category-select">
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
            <div className="grid grid-cols-3 gap-3">
              <NumField
                label="Losse units"
                value={form.loose_units}
                onChange={(v) => setForm({ ...form, loose_units: v })}
                test="inv-loose-input"
              />
              <NumField
                label="Trays in opslag"
                value={form.trays_in_storage}
                onChange={(v) => setForm({ ...form, trays_in_storage: v })}
                test="inv-trays-input"
              />
              <NumField
                label="Units per tray"
                value={form.units_per_tray}
                onChange={(v) => setForm({ ...form, units_per_tray: v })}
                test="inv-per-tray-input"
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trays worden los van losse units bijgehouden. Bij bestellen wordt eerst van losse units afgehaald; als deze op zijn wordt automatisch een tray omgezet.
            </p>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {form.alarm_enabled ? (
                      <Bell className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <BellOff className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    Voorraad alarm
                  </div>
                  <div className="text-xs text-slate-500">
                    Verschijnt op Dashboard onder "Voorraad alarm"
                  </div>
                </div>
                <Switch
                  checked={!!form.alarm_enabled}
                  onCheckedChange={(v) => setForm({ ...form, alarm_enabled: v })}
                  data-testid="alarm-enabled-switch"
                />
              </div>
              {form.alarm_enabled && (
                <div>
                  <Label className="text-xs text-slate-400">Alarmdrempel (totaal &lt;)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.alarm_threshold}
                    onChange={(e) => setForm({ ...form, alarm_threshold: e.target.value })}
                    className="mt-1 bg-slate-900 border-slate-800 font-mono"
                    data-testid="alarm-threshold-input"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={save}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              data-testid="save-inv-btn"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const NumField = ({ label, value, onChange, test }) => (
  <div>
    <Label>{label}</Label>
    <Input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-slate-950 border-slate-800 font-mono"
      data-testid={test}
    />
  </div>
);

const SummaryCard = ({ label, value, icon: Icon, accent }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </div>
    <div
      className={`mt-2 font-mono tabular text-3xl font-bold ${
        accent ? "text-amber-400" : "text-slate-100"
      }`}
    >
      {value}
    </div>
  </div>
);
