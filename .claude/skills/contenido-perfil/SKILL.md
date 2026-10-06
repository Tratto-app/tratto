---
name: contenido-perfil
description: Optimiza el perfil de Instagram de Tratto (nombre buscable, usuario, bio, link, destacadas, publicaciones fijadas y foto) para que alguien que llega por primera vez entienda en 3 segundos qué es, para quién y qué hacer. Usar con "mejorá la bio", "optimizá el perfil", "qué pongo en destacadas".
---

# Optimización de perfil

Seguí `tools/contenido/conocimiento/protocolo.md`. Límites en
`tools/contenido/conocimiento/formatos.json` (perfil).

Quien entra al perfil viene de un reel o de una búsqueda y decide en
segundos si sigue la cuenta o toca el link. El perfil tiene que contestar:
**qué es, para quién, por qué confiar y qué hago ahora**.

## Método

1. **Contexto**: `node tools/contenido/cli.mjs contexto` (cuenta, propuesta de valor, diferenciales, CTA principal, ambos segmentos).
2. **Estado actual**: pedí captura del perfil o el texto de nombre, usuario, bio, link y destacadas. Si no lo hay, trabajá desde cero y decilo. No supongas lo que no se ve.
3. **Elemento por elemento**, con la plantilla de mejora (ACTUAL / PROBLEMA / POR QUÉ NO FUNCIONA / NUEVAS OPCIONES / MEJOR OPCIÓN / POR QUÉ):
   - **Nombre** (campo buscable, distinto del usuario): marca + lo que la gente busca ("Tratto · Servicios cerca tuyo").
   - **Bio** (hasta 150 caracteres): qué es + para quién (los dos segmentos si entra) + un diferencial creíble + CTA hacia el link. Sin promesas absolutas ni palabras que la marca evita.
   - **Link**: `cta_principal` con UTM (`?utm_source=instagram&utm_medium=bio`) para medirlo en Vercel Analytics.
   - **Destacadas** (3 a 7, títulos de hasta 15 caracteres): por ejemplo "Cómo funciona", "Precios", "Proveedores", "Dudas", "Seguridad". Para cada una, qué historias van adentro.
   - **Fijadas** (hasta 3): qué piezas fijar (una que explique qué es Tratto, una de valor guardable, una para proveedores) y, si no existen, proponerlas como `idea`.
   - **Foto**: el logo de `tools/piezas-redes/salida/01-foto-de-perfil.png`; revisá que se lea en chico.
4. **Verificar**:
   ```bash
   node tools/contenido/cli.mjs verificar <<'JSON'
   { "formato": "perfil", "nombre": "…", "usuario": "trattoapp_", "bio": "…", "destacadas": ["…"] }
   JSON
   ```
5. **Prueba de 3 segundos**: leé el perfil propuesto como alguien que no conoce Tratto y contestá las 4 preguntas. Si alguna no se contesta, volvé al paso 3.
6. **Memoria**: `registrar contenido` con `formato: perfil`, `titulo: "Perfil vN"`, `guion` con todos los campos, y las fijadas que falten como `idea`.

## Salida

Plantilla de mejora por elemento + el perfil final completo, listo para copiar
y pegar en Instagram, + la verificación del motor.
