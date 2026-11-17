---
tipo: adr
numero: 0007
estado: propuesta
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0007 - Pedir tipo y número de documento a todo donante

## Estado

**Propuesta**, 2026-11-16. Pendiente de validación por el abogado y el contador de la fundación. No pasa a "aceptada" sin esa validación.

## Contexto

El estándar de privacidad del vault ([[Privacidad y Habeas Data]], "Sitios que reciben donaciones") dice: si el donante quiere certificado, pedir el documento **solo en ese caso** (minimización). Además plantea la debida diligencia (conocimiento del donante y prevención de lavado de activos) como algo a validar con contador y abogado.

El flujo implementado hoy pide **tipo y número de documento a todo donante**, tenga o no interés en certificado:

- El esquema `DatosDonante` (`apps/web/src/modules/donantes/domain/donante.ts`) exige `tipoDocumento` (`CC`, `CE`, `TI`, `PA`, `PPT`, `NIT`) y `numeroDocumento`.
- El repositorio identifica al donante por `(tipoDocumento, numeroDocumento)` (`buscarPorDocumento`) para no duplicarlo si dona varias veces.
- La casilla "quiero certificado de donación" es opcional y solo genera un consentimiento adicional (`certificado_donacion`).

Motivos de la decisión actual: (1) el certificado y la debida diligencia necesitan el documento y pedirlo después fricciona o se olvida; (2) identificar al donante evita duplicados; (3) poder marcar donaciones para revisión manual.

## Decisión (propuesta)

> Pedir tipo y número de documento a todo donante, con la autorización de tratamiento de datos obligatoria y no premarcada, tratando el documento como dato personal de acceso restringido.

## Alternativas consideradas

### Alternativa A - Documento solo si pide certificado (estándar del vault)
- Ventaja: minimización de datos; menos riesgo y menos fricción para donaciones pequeñas.
- Contra: sin documento no se puede aplicar debida diligencia a quien no pidió certificado; más difícil unificar donantes recurrentes.
- **Pendiente de decisión**: es la opción por defecto si el abogado o el contador no respaldan la propuesta.

### Alternativa B - Documento para todos (la implementada)
- Ventaja: conocimiento del donante y certificado sin pasos extra.
- Contra: se recoge más dato personal del necesario para donaciones sin certificado; mayor impacto si hay una filtración.

### Alternativa C - Documento solo desde cierto monto o con certificado
- Ventaja: equilibrio; coherente con umbrales de debida diligencia.
- Contra: requiere conocer el umbral aplicable, que aún no está definido.

## Consecuencias

**Positivas**
- Certificado de donación y debida diligencia siempre posibles.

**Negativas**
- Se aparta del estándar de minimización: mientras no se valide, es una desviación aceptada a sabiendas.
- Obliga a proteger el documento: cifrado a nivel de columna (pgcrypto) o equivalente, enmascarado en el panel (ya implementado: se muestra enmascarado y revelarlo exige permiso `donantes:revelar` y queda en auditoría), nunca en logs (`registro.ts` redacta claves como `documento`).
- Si se pasa a la Alternativa A o C, hay que cambiar el esquema (`numeroDocumento` opcional), la identificación del donante y el formulario (`apps/web/src/flujos/donar`). Es un cambio de contrato.

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El abogado/contador exige minimizar | Media | Medio (cambio de contrato) | Decidir antes de implementar la tabla `donantes` real |
| Filtración de documentos | Baja | Alto | Cifrado de columna, RLS, enmascarado, auditoría de revelados, derecho de supresión con anonimización |
| Cliente no está en el RTE y no expide certificados | Media | Medio | Si no expide certificado, la justificación para pedir el documento cae: revisar (ver Pendientes) |

## Qué hay que validar (checklist)

- [ ] La fundación está en el Régimen Tributario Especial y puede expedir certificados de donación.
- [ ] Qué datos exactos exige el certificado y en qué plazo se expide.
- [ ] Qué umbrales y controles de debida diligencia aplican a la fundación.
- [ ] Plazo de conservación de los soportes (norma contable y tributaria).
- [ ] El aviso de privacidad y la política de tratamiento reflejan la finalidad del documento.

## Cómo se revierte

Pasar a "documento solo con certificado" toca el esquema Zod, el formulario, la identidad del donante y la tabla; coste medio, mucho menor si se decide **antes** de crear la tabla real.

## Enlaces

- [[Privacidad y Habeas Data]] (vault general)
- [[Pendientes]]
- [[Handoff para Backend]]
- [[ProInserco]]
