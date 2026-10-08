---
name: contenido-planificador
description: Planificador semanal de TikTok e Instagram para Tratto. Arma la semana entera, de lunes a domingo, con qué publicar, cuándo y en qué formato (reel, carrusel, historia, post), repartido por pilares y segmentos, con el mismo video adaptado a las dos redes y los horarios que mejor funcionan. Usar con "¿qué publico esta semana?", "armá el calendario", "planificá la semana", "qué subo a TikTok".
---

# Planificador semanal (TikTok + Instagram)

Pieza 1 de 9 del sistema de contenido. Antes de empezar leé
`tools/contenido/conocimiento/protocolo.md` y
`tools/contenido/conocimiento/plataformas.md`.

## Pasos

1. **Contexto.** `node tools/contenido/cli.mjs contexto` (marca, segmentos,
   pilares con su porcentaje, frecuencia, horarios) y
   `node tools/contenido/cli.mjs metricas` (qué funcionó). Si Metricool está
   conectado, traé lo publicado la semana anterior y lo ya programado
   (`getScheduledPosts`) para no pisar horarios.
2. **Cuotas.** De `config/estrategia.json`: reels y carruseles por semana e
   historias por día. Repartí por pilar según su porcentaje y compensá el que
   quedó atrás la semana pasada. Alterná segmentos (clientes y proveedores) y
   rubros: más de 40, nunca solo hogar.
3. **Una pieza, dos redes.** Cada video vertical sale en TikTok y en Instagram
   (link con nombre distinto por red, protocolo sección 8.2). Los carruseles
   van a Instagram y, en modo foto, a TikTok. Usá `contenido-reutilizador`
   para adaptarlos.
4. **Horarios.** Los de `horarios` en la estrategia. No pongas dos piezas de la
   misma red a menos de 3 horas. Si hay un día con fecha especial (feriado,
   fin de mes, Día de la Madre), aprovechalo.
5. **Ganchos.** Para cada pieza, un gancho con `contenido-hooks`, variando la
   fórmula (número primero, mito vs. realidad, antes/después, confesión;
   `conocimiento/plataformas.md`). No repitas la misma fórmula dos días seguidos.
6. **Entregar el calendario** (tabla de abajo) y registrar cada pieza:
   `node tools/contenido/cli.mjs registrar idea` (o `contenido` en borrador si
   ya está escrita). Si lo pide el equipo de marketing, cada pieza va a la
   cola `growth_mkt_items` como `para_aprobar`
   (`.claude/skills/equipo-marketing/protocolo.md`, sección 4).

## Salida

```
SEMANA DEL [fecha] · [N] reels · [N] carruseles · historias todos los días

| Día | Hora | Red | Formato | Pilar · segmento | Gancho | Rubro |
|---|---|---|---|---|---|---|
| Lun | 18:00 | TikTok + IG | Reel | Cuánto sale · clientes | "…" | Fletes |
| … |

Por qué esta semana: [2 renglones con el dato que lo justifica]
Lo que falta para producir: [guiones, placas, videos, con la skill de cada uno]
```

## Reglas

- No llenes por llenar: si no hay idea buena para un día, dejalo libre y decilo.
- No prometas alcance ni resultados. Lo que se mide: guardados, compartidos y
  clics al link con nombre.
- Lo programado en Metricool sale con publicación manual, solo lo aprobado.
