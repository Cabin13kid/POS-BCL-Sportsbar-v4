import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Beer } from "lucide-react";

const LOGIN_BG =
  "https://static.prod-images.emergentagent.com/jobs/501e447e-ce3c-433e-bb5d-f0d7f8030277/images/37575875f9d7e98ca44ef63f36c2a87d758d4b4d19b55f302c968db9bad02f3c.png";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@bar.nl");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-slate-950">
      <div
        className="hidden lg:block relative"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(2,6,23,0.55), rgba(2,6,23,0.85)), url(${LOGIN_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Beer className="h-5 w-5 text-slate-950" />
            </div>
            <span className="text-slate-50 font-semibold tracking-wide">BARTRACK BCL</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-5xl xl:text-6xl text-slate-50 font-bold tracking-tight leading-[1.05]">
              Bestellingen.<br />Voorraad.<br />
              <span className="text-amber-500">Zonder gedoe.</span>
            </h1>
            <p className="mt-6 text-slate-300 text-base max-w-sm">
              Tap een tafel, sleep menu items en houd je voorraad bij — inclusief trays en losse units.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-7"
          data-testid="login-form"
        >
          <div>
            <h2 className="text-3xl text-slate-50 font-semibold tracking-tight">Inloggen</h2>
            <p className="text-sm text-slate-400 mt-1">Welkom terug. Log in op je bar dashboard.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 bg-slate-900 border-slate-800 text-slate-50 focus-visible:ring-amber-500"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 bg-slate-900 border-slate-800 text-slate-50 focus-visible:ring-amber-500"
                data-testid="login-password-input"
              />
            </div>
          </div>

          {error && (
            <div
              className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900 rounded-md p-3"
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold tracking-wide"
            data-testid="login-submit-btn"
          >
            {busy ? "Bezig…" : "Inloggen"}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            Standaard: admin@bar.nl / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
