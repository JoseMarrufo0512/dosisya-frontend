# MVP de DosisYa — Gate de lanzamiento

> Última actualización: 2026-09-05. Este documento no describe qué construir — los flujos obligatorios ya están construidos (ver abajo). Describe qué falta para poder llamarlo "lanzable".

## Objetivo
Permitir que un paciente en Acarigua/Araure encuentre medicamentos disponibles en farmacias cercanas y contacte a una farmacia por WhatsApp, sin crear cuenta.

## Flujos obligatorios para lanzar (estado real)

1. ✅ Un paciente permite ubicación o selecciona una ubicación alternativa. — spec `docs/superpowers/specs/2026-07-12-busqueda-v2-design.md`.
2. ✅ Busca un medicamento por nombre. — mismo spec.
3. ✅ Ve resultados reales de farmacias dentro del radio permitido. — mismo spec (`ST_DWithin`, ver `CLAUDE.md` §5).
4. ✅ Puede abrir el detalle de un medicamento y de la farmacia. — ruta `src/routes/producto.$farmaciaId.$medicamentoId.tsx`.
5. ✅ Puede agregar varios medicamentos a la Lista Médica. — commit `ddbb253`, `src/components/lista/`.
6. ✅ Puede seleccionar una farmacia para su Lista Médica. — `src/components/lista/SelectorFarmacia.tsx` (creado en el mismo commit `ddbb253`).
7. ✅ Puede enviar la Lista Médica por WhatsApp. — `src/lib/whatsapp.ts`, `src/lib/leadsLista.ts`.
8. ✅ Cada acción comercial relevante genera el lead correcto (fan-out). — `docs/contexto/decisiones.md` §"Consolidación de la capa de red", spec `docs/superpowers/specs/2026-07-13-lead-premium-escaner-design.md` (origen `busqueda`/`lista_medica`/`escaner_recipe` para facturación premium). **En riesgo:** ver B-001 en `BACKLOG.md` (3 tests rojos en `leadsLista.test.ts` en `main`).
9. ✅ Una farmacia puede gestionar su información e inventario desde su panel. — spec `docs/superpowers/specs/2026-07-13-admin-farmacia-completar-design.md`, `src/routes/admin.dashboard.tsx`.
10. ✅ Un superadmin puede revisar y aprobar farmacias (con ubicación). — commit `c2d4fe5`, spec `docs/superpowers/specs/2026-07-14-super-admin-panel-design.md`.

Funcionalidad adicional ya construida, fuera de la lista original de 10 pero parte del producto real: escáner de receta con IA (paciente y modo farmacéutico), chat/asistente IA flotante, verificación en vivo de RIF en el registro, facturación con leads premium, landing `/acerca-de`, términos y privacidad.

## No pertenece al MVP
- Pago dentro de la plataforma.
- Comisión por venta.
- Login de paciente completo (existe un placeholder de UI en `src/components/paciente/HojaLoginPaciente.tsx`; el backend de auth de paciente no existe — ver D-002 en `DECISIONES-PENDIENTES.md`).
- Logística propia.
- Funciones no especificadas en `docs/features/`.

## Definition of Done del MVP
El MVP se considera terminado solo si:
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `npm run build` pasa sin errores.
- [ ] `npx vitest run` pasa en verde (**hoy no se cumple** — ver B-001 en `BACKLOG.md`).
- [ ] `scripts/test-leads-cpc.sh` pasa.
- [ ] El job `verify` de `.github/workflows/ci.yml` está en verde en `main`.
- [ ] Los 10 flujos de arriba se verifican **juntos, en un solo recorrido manual**, en desktop y móvil, contra la API real (ver B-002 en `BACKLOG.md` — nunca se ha hecho; cada flujo se validó por separado en su propio plan).
- [ ] No hay mocks activos en funcionalidades declaradas operativas (confirmado: el mock de `recipeIA` se eliminó en el commit `c85f157`).
- [ ] El despliegue de Vercel funciona y no muestra errores de consola críticos.

## Cómo se actualiza este documento
Cuando una tarea de `BACKLOG.md` cierra un ítem de la Definition of Done, marca el checkbox aquí y anota el resultado en `ESTADO-PROYECTO.md`. Si aparece un flujo nuevo que el negocio considera obligatorio para lanzar, agrégalo aquí primero (requiere decisión de José — ver "Requiere autorización humana explícita" en `CLAUDE.md` §8) antes de crear tareas para él en `BACKLOG.md`.
