// Carga Google Identity Services (GIS) y obtiene un ID token del usuario.
// SSR-safe: todo detrás de `typeof window`. Lee VITE_GOOGLE_CLIENT_ID.

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      prompt: () => void;
    };
  };
};

let cargando: Promise<void> | null = null;

function googleGlobal(): GoogleId | undefined {
  return (window as unknown as { google?: GoogleId }).google;
}

export function cargarGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (googleGlobal()) return Promise.resolve();
  if (cargando) return cargando;
  cargando = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      cargando = null;
      reject(new Error("No se pudo cargar Google."));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

export function solicitarIdTokenGoogle(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) return Promise.reject(new Error("Google no está configurado."));
  return new Promise<string>((resolve, reject) => {
    const g = googleGlobal();
    if (!g) {
      reject(new Error("Google no disponible."));
      return;
    }
    g.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: { credential?: string }) =>
        resp.credential
          ? resolve(resp.credential)
          : reject(new Error("Sin credencial de Google.")),
    });
    g.accounts.id.prompt();
  });
}
