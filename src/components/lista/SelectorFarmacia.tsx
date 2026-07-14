import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, RefreshCw } from "lucide-react";
import { buscarMedicamentos, type ResultadoFarmacia } from "@/lib/api";
import { registrarLeadLista } from "@/lib/leadsLista";
import { construirMensajeLista, construirUrlWhatsApp } from "@/lib/whatsapp";
import type { ItemLista } from "@/hooks/useListaMedica";
import { BadgePremium } from "@/components/BadgePremium";
import { BadgeDelivery } from "@/components/BadgeDelivery";

// Radio amplio para la cobertura: preferimos mostrar una farmacia a 6 km con
// la lista completa antes que esconderla. La distancia sigue visible para que
// el usuario decida.
const RADIO_COBERTURA_M = 10000;

interface SelectorFarmaciaProps {
  lista: ItemLista[];
  lat: number;
  lng: number;
}

interface FarmaciaAgregada {
  farmaciaId: string | number;
  nombre: string;
  direccion: string;
  whatsapp: string | null;
  distanciaM: number;
  esPremium: boolean;
  tieneDelivery: boolean;
  /** medicamentoId (string) → fila de inventario de ESTA farmacia. */
  matches: Map<string, ResultadoFarmacia>;
}

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; farmacias: FarmaciaAgregada[] };

export function SelectorFarmacia({ lista, lat, lng }: SelectorFarmaciaProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // Anti-spam (spec): tras contactar, el botón de esa farmacia se bloquea 2s
  const [bloqueadaId, setBloqueadaId] = useState<string | null>(null);

  const cargarCobertura = useCallback(async () => {
    setEstado({ tipo: "cargando" });

    // Una búsqueda por medicamento, en paralelo. Reutiliza el endpoint
    // existente: cero cambios de backend.
    const respuestas = await Promise.all(
      lista.map((item) =>
        buscarMedicamentos({
          q: item.nombre,
          lat,
          lng,
          con_delivery: false,
          radio: RADIO_COBERTURA_M,
        })
          .then((r) => (r.status === "error" || !r.data ? null : r.data.resultados))
          .catch(() => null),
      ),
    );

    // Solo es error si TODAS fallaron (sin red). Fallos parciales siguen.
    if (respuestas.every((r) => r === null)) {
      setEstado({ tipo: "error" });
      return;
    }

    const porFarmacia = new Map<string, FarmaciaAgregada>();

    respuestas.forEach((resultados, idx) => {
      if (!resultados) return;
      const item = lista[idx];

      for (const res of resultados) {
        // Match estricto por ID: contamos solo el medicamento exacto que el
        // usuario añadió (la búsqueda fuzzy puede traer otros parecidos).
        if (String(res.medicamento_id) !== String(item.medicamentoId)) continue;

        const key = String(res.farmacia_id);
        let farmacia = porFarmacia.get(key);
        if (!farmacia) {
          farmacia = {
            farmaciaId: res.farmacia_id,
            nombre: res.farmacia_nombre,
            direccion: res.direccion,
            whatsapp: res.whatsapp ?? null,
            distanciaM: res.distancia_m,
            esPremium: res.es_premium,
            tieneDelivery: res.tiene_delivery,
            matches: new Map(),
          };
          porFarmacia.set(key, farmacia);
        }
        farmacia.matches.set(String(item.medicamentoId), res);
      }
    });

    const farmacias = [...porFarmacia.values()].sort((a, b) => {
      const porCobertura = b.matches.size - a.matches.size;
      if (porCobertura !== 0) return porCobertura;
      return a.distanciaM - b.distanciaM;
    });

    setEstado({ tipo: "listo", farmacias });
  }, [lista, lat, lng]);

  useEffect(() => {
    void cargarCobertura();
  }, [cargarCobertura]);

  const handleContactar = (farmacia: FarmaciaAgregada) => {
    const mensaje = construirMensajeLista(farmacia.nombre, lista);
    const url = construirUrlWhatsApp(farmacia.whatsapp, mensaje);
    if (!url) {
      toast.error("Esta farmacia no tiene WhatsApp registrado");
      return;
    }

    setBloqueadaId(String(farmacia.farmaciaId));
    setTimeout(() => setBloqueadaId(null), 2000);

    // 1) Lead CPC multi-producto — keepalive sobrevive a la navegación
    registrarLeadLista(
      farmacia.farmaciaId,
      lista.map((i) => ({ medicamentoId: i.medicamentoId, origen: i.origen })),
    );

    // 2) Abrir WhatsApp con la lista completa
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(`Abriendo WhatsApp de ${farmacia.nombre}…`);
  };

  // ── Cargando: mismo lenguaje visual que EstadoCargando ─────────────────────
  if (estado.tipo === "cargando") {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-6 pt-1">
        <p className="py-1 text-center text-sm font-medium text-emerald-600">
          Consultando inventarios cercanos…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
            <div className="mt-3 h-1.5 w-full rounded bg-muted" />
            <div className="mt-4 h-11 w-full rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error total (sin conexión) ─────────────────────────────────────────────
  if (estado.tipo === "error") {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="font-medium text-foreground">No pudimos consultar las farmacias</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        <button
          type="button"
          onClick={() => void cargarCobertura()}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Reintentar
        </button>
      </div>
    );
  }

  // ── Vacío: ninguna farmacia tiene ningún item ──────────────────────────────
  if (estado.farmacias.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="font-medium text-foreground">
          Ninguna farmacia cercana tiene estos medicamentos ahora
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Los inventarios cambian a diario. Prueba de nuevo más tarde o ajusta tu lista.
        </p>
        <button
          type="button"
          onClick={() => void cargarCobertura()}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Buscar de nuevo
        </button>
      </div>
    );
  }

  // ── Resultados ─────────────────────────────────────────────────────────────
  const totalLista = lista.length;

  return (
    <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">
      {estado.farmacias.map((farmacia, idx) => {
        const cuantos = farmacia.matches.size;
        const completa = cuantos === totalLista;
        const esMejor = idx === 0 && cuantos > 0;
        const bloqueada = bloqueadaId === String(farmacia.farmaciaId);

        const totalUsd = lista.reduce((acc, item) => {
          const match = farmacia.matches.get(String(item.medicamentoId));
          return match ? acc + match.precio_usd * item.cantidad : acc;
        }, 0);

        const faltantes = lista.filter((i) => !farmacia.matches.has(String(i.medicamentoId)));

        return (
          <li
            key={String(farmacia.farmaciaId)}
            className={`rounded-xl border bg-card p-4 shadow-sm ${
              esMejor ? "border-secondary ring-1 ring-secondary/40" : "border-border"
            }`}
          >
            {esMejor && (
              <span className="mb-2 inline-flex rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Mejor opción para tu lista
              </span>
            )}

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-col gap-1">
                <h3 className="truncate text-base font-semibold leading-tight text-foreground">
                  {farmacia.nombre}
                </h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {farmacia.esPremium && <BadgePremium />}
                  {farmacia.tieneDelivery && <BadgeDelivery />}
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    {(farmacia.distanciaM / 1000).toFixed(1)} km · {farmacia.direccion}
                  </span>
                </p>
              </div>
            </div>

            {/* Cobertura */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className={`font-semibold ${completa ? "text-emerald-700" : "text-foreground"}`}>
                  {completa
                    ? "✓ Tiene tu lista completa"
                    : `Tiene ${cuantos} de ${totalLista} de tu lista`}
                </span>
                {totalUsd > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ≈ ${totalUsd.toFixed(2)} USD
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-secondary transition-all"
                  style={{ width: `${(cuantos / totalLista) * 100}%` }}
                />
              </div>
              {faltantes.length > 0 && faltantes.length <= 2 && (
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  Le falta: {faltantes.map((f) => f.nombre).join(", ")}
                </p>
              )}
            </div>

            {/* Contactar → lead CPC multi-producto + WhatsApp */}
            <button
              type="button"
              onClick={() => handleContactar(farmacia)}
              disabled={bloqueada}
              aria-label={`Contactar ${farmacia.nombre} por WhatsApp con tu lista`}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-[#25D366] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {bloqueada ? "Abriendo WhatsApp…" : "Contactar por WhatsApp"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
