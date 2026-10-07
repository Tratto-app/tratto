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

## Reglas

Nada se publica, envía ni gasta sin aprobación. Solo se escribe a quien dio
permiso. No se inventan datos, reseñas ni capacidades. Más de 40 rubros, nunca
solo oficios del hogar. Detalle en `protocolo.md`.
