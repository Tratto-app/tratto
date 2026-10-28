const { abrir, estadoNuevo, medir, SALIDA, chromium } = require('./banco');

const resultados = [];
function ok(caso, cond, detalle){ resultados.push({caso, ok: !!cond, detalle: detalle || ''}); }
const foto = (page, nombre) => page.screenshot({ path: SALIDA + '/' + nombre + '.png' });
const esperar = ms => new Promise(r => setTimeout(r, ms));
const prov = (extra) => Object.assign({ rol: 'proveedor', nombre: 'Raúl Gómez', telefono: '11 5555-5555', rubro: 'Plomería y destapaciones' }, extra || {});
const cli  = (extra) => Object.assign({ rol: 'cliente', nombre: 'María Pérez', telefono: '11 4444-4444' }, extra || {});
const accion = (page, texto) => page.locator('#guia-tarjeta .gt-acciones button', { hasText: texto }).click();
const nav = (page, que) => page.click('#guia-tarjeta [data-g="' + que + '"]');

async function llenarServicio(page){
  await page.selectOption('#p-zona', { index: 1 });
  await page.fill('#p-desde', '20000');
  await page.fill('#p-hasta', '60000');
  await page.selectOption('#p-disp', { index: 1 });
  await page.fill('#p-desc', 'Destapaciones y cambio de canillas. Llevo mis herramientas.');
  await page.click('#p-declara');
}

(async () => {
  const browser = await chromium.launch();
  try{

  /* ── A. Proveedor nuevo que publica su primer servicio ── */
  {
    const est = estadoNuevo(); est.user.user_metadata = prov();
    const { ctx, page } = await abrir(browser, est);
    let m = await medir(page);
    ok('A1 la guía abre sola al entrar (proveedor nuevo)', m.guia && m.paso.includes('Paso 1 de 6'), m.tit);
    ok('A1 la tarjeta entra en pantalla y no tapa el botón', m.dentro && !m.tapaLoSenalado);
    ok('A1 aviso grande "Publicá tu servicio" en el Panel', await page.isVisible('.paso-uno'));
    ok('A1 no aparece la hoja de avisos encima', !(await page.isVisible('#telon-avisos.abierto')));
    // toca el botón real resaltado
    await page.click('#panel-crear'); await esperar(600);
    m = await medir(page);
    ok('A2 tocar el botón real lleva al formulario y la guía lo acompaña', m.pantalla === 'p-nuevo-proveedor' && m.tit === 'Completá tu servicio', m.tit);
    await foto(page, 'A2-formulario-con-guia');
    await accion(page, 'Completar el formulario'); await esperar(500);
    m = await medir(page);
    ok('A3 "Completar el formulario" achica la guía a la barrita', !m.guia && m.mini);
    await page.locator('#p-desc').scrollIntoViewIfNeeded(); await esperar(300);
    ok('A3 ejemplos reales del rubro debajo de "Qué ofrecés"', (await page.textContent('#p-tipicos')).includes('Cambio de inodoro'));
    ok('A3 la vista previa muestra el oficio de la cuenta', (await page.textContent('#pv-rubro')).includes('Plomería'));
    await foto(page, 'A3-formulario-barrita');
    // publicar sin tildar: la validación existente frena
    await page.selectOption('#p-zona', { index: 1 });
    await page.click('#p-enviar'); await esperar(400);
    ok('A4 sin completar no publica (validaciones de siempre)', est.posts.proveedores === 0 && await page.isVisible('#p-aviso.visible'));
    await llenarServicio(page);
    await page.click('#p-enviar'); await esperar(1800);
    m = await medir(page);
    ok('A5 publicado: festejo y paso "ver y editar" en Mi perfil', est.posts.proveedores === 1 && m.festejo.includes('quedó publicado') && m.pantalla === 'p-ficha', m.festejo + ' · ' + m.pantalla);
    ok('A5 el servicio aparece en Mi perfil con "Editar"', await page.isVisible('#pf-servicios [data-editar-serv]'));
    await foto(page, 'A5-publicado');
    await nav(page, 'siguiente'); await esperar(700);
    m = await medir(page);
    ok('A6 paso notificaciones en Cuenta, señalando el interruptor real', m.pantalla === 'p-perfil' && m.estado === 'Desactivadas', m.estado);
    ok('A6 el aviso "te falta publicar" ya no está', !(await page.isVisible('#aviso-serv-cuenta .paso-fino')));
    await accion(page, 'Activar notificaciones'); await esperar(900);
    m = await medir(page);
    ok('A7 notificaciones permitidas: "Activadas" recién con la suscripción guardada', m.estado === 'Activadas' && est.pushGuardadas >= 1, 'guardadas ' + est.pushGuardadas);
    await foto(page, 'A7-avisos-activadas');
    await nav(page, 'siguiente'); await esperar(700);
    m = await medir(page);
    ok('A8 paso Mercado Pago en el Panel: sin conectar', m.pantalla === 'p-panel' && m.estado === 'Sin conectar', m.estado);
    const [popup] = await Promise.all([ctx.waitForEvent('page', {timeout: 4000}).catch(() => null), accion(page, 'Conectar Mercado Pago')]);
    await esperar(900);
    m = await medir(page);
    ok('A9 tocar "Conectar" no lo marca conectado: queda Pendiente', m.estado === 'Pendiente' && !!popup, m.estado);
    ok('A9 el intento quedó guardado en la cuenta antes de salir', !!(est.user.user_metadata.guia_proveedor || {}).mp_intento);
    if(popup) await popup.close();
    await foto(page, 'A9-mp-pendiente');
    est.cuentaMP = { mp_user_id: 123456789, created_at: new Date().toISOString() };
    await accion(page, 'Ya lo autoricé'); await esperar(900);
    m = await medir(page);
    ok('A10 cuenta conectada de verdad: "Conectada"', m.estado === 'Conectada' && m.tit === 'Mercado Pago conectado', m.estado);
    await foto(page, 'A10-mp-conectada');
    await nav(page, 'siguiente'); await esperar(600);
    m = await medir(page);
    ok('A11 paso pedidos, presupuestos y chat', m.tit === 'Pedidos, presupuestos y chat');
    await nav(page, 'siguiente'); await esperar(600);
    m = await medir(page);
    const resumen = await page.textContent('#guia-tarjeta');
    ok('A12 resumen distingue Hecho de Visto', m.paso.includes('Resumen') && resumen.includes('Hecho') && resumen.includes('Visto'));
    await foto(page, 'A12-resumen');
    await nav(page, 'terminar'); await esperar(1600);
    ok('A13 al terminar se guarda "terminada"', (est.user.user_metadata.guia_proveedor || {}).estado === 'terminada');
    // vuelve a entrar
    await page.reload(); await esperar(2400);
    m = await medir(page);
    ok('A14 usuario que ya completó vuelve a entrar: no se repite', !m.guia && !m.mini);
    await page.click('.tab[data-ir="perfil"]'); await esperar(500);
    ok('A14 en Cuenta figura "Recorrida" y "Verla de nuevo"', (await page.textContent('#guia-sello')) === 'Recorrida' && (await page.textContent('#guia-ver-txt')) === 'Verla de nuevo');
    // editar el servicio
    await page.click('#lista-perfiles [data-editar-serv]'); await esperar(500);
    ok('A15 Editar abre el mismo formulario en modo edición', (await page.textContent('#np-tit')) === 'Editá tu servicio' && !(await page.isVisible('#p-declara-caja')));
    ok('A15 el formulario trae los datos guardados', (await page.inputValue('#p-desde')) === '20.000');
    await page.fill('#p-hasta', '80000'); await page.click('#p-enviar'); await esperar(1200);
    ok('A16 guardar cambios hace un PATCH y avisa', est.patches === 1 && est.proveedores[0].precio_hasta === 80000 && await page.isVisible('#serv-aviso.visible'));
    await foto(page, 'A16-editado');
    ok('A errores de JavaScript', !(est.errores || []).length, (est.errores || []).join(' | '));
    await ctx.close();
  }

  /* ── B. Proveedor sin servicios que omite la guía ── */
  {
    const est = estadoNuevo(); est.user.user_metadata = prov();
    const { ctx, page } = await abrir(browser, est);
    await nav(page, 'ahora'); await esperar(1500);
    let m = await medir(page);
    ok('B1 "Ahora no" cierra la guía y no bloquea nada', !m.guia && !m.mini);
    ok('B1 se guarda pausada', (est.user.user_metadata.guia_proveedor || {}).estado === 'pausada');
    ok('B2 el Panel muestra el aviso grande con el botón directo', await page.isVisible('.paso-uno #panel-crear'));
    await foto(page, 'B2-panel-aviso');
    await page.click('.tab[data-ir="chats"]'); await esperar(400);
    ok('B3 Chats muestra el aviso corto', await page.isVisible('#aviso-serv-chats .paso-fino'));
    await foto(page, 'B3-chats-aviso');
    await page.click('.tab[data-ir="perfil"]'); await esperar(400);
    ok('B4 Cuenta: aviso corto, botón destacado y "Retomar la guía"', await page.isVisible('#aviso-serv-cuenta .paso-fino') &&
      await page.locator('#ir-proveedor.destacado').count() === 1 && (await page.textContent('#guia-ver-txt')) === 'Retomar la guía');
    await page.click('.tab[data-ir="ficha"]'); await esperar(800);
    ok('B5 Mi perfil: aviso corto arriba', await page.isVisible('#aviso-serv-ficha .paso-fino'));
    await page.reload(); await esperar(2400);
    m = await medir(page);
    ok('B6 al volver a entrar no se impone la guía pausada', !m.guia && !m.mini);
    // el aviso corto lleva al formulario
    await page.click('.tab[data-ir="chats"]'); await esperar(300);
    await page.click('#aviso-serv-chats [data-ofrecer-servicio]'); await esperar(400);
    ok('B7 el botón del aviso abre el formulario de servicio', (await medir(page)).pantalla === 'p-nuevo-proveedor');
    ok('B errores de JavaScript', !(est.errores || []).length, (est.errores || []).join(' | '));
    await ctx.close();
  }

  /* ── C. Cierra en el medio y retoma desde Cuenta ── */
  {
    const est = estadoNuevo(); est.user.user_metadata = prov();
    const { ctx, page } = await abrir(browser, est);
    await nav(page, 'siguiente'); await esperar(600);   // formulario
    await nav(page, 'siguiente'); await esperar(1000);  // Mi perfil
    let m = await medir(page);
    ok('C1 "Siguiente" sin publicar no lo da por hecho', m.tit === 'Acá va a aparecer tu servicio' && m.estado === 'Sin publicar', m.tit);
    await page.click('#guia-tarjeta .gt-cerrar'); await esperar(1500);
    await page.reload(); await esperar(2400);
    m = await medir(page);
    ok('C2 cerrada no reaparece sola', !m.guia);
    await page.click('.tab[data-ir="perfil"]'); await esperar(400);
    ok('C3 Cuenta dice en qué paso quedó', (await page.textContent('#guia-sello')) === 'Paso 3 de 6');
    await page.click('#guia-ver'); await esperar(1200);
    m = await medir(page);
    ok('C4 "Retomar la guía" sigue desde el mismo paso', m.guia && m.paso.includes('Paso 3 de 6') && m.pantalla === 'p-ficha', m.paso);
    // tocar fuera achica, la barrita la trae de vuelta
    await page.mouse.click(20, 120); await esperar(400);
    m = await medir(page);
    ok('C5 tocar fuera de la tarjeta la achica (no bloquea)', !m.guia && m.mini);
    await page.click('#guia-mini [data-gm="seguir"]'); await esperar(800);
    ok('C6 "Seguir la guía" la vuelve a abrir', (await medir(page)).guia);
    // sale del formulario sin publicar
    await nav(page, 'atras'); await esperar(700);
    await accion(page, 'Completar el formulario'); await esperar(500);
    await page.click('#volver'); await esperar(900);
    m = await medir(page);
    ok('C7 sale del formulario sin publicar: vuelve al paso de publicar', m.guia && m.paso.includes('Paso 1 de 6') && m.estado === 'Pendiente', m.paso);
    ok('C errores de JavaScript', !(est.errores || []).length, (est.errores || []).join(' | '));
    await ctx.close();
  }

  /* ── D. Notificaciones rechazadas y no disponibles ── */
  {
    const est = estadoNuevo(); est.user.user_metadata = prov();
    const { ctx, page } = await abrir(browser, est, { respuesta: 'denied' });
    for(const x of [1,2,3]){ await nav(page, 'siguiente'); await esperar(800); }
    await accion(page, 'Activar notificaciones'); await esperar(900);
    let m = await medir(page);
    const txt = await page.textContent('#guia-tarjeta');
    ok('D1 permiso rechazado: "Bloqueadas" con cómo resolverlo', m.estado === 'Bloqueadas' && txt.includes('candado') && txt.includes('Revisar de nuevo'));
    await foto(page, 'D1-avisos-bloqueadas');
    await ctx.close();
  }
  {
    const est = estadoNuevo(); est.user.user_metadata = cli();
    const { ctx, page } = await abrir(browser, est, { sinPush: true,
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    for(const x of [1,2,3,4]){ await nav(page, 'siguiente'); await esperar(800); }
    const m = await medir(page);
    const txt = await page.textContent('#guia-tarjeta');
    ok('D2 iPhone en Safari sin instalar: "No disponible acá" y cómo instalarla', m.estado === 'No disponible acá' && txt.includes('Agregar a inicio'), m.estado);
    await foto(page, 'D2-avisos-iphone-safari');
    await ctx.close();
  }

  /* ── E. Cliente nuevo ── */
  {
    const est = estadoNuevo(); est.user.user_metadata = cli();
    const { ctx, page } = await abrir(browser, est);
    let m = await medir(page);
    ok('E1 cliente nuevo: la guía señala "Pedir un servicio"', m.guia && m.tit === 'Pedí un servicio' && m.pantalla === 'p-inicio' && !m.tapaLoSenalado);
    await foto(page, 'E1-cliente-pedir');
    await page.click('#ir-pedido'); await esperar(600);
    m = await medir(page);
    ok('E2 el botón real lleva al formulario y la guía explica foto o texto', m.pantalla === 'p-nuevo-pedido' && m.tit === 'Contá qué necesitás');
    await foto(page, 'E2-cliente-formulario');
    await accion(page, 'Completar el pedido'); await esperar(500);
    await page.selectOption('#s-servicio', { label: 'Pintura' });
    await page.selectOption('#s-zona', { index: 1 });
    await page.selectOption('#s-urgencia', { index: 2 });
    await page.fill('#s-desc', 'Pintar una habitación de 3x3, paredes y techo.');
    await page.click('#s-enviar'); await esperar(1600);
    m = await medir(page);
    ok('E3 pedido enviado: festejo y paso de chats y presupuestos', est.posts.solicitudes === 1 && m.festejo.includes('Tu pedido salió') && m.tit === 'Conversaciones y presupuestos', m.festejo);
    await foto(page, 'E3-cliente-chats');
    await nav(page, 'siguiente'); await esperar(500);
    m = await medir(page);
    const pago = await page.textContent('#guia-tarjeta');
    ok('E4 pago: con tarjeta desde el chat, sin conectar ninguna cuenta', m.tit === 'Cómo se paga un trabajo' && pago.includes('No necesitás conectar ninguna cuenta'));
    await foto(page, 'E4-cliente-pago');
    await nav(page, 'siguiente'); await esperar(700);
    m = await medir(page);
    ok('E5 notificaciones del cliente: presupuestos y trabajo terminado', m.estado === 'Desactivadas' && (await page.textContent('#guia-tarjeta')).includes('cuando te llega un presupuesto'));
    await nav(page, 'siguiente'); await esperar(700);
    m = await medir(page);
    ok('E6 cuenta y permisos: explica sin activar nada', m.tit === 'Tu cuenta y tus permisos' && est.user.user_metadata.publicidad_permiso === undefined && est.user.user_metadata.ia_permiso === undefined);
    await foto(page, 'E6-cliente-cuenta');
    await nav(page, 'siguiente'); await nav(page, 'terminar'); await esperar(1500);
    ok('E7 el progreso del cliente se guarda aparte', (est.user.user_metadata.guia_cliente || {}).estado === 'terminada' && !est.user.user_metadata.guia_proveedor);
    ok('E errores de JavaScript', !(est.errores || []).length, (est.errores || []).join(' | '));
    await ctx.close();
  }

  /* ── F. Cuentas viejas ── */
  {
    const est = estadoNuevo({}); est.user.created_at = '2026-10-10T12:00:00Z'; est.user.user_metadata = cli();
    const { ctx, page } = await abrir(browser, est);
    ok('F1 cliente con cuenta vieja: no se le impone', !(await medir(page)).guia);
    await ctx.close();
  }
  {
    const est = estadoNuevo({}); est.user.created_at = '2026-10-10T12:00:00Z'; est.user.user_metadata = prov();
    const { ctx, page } = await abrir(browser, est);
    ok('F2 quien ofrece servicios con cuenta vieja y sin publicar: la ve', (await medir(page)).guia);
    await ctx.close();
  }

  /* ── G. Se queda sin servicios ── */
  {
    const est = estadoNuevo({}); est.user.created_at = '2026-10-10T12:00:00Z'; est.user.user_metadata = prov();
    est.proveedores = [{ id: 77, created_at: '2026-10-11T00:00:00Z', nombre: 'Raúl', email: 'p@e.com', telefono: '1155', rubro: 'Plomería y destapaciones',
      zona: 'CABA', precio_desde: 10000, precio_hasta: 50000, disponibilidad: 'Inmediata', descripcion: 'Plomería general' }];
    const { ctx, page } = await abrir(browser, est);
    ok('G1 con servicio publicado: sin aviso ni guía', !(await page.isVisible('.paso-uno')) && !(await medir(page)).guia);
    est.proveedores = [];
    await page.click('#refrescar'); await esperar(1500);
    ok('G2 si se queda sin servicios, el aviso vuelve', await page.isVisible('.paso-uno #panel-crear'));
    await ctx.close();
  }

  /* ── H. Mercado Pago con error ── */
  {
    const est = estadoNuevo(); est.user.user_metadata = prov(); est.mpFalla = true;
    est.proveedores = [{ id: 78, created_at: HOYs(), nombre: 'Raúl', email: 'p@e.com', telefono: '1155', rubro: 'Plomería y destapaciones',
      zona: 'CABA', precio_desde: 10000, precio_hasta: 50000, disponibilidad: 'Inmediata', descripcion: 'Plomería general' }];
    est.user.user_metadata.guia_proveedor = { v: 1, rol: 'proveedor', paso: 'mp', vistos: [], estado: 'activa', mp_intento: null, act: '' };
    const { ctx, page } = await abrir(browser, est);
    let m = await medir(page);
    ok('H1 guía activa: retoma en el paso donde estaba (Mercado Pago)', m.guia && m.tit.includes('Mercado Pago'), m.tit);
    await accion(page, 'Conectar Mercado Pago'); await esperar(1200);
    m = await medir(page);
    ok('H2 si Mercado Pago falla: "No se pudo abrir" y se puede reintentar', m.estado === 'No se pudo abrir' && await page.isVisible('#guia-tarjeta .gt-acciones button'));
    await foto(page, 'H2-mp-error');
    await ctx.close();
  }

  /* ── I. Tamaños de pantalla ── */
  for(const [nombre, op] of [['chico', {viewport: {width: 320, height: 568}}], ['iphone-se', {viewport: {width: 375, height: 667}}],
                             ['escritorio', {viewport: {width: 1280, height: 800}, escritorio: true}]]){
    for(const rol of ['proveedor', 'cliente']){
      const est = estadoNuevo(); est.user.user_metadata = rol === 'proveedor' ? prov() : cli();
      const { ctx, page } = await abrir(browser, est, op);
      let m = await medir(page);
      ok('I ' + nombre + ' ' + rol + ' paso 1: entra en pantalla sin tapar', m.guia && m.dentro && !m.tapaLoSenalado);
      await foto(page, 'I-' + nombre + '-' + rol + '-1');
      await nav(page, 'siguiente'); await esperar(800);
      m = await medir(page);
      ok('I ' + nombre + ' ' + rol + ' paso 2: entra en pantalla sin tapar', m.guia && m.dentro && !m.tapaLoSenalado);
      ok('I ' + nombre + ' ' + rol + ' los botones de la guía se ven enteros', await page.evaluate(() => {
        const n = document.querySelector('.gt-nav').getBoundingClientRect(); return n.bottom <= innerHeight + 1 && n.top >= 0; }));
      await foto(page, 'I-' + nombre + '-' + rol + '-2');
      await ctx.close();
    }
  }

  }catch(e){ ok('EJECUCIÓN cortada', false, e.message.split('\n')[0]); }
  await browser.close();
  const fallas = resultados.filter(r => !r.ok);
  resultados.forEach(r => console.log((r.ok ? 'OK   ' : 'FALLA') + ' ' + r.caso + (r.detalle && !r.ok ? '  → ' + r.detalle : '')));
  console.log('\n' + (resultados.length - fallas.length) + ' de ' + resultados.length + ' pasaron');
})();

function HOYs(){ return new Date().toISOString(); }
