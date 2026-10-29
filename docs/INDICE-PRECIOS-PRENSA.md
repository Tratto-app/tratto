# Índice de precios para prensa

Página mensual con los precios de referencia de los 46 rubros, cómo citarla y
la planilla para bajar: https://www.trattoapp.com.ar/precios/indice/

La idea (28/10/2026, tomada de Clickie): que los medios usen los números y nos
nombren. Cada dato va con su fecha y su fuente, sin ajustar por inflación; las
filas que estimamos nosotros dicen «Estimado».

## Cómo se actualiza cada mes

1. Exportar la tabla de Supabase a `tools/precios/datos.json`:
   ```sql
   select json_agg(json_build_array(rubro, servicio, unidad, precio_min, precio_max, relevado, fuente)
     order by rubro, id) from public.precios_referencia;
   ```
   y poner la fecha del día en `"exportado"`.
2. `node tools/precios/generar.mjs` → rehace las 46 páginas de rubro, el
   índice para prensa, la planilla `precios-servicios-amba-AAAA-MM.csv` y el
   sitemap.
3. Revisar y subir.

## Mail a periodistas (borrador: no se manda sin aprobación del fundador)

Asunto: Cuánto se paga por un servicio en octubre: 135 precios del AMBA

> Hola, ¿cómo estás? Soy el fundador de Tratto, una app argentina para pedir
> servicios en tu zona. Todos los meses juntamos los precios de referencia de
> 46 rubros en el AMBA: cuánto se cobra una destapación, una mudanza de 2
> ambientes, una clase de inglés o un DJ para un 15. Cada dato tiene su fecha y
> su fuente, y está la planilla para bajar. Te lo paso por si te sirve para una
> nota: https://www.trattoapp.com.ar/precios/indice/
> Si necesitás el detalle de un rubro, te lo armo. Gracias.

Pasó por el humanizador (0 %). A quién mandarlo y desde qué casilla lo decide
el fundador: secciones de economía, consumo e interés general de medios de
CABA y el conurbano, y periodistas que ya escribieron de precios de oficios.
