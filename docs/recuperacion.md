# Runbook de Recuperación de Desastres

Este documento detalla los pasos inmediatos a seguir en caso de que un flujo crítico de la aplicación sufra una caída, afectando el modelo "Cero Fricción" o la captura de *leads*.

## 1. Caída de Google Gemini (Error 503 en IA)

**Síntoma:** El escáner de récipes falla continuamente o el Asistente de IA (Chat) no responde. El backend devuelve HTTP 503 o 429.

**Acciones Inmediatas:**
1. **Verificar Estado de Google:** Revisa el dashboard de estado de Google Cloud AI o Google AI Studio para confirmar si es un problema global.
2. **Revisar Cuota (429):** Entra a Google Cloud Console. Verifica si excedimos el límite de Tokens por Minuto (TPM) o Peticiones por Minuto (RPM).
   - Si es así, contactar soporte para aumentar la cuota o aplicar limitación agresiva de Rate Limit en FastAPI.
3. **Fallback en UI:** Actualmente, la UI tiene un estado de error (`EstadoError.tsx`) que solicita al usuario contactar manualmente o buscar por texto. Verifica en Vercel Logs que los errores se están encapsulando correctamente.

## 2. Webhooks de n8n Atascados (Leads no notificados)

**Síntoma:** Los leads se están guardando en Supabase (tasa de conversión activa en PostHog), pero las farmacias reportan que no reciben la notificación automática al WhatsApp.

**Acciones Inmediatas:**
1. **Revisar Ejecuciones en n8n:** Entra al panel de n8n y verifica el historial de ejecuciones del Workflow de Notificación de Leads.
2. **Reiniciar Workflow:** Si el workflow está "Paused" o reporta errores de autenticación con la API de Evolution API/OpenWA, reinicia las credenciales en n8n.
3. **Reprocesar Colas:** Los leads que fallaron pueden re-enviarse manualmente consultando Supabase (`select * from leads where notificado = false`) y haciendo un cURL masivo al webhook de n8n.

## 3. Caída / Corrupción de Base de Datos (Supabase)

**Síntoma:** Consultas lentas, timeouts en la API (504 Gateway Timeout), o datos incorrectos en producción.

**Acciones Inmediatas (Restauración Punto-en-el-Tiempo - PITR):**
1. Entra al Dashboard de Supabase -> Database -> Backups.
2. Identifica el tiempo exacto antes de que ocurriera la corrupción o caída.
3. **IMPORTANTE:** Si es un problema de rendimiento (Timeouts), revisa `pg_stat_activity` antes de restaurar. Podría ser simplemente falta de índices o saturación del Connection Pooler (PgBouncer).
4. Si se requiere restauración de *Staging* para depurar:
   - Haz un volcado parcial (`pg_dump`) de las tablas maestras (sin datos PII sensibles) e impórtalos a tu instancia local de Supabase usando el CLI: `supabase db reset`.
