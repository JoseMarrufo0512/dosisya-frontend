import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Lock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "@/lib/adminApi";
import { guardarSesionSuper } from "@/lib/adminAuth";

export const Route = createFileRoute("/super/login")({
  head: () => ({ meta: [{ title: "DosisYa — Súper Admin" }] }),
  component: SuperLogin,
});

function SuperLogin() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await adminLogin(correo.trim().toLowerCase(), password);
      guardarSesionSuper(r);
      navigate({ to: "/super/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-accent px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(10,36,99,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold">Panel Súper Admin</div>
            <div className="text-xs text-muted-foreground">Acceso restringido</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="s-correo">Correo</Label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="s-correo" type="email" autoComplete="email" required
                value={correo} onChange={(e) => setCorreo(e.target.value)}
                placeholder="admin@dosisya.com" className="pl-9 h-11" maxLength={255} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-pass">Contraseña</Label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="s-pass" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="pl-9 h-11" maxLength={128} />
            </div>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingresando…</> : "Iniciar sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}
