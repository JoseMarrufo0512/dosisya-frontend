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
    // Valida el token guardado; si es inválido, limpia en silencio.
    let cancelado = false;
    obtenerPerfil()
      .then((p) => {
        if (!cancelado) setPerfil(p);
      })
      .catch(() => {
        if (cancelado) return;
        cerrarSesionPaciente();
        setPerfil(null);
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
