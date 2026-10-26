/*
 * HojaLoginPaciente — hoja de "Iniciar sesión / Crear cuenta" (opcional) del paciente.
 *
 * Registro v2: correo + contraseña, y registro/login con Google. El login es
 * OPCIONAL por diseño ("Cero Fricción"): "Seguir sin cuenta" está disponible en
 * todo momento. Reemplaza el flujo OTP por WhatsApp.
 */

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  registro,
  login,
  googleLogin,
  completarPerfilGoogle,
} from "@/lib/pacienteApi";
import { guardarSesionPaciente, type Genero, type SesionPaciente } from "@/lib/pacienteAuth";
import { cargarGoogleIdentity, solicitarIdTokenGoogle } from "@/lib/googleIdentity";

type Modo = "entrar" | "crear" | "completar";

const GENEROS: { valor: Genero; etiqueta: string }[] = [
  { valor: "femenino", etiqueta: "Femenino" },
  { valor: "masculino", etiqueta: "Masculino" },
  { valor: "no_binario", etiqueta: "No binario" },
  { valor: "no_especifica", etiqueta: "Prefiero no especificar" },
];

export function HojaLoginPaciente({
  open,
  onOpenChange,
  onSesionIniciada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSesionIniciada?: () => void;
}) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [cargando, setCargando] = useState(false);
  const [preToken, setPreToken] = useState<string | null>(null);

  // Campos del formulario.
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [documento, setDocumento] = useState("");
  const [genero, setGenero] = useState<Genero | "">("");
  const [password, setPassword] = useState("");

  // Reinicia el formulario cada vez que se abre la hoja.
  useEffect(() => {
    if (open) {
      setModo("entrar");
      setCargando(false);
      setPreToken(null);
      setNombre("");
      setApellido("");
      setCorreo("");
      setTelefono("");
      setDocumento("");
      setGenero("");
      setPassword("");
    }
  }, [open]);

  const finalizar = (s: SesionPaciente) => {
    guardarSesionPaciente(s);
    onSesionIniciada?.();
    onOpenChange(false);
    toast(`¡Hola, ${s.nombre || "bienvenido"}!`);
  };

  const onEntrar = async () => {
    setCargando(true);
    try {
      finalizar(await login(correo.trim(), password));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  };

  const onCrear = async () => {
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setCargando(true);
    try {
      finalizar(
        await registro({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          correo: correo.trim(),
          telefono: telefono.trim(),
          documento: documento.trim(),
          genero: genero || null,
          password,
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la cuenta.");
    } finally {
      setCargando(false);
    }
  };

  const onGoogle = async () => {
    setCargando(true);
    try {
      await cargarGoogleIdentity();
      const idToken = await solicitarIdTokenGoogle();
      const r = await googleLogin(idToken);
      if (r.tipo === "sesion") {
        finalizar(r.sesion);
      } else {
        setPreToken(r.preregistroToken);
        setNombre(r.prefill.nombre);
        setCorreo(r.prefill.correo);
        setModo("completar");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo continuar con Google.");
    } finally {
      setCargando(false);
    }
  };

  const onCompletar = async () => {
    if (!preToken) return;
    setCargando(true);
    try {
      finalizar(
        await completarPerfilGoogle(preToken, {
          telefono: telefono.trim(),
          documento: documento.trim(),
          genero: genero || null,
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar tu perfil.");
    } finally {
      setCargando(false);
    }
  };

  const telOk = telefono.replace(/\D/g, "").length >= 10;
  const docOk = documento.trim().length >= 5;
  const correoOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim());

  const puedeEntrar = correoOk && password.length >= 1;
  const puedeCrear =
    nombre.trim() && apellido.trim() && correoOk && telOk && docOk && password.length >= 8;
  const puedeCompletar = telOk && docOk;

  const estiloPrimario = {
    height: 48,
    background: "var(--verde-cruz)",
    color: "var(--papel)",
    border: 0,
    borderRadius: 13,
    fontSize: 14,
    fontWeight: 500,
    opacity: cargando ? 0.6 : 1,
  } as const;

  const estiloSecundario = {
    height: 48,
    marginTop: 10,
    background: "var(--blanco)",
    color: "var(--verde-cruz)",
    border: "1px solid #d8dad3",
    borderRadius: 13,
    fontSize: 14,
    fontWeight: 500,
  } as const;

  const estiloInput = {
    height: 48,
    width: "100%",
    borderRadius: 13,
    border: "1px solid #d8dad3",
    background: "var(--blanco)",
    padding: "0 14px",
    fontSize: 15,
    color: "var(--tinta)",
    marginTop: 8,
  } as const;

  const titulo =
    modo === "crear" ? "Crear cuenta" : modo === "completar" ? "Completa tu perfil" : "Iniciar sesión";

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-md flex-col overflow-y-auto rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 26px" }}
          aria-describedby={undefined}
        >
          <div
            aria-hidden="true"
            style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
          />
          <div className="flex items-center justify-between">
            <Drawer.Title
              style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}
            >
              {titulo}
            </Drawer.Title>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => onOpenChange(false)}
              className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>

          {/* ─────────── Entrar (correo + contraseña) ─────────── */}
          {modo === "entrar" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 6px" }}>
                Inicia sesión para guardar tu Lista Médica y acceder a beneficios. Es{" "}
                <span style={{ color: "var(--tinta)", fontWeight: 500 }}>opcional</span>.
              </p>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Correo electrónico"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                style={estiloInput}
                aria-label="Correo electrónico"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={estiloInput}
                aria-label="Contraseña"
              />
              <button
                type="button"
                onClick={onEntrar}
                disabled={cargando || !puedeEntrar}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={onGoogle}
                disabled={cargando}
                className="dy-foco w-full"
                style={estiloSecundario}
              >
                Continuar con Google
              </button>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", textAlign: "center", marginTop: 14 }}>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => setModo("crear")}
                  className="dy-foco"
                  style={{ background: "none", border: 0, color: "var(--verde-cruz)", fontWeight: 500, padding: 0 }}
                >
                  Crear cuenta
                </button>
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="dy-foco w-full"
                style={{ ...estiloSecundario, border: 0, color: "var(--tinta-suave)" }}
              >
                Seguir sin cuenta
              </button>
            </>
          )}

          {/* ─────────── Crear cuenta (formulario) ─────────── */}
          {modo === "crear" && (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoComplete="given-name"
                  placeholder="Nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  style={estiloInput}
                  aria-label="Nombre"
                />
                <input
                  type="text"
                  autoComplete="family-name"
                  placeholder="Apellido"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  style={estiloInput}
                  aria-label="Apellido"
                />
              </div>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Correo electrónico"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                style={estiloInput}
                aria-label="Correo electrónico"
              />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Teléfono (ej. 0414 123 4567)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={estiloInput}
                aria-label="Teléfono"
              />
              <input
                type="text"
                placeholder="Número de documento (ej. V12345678)"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                style={estiloInput}
                aria-label="Número de documento"
              />
              <select
                value={genero}
                onChange={(e) => setGenero(e.target.value as Genero | "")}
                style={{ ...estiloInput, appearance: "auto" }}
                aria-label="Género (opcional)"
              >
                <option value="">Género (opcional)</option>
                {GENEROS.map((g) => (
                  <option key={g.valor} value={g.valor}>
                    {g.etiqueta}
                  </option>
                ))}
              </select>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Contraseña (mínimo 8 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={estiloInput}
                aria-label="Contraseña"
              />
              <button
                type="button"
                onClick={onCrear}
                disabled={cargando || !puedeCrear}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Crear cuenta
              </button>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", textAlign: "center", marginTop: 14 }}>
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => setModo("entrar")}
                  className="dy-foco"
                  style={{ background: "none", border: 0, color: "var(--verde-cruz)", fontWeight: 500, padding: 0 }}
                >
                  Iniciar sesión
                </button>
              </p>
            </>
          )}

          {/* ─────────── Completar perfil (tras Google) ─────────── */}
          {modo === "completar" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 6px" }}>
                Solo falta un paso para terminar tu registro con Google.
              </p>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Teléfono (ej. 0414 123 4567)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={estiloInput}
                aria-label="Teléfono"
              />
              <input
                type="text"
                placeholder="Número de documento (ej. V12345678)"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                style={estiloInput}
                aria-label="Número de documento"
              />
              <select
                value={genero}
                onChange={(e) => setGenero(e.target.value as Genero | "")}
                style={{ ...estiloInput, appearance: "auto" }}
                aria-label="Género (opcional)"
              >
                <option value="">Género (opcional)</option>
                {GENEROS.map((g) => (
                  <option key={g.valor} value={g.valor}>
                    {g.etiqueta}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onCompletar}
                disabled={cargando || !puedeCompletar}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Terminar registro
              </button>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
