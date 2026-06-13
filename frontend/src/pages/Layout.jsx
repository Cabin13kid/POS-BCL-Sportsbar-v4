import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Beer,
  LayoutGrid,
  ClipboardList,
  Package,
  BookOpen,
  Map,
  LogOut,
  Users as UsersIcon,
  Tag,
  Shield,
  Menu as MenuIcon,
  X,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutGrid, label: "Dashboard", roles: ["admin", "manager", "werknemer"], end: true },
  { to: "/orders", icon: ClipboardList, label: "Bestellingen", roles: ["admin", "manager", "werknemer"] },
  { to: "/floorplan", icon: Map, label: "Plattegrond", roles: ["admin", "manager"] },
  { to: "/menu", icon: BookOpen, label: "Menu", roles: ["admin", "manager"] },
  { to: "/inventory", icon: Package, label: "Voorraad", roles: ["admin", "manager"] },
  { to: "/promotions", icon: Tag, label: "Promoties", roles: ["admin"] },
  { to: "/users", icon: UsersIcon, label: "Gebruikers", roles: ["admin"] },
];

const ROLE_BADGE = {
  admin: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  manager: "bg-sky-500/15 text-sky-400 border-sky-500/40",
  werknemer: "bg-slate-700/40 text-slate-300 border-slate-600",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || "werknemer";
  const visible = NAV.filter((n) => n.roles.includes(role));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const currentLabel = visible.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label || "Dashboard";

  const SidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-500 flex items-center justify-center">
          <Beer className="h-4 w-4 text-slate-950" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold tracking-tight truncate">BARTRACK BCL</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            ops dashboard
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden h-8 w-8 rounded-md text-slate-400 hover:text-slate-50 hover:bg-slate-800/60"
          data-testid="close-mobile-nav"
        >
          <X className="h-4 w-4 mx-auto" />
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto scrollbar-thin">
        {visible.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={`nav-${n.label.toLowerCase()}`}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-50 hover:bg-slate-800/60 border border-transparent"
              }`
            }
          >
            <n.icon className="h-4 w-4 shrink-0" />
            <span className="font-medium">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2 text-xs">
          <div className="text-slate-500">Ingelogd als</div>
          <div className="text-slate-200 truncate" data-testid="current-user">{user?.email}</div>
          <span
            className={`mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_BADGE[role] || ROLE_BADGE.werknemer}`}
            data-testid="current-role"
          >
            <Shield className="h-3 w-3" /> {role}
          </span>
        </div>
        <button
          onClick={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
          className="mt-1 w-full flex items-center gap-2 text-sm text-slate-400 hover:text-rose-400 px-3 py-2 rounded-lg hover:bg-rose-500/10 transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-slate-800 bg-slate-900/40 flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="h-9 w-9 rounded-md hover:bg-slate-800/60 flex items-center justify-center"
          data-testid="open-mobile-nav"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-md bg-amber-500 flex items-center justify-center">
          <Beer className="h-4 w-4 text-slate-950" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 leading-none">
            BARTRACK BCL
          </div>
          <div className="text-sm font-semibold tracking-tight truncate">
            {currentLabel}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col animate-in slide-in-from-left"
          >
            {SidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
