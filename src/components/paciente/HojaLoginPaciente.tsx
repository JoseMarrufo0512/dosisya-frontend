/*
 * HojaLoginPaciente — hoja de "Iniciar sesión" (opcional) del paciente.
 *
 * Flujo de 2 pasos: teléfono → código OTP por WhatsApp. El login es OPCIONAL por
 * diseño ("Cero Fricción"): "Seguir sin cuenta" está disponible en todo momento.
 */

import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { ArrowLeft, Smartphone, X } from "lucide-react";
import { solicitarCodigo, verificarCodigo, actualizarNombre } from "@/lib/pacienteApi";
import { actualizarPerfilGuardado, guardarSesionPaciente } from "@/lib/pacienteAuth";

type Paso = "telefono" | "codigo" | "nombre";

const COOLDOWN_S = 60;

export function HojaLoginPaciente({
  open,
  onOpenChange,
  onSesionIniciada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSesionIniciada?: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("telefono");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [restante, setRestante] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reinicia el formulario cada vez que se abre la hoja.
  useEffect(() => {
    if (open) {
      setPaso("telefono");
      setTelefono("");
      setCodigo("");
      setNombre("");
      setCargando(false);
      setRestante(0);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const iniciarCooldown = () => {
    setRestante(COOLDOWN_S);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRestante((s) => {
        if (s <= 1 && timerRef.current) clearInterval(timerRef.current);
        return s - 1;
      });
    }, 1000);
  };

  const pedirCodigo = async () => {
    setCargando(true);
    try {
      await solicitarCodigo(telefono);
      setPaso("codigo");
      iniciarCooldown();
      toast("Te enviamos un código por WhatsApp.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally {
      setCargando(false);
    }
  };

  const confirmarCodigo = async () => {
    setCargando(true);
    try {
      const sesion = await verificarCodigo(telefono, codigo);
      guardarSesionPaciente(sesion);
      onSesionIniciada?.();
      if (sesion.es_nuevo) {
        setPaso("nombre");
        toast("¡Listo! ¿Cómo te llamamos?");
      } else {
        toast(sesion.nombre ? `¡Hola de nuevo, ${sesion.nombre}!` : "¡Sesión iniciada!");
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código incorrecto o vencido.");
    } finally {
      setCargando(false);
    }
  };

  const guardarNombre = async () => {
    setCargando(true);
    try {
      const perfil = await actualizarNombre(nombre.trim());
      actualizarPerfilGuardado(perfil); // actualiza el nombre sin tocar el token
      onSesionIniciada?.();
    } catch {
      // No bloqueante: el nombre es opcional, la sesión ya existe.
    } finally {
      setCargando(false);
      onOpenChange(false);
      toast("¡Bienvenido a DosisYa!");
    }
  };

  const puedeEnviarTelefono = telefono.replace(/\D/g, "").length >= 10;
  const puedeVerificar = codigo.replace(/\D/g, "").length === 6;

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
  } as const;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 26px" }}
          aria-describedby={undefined}
        >
          <div
            aria-hidden="true"
            style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {paso === "codigo" && (
                <button
                  type="button"
                  aria-label="Volver"
                  onClick={() => setPaso("telefono")}
                  className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
                  style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
                >
                  <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              )}
              <Drawer.Title style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
                {paso === "nombre" ? "¿Cómo te llamamos?" : "Iniciar sesión"}
              </Drawer.Title>
            </div>
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

          {paso === "telefono" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
                Es <span style={{ color: "var(--tinta)", fontWeight: 500 }}>opcional</span>. Inicia sesión para
                guardar tu Lista Médica y acceder a beneficios.
              </p>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Tu teléfono (ej. 0414 123 4567)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={estiloInput}
                aria-label="Teléfono"
              />
              <button
                type="button"
                onClick={pedirCodigo}
                disabled={cargando || !puedeEnviarTelefono}
                className="dy-foco mt-3 flex w-full items-center justify-center gap-2"
                style={estiloPrimario}
              >
                <Smartphone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                Continuar con teléfono
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="dy-foco w-full" style={estiloSecundario}>
                Seguir sin cuenta
              </button>
            </>
          )}

          {paso === "codigo" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
                Escribe el código de 6 dígitos que te enviamos por WhatsApp.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="______"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                style={{ ...estiloInput, letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                aria-label="Código de verificación"
              />
              <button
                type="button"
                onClick={confirmarCodigo}
                disabled={cargando || !puedeVerificar}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Verificar
              </button>
              <button
                type="button"
                onClick={pedirCodigo}
                disabled={cargando || restante > 0}
                className="dy-foco w-full"
                style={{ ...estiloSecundario, opacity: restante > 0 ? 0.6 : 1 }}
              >
                {restante > 0 ? `Reenviar en ${restante}s` : "Reenviar código"}
              </button>
            </>
          )}

          {paso === "nombre" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
                Opcional — así personalizamos tu saludo.
              </p>
              <input
                type="text"
                autoComplete="given-name"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={estiloInput}
                aria-label="Nombre"
              />
              <button
                type="button"
                onClick={guardarNombre}
                disabled={cargando || nombre.trim().length === 0}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Guardar
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="dy-foco w-full" style={estiloSecundario}>
                Omitir
              </button>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
