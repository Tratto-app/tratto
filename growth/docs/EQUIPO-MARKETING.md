# Equipo de marketing (CMO + 5 departamentos con Claude Code)

Armado el 7/10/2026 a partir del video "Equipo de marketing con Claude" que pasó
el fundador, adaptado a Tratto y conectado al CRM.

```
                         ┌──────────────────────────┐
                         │ CMO  (skill equipo-marketing)
                         │ lee el CRM, planifica,   │
                         │ reparte, informa         │
                         └────────────┬─────────────┘
        ┌───────────────┬─────────────┼──────────────┬─────────────────┐
     Redes          SEO local     Contenido      Anuncios        Operaciones
  (mkt-redes)   (mkt-seo-local) (mkt-contenido) (mkt-anuncios)  (mkt-operaciones)
  TikTok · IG    páginas de     guías, promos,  Meta y Google   CRM: mails,
  Metricool      precios, perfil mail novedades  listas para     seguimientos,
  Canva · video  de Google                       cargar · costo  bajas, salud
                                                 por registro
                                  │
                     cola: growth_mkt_items (Supabase)
                                  │
                  panel: trattoapp.com.ar/crm/equipo  ← la persona aprueba
```

## Piezas

| Pieza | Dónde |
|---|---|
| CMO (orquestador) | `.claude/skills/equipo-marketing/SKILL.md` |
| Reglas del equipo | `.claude/skills/equipo-marketing/protocolo.md` |
| Departamentos | `.claude/agents/mkt-redes.md`, `mkt-seo-local.md`, `mkt-contenido.md`, `mkt-anuncios.md`, `mkt-operaciones.md` |
| Cola de trabajo | tabla `growth_mkt_items` (RLS por miembro del workspace) |
| Números | `mkt_tablero(ws, dias)` |
| Envío a un grupo | `mkt_inscribir(workflow, max)` (solo MCP / service role; solo `opt_in`) |
| Panel | `growth/web/src/pages/Equipo.tsx` → `/crm/equipo` |
| Migración | `supabase/migrations/20261007200000_equipo_marketing.sql` |

## Cómo trabaja

1. **Todos los días** (rutina): el CMO toma los pedidos que cargaste en el
   panel, hace ejecutar lo que aprobaste, revisa la salud del CRM y trae
   métricas de redes.
2. **Los lunes** (rutina): plan semanal con los números del CRM. Cada
   departamento prepara sus piezas y las deja **para aprobar**. El CMO escribe el
   informe.
3. **Vos** entrás a `/crm/equipo`: aprobás, pedís cambios o descartás. También
   podés cargar un pedido con "+ Pedido al equipo".
4. Lo aprobado se ejecuta en la corrida siguiente: los posts se programan en
   Metricool con publicación manual (te llega la notificación al teléfono),
   las páginas se publican en la web, los mails salen por el CRM.

También se le puede hablar directo en Claude Code: `/equipo-marketing`
("¿cómo vamos?", "semanal", "diario", "que Redes haga un reel de…").

## Qué es automático y qué es a mano

| Automático (con aprobación) | A mano (no hay conexión) |
|---|---|
| Programar en TikTok e Instagram (Metricool) | Cargar campañas en Meta Ads / Google Ads y su presupuesto |
| Diseños en Canva, videos con `video-publicidad` | Responder reseñas de Google (el equipo deja el texto) |
| Páginas y guías en la web (PR + publicación) | Crear el perfil de Google de Tratto |
| Mails del CRM (automatizaciones, novedades) | WhatsApp e Instagram DM (falta verificación de Meta) |
| Links con nombre y medición de registros por pieza | Cargar el gasto real de anuncios (Sources o pedírselo al equipo) |

## Mails a proveedores (Gmail, un rubro por día)

Pedido del 8/10/2026: 70 mails por día desde **trattoapp1@gmail.com**, cada día
a un rubro distinto; al terminar los 46 rubros vuelve a empezar por el 1.

- **Quién lo hace:** el agente `mkt-prospeccion` (`.claude/agents/`), con una
  rutina diaria propia.
- **Rotación:** tabla `growth_mkt_rotacion` (los 46 rubros en el orden de la
  app). `mkt_rubro_del_dia()` toma el que menos vueltas tiene. La zona cambia
  en cada vuelta: CABA, GBA Norte, GBA Oeste, GBA Sur, interior bonaerense.
- **De dónde salen los mails:** búsquedas web (Firecrawl) de direcciones que
  el propio negocio publicó para que lo contacten. Solo CABA y Provincia de
  Buenos Aires.
- **Cada mail:** personalizado (qué hace y dónde), texto plano, con link a la
  web etiquetado `utm_source=prospeccion`, dónde encontramos el mail y la
  opción de responder "no". Un solo mail por dirección, nunca un seguimiento
  automático.
- **En el CRM:** cada proveedor queda como contacto **proveedor**, fuente
  "Mails a proveedores (Gmail)", con permiso `unknown` (las automatizaciones
  de Brevo no le escriben). Si se registra en la app, se une solo por mail.
- **Respuestas:** el agente marca bajas ("no") y rebotes, y deja **borradores**
  de respuesta en Gmail para los interesados. Nunca responde solo.
- **Frenos:** no envía si la plantilla no está aprobada en el panel, si está
  en pausa, o si los rebotes pasan el 10 %.
- **Números:** `select mkt_prospeccion_numeros(7);` y un informe por día en
  `/crm/equipo`.
- **Por qué Gmail y no Brevo:** Brevo prohíbe escribir a direcciones sacadas
  de internet y, si lo detecta, suspende la cuenta entera (incluidos los mails
  de la app).

Migración: `supabase/migrations/20261008150000_prospeccion_proveedores.sql`.

## Reglas

Nada se publica, envía ni gasta sin aprobación. Solo se escribe a quien dio
permiso (salvo los mails a proveedores de arriba). No se inventan datos, reseñas ni capacidades. Más de 40 rubros, nunca
solo oficios del hogar. Detalle en `protocolo.md`.
