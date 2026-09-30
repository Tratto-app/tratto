-- Rubros más generales: de 121 a 46 (más "Otro").
--
-- Los rubros muy específicos (impermeabilización, cámaras de seguridad, cortinas
-- y toldos...) casi nadie los elige como oficio. Se juntan en rubros que la gente
-- realmente usa. Cada rubro viejo pasa al nuevo que le corresponde; cuando el
-- viejo era más específico que el nuevo, su nombre queda como "rubro
-- personalizado" del proveedor, así en su perfil se sigue viendo lo que hace.
--
-- Se actualizan los tres lugares donde se guarda el rubro: los servicios
-- (proveedores), los pedidos (solicitudes) y el dato que queda en la cuenta al
-- registrarse. Un rubro que no está en el mapa se deja como está (por ejemplo,
-- "Electricidad", que salió de la app por la cláusula de matrícula).
-- Se puede correr más de una vez: lo que ya está migrado no se toca.
-- Estas actualizaciones no disparan ningún aviso ni matching (esos triggers son
-- solo de INSERT).

create temporary table _mapa_rubros (viejo text primary key, nuevo text not null, guardar_nombre boolean not null) on commit drop;
insert into _mapa_rubros (viejo, nuevo, guardar_nombre) values
  ('Plomería', 'Plomería y destapaciones', false),
  ('Destapaciones', 'Plomería y destapaciones', false),
  ('Albañilería y refacciones', 'Albañilería y refacciones', false),
  ('Carpintería', 'Carpintería y muebles', false),
  ('Pintura', 'Pintura', false),
  ('Herrería y soldadura', 'Herrería y soldadura', false),
  ('Techos y humedades', 'Techos e impermeabilización', false),
  ('Impermeabilización', 'Techos e impermeabilización', false),
  ('Durlock y cielorrasos', 'Durlock y yeso', false),
  ('Pisos y cerámicas', 'Pisos y revestimientos', false),
  ('Vidriería', 'Vidrios y aberturas', false),
  ('Cerrajería', 'Cerrajería', false),
  ('Aberturas y ventanas', 'Vidrios y aberturas', false),
  ('Aire acondicionado', 'Aire acondicionado', false),
  ('Service de electrodomésticos', 'Service de electrodomésticos', false),
  ('Antenas y redes de TV', 'Arreglos generales', true),
  ('Piletas y mantenimiento', 'Jardinería y piletas', true),
  ('Jardinería y parquización', 'Jardinería y piletas', false),
  ('Poda y extracción de árboles', 'Jardinería y piletas', true),
  ('Limpieza de tanques', 'Servicios de limpieza', true),
  ('Armado de muebles', 'Arreglos generales', true),
  ('Cortinas y toldos', 'Arreglos generales', true),
  ('Cámaras de seguridad', 'Arreglos generales', true),
  ('Portones automáticos', 'Arreglos generales', true),
  ('Pequeños arreglos del hogar', 'Arreglos generales', false),
  ('Limpieza de hogar', 'Servicios de limpieza', false),
  ('Limpieza de oficinas', 'Servicios de limpieza', false),
  ('Limpieza de consorcios', 'Servicios de limpieza', false),
  ('Limpieza final de obra', 'Servicios de limpieza', true),
  ('Limpieza de tapizados y alfombras', 'Servicios de limpieza', true),
  ('Lavado a domicilio', 'Servicios de limpieza', true),
  ('Mecánica general', 'Mecánica del automotor', false),
  ('Chapa y pintura', 'Chapa y pintura', false),
  ('Gomería', 'Gomería y auxilio', false),
  ('Electricidad del automotor', 'Mecánica del automotor', true),
  ('Lavadero y detailing', 'Lavado de autos', false),
  ('Auxilio y remolque', 'Gomería y auxilio', false),
  ('Cerrajería del automotor', 'Cerrajería', true),
  ('Aire acondicionado del automotor', 'Mecánica del automotor', true),
  ('Fletes y mudanzas', 'Fletes y mudanzas', false),
  ('Transporte y logística', 'Fletes y mudanzas', true),
  ('Chofer particular', 'Mandados y compras', true),
  ('Delivery y mensajería', 'Mandados y compras', true),
  ('Contabilidad y facturación', 'Contabilidad e impuestos', false),
  ('Asesoría impositiva', 'Contabilidad e impuestos', false),
  ('Liquidación de sueldos', 'Contabilidad e impuestos', true),
  ('Diseño de interiores', 'Decoración e interiores', false),
  ('Gestoría y trámites', 'Gestoría y trámites', false),
  ('Recursos humanos', 'Asistente administrativo', true),
  ('Consultoría de negocios', 'Asistente administrativo', true),
  ('Desarrollo web', 'Programación y desarrollo', true),
  ('Desarrollo de apps', 'Programación y desarrollo', true),
  ('Diseño gráfico', 'Diseño gráfico', false),
  ('Diseño UX/UI', 'Diseño gráfico', true),
  ('Marketing digital', 'Marketing y redes sociales', false),
  ('Community manager', 'Marketing y redes sociales', true),
  ('Publicidad en redes', 'Marketing y redes sociales', true),
  ('Posicionamiento en Google (SEO)', 'Marketing y redes sociales', true),
  ('Redacción y contenidos', 'Marketing y redes sociales', true),
  ('Edición de video', 'Fotografía y video', true),
  ('Fotografía', 'Fotografía y video', false),
  ('Video y drone', 'Fotografía y video', true),
  ('Ilustración', 'Diseño gráfico', true),
  ('Animación y motion', 'Diseño gráfico', true),
  ('Locución', 'Fotografía y video', true),
  ('Producción musical', 'Música y sonido (DJ)', true),
  ('Automatización con IA', 'Programación y desarrollo', true),
  ('Soporte técnico', 'Reparación y soporte técnico', false),
  ('Reparación de PC y notebooks', 'Reparación y soporte técnico', false),
  ('Reparación de celulares', 'Reparación y soporte técnico', false),
  ('Redes y cableado', 'Reparación y soporte técnico', true),
  ('Ciberseguridad', 'Reparación y soporte técnico', true),
  ('Análisis de datos', 'Programación y desarrollo', true),
  ('Cuidado de adultos mayores', 'Cuidado de adultos mayores', false),
  ('Masajes', 'Masajes', false),
  ('Entrenador personal', 'Personal trainer, yoga y pilates', false),
  ('Yoga y pilates', 'Personal trainer, yoga y pilates', false),
  ('Peluquería', 'Estética, maquillaje y peinados', true),
  ('Barbería', 'Estética, maquillaje y peinados', true),
  ('Manicura y pedicura', 'Estética, maquillaje y peinados', true),
  ('Cosmetología', 'Estética, maquillaje y peinados', true),
  ('Maquillaje', 'Estética, maquillaje y peinados', false),
  ('Depilación', 'Estética, maquillaje y peinados', true),
  ('Estética corporal', 'Estética, maquillaje y peinados', false),
  ('Tatuajes y piercings', 'Estética, maquillaje y peinados', true),
  ('Catering', 'Catering y pastelería', false),
  ('Chef a domicilio', 'Catering y pastelería', true),
  ('Pastelería y tortas', 'Catering y pastelería', false),
  ('Fotografía de eventos', 'Fotografía y video', true),
  ('Filmación de eventos', 'Fotografía y video', true),
  ('DJ y sonido', 'Música y sonido (DJ)', false),
  ('Música en vivo', 'Música y sonido (DJ)', true),
  ('Animación infantil', 'Animación y organización de eventos', false),
  ('Alquiler de livings y mobiliario', 'Animación y organización de eventos', true),
  ('Decoración de eventos', 'Animación y organización de eventos', true),
  ('Organización de eventos', 'Animación y organización de eventos', false),
  ('Barras y coctelería', 'Catering y pastelería', true),
  ('Alquiler de salones', 'Animación y organización de eventos', true),
  ('Clases particulares (primaria)', 'Apoyo escolar y universitario', false),
  ('Clases particulares (secundaria)', 'Apoyo escolar y universitario', false),
  ('Apoyo universitario', 'Apoyo escolar y universitario', false),
  ('Idiomas', 'Idiomas', false),
  ('Clases de música', 'Clases de música', false),
  ('Preparación de exámenes', 'Apoyo escolar y universitario', true),
  ('Cursos y capacitación', 'Computación y capacitación', false),
  ('Clases de manejo', 'Clases de manejo', false),
  ('Clases de natación', 'Personal trainer, yoga y pilates', true),
  ('Clases de computación', 'Computación y capacitación', false),
  ('Paseo de perros', 'Paseo y cuidado de mascotas', false),
  ('Adiestramiento canino', 'Peluquería y adiestramiento canino', false),
  ('Guardería de mascotas', 'Paseo y cuidado de mascotas', false),
  ('Peluquería canina', 'Peluquería y adiestramiento canino', false),
  ('Costura y arreglos de ropa', 'Costura y arreglos de ropa', false),
  ('Tapicería', 'Tapicería y restauración', false),
  ('Restauración de muebles', 'Tapicería y restauración', false),
  ('Imprenta y gráfica', 'Diseño gráfico', true),
  ('Estampado y serigrafía', 'Diseño gráfico', true),
  ('Cartelería', 'Diseño gráfico', true),
  ('Asistente virtual', 'Asistente administrativo', false),
  ('Organización de espacios', 'Decoración e interiores', true),
  ('Compras y mandados', 'Mandados y compras', false);

update public.proveedores p
   set rubro = m.nuevo,
       rubro_personalizado = case when m.guardar_nombre and p.rubro_personalizado is null then m.viejo else p.rubro_personalizado end
  from _mapa_rubros m
 where p.rubro = m.viejo and m.viejo <> m.nuevo;

update public.solicitudes s
   set servicio_necesitado = m.nuevo
  from _mapa_rubros m
 where s.servicio_necesitado = m.viejo and m.viejo <> m.nuevo;

update auth.users u
   set raw_user_meta_data = u.raw_user_meta_data
         || jsonb_build_object('rubro', m.nuevo)
         || case when m.guardar_nombre and coalesce(u.raw_user_meta_data->>'rubro_personalizado', '') = ''
                 then jsonb_build_object('rubro_personalizado', m.viejo) else '{}'::jsonb end
  from _mapa_rubros m
 where u.raw_user_meta_data->>'rubro' = m.viejo and m.viejo <> m.nuevo;

-- Las cuentas demo se reponen con el rubro nuevo.
do $$
declare def text;
begin
  select pg_get_functiondef('privado.reponer_demo'::regproc) into def;
  if def like '%Techos y humedades%' then
    execute replace(def, 'Techos y humedades', 'Techos e impermeabilización');
  end if;
end $$;
revoke all on function privado.reponer_demo() from public, anon, authenticated;
