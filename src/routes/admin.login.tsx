import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Pill,
  Loader2,
  Mail,
  Lock,
  Building2,
  FileBadge,
  Phone,
  MapPin,
  Navigation,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Users,
  Zap,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.VITE_API_URL || "https://proyecto-dosis-ya.vercel.app";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "DosisYa B2B — Portal de Farmacias" },
      {
        name: "description",
        content:
          "Únete a DosisYa, la red de farmacias más rápida de Portuguesa. Más visibilidad, más pacientes en tu WhatsApp.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "register";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* LEFT — Value proposition */}
      <aside
        className="relative lg:w-1/2 px-8 py-12 lg:p-16 flex flex-col justify-between overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(140deg, #0a2463 0%, #11357a 45%, #1f6f5c 100%)",
        }}
      >
        {/* glow accents */}
        <div className="pointer-events-none absolute -top-24 -left-20 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold leading-none">DosisYa</div>
            <div className="text-xs text-white/70 font-medium mt-1">
              Portal B2B Farmacias
            </div>
          </div>
        </div>

        <div className="relative max-w-lg mt-12 lg:mt-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Sparkles className="h-3.5 w-3.5 text-secondary" />
            Acarigua · Araure · Portuguesa
          </div>
          <h1 className="mt-5 text-3xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Únete a la red de farmacias{" "}
            <span className="text-secondary">más rápida</span> de Portuguesa.
          </h1>
          <p className="mt-5 text-base lg:text-lg text-white/80 leading-relaxed">
            Más visibilidad, más pacientes llegando directo a tu WhatsApp.
            DosisYa conecta cada búsqueda de medicamento con la farmacia
            correcta — la tuya.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: Users, text: "Miles de búsquedas locales cada mes" },
              { icon: Zap, text: "Leads directos a tu WhatsApp, sin intermediarios" },
              { icon: TrendingUp, text: "Panel con métricas de ingresos potenciales" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-secondary/20 border border-secondary/30 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-secondary" />
                </div>
                <span className="text-white/90 text-sm lg:text-base">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:block text-xs text-white/60">
          © {new Date().getFullYear()} DosisYa · Hecho en Venezuela
        </div>
      </aside>

      {/* RIGHT — Glass card */}
      <main className="lg:w-1/2 flex items-center justify-center px-4 py-12 lg:p-12 bg-gradient-to-br from-muted via-background to-accent">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl border p-6 sm:p-8 backdrop-blur-xl"
            style={{
              background: "rgba(255,255,255,0.72)",
              borderColor: "rgba(255,255,255,0.6)",
              boxShadow: "0 20px 60px -20px rgba(10,36,99,0.25)",
            }}
          >
            {mode === "login" ? (
              <LoginCard onSwitch={() => setMode("register")} />
            ) : (
              <RegisterCard onSwitch={() => setMode("login")} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* -------------------- LOGIN -------------------- */

function LoginCard({ onSwitch }: { onSwitch: () => void }) {
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
    <div>
      <h2 className="text-2xl font-bold text-foreground">Bienvenido de nuevo</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Accede al panel de tu farmacia.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field
          id="email"
          label="Correo corporativo"
          icon={Mail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(v) => setEmail(v)}
          placeholder="farmacia@ejemplo.com"
        />
        <Field
          id="password"
          label="Contraseña"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(v) => setPassword(v)}
          placeholder="••••••••"
        />

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingresando…
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>

      {/* Affiliate CTA */}
      <button
        type="button"
        onClick={onSwitch}
        className="group mt-6 w-full rounded-xl border-2 border-dashed border-secondary/60 bg-secondary/10 hover:bg-secondary/20 transition-colors p-4 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary-foreground" />
              ¿Tu farmacia no está en DosisYa?
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Afíliate aquí en 2 minutos · sin costo inicial
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
        </div>
      </button>
    </div>
  );
}

/* -------------------- REGISTER (multi-step) -------------------- */

type RegData = {
  nombre: string;
  rif: string;
  whatsapp: string;
  sector: "Acarigua" | "Araure" | "";
  referencia: string;
  email: string;
  password: string;
  lead_id?: string;
};

function RegisterCard({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<RegData>({
    nombre: "",
    rif: "",
    whatsapp: "",
    sector: "",
    referencia: "",
    email: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = <K extends keyof RegData>(k: K, v: RegData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  /* Step 1 → background lead creation */
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Simulated background save (partial lead)
      const res = await fetch(`${API_BASE}/api/v1/leads/parcial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_farmacia: data.nombre,
          rif: data.rif,
          whatsapp: data.whatsapp,
          tipo_lead: "registro_parcial",
        }),
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        const leadId = json?.data?.lead_id || json?.lead_id;
        if (leadId) update("lead_id", leadId);
      }
      setAutoSaved(true);
      setStep(2);
    } catch {
      // never block UX on auto-save failure
      setAutoSaved(true);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(3);
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_farmacia: data.nombre,
          rif: data.rif,
          whatsapp: data.whatsapp,
          sector: data.sector,
          punto_referencia: data.referencia,
          email: data.email,
          password: data.password,
          lead_id: data.lead_id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.status !== "success") {
        throw new Error(json?.message || "No se pudo completar el registro");
      }
      const farmaciaId = json?.data?.farmacia_id || json?.farmacia_id;
      if (farmaciaId) localStorage.setItem("farmacia_id", farmaciaId);
      if (json?.data?.token) localStorage.setItem("auth_token", json.data.token);
      setDone(true);
      setTimeout(() => navigate({ to: "/admin/dashboard" }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto h-14 w-14 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center">
          <Check className="h-7 w-7 text-secondary-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          ¡Bienvenido a DosisYa!
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Llevándote a tu panel…
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSwitch}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al login
        </button>
        {autoSaved && (
          <span className="text-[11px] font-medium inline-flex items-center gap-1 text-secondary-foreground bg-secondary/20 border border-secondary/30 rounded-full px-2 py-0.5">
            <Check className="h-3 w-3" /> Progreso guardado
          </span>
        )}
      </div>

      <h2 className="mt-3 text-2xl font-bold text-foreground">
        Afilia tu farmacia
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Solo 3 pasos · te toma menos de 2 minutos.
      </p>

      <Stepper step={step} />

      {step === 1 && (
        <form onSubmit={handleStep1} className="mt-5 space-y-4">
          <Field
            id="nombre"
            label="Nombre de la farmacia"
            icon={Building2}
            required
            value={data.nombre}
            onChange={(v) => update("nombre", v)}
            placeholder="Farmatodo Araure"
          />
          <Field
            id="rif"
            label="RIF"
            icon={FileBadge}
            required
            value={data.rif}
            onChange={(v) => update("rif", v.toUpperCase())}
            placeholder="J-12345678-9"
          />
          <Field
            id="whatsapp"
            label="Número de WhatsApp"
            icon={Phone}
            required
            value={data.whatsapp}
            onChange={(v) => update("whatsapp", v)}
            placeholder="+58 412 1234567"
            type="tel"
          />
          {error && <ErrorBox text={error} />}
          <Button
            type="submit"
            disabled={saving}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                Siguiente <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>Sector / Urbanización</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["Acarigua", "Araure"] as const).map((s) => {
                const active = data.sector === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update("sector", s)}
                    className={`h-11 rounded-md border text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent"
                    }`}
                  >
                    <MapPin className="h-4 w-4" /> {s}
                  </button>
                );
              })}
            </div>
          </div>
          <Field
            id="ref"
            label="Punto de referencia"
            icon={Navigation}
            required
            value={data.referencia}
            onChange={(v) => update("referencia", v)}
            placeholder="Frente al CC Buenaventura"
          />
          {error && <ErrorBox text={error} />}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="h-11"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              disabled={!data.sector || !data.referencia}
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleStep3} className="mt-5 space-y-4">
          <Field
            id="r-email"
            label="Correo electrónico"
            icon={Mail}
            type="email"
            required
            value={data.email}
            onChange={(v) => update("email", v)}
            placeholder="farmacia@ejemplo.com"
          />
          <Field
            id="r-pass"
            label="Crear contraseña"
            icon={Lock}
            type="password"
            required
            value={data.password}
            onChange={(v) => update("password", v)}
            placeholder="Mínimo 8 caracteres"
          />
          {error && <ErrorBox text={error} />}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              className="h-11"
              disabled={saving}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              disabled={saving || data.password.length < 8}
              className="flex-1 h-11 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando cuenta…
                </>
              ) : (
                <>
                  Finalizar y entrar <Check className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -------------------- Helpers -------------------- */

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Contacto", "Ubicación", "Cuenta"];
  return (
    <div className="mt-5 flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const complete = step > n;
        return (
          <div key={label} className="flex-1 flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center border transition-colors ${
                complete
                  ? "bg-secondary text-secondary-foreground border-secondary"
                  : active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <div
              className={`text-[11px] font-medium ${
                active || complete ? "text-foreground" : "text-muted-foreground"
              } hidden sm:block`}
            >
              {label}
            </div>
            {i < labels.length - 1 && (
              <div
                className={`flex-1 h-0.5 rounded ${
                  complete ? "bg-secondary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 h-11"
        />
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
      {text}
    </div>
  );
}
