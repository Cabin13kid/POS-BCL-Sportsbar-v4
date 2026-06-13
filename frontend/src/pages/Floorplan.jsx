import React, { useEffect, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Move } from "lucide-react";
import { motion } from "framer-motion";

const CANVAS_W = 900;
const CANVAS_H = 560;

export default function Floorplan() {
  const [tables, setTables] = useState([]);
  const [tab, setTab] = useState("canvas");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", seats: 4 });
  const canvasRef = useRef(null);

  const load = async () => {
    const r = await api.get("/tables");
    setTables(r.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", seats: 4 });
    setOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, seats: t.seats });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/tables/${editing.id}`, {
          name: form.name,
          seats: Number(form.seats),
          x: editing.x,
          y: editing.y,
        });
        toast.success("Tafel bijgewerkt");
      } else {
        await api.post("/tables", {
          name: form.name,
          seats: Number(form.seats),
          x: 80,
          y: 80,
        });
        toast.success("Tafel toegevoegd");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Verwijder ${t.name}?`)) return;
    await api.delete(`/tables/${t.id}`);
    toast.success("Tafel verwijderd");
    load();
  };

  const onDragEnd = async (t, info) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(CANVAS_W - 110, t.x + info.offset.x));
    const newY = Math.max(0, Math.min(CANVAS_H - 110, t.y + info.offset.y));
    setTables((curr) =>
      curr.map((it) => (it.id === t.id ? { ...it, x: newX, y: newY } : it)),
    );
    try {
      await api.put(`/tables/${t.id}`, {
        name: t.name,
        seats: t.seats,
        x: newX,
        y: newY,
      });
    } catch (e) {
      toast.error("Opslaan positie mislukt");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plattegrond</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Sleep tafels op het canvas of bewerk in de lijst
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-slate-900 border border-slate-800 p-1">
            {["canvas", "lijst"].map((v) => (
              <button
                key={v}
                onClick={() => setTab(v)}
                data-testid={`tab-${v}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                  tab === v
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            data-testid="add-table-btn"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Tafel
          </Button>
        </div>
      </div>

      {tab === "canvas" && (
        <div className="overflow-x-auto scrollbar-thin -mx-4 sm:mx-0 px-4 sm:px-0">
        <div
          ref={canvasRef}
          className="floorplan-grid relative rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden"
          style={{ width: CANVAS_W, height: CANVAS_H }}
          data-testid="floorplan-canvas"
        >
          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <Move className="h-8 w-8 mb-2" />
              <p className="text-sm">Geen tafels — voeg er één toe.</p>
            </div>
          )}
          {tables.map((t) => (
            <motion.div
              key={t.id}
              drag
              dragMomentum={false}
              dragConstraints={canvasRef}
              onDragEnd={(_, info) => onDragEnd(t, info)}
              initial={false}
              animate={{ x: t.x, y: t.y }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="absolute h-24 w-24 rounded-2xl bg-slate-900 border border-slate-700 hover:border-amber-500 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center select-none shadow-lg"
              style={{ touchAction: "none" }}
              data-testid={`floorplan-table-${t.name}`}
            >
              <div className="text-sm font-semibold text-slate-100">{t.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {t.seats} plekken
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(t);
                }}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </div>
        </div>
      )}

      {tab === "lijst" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-3 font-medium">Naam</th>
                <th className="text-right p-3 font-medium">Plekken</th>
                <th className="text-right p-3 font-medium">Positie</th>
                <th className="text-right p-3 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    Geen tafels
                  </td>
                </tr>
              )}
              {tables.map((t) => (
                <tr key={t.id} className="border-t border-slate-800" data-testid={`row-table-${t.name}`}>
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3 text-right font-mono tabular">{t.seats}</td>
                  <td className="p-3 text-right font-mono tabular text-slate-500">
                    {Math.round(t.x)}, {Math.round(t.y)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openEdit(t)}
                      className="text-slate-400 hover:text-amber-400 p-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(t)}
                      className="text-slate-400 hover:text-rose-400 p-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle>{editing ? "Tafel bewerken" : "Nieuwe tafel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Naam</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tafel 1"
                className="bg-slate-950 border-slate-800"
                data-testid="table-name-input"
              />
            </div>
            <div>
              <Label>Aantal plekken</Label>
              <Input
                type="number"
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })}
                className="bg-slate-950 border-slate-800"
                data-testid="table-seats-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button
                variant="ghost"
                onClick={() => {
                  remove(editing);
                  setOpen(false);
                }}
                className="text-rose-400 hover:bg-rose-500/10"
              >
                Verwijderen
              </Button>
            )}
            <Button
              onClick={save}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              data-testid="save-table-btn"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
