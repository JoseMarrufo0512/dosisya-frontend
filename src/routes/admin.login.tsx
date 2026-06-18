import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
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

import { API_BASE } from "@/lib/api";

/* ----------- Scalable sector catalog -----------
 * Empezamos con Acarigua y Araure, pero el arreglo está pensado
 * para crecer a otras ciudades/sectores sin tocar la UI. */
type SectorOption = { value: string; label: string; ciudad: string };
const SECTORES: SectorOption[] = [
  { value: "acarigua", label: "Acarigua", ciudad: "Acarigua" },
  { value: "araure", label: "Araure", ciudad: "Araure" },
];

/* ----------- Validation helpers ----------- */
const NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'&-]+$/;
const SOLO_LETRAS_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/;
const RIF_REGEX = /^[JVEGP]-\d{8}-\d$/;
const TELEFONO_VE_REGEX = /^\+58\d{10}$/; // +58 + 10 dígitos

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const formatRif = (raw: string) => {
  // Mantiene letra inicial (J/V/E/G/P) + dígitos, inserta guiones J-XXXXXXXX-X
  const cleaned = raw.toUpperCase().replace(/[^JVEGP0-9]/g, "");
  if (!cleaned) return "";
  const letra = /^[JVEGP]/.test(cleaned) ? cleaned[0] : "J";
  const nums = cleaned.replace(/[^0-9]/g, "").slice(0, 9);
  if (nums.length <= 8) {
    return nums.length ? `${letra}-${nums}` : `${letra}-`;
  }
  return `${letra}-${nums.slice(0, 8)}-${nums.slice(8, 9)}`;
};

const formatTelefonoVE = (raw: string) => {
  // Normaliza a +58XXXXXXXXXX
  let d = onlyDigits(raw);
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  return d ? `+58${d}` : "";
};

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

const step1Schema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(120, "Máximo 120 caracteres")
    .regex(NOMBRE_REGEX, "Solo letras, números y . , ' & -"),
  rif: z.string().regex(RIF_REGEX, "Formato: J-12345678-9"),
  whatsapp: z
    .string()
    .regex(TELEFONO_VE_REGEX, "Formato: +58 seguido de 10 dígitos"),
});

const step2Schema = z.object({
  sector: z.string().min(1, "Selecciona un sector"),
  referencia: z
    .string()
    .trim()
    .min(5, "Describe brevemente (mín. 5 caracteres)")
    .max(180, "Máximo 180 caracteres"),
});

const step3Schema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(128)
    .regex(/[A-Za-z]/, "Debe incluir una letra")
    .regex(/\d/, "Debe incluir un número"),
});

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

type LoginResponse = {
  data: {
    farmacia_id: string;
    auth_token: string;
    nombre_farmacia: string;
  };
};

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: parsed.data.email, password: parsed.data.password }),
      });
      const data = (await response.json()) as LoginResponse;
      console.log("Respuesta login DosisYa:", data);

      if (!response.ok) {
        throw new Error("Credenciales inválidas");
      }

      const authToken = data.data.auth_token;
      const farmaciaId = data.data.farmacia_id;
      localStorage.setItem("auth_token", authToken);
      localStorage.setItem("farmacia_id", farmaciaId);
      if (data.data.nombre_farmacia) {
        localStorage.setItem("nombre_farmacia", data.data.nombre_farmacia);
      }
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

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field
          id="email"
          label="Correo corporativo"
          icon={Mail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="tu-farmacia@correo.com"
          error={fieldErrors.email}
          maxLength={255}
        />
        <Field
          id="password"
          label="Contraseña"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          error={fieldErrors.password}
          maxLength={128}
        />

        {error && <ErrorBox text={error} />}

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
  sector: string;
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const update = <K extends keyof RegData>(k: K, v: RegData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (fieldErrors[k as string]) {
      setFieldErrors((e) => {
        const { [k as string]: _omit, ...rest } = e;
        return rest;
      });
    }
  };

  const collectErrors = (issues: z.ZodIssue[]) => {
    const errs: Record<string, string> = {};
    for (const issue of issues) {
      const k = issue.path[0] as string;
      if (k && !errs[k]) errs[k] = issue.message;
    }
    return errs;
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = step1Schema.safeParse({
      nombre: data.nombre,
      rif: data.rif,
      whatsapp: data.whatsapp,
    });
    if (!parsed.success) {
      setFieldErrors(collectErrors(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/leads/parcial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_farmacia: parsed.data.nombre,
          rif: parsed.data.rif,
          whatsapp: parsed.data.whatsapp,
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
      setAutoSaved(true);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = step2Schema.safeParse({
      sector: data.sector,
      referencia: data.referencia,
    });
    if (!parsed.success) {
      setFieldErrors(collectErrors(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    setStep(3);
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = step3Schema.safeParse({
      email: data.email,
      password: data.password,
    });
    if (!parsed.success) {
      setFieldErrors(collectErrors(parsed.error.issues));
      return;
    }
    setFieldErrors({});
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
          email: parsed.data.email,
          password: parsed.data.password,
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
        <form onSubmit={handleStep1} className="mt-5 space-y-4" noValidate>
          <Field
            id="nombre"
            label="Nombre de la farmacia"
            icon={Building2}
            required
            value={data.nombre}
            onChange={(v) => {
              const clean = v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'&-]/g, "");
              update("nombre", clean);
            }}
            placeholder="Ej. Farmacia San Rafael"
            error={fieldErrors.nombre}
            maxLength={120}
          />
          <Field
            id="rif"
            label="RIF"
            icon={FileBadge}
            required
            value={data.rif}
            onChange={(v) => update("rif", formatRif(v))}
            placeholder="J-12345678-9"
            error={fieldErrors.rif}
            maxLength={12}
            hint="Empieza con J, V, E, G o P."
          />
          <Field
            id="whatsapp"
            label="WhatsApp"
            icon={Phone}
            required
            value={data.whatsapp}
            onChange={(v) => update("whatsapp", formatTelefonoVE(v))}
            placeholder="+584121234567"
            type="tel"
            inputMode="tel"
            error={fieldErrors.whatsapp}
            maxLength={13}
            hint="Solo números · Venezuela (+58) + 10 dígitos."
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
        <form onSubmit={handleStep2} className="mt-5 space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Sector / Ciudad</Label>
            <div className="grid grid-cols-2 gap-2">
              {SECTORES.map((s) => {
                const active = data.sector === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => update("sector", s.value)}
                    className={`h-11 rounded-md border text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent"
                    }`}
                  >
                    <MapPin className="h-4 w-4" /> {s.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.sector && (
              <p className="text-xs text-destructive">{fieldErrors.sector}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Pronto sumaremos más ciudades de Venezuela.
            </p>
          </div>
          <Field
            id="ref"
            label="Punto de referencia"
            icon={Navigation}
            required
            value={data.referencia}
            onChange={(v) => update("referencia", v)}
            placeholder="Ej. A 2 cuadras de la plaza Bolívar"
            error={fieldErrors.referencia}
            maxLength={180}
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
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleStep3} className="mt-5 space-y-4" noValidate>
          <Field
            id="r-email"
            label="Correo electrónico"
            icon={Mail}
            type="email"
            required
            value={data.email}
            onChange={(v) => update("email", v.trim())}
            placeholder="tu-farmacia@correo.com"
            error={fieldErrors.email}
            maxLength={255}
            autoComplete="email"
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
            error={fieldErrors.password}
            maxLength={128}
            autoComplete="new-password"
            hint="Incluye al menos una letra y un número."
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
              disabled={saving}
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
  error,
  hint,
  maxLength,
  inputMode,
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
  error?: string;
  hint?: string;
  maxLength?: number;
  inputMode?:
    | "text"
    | "tel"
    | "email"
    | "numeric"
    | "search"
    | "url"
    | "none"
    | "decimal";
}) {
  const invalid = Boolean(error);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={
            invalid ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className={`pl-9 h-11 ${
            invalid ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
        />
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
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
