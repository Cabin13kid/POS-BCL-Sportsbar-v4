import React, { useEffect, useState } from "react";
import { api, formatEUR, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Euro,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  StickyNote,
  Plus,
  Trash2,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    revenue: 0,
    open_count: 0,
    paid_count: 0,
    low_stock: [],
  });
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");

  const load = async () => {
    const [s, n] = await Promise.all([
      api.get("/stats/today"),
      api.get("/shift-notes"),
    ]);
    setStats(s.data);
    setNotes(n.data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post("/shift-notes", { text: newNote.trim() });
      setNewNote("");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const delNote = async (id) => {
    await api.delete(`/shift-notes/${id}`);
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Live overzicht van de avond
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          icon={Euro}
          label="Omzet vandaag"
          value={formatEUR(stats.revenue)}
          accent
          testid="kpi-revenue"
        />
        <Kpi
          icon={ClipboardList}
          label="Open bestellingen"
          value={stats.open_count}
          testid="kpi-open"
        />
        <Kpi
          icon={CheckCircle2}
          label="Afgerond"
          value={stats.paid_count}
          testid="kpi-paid"
        />
        <Kpi
          icon={AlertTriangle}
          label="Voorraad alarm"
          value={stats.low_stock.length}
          warning={stats.low_stock.length > 0}
          testid="kpi-lowstock"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Low stock list */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold tracking-tight">
              Voorraad alarm
              <span className="ml-2 text-xs font-mono tabular text-slate-500">
                ({stats.low_stock.length})
              </span>
            </h2>
          </div>
          <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
            {stats.low_stock.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                Alle voorraad op niveau ✓
              </div>
            )}
            {stats.low_stock.map((s) => {
              const critical = s.total_available <= 0;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 last:border-b-0"
                  data-testid={`lowstock-row-${s.name}`}
                >
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.category}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-mono tabular text-lg font-bold ${
                        critical ? "text-rose-400" : "text-amber-400"
                      }`}
                    >
                      {s.total_available}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">
                      {s.loose_units} los · {s.trays_in_storage} trays
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Shift notes */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold tracking-tight">Shift notities</h2>
          </div>
          <div className="p-4 border-b border-slate-800 flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="bv. Tap 3 lekt — monteur gebeld"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
              data-testid="shiftnote-input"
            />
            <button
              onClick={addNote}
              data-testid="shiftnote-add-btn"
              className="h-10 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Plak
            </button>
          </div>
          <div className="flex-1 max-h-[300px] overflow-y-auto scrollbar-thin">
            {notes.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                Nog geen notities. Plak hierboven je eerste shift notitie.
              </div>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className="px-5 py-3 border-b border-slate-800/60 last:border-b-0 group"
                data-testid={`shiftnote-${n.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-100 leading-relaxed">{n.text}</p>
                  <button
                    onClick={() => delNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1.5">
                  {n.author_email} · {new Date(n.created_at).toLocaleString("nl-NL")}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="text-xs text-slate-500">
        Ingelogd als <span className="text-slate-300">{user?.email}</span> · gegevens vernieuwen elke 8s
      </div>
    </div>
  );
}

const Kpi = ({ icon: Icon, label, value, accent, warning, testid }) => (
  <div
    className={`rounded-2xl border p-3 sm:p-5 ${
      warning
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-slate-800 bg-slate-900/40"
    }`}
    data-testid={testid}
  >
    <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-widest text-slate-500">
      <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
    </div>
    <div
      className={`mt-1.5 sm:mt-2 font-mono tabular text-xl sm:text-3xl font-bold ${
        accent ? "text-amber-400" : warning ? "text-amber-400" : "text-slate-100"
      }`}
    >
      {value}
    </div>
  </div>
);
