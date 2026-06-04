import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pill, Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.VITE_API_URL || "https://proyecto-dosis-ya.vercel.app";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "DosisYa B2B — Acceso Farmacias" },
      { name: "description", content: "Panel administrativo B2B para farmacias afiliadas a DosisYa." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || json?.status !== "success") {
        throw new Error(json?.message || "Credenciales inválidas");
      }
      const farmaciaId = json?.data?.farmacia_id || json?.farmacia_id;
      if (!farmaciaId) throw new Error("No se recibió farmacia_id");
      localStorage.setItem("farmacia_id", farmaciaId);
      if (json?.data?.token) localStorage.setItem("auth_token", json.data.token);
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg,#f3f5fb 0%,#e8fbf2 100%)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xl font-bold text-foreground leading-none">DosisYa</div>
            <div className="text-xs text-muted-foreground font-medium">Panel B2B Farmacias</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-[0_8px_32px_-12px_rgba(10,36,99,0.18)] p-8">
          <h1 className="text-2xl font-bold text-foreground">Bienvenido de nuevo</h1>
          <p className="text-sm text-muted-foreground mt-1">Accede al panel de tu farmacia.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo corporativo</Label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmacia@ejemplo.com"
                  className="pl-9 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 h-11"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingresando…</>) : "Iniciar sesión"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            ¿Tu farmacia aún no es parte? <span className="text-primary font-medium">Contáctanos</span>
          </p>
        </div>
      </div>
    </div>
  );
}
