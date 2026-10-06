# Memoria del sistema de contenido

Un archivo JSONL por tipo (una línea = un registro). Los escribe
`node tools/contenido/cli.mjs registrar <tipo>`; no hace falta editarlos a mano.

| Archivo | Qué guarda |
|---|---|
| `contenidos.jsonl` | Piezas creadas, mejoradas o publicadas (formato, pilar, hook, guion, estado, puntaje previsto) |
| `hooks.jsonl` | Hooks usados, para no repetirlos |
| `resultados.jsonl` | Métricas reales de piezas publicadas |
| `aprendizajes.jsonl` | Conclusiones con su evidencia (funciona / no funciona / hipótesis) |
| `ideas.jsonl` | Ideas pendientes, usadas o descartadas |

**Este repositorio es público**: no guardar datos personales de clientes ni
proveedores, contraseñas, tokens ni números internos que no quieras mostrar.
Para guardar la memoria en otro lado, apuntar `CONTENIDO_MEMORIA_DIR` a otra carpeta.

Si una línea se rompe, `node tools/contenido/cli.mjs validar` dice cuál; el
resto de la memoria se sigue leyendo.
