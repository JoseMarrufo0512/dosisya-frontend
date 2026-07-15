import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import type { FarmaciaAdmin } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatoTelefonoVE = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  return d ? `+58${d}` : "";
};

export function EditarFarmaciaDrawer({
  farmacia, token, open, onOpenChange, onSaved,
}: {
  farmacia: FarmaciaAdmin | null;
  token: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sector, setSector] = useState("");
  const [referencia, setReferencia] = useState("");
  const [saving, setSaving] = useState(false);

  // Precargar cada vez que cambia la farmacia a editar (no depender de onOpenChange:
  // vaul solo lo dispara desde su propio estado interno, no cuando el padre cambia `open`).
  useEffect(() => {
    if (farmacia) {
      setNombre(farmacia.nombre);
      setWhatsapp(farmacia.whatsapp);
      setSector(farmacia.sector);
      setReferencia(farmacia.punto_referencia);
    }
  }, [farmacia?.id]);

  const guardar = async () => {
    if (!farmacia) return;
    if (!/^\+58\d{10}$/.test(whatsapp)) {
      toast.error("WhatsApp: +58 seguido de 10 dígitos");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmacia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre_farmacia: nombre, whatsapp, sector, punto_referencia: referencia,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.detail || json?.error?.message || "No se pudo guardar");
      }
      toast.success("Farmacia actualizada");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card p-6 max-h-[90vh] overflow-auto">
          <Drawer.Title className="text-lg font-bold">Editar farmacia</Drawer.Title>
          <div className="mt-4 space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="e-nombre">Nombre</Label>
              <Input id="e-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-wa">WhatsApp</Label>
              <Input id="e-wa" value={whatsapp} onChange={(e) => setWhatsapp(formatoTelefonoVE(e.target.value))}
                placeholder="+584121234567" maxLength={13} inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-sector">Sector</Label>
              <Input id="e-sector" value={sector} onChange={(e) => setSector(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-ref">Punto de referencia</Label>
              <Input id="e-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={180} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={guardar} disabled={saving} className="flex-1">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…</> : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
