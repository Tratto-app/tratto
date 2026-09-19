# Costos del sistema

Qué cobra cada servicio externo, con precios de lista a **septiembre de 2026**.
Los precios cambian: verificá en los links antes de decidir.

> **Nada de esto es gratis para siempre.** Hay capas gratuitas, pero el hosting
> con proceso vivo y la API de IA se cobran desde el primer día de uso real.

---

## Resumen para una barbería chica

Supuesto: **300 conversaciones por mes**, ~8 mensajes por conversación,
1 barbero, 1 local.

| Servicio | Qué cobra | Estimado mensual (USD) |
|---|---|---|
| WhatsApp Cloud API | Solo cobra las plantillas, y no se usan | **0** |
| API de IA (Claude) | Por token de entrada y salida | 3 – 12 |
| Hosting (Render/Railway) | Instancia siempre prendida | 5 – 10 |
| Base de datos PostgreSQL | Instancia gestionada | 0 – 7 |
| Google Sheets / Drive | Gratis en este volumen | 0 |
| Dominio (opcional) | Anual | ~1 (prorrateado) |
| **Total** | | **≈ 5 – 30 USD/mes** |

El rango depende sobre todo de cuánto se usa la IA y de si el Postgres es de
capa gratuita o pago.

---

## 1. WhatsApp Cloud API (Meta)

**Modelo:** desde julio de 2025 Meta cobra **por mensaje de plantilla** (marketing,
utilidad, autenticación) y las **conversaciones de servicio** —las que inicia el
cliente— son **gratis**.

Para este sistema:

- Un cliente escribe para sacar turno → **conversación de servicio → gratis.**
- El sistema **no manda recordatorios** (están apagados), que era lo único que
  iba a costar plata.

**Estimado: 0 USD.** Todo el ida y vuelta de turnos entra en las conversaciones
que inicia el cliente, que no se cobran.

Si algún día prendés los recordatorios: una plantilla de utilidad cuesta
centavos por mensaje, y sobre ~150 turnos/mes serían 2 a 5 USD.

También hay que tener en cuenta:
- El número de WhatsApp Business no puede ser el mismo que ya usa el barbero
  con WhatsApp común.
- La verificación del negocio es gratis pero lleva días.

📎 [Precios de WhatsApp Business](https://developers.facebook.com/docs/whatsapp/pricing)

---

## 2. API de IA (Claude)

**Modelo:** por token. Precios de `claude-opus-5`: **5 USD por millón de tokens
de entrada** y **25 USD por millón de salida**. Las lecturas de caché cuestan una
fracción de la entrada.

**Cómo baja el costo este proyecto:**

- El bloque estable del prompt (rol, reglas, servicios, horarios) se manda con
  `cache_control`, así que a partir del segundo mensaje se cobra como lectura de
  caché en vez de entrada completa.
- `AI_EFFORT=low` por defecto: para un chat de turnos no hace falta más.
- `AI_MAX_TOKENS=2000` y respuestas recortadas a ~600 caracteres.
- Un tope de iteraciones del loop de herramientas (`AI_MAX_ITERACIONES=6`) evita
  que una conversación se descontrole.

**Estimado:** una conversación típica de reserva usa 3 a 5 llamadas al modelo,
la mayoría con caché. Unos **0,01 a 0,04 USD por conversación** →
**3 a 12 USD** por 300 conversaciones.

**Cómo gastar menos:**
- `AI_MODEL=claude-sonnet-5` (2 USD / 10 USD por millón) o
  `claude-haiku-4-5` (1 USD / 5 USD). Para este caso de uso, un modelo más chico
  alcanza bastante bien; conviene probarlo en `/test-chat` antes de cambiarlo.
- `AI_HABILITADA=false` deja el bot en modo menú: **costo cero de IA**, y los
  turnos se siguen reservando.

📎 [Precios de la API](https://www.anthropic.com/pricing)

---

## 3. Hosting

Hace falta un **proceso siempre vivo**: los workers de recordatorios y de
sincronización con Sheets no funcionan en serverless.

| Plataforma | Plan | USD/mes | Nota |
|---|---|---|---|
| Render | Starter | ~7 | El plan gratuito **duerme** el servicio: los recordatorios no salen a horario |
| Railway | Uso medido | ~5 | Se paga por lo que consume |
| Fly.io | Máquina chica | ~3–5 | Más configuración |
| VPS (Hetzner, DigitalOcean) | 1 vCPU | ~5 | Hay que administrarlo |
| **Vercel** | — | — | ❌ No sirve: serverless, sin proceso vivo ni disco |

---

## 4. Base de datos

| Opción | USD/mes | Nota |
|---|---|---|
| Supabase | 0 (Free) / 25 (Pro) | El free pausa el proyecto si está inactivo |
| Neon | 0 (Free) / ~19 | Free suficiente para una barbería |
| Railway Postgres | ~5 | Cómodo si el backend ya está ahí |
| Render Postgres | 0 (90 días) / ~7 | El free **se borra a los 90 días** |
| SQLite (incluido) | 0 | Solo con una instancia y disco persistente |

**Recomendación:** empezar con Neon o Supabase en capa gratuita y pasar a un plan
pago cuando el negocio lo justifique. Lo importante es que haya **backups**.

---

## 5. Google Sheets / Drive

**Gratis** en este volumen. Las cuotas de la API (300 lecturas/minuto por
proyecto, 60 por usuario) están muy por encima de lo que usa el sistema, que
sincroniza cada 15 segundos y solo cuando hay cambios.

Si la planilla creciera a decenas de miles de filas conviene archivar los turnos
viejos: la base de datos igual los guarda todos.

---

## 6. Otros

- **Dominio:** 10 a 15 USD al año (opcional; las plataformas dan un subdominio).
- **HTTPS:** gratis en todas las plataformas mencionadas.
- **ngrok** (solo desarrollo): gratis alcanza.

---

## Cómo bajar el costo a casi cero para probar

1. `AI_HABILITADA=false` → sin costo de IA, el bot atiende por menú.
2. Los recordatorios ya vienen apagados → sin costo de WhatsApp.
3. SQLite + un VPS de 5 USD, o directamente la notebook con ngrok.

Con eso el sistema completo se prueba **sin gastar nada más que el hosting**.
