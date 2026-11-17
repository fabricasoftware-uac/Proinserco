---
tipo: adr
numero: 0001
estado: aceptada
fecha: 2026-11-16
creado: 2026-11-16
actualizado: 2026-11-16
proyecto: ProInserco
reemplaza:
reemplazada-por:
---

# ADR-0001 - Checkout hospedado de Openpay por redirect

## Estado

Aceptada, 2026-11-16.

## Contexto

La Fundación Proinserco recibe donaciones en línea con tarjeta (y, si Openpay lo permite por API, PSE). Openpay Colombia ofrece dos integraciones:

1. **Checkout hospedado (redirect)**: el servidor crea el cargo con `confirm: false` y `redirect_url`; Openpay responde `charge_pending` con `payment_method.url`; el donante paga en la página de Openpay y vuelve a nuestro sitio.
2. **Tokenización en página (Openpay.js)**: el navegador captura la tarjeta en nuestra página y obtiene un token.

El vault documenta que el `openpay.v1.min.js` descargable **data de 2018 y solo contiene hosts `.mx`**; no está verificado cuál es el script ni el host correcto para Colombia (ver [[Pagos en Línea y Pasarelas]], sección Openpay Colombia). Además, un sitio de donaciones de una fundación no tiene equipo de cumplimiento PCI propio.

## Decisión

> Usaremos el checkout hospedado de Openpay por redirect. Ningún dato de tarjeta toca nuestro frontend, nuestro servidor, nuestros logs ni nuestra base de datos.

El puerto `PasarelaPagos` (`apps/web/src/modules/donaciones/application/ports/pasarela-pagos.ts`) solo expone `crearCargo` y `consultarCargo`; no existe una operación que reciba tarjeta o token de tarjeta.

## Alternativas consideradas

### Alternativa A - Tokenización en página con Openpay.js
- Ventaja: experiencia de pago sin salir del sitio.
- Contra: nuestra página carga un script de pago y captura la tarjeta, lo que sube el alcance a SAQ A-EP; obliga a abrir la CSP a más hosts; el script y host de Colombia no están verificados.
- **Descartada porque**: sube el alcance PCI y depende de un script cuyo host no se ha podido verificar.

### Alternativa B - Checkout hospedado por redirect
- Ventaja: alcance PCI mínimo (SAQ A, a confirmar por escrito con Openpay); sin scripts de pago en nuestro origen; la CSP solo necesita el host del checkout en `form-action`.
- Contra: el donante sale del sitio; menos control visual del pago; depende de que Openpay conserve esa modalidad.
- **Elegida**.

## Consecuencias

**Positivas**
- Alcance PCI mínimo; un fallo nuestro no puede filtrar tarjetas porque no las vemos.
- La CSP no necesita `script-src` ni `frame-src` de Openpay.
- El adaptador real es un `fetch` con Basic auth, fácil de probar.

**Negativas**
- El host del checkout hospedado aún no se conoce: hay que añadirlo a `form-action` en `apps/web/src/server/csp.ts` (comentario `// SALOMÓN:` en ese archivo) o Chrome bloquea la redirección tras el POST del formulario.
- El retorno del donante **no confirma nada**: la confirmación depende del webhook y de la consulta a la API. Hay que construir y mantener conciliación.
- El SAQ aplicable debe confirmarse por escrito con Openpay; mientras no, es una suposición.

**Riesgos y mitigación**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Openpay retira o cambia el checkout hospedado | Baja | Alto | El puerto `PasarelaPagos` aísla el cambio en un solo adaptador |
| El host del checkout no está en la lista blanca de la CSP | Media | Alto (el donante no llega a pagar) | Probar en sandbox con la CSP en modo solo reporte (`CSP_SOLO_REPORTE=si`) antes de aplicarla |
| Openpay no admite PSE por esta vía | Media | Medio | Preguntar a soporte (ver Handoff, "Preguntas abiertas para Openpay") |

## Cómo se revierte

Cambiar a tokenización en página exige: un campo de token en el contrato del puerto, cargar Openpay.js (con su host en la CSP), una nueva ADR y re-evaluar PCI. Es una decisión costosa de revertir: por eso se toma ahora.

## Enlaces

- [[Handoff para Backend]] (integración Openpay paso a paso)
- [[Pagos en Línea y Pasarelas]] (vault general, sección Openpay Colombia)
- [[ADR-0004 - CSP con nonce y páginas dinámicas]]
- [[ProInserco]]
