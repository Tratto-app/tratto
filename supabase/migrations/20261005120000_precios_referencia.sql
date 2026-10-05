-- Precios de referencia de mercado para el tasador ("Estimar precio").
--
-- El tasador (workflow "Tasador por foto" en n8n) le pedía a la IA "precios de
-- mercado argentinos actuales" sin darle ningún número. La IA contestaba con lo
-- que recordaba, que con la inflación quedó muy atrasado: una clase de inglés
-- salía "$300 a $600". Ahora el workflow lee esta tabla y se la pasa a la IA
-- como base obligatoria, y después controla que el rango no quede por debajo.
--
-- Cada fila es un servicio típico de un rubro con su rango de mano de obra
-- (sin materiales) en el momento en que se relevó. El workflow ajusta cada
-- rango por inflación desde la fecha "relevado" hasta hoy (ajuste mensual en
-- el nodo "Configuracion"), así la tabla no queda vieja de un mes para otro.
-- Igual conviene revisarla cada 3 a 6 meses: se edita desde el panel de
-- Supabase (Table editor → precios_referencia) y al cambiar un precio hay que
-- poner la fecha del relevamiento nuevo en "relevado".
--
-- "unidad" usa las de la app (por trabajo, por hora, por clase, por día, por
-- mes, por evento) y algunas solo de referencia (por m², por kg, por persona).
-- Las filas con fuente "Estimado" no salen de un relevamiento: se calcularon
-- comparando con servicios parecidos de la tabla.
--
-- Solo la lee el workflow, con la clave de servicio. La app no la consulta.

create table if not exists public.precios_referencia (
  id          bigint generated always as identity primary key,
  rubro       text not null,
  servicio    text not null,
  unidad      text not null,
  precio_min  integer not null check (precio_min > 0),
  precio_max  integer not null,
  relevado    date not null,
  fuente      text not null,
  actualizado timestamptz not null default now(),
  constraint precios_referencia_rango check (precio_max >= precio_min),
  constraint precios_referencia_unico unique (rubro, servicio)
);

alter table public.precios_referencia enable row level security;
revoke all on public.precios_referencia from anon, authenticated;

insert into public.precios_referencia (rubro, servicio, unidad, precio_min, precio_max, relevado, fuente) values
  -- Hogar y construcción
  ('Plomería y destapaciones', 'Visita y diagnóstico', 'por trabajo', 17000, 25000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Plomería y destapaciones', 'Destapación simple (pileta o inodoro)', 'por trabajo', 36000, 52000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Plomería y destapaciones', 'Destapación urgente o de guardia', 'por trabajo', 50000, 95000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Plomería y destapaciones', 'Cambio o arreglo de canilla', 'por trabajo', 35000, 60000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Plomería y destapaciones', 'Cambio de inodoro', 'por trabajo', 48000, 65000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Albañilería y refacciones', 'Jornal de albañil oficial', 'por día', 45000, 65000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Albañilería y refacciones', 'Jornal de ayudante', 'por día', 25000, 35000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Albañilería y refacciones', 'Pared de ladrillo', 'por m²', 30000, 50000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Pintura', 'Pintura interior lisa', 'por m²', 5500, 18000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Pintura', 'Habitación chica (3x3 m)', 'por trabajo', 100000, 155000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Pintura', 'Departamento de 2 ambientes', 'por trabajo', 450000, 715000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Pintura', 'Fachada', 'por m²', 9000, 21000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Carpintería y muebles', 'Ajuste o arreglo de puerta o mueble', 'por trabajo', 22000, 40000, '2026-10-01', 'Todo Resuelto, oct 2026'),
  ('Carpintería y muebles', 'Lijado y barnizado completo', 'por m²', 13600, 24500, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Carpintería y muebles', 'Cambio de correderas de cajón', 'por trabajo', 8000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Herrería y soldadura', 'Soldadura o arreglo de reja o portón', 'por trabajo', 15000, 60000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Herrería y soldadura', 'Reja para ventana (1x1 m)', 'por trabajo', 100000, 195000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Herrería y soldadura', 'Jornal de soldador', 'por día', 55000, 90000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Herrería y soldadura', 'Portón corredizo (3x2 m)', 'por trabajo', 520000, 1040000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Techos e impermeabilización', 'Reparación de gotera simple', 'por trabajo', 20000, 45000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Techos e impermeabilización', 'Reparación de gotera compleja', 'por trabajo', 52000, 104000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Techos e impermeabilización', 'Colocación de membrana', 'por m²', 10000, 20000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Durlock y yeso', 'Cielorraso de durlock', 'por m²', 32500, 52000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Durlock y yeso', 'Tabique simple de durlock', 'por m²', 39000, 58500, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Durlock y yeso', 'Reparación de fisuras o enduido', 'por m²', 6000, 16000, '2026-07-01', 'Ellaburante, jul 2026'),
  ('Pisos y revestimientos', 'Colocación de cerámica', 'por m²', 12000, 22000, '2026-07-01', 'Ellaburante, jul 2026'),
  ('Pisos y revestimientos', 'Colocación de porcelanato', 'por m²', 16000, 30000, '2026-07-01', 'Ellaburante, jul 2026'),
  ('Pisos y revestimientos', 'Colocación de piso flotante', 'por m²', 9000, 18000, '2026-07-01', 'Ellaburante, jul 2026'),
  ('Vidrios y aberturas', 'Vidrio común 3 mm colocado', 'por m²', 20000, 33000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Vidrios y aberturas', 'Vidrio float 4 mm colocado', 'por m²', 33000, 52000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Vidrios y aberturas', 'Espejo común', 'por m²', 59000, 104000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Cerrajería', 'Apertura de puerta sin rotura', 'por trabajo', 35000, 60000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Cerrajería', 'Cambio de cerradura común', 'por trabajo', 55000, 95000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Cerrajería', 'Copia de llave común', 'por trabajo', 4000, 11000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Aire acondicionado', 'Instalación de split hasta 3.000 frigorías', 'por trabajo', 90000, 175000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Aire acondicionado', 'Instalación de split de 3.000 a 4.500 frigorías', 'por trabajo', 130000, 200000, '2026-10-01', 'Clickie, precios oct 2026'),
  ('Service de electrodomésticos', 'Visita de diagnóstico', 'por trabajo', 15000, 30000, '2026-10-01', 'Clickie (oct 2026) y Ellaburante (abr 2026)'),
  ('Service de electrodomésticos', 'Cambio de bomba de lavarropas', 'por trabajo', 39000, 65000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Service de electrodomésticos', 'Carga de gas de heladera', 'por trabajo', 45500, 71500, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Jardinería y piletas', 'Corte de pasto, terreno de hasta 100 m²', 'por trabajo', 15000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Jardinería y piletas', 'Corte de pasto, terreno de 100 a 300 m²', 'por trabajo', 25000, 40000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Jardinería y piletas', 'Poda de árbol mediano (3 a 6 m)', 'por trabajo', 30000, 60000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Jardinería y piletas', 'Mantenimiento de jardín chico, semanal', 'por mes', 55000, 80000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Jardinería y piletas', 'Mantenimiento de pileta completo', 'por mes', 78000, 130000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Arreglos generales', 'Visita de 2 horas (hasta 3 tareas simples)', 'por trabajo', 45000, 80000, '2026-10-01', 'Todo Resuelto, oct 2026'),
  ('Arreglos generales', 'Tareas sueltas', 'por hora', 25000, 40000, '2026-10-01', 'Todo Resuelto, oct 2026'),
  ('Arreglos generales', 'Colgar cuadros o espejos (hasta 5)', 'por trabajo', 20000, 40000, '2026-10-01', 'Todo Resuelto, oct 2026'),
  ('Arreglos generales', 'Armado de un mueble', 'por trabajo', 30000, 90000, '2026-10-01', 'Todo Resuelto, oct 2026'),
  ('Arreglos generales', 'Instalación de una cámara de seguridad (mano de obra)', 'por trabajo', 26000, 52000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Servicios de limpieza', 'Limpieza del hogar', 'por hora', 7800, 13000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Servicios de limpieza', 'Media jornada (4 horas)', 'por trabajo', 31200, 45500, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Servicios de limpieza', 'Limpieza de oficinas', 'por hora', 10400, 15600, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Servicios de limpieza', 'Una vez por semana, 4 horas', 'por mes', 130000, 195000, '2026-04-01', 'Ellaburante, abr 2026'),
  -- Autos y traslados
  ('Mecánica del automotor', 'Cambio de aceite y filtro', 'por trabajo', 58500, 104000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Mecánica del automotor', 'Service completo', 'por trabajo', 104000, 195000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Mecánica del automotor', 'Cambio de pastillas de freno', 'por trabajo', 45500, 91000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Mecánica del automotor', 'Alineación y balanceo', 'por trabajo', 32500, 58500, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Chapa y pintura', 'Pintura de un paño (puerta, guardabarros)', 'por trabajo', 160000, 460000, '2026-07-01', 'Talleres en MercadoLibre y precio sugerido FATRA 2026'),
  ('Gomería y auxilio', 'Auxilio para cambio de rueda', 'por trabajo', 20000, 32000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Gomería y auxilio', 'Parche de neumático', 'por trabajo', 10000, 20000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Gomería y auxilio', 'Grúa, traslado de hasta 10 km', 'por trabajo', 58000, 90000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Lavado de autos', 'Lavado exterior', 'por trabajo', 10000, 23000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Lavado de autos', 'Lavado completo (interior y exterior)', 'por trabajo', 20000, 45000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Lavado de autos', 'Detailing', 'por trabajo', 100000, 195000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fletes y mudanzas', 'Flete en furgón chico', 'por hora', 23500, 32500, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fletes y mudanzas', 'Flete con 2 peones', 'por hora', 71500, 117000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fletes y mudanzas', 'Flete chico (pocos muebles, misma ciudad, unas 2 horas)', 'por trabajo', 47000, 65000, '2026-04-01', 'Ellaburante, abr 2026: 2 horas de furgón chico'),
  ('Fletes y mudanzas', 'Mudanza de monoambiente', 'por trabajo', 156000, 234000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fletes y mudanzas', 'Mudanza de 2 ambientes', 'por trabajo', 234000, 364000, '2026-04-01', 'Ellaburante, abr 2026'),
  -- Oficina y profesionales
  ('Contabilidad e impuestos', 'Gestión mensual de monotributo', 'por mes', 15000, 35000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Contabilidad e impuestos', 'Alta en ARCA', 'por trabajo', 25000, 60000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Contabilidad e impuestos', 'Declaración jurada de Ganancias (persona)', 'por trabajo', 40000, 120000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Contabilidad e impuestos', 'Liquidación de sueldo, por empleado', 'por mes', 12000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Gestoría y trámites', 'Transferencia de auto', 'por trabajo', 85000, 150000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Gestoría y trámites', 'Informe de dominio', 'por trabajo', 18000, 35000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Gestoría y trámites', 'Gestión de licencia de conducir', 'por trabajo', 30000, 55000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Gestoría y trámites', 'Habilitación comercial', 'por trabajo', 120000, 280000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Asistente administrativo', 'Tareas administrativas', 'por hora', 8000, 15000, '2026-07-01', 'Estimado: entre limpieza de oficinas y consultor informático junior'),
  ('Diseño gráfico', 'Diseño de logo', 'por trabajo', 80000, 300000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Diseño gráfico', 'Flyer o pieza suelta', 'por trabajo', 15000, 40000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Diseño gráfico', 'Pack mensual de posteos para redes', 'por mes', 90000, 250000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Diseño gráfico', 'Hora de diseño', 'por hora', 15000, 35000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Programación y desarrollo', 'Hora de programador semi senior', 'por hora', 28000, 45000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Programación y desarrollo', 'Página web a medida', 'por trabajo', 450000, 1500000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Programación y desarrollo', 'Soporte informático para una pyme', 'por mes', 120000, 350000, '2026-05-01', 'Ellaburante, may 2026'),
  ('Marketing y redes sociales', 'Community manager, 1 red', 'por mes', 110000, 200000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Marketing y redes sociales', 'Community manager, 2 redes', 'por mes', 200000, 380000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Marketing y redes sociales', 'Pieza de contenido (foto o video)', 'por trabajo', 20000, 55000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fotografía y video', 'Sesión de fotos', 'por trabajo', 80000, 180000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fotografía y video', 'Cobertura de cumpleaños o evento (4 horas)', 'por evento', 150000, 320000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Fotografía y video', 'Casamiento completo', 'por evento', 450000, 800000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Reparación y soporte técnico', 'Técnico de computadoras', 'por hora', 20000, 35000, '2026-05-01', 'Ellaburante (may 2026), referencia CPITLP'),
  ('Reparación y soporte técnico', 'Formateo o puesta a punto de computadora', 'por trabajo', 30000, 70000, '2026-05-01', 'Estimado: 1,5 a 2 horas de técnico'),
  -- Personas y bienestar
  ('Estética, maquillaje y peinados', 'Manicura semipermanente', 'por trabajo', 15000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Estética, maquillaje y peinados', 'Manicura y pedicura', 'por trabajo', 25000, 40000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Estética, maquillaje y peinados', 'Maquillaje social', 'por trabajo', 60000, 120000, '2026-07-01', 'AgendaPro, MercadoLibre y mínimo sugerido de AMRA'),
  ('Personal trainer, yoga y pilates', 'Clase individual', 'por clase', 10000, 20000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Personal trainer, yoga y pilates', 'Entrenamiento a domicilio', 'por clase', 15000, 26000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Personal trainer, yoga y pilates', 'Pack de 8 clases', 'por mes', 65000, 115000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Masajes', 'Masaje descontracturante (1 hora)', 'por trabajo', 35000, 60000, '2026-07-01', 'AgendaPro, Ágora y MercadoLibre, 2026'),
  ('Cuidado de adultos mayores', 'Cuidador con experiencia', 'por hora', 7000, 9500, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Cuidado de adultos mayores', 'Cuidador nocturno', 'por hora', 8000, 12000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Cuidado de adultos mayores', 'Cuidador de jornada completa', 'por mes', 580000, 720000, '2026-04-01', 'Ellaburante, abr 2026'),
  -- Eventos
  ('Catering y pastelería', 'Torta artesanal', 'por kg', 20000, 45000, '2026-07-01', 'Pasteleras en Facebook y MercadoLibre, jul 2026'),
  ('Catering y pastelería', 'Mesa dulce decorada', 'por evento', 45000, 104000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Catering y pastelería', 'Catering para eventos', 'por persona', 15000, 35000, '2026-07-01', 'Estimado: mesa dulce y chef a domicilio'),
  ('Música y sonido (DJ)', 'DJ para cumpleaños o fiesta (4 a 5 horas)', 'por evento', 104000, 195000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Música y sonido (DJ)', 'DJ para cumpleaños de 15', 'por evento', 195000, 390000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Música y sonido (DJ)', 'DJ para casamiento', 'por evento', 325000, 650000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Animación y organización de eventos', 'Animación infantil (2 horas)', 'por evento', 58000, 120000, '2026-07-01', 'Animadores en Instagram, 2026'),
  ('Animación y organización de eventos', 'Decoración de cumpleaños infantil temático', 'por evento', 65000, 195000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Animación y organización de eventos', 'Arco de globos', 'por trabajo', 33000, 78000, '2026-04-01', 'Ellaburante, abr 2026'),
  -- Clases
  ('Apoyo escolar y universitario', 'Primaria', 'por clase', 8000, 15000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Apoyo escolar y universitario', 'Secundaria', 'por clase', 12000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Apoyo escolar y universitario', 'Universitario o ingreso (CBC)', 'por clase', 18000, 35000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Idiomas', 'Inglés general (1 hora)', 'por clase', 20000, 25000, '2026-07-01', 'goFluent Academy, jul 2026'),
  ('Idiomas', 'Inglés de conversación, exámenes o profesional (1 hora)', 'por clase', 25000, 35000, '2026-07-01', 'goFluent Academy, jul 2026'),
  ('Idiomas', 'Portugués, francés, italiano o alemán (1 hora)', 'por clase', 12000, 28000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Clases de música', 'Guitarra (1 hora)', 'por clase', 12000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Clases de música', 'Piano (1 hora)', 'por clase', 15000, 30000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Clases de música', 'Canto (1 hora)', 'por clase', 15000, 28000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Computación y capacitación', 'Clase de computación (1 hora)', 'por clase', 12000, 25000, '2026-04-01', 'Estimado: apoyo escolar y clases de programación'),
  ('Clases de manejo', 'Clase práctica (1 hora)', 'por clase', 32000, 45000, '2026-07-01', 'ACA y escuelas de manejo, jul 2026'),
  -- Mascotas, ropa y casa
  ('Paseo y cuidado de mascotas', 'Paseo individual', 'por trabajo', 6500, 13000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Paseo y cuidado de mascotas', 'Cuidado diurno (8 horas)', 'por día', 20000, 33000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Paseo y cuidado de mascotas', 'Hospedaje', 'por día', 26000, 52000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Peluquería y adiestramiento canino', 'Baño de perro chico o mediano', 'por trabajo', 25000, 35000, '2026-05-01', 'Peluquerías caninas, may 2026'),
  ('Peluquería y adiestramiento canino', 'Baño y corte', 'por trabajo', 35000, 60000, '2026-05-01', 'Peluquerías caninas y GuauAgenda, 2026'),
  ('Costura y arreglos de ropa', 'Ruedo de pantalón', 'por trabajo', 4000, 8000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Costura y arreglos de ropa', 'Cambio de cierre', 'por trabajo', 5000, 15000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Costura y arreglos de ropa', 'Achicar una prenda', 'por trabajo', 8000, 25000, '2026-04-01', 'Ellaburante, abr 2026'),
  ('Tapicería y restauración', 'Retapizado de sillón de 3 cuerpos', 'por trabajo', 250000, 500000, '2026-07-01', 'Tapiceros en MercadoLibre, 2026'),
  ('Tapicería y restauración', 'Retapizado de asiento de silla', 'por trabajo', 15000, 35000, '2026-07-01', 'Estimado: proporción del sillón'),
  ('Decoración e interiores', 'Asesoramiento y proyecto de un ambiente', 'por trabajo', 80000, 250000, '2026-07-01', 'Estimado: diseño gráfico y decoración de eventos'),
  ('Mandados y compras', 'Mandado o envío en moto (hasta 8 km)', 'por trabajo', 15000, 25000, '2026-07-01', 'Mensajerías en moto de CABA, 2026')
on conflict (rubro, servicio) do nothing;
