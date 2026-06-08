import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Layout from "@/pages/Layout";
import POS from "@/pages/POS";
import Orders from "@/pages/Orders";
import Floorplan from "@/pages/Floorplan";
import MenuManagement from "@/pages/MenuManagement";
import Inventory from "@/pages/Inventory";
import Users from "@/pages/Users";
import Promotions from "@/pages/Promotions";

const Protected = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-500">
        Laden…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 gap-2">
        <div className="text-2xl font-semibold text-rose-400">Geen toegang</div>
        <div className="text-sm text-slate-500">Je hebt geen rechten voor deze pagina.</div>
      </div>
    );
  return children;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "rgb(15 23 42)",
                color: "rgb(248 250 252)",
                border: "1px solid rgb(30 41 59)",
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route path="/" element={<POS />} />
              <Route path="/orders" element={<Orders />} />
              <Route
                path="/floorplan"
                element={
                  <Protected roles={["admin", "manager"]}>
                    <Floorplan />
                  </Protected>
                }
              />
              <Route
                path="/menu"
                element={
                  <Protected roles={["admin", "manager"]}>
                    <MenuManagement />
                  </Protected>
                }
              />
              <Route
                path="/inventory"
                element={
                  <Protected roles={["admin", "manager"]}>
                    <Inventory />
                  </Protected>
                }
              />
              <Route
                path="/promotions"
                element={
                  <Protected roles={["admin"]}>
                    <Promotions />
                  </Protected>
                }
              />
              <Route
                path="/users"
                element={
                  <Protected roles={["admin"]}>
                    <Users />
                  </Protected>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
