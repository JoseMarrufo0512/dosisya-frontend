import { useCallback, useEffect, useState } from "react";
import {
  cerrarSesionPaciente,
  getPacientePerfil,
  getPacienteToken,
  type PacientePerfil,
} from "@/lib/pacienteAuth";
import { obtenerPerfil } from "@/lib/pacienteApi";

export function usePacienteSesion(): {
  logueado: boolean;
  perfil: PacientePerfil | null;
  cerrarSesion: () => void;
} {
  const [perfil, setPerfil] = useState<PacientePerfil | null>(null);

  useEffect(() => {
    // Lectura inicial tras hidratar (evita desajuste SSR/CSR).
    setPerfil(getPacientePerfil());
    if (!getPacienteToken()) return;
    // Valida el token guardado; solo cierra sesión ante 401/403 (UNAUTHORIZED).
    let cancelado = false;
    obtenerPerfil()
      .then((p) => {
        if (!cancelado) setPerfil(p);
      })
      .catch((e) => {
        if (cancelado) return;
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          cerrarSesionPaciente();
          setPerfil(null);
        }
        // otro error (red/5xx/parse): conservar sesión y perfil cacheado
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const cerrarSesion = useCallback(() => {
    cerrarSesionPaciente();
    setPerfil(null);
  }, []);

  return { logueado: perfil !== null, perfil, cerrarSesion };
}
