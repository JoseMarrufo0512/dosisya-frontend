# Errores conocidos (gotchas)
> Las trampas que ya te han mordido. Cada una ahorra horas de debugging.

## Exposición de API Keys de Gemini
- **Pasa cuando:** El frontend intenta llamar directamente a `generativelanguage.googleapis.com`.
- **Causa real:** Claude intentó implementar el escáner de recetas directamente en React.
- **Solución:** ¡NUNCA LLAMAR A GEMINI DESDE REACT! El frontend debe enviar la imagen (Base64/FormData) a nuestro propio backend (FastAPI), y es el backend de Python quien se comunica seguro con Gemini.

## Pérdida del Carrito al Refrescar
- **Pasa cuando:** El usuario añade medicinas, recarga la página, y la lista desaparece.
- **Causa real:** El estado de React se reinició y no estaba sincronizado.
- **Solución:** Usar un custom hook (ej. `useLocalStorage`) para que la "Lista Médica" se guarde en el almacenamiento local del navegador y persista entre sesiones sin requerir login.

## Bloqueo de UI al registrar Leads
- **Pasa cuando:** Clic en "Contactar" congela la app.
- **Solución:** FastAPI usa `BackgroundTasks`. El frontend asume respuesta instantánea.

## Failed to Fetch (CORS Frontend)
- **Solución:** Ajustar `FRONTEND_CORS_ORIGINS` en Vercel.
