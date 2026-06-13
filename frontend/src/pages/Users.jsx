import React, { useEffect, useState } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

const ROLES = [
  { v: "admin", label: "Admin", desc: "Volledige toegang inclusief gebruikers & promoties" },
  { v: "manager", label: "Manager", desc: "Beheert menu, voorraad, plattegrond — geen gebruikers" },
  { v: "werknemer", label: "Werknemer", desc: "POS, items toevoegen, afrekenen" },
];

const roleBadge = (r) => {
  const map = {
    admin: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    manager: "bg-sky-500/15 text-sky-400 border-sky-500/40",
    werknemer: "bg-slate-700/40 text-slate-300 border-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${map[r] || map.werknemer}`}
    >
      <Shield className="h-3 w-3" /> {r}
    </span>
  );
};

const emptyForm = { email: "", name: "", username: "", role: "werknemer", password: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const r = await api.get("/users");
    setUsers(r.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ email: u.email, name: u.name, username: u.username || "", role: u.role, password: "" });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        const upd = { name: form.name, role: form.role, username: form.username };
        if (form.password) upd.password = form.password;
        await api.put(`/users/${editing.id}`, upd);
        toast.success("Gebruiker bijgewerkt");
      } else {
        if (!form.password || form.password.length < 4) {
          toast.error("Wachtwoord min. 4 tekens");
          return;
        }
        await api.post("/users", form);
        toast.success("Gebruiker aangemaakt");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Verwijder ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Verwijderd");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gebruikers</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Beheer werknemers en rollen
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          data-testid="add-user-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Gebruiker
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ROLES.map((r) => (
          <div key={r.v} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between">
              {roleBadge(r.v)}
              <span className="text-xs font-mono tabular text-slate-500">
                {users.filter((u) => u.role === r.v).length}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-3 font-medium">Naam</th>
              <th className="text-left p-3 font-medium">Gebruikersnaam</th>
              <th className="text-left p-3 font-medium">E-mail</th>
              <th className="text-left p-3 font-medium">Rol</th>
              <th className="text-right p-3 font-medium">Acties</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-800" data-testid={`user-row-${u.email}`}>
                <td className="p-3 font-medium">{u.name || "—"}</td>
                <td className="p-3 text-slate-400 font-mono text-xs">{u.username || <span className="text-slate-600">—</span>}</td>
                <td className="p-3 text-slate-300">{u.email}</td>
                <td className="p-3">{roleBadge(u.role)}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-amber-400">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(u)} className="p-1.5 text-slate-400 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle>{editing ? "Gebruiker bewerken" : "Nieuwe gebruiker"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                disabled={!!editing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-slate-950 border-slate-800 disabled:opacity-60"
                data-testid="user-email-input"
              />
            </div>
            <div>
              <Label>Naam</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-slate-950 border-slate-800"
                data-testid="user-name-input"
              />
            </div>
            <div>
              <Label>Gebruikersnaam (optioneel — login met e-mail of gebruikersnaam)</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="bv. jan"
                className="bg-slate-950 border-slate-800 font-mono"
                data-testid="user-username-input"
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800" data-testid="user-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                  {ROLES.map((r) => (
                    <SelectItem key={r.v} value={r.v}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{editing ? "Nieuw wachtwoord (laat leeg om te behouden)" : "Wachtwoord"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-slate-950 border-slate-800"
                data-testid="user-password-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={save}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              data-testid="save-user-btn"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
