# Alianzas con inmobiliarias y administraciones de consorcios

Idea del 28/10/2026 (Clickie tiene un acuerdo con una aseguradora; para Tratto
tiene más sentido algo local): inmobiliarias y administraciones de consorcios
necesitan oficios todo el tiempo.

## Qué hay

- **Página**: https://www.trattoapp.com.ar/alianzas.html (`alianzas.html`).
  Cuenta qué pueden hacer con Tratto y tiene un formulario: nombre, empresa,
  tipo (inmobiliaria, consorcios u otra), email, teléfono, zona y mensaje.
- **Al mandar el formulario** (`public.alianza_contacto`, migración
  `20261029170000_alianzas.sql`): se guarda en `privado.alianzas_contactos`,
  aparece un aviso en la cola del equipo del CRM y llega un mail. Tope de 3 por
  mail por día.

## Mail de presentación (borrador: no se manda sin aprobación del fundador)

Asunto: Los arreglos de sus propiedades, en un solo lugar

> Hola, ¿cómo andás? Soy el que hizo Tratto, una app argentina para pedir
> arreglos y servicios en tu zona. Pensé en ustedes porque en una inmobiliaria
> o en una administración siempre hay algo para arreglar: una canilla, una
> humedad, una cerradura. En Tratto publican el arreglo, les llegan presupuestos
> de gente de la zona con qué incluye cada uno y queda todo por escrito en el
> chat. Para quien pide es gratis. Si les interesa, les cuento en quince minutos
> cómo lo usarían y armamos juntos los primeros pedidos. Acá está todo:
> https://www.trattoapp.com.ar/alianzas.html
> Saludos.

Pasó por el humanizador (0 %).

## Cómo seguir (cuando el fundador lo apruebe)

1. Armar la lista: inmobiliarias y administraciones de CABA y GBA con mail
   público (el departamento de prospección ya sabe buscarlas con Firecrawl).
   Una presentación por dirección, como con quienes ofrecen servicios.
2. Mandar el mail de arriba desde la casilla de la campaña, de a pocos por día.
3. A quien conteste: una llamada corta y cargar con él los primeros pedidos.
