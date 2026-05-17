# memory/

Documentación maestra del proyecto pensada para que cualquier persona —
o cualquier IA que entre con sesión nueva — pueda entender en 10 minutos
qué es AnimeShowdown, cómo está construido, qué está hecho y qué falta.

## Qué hay aquí

- **[project_plan_v2_estado.md](project_plan_v2_estado.md)** — **EMPIEZA POR
  AQUÍ.** Brief operativo completo: contexto del proyecto, stack,
  bloques cerrados, pendientes con prioridad, decisiones técnicas
  clave, glosario y guía de cómo retomar sin romper nada. Se actualiza
  con cada commit relevante.

- **[project_plan_v2_brief.md](project_plan_v2_brief.md)** — Plan v2
  original con 17 bloques y ~150 sub-puntos tal como lo redactó el autor
  del proyecto. Documento de referencia largo, consultar para detalles
  finos cuando el estado actual remita a un sub-bloque concreto. Es
  inmutable: no se reescribe, se anota en el `estado.md`.

## Para una sesión nueva (humano o IA)

1. Lee `project_plan_v2_estado.md` entero — son ~250 líneas.
2. Si necesitas el detalle de un bloque concreto, salta a la sección
   correspondiente del `project_plan_v2_brief.md`.
3. El `README.md` del repo (raíz) tiene el estado live de la web,
   features destacadas, setup local, endpoints y roadmap.
4. Las reglas operativas del proyecto (commits granulares, sin
   co-author Claude, push automático tras cada commit, preguntar
   antes de decisiones de estilo) están vivas como memorias del
   agente Claude del autor. Si trabajas en otra IA o como humano,
   respeta el mismo patrón mirando el `git log` reciente.

## Cómo se mantiene

- El `project_plan_v2_estado.md` se actualiza cada vez que se cierra un
  bloque o se toma una decisión técnica relevante. No es un changelog
  exhaustivo — para eso está `git log`. Es un brief de "estado en este
  momento".
- El `project_plan_v2_brief.md` no se toca salvo que el autor revise el
  plan original.
- Cualquier resumen de cambios concreto va al mensaje del commit, no a
  estos archivos.
