import {test,expect} from '@playwright/test';
const uid='00000000-0000-0000-0000-000000000001';
const people=[
 {user_id:'new',nombre:'Oferente nuevo',email:'nuevo@example.invalid',tipo:'provider',rubros:['Cerrajería'],registrado_at:'2026-10-19T15:00:00Z',servicios:0,trabajos:0,pedidos:0,dispositivos:1,crm_id:null},
 {user_id:'published',nombre:'Negocio de prueba',email:'negocio@example.invalid',tipo:'provider',rubros:['Plomería'],registrado_at:'2026-10-18T15:00:00Z',servicios:2,trabajos:1,pedidos:0,dispositivos:0,crm_id:null},
 {user_id:'customer',nombre:'Cliente de prueba',email:'cliente@example.invalid',tipo:'customer',rubros:[],registrado_at:'2026-10-17T15:00:00Z',servicios:0,trabajos:0,pedidos:1,dispositivos:1,crm_id:null},
];
for(const width of [390,1440]) test(`resumen, filtros y menú con ${width}px`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(({uid})=>{
  const user={id:uid,email:'owner@example.invalid',aud:'authenticated',role:'authenticated'};
  const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:4102444800}))+'.test-signature';
  localStorage.setItem('sb-example-auth-token',JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:4102444800,expires_in:999999,user,token_type:'bearer'}));
 },{uid});
 await page.route('https://example.supabase.co/**',async route=>{
  const url=new URL(route.request().url());let body:unknown=[];
  if(url.pathname.includes('/auth/v1/')) body={id:uid,email:'owner@example.invalid'};
  if(url.pathname.endsWith('/growth_workspaces')) body=[{id:'ws',name:'Tratto',slug:'tratto',is_demo:false}];
  if(url.pathname.endsWith('/growth_app_settings')) body={workspace_id:'ws',active_window_days:7};
  if(url.pathname.endsWith('/growth_app_users_overview')){
   const p=route.request().postDataJSON();
   const filtered=people.filter(u=>(!p.p_kind||u.tipo===p.p_kind)&&(!p.p_rubro||u.rubros.includes(p.p_rubro))&&(!p.p_query||(u.nombre+' '+u.email).toLowerCase().includes(p.p_query.toLowerCase()))&&(!p.p_stage||(p.p_stage==='push'&&u.dispositivos>0)||(p.p_stage==='no_push'&&u.dispositivos===0)||(p.p_stage==='pending'&&u.tipo==='provider'&&u.servicios===0)||(p.p_stage==='published'&&u.tipo==='provider'&&u.servicios>0)));
   body={corte_at:'2026-10-19T22:00:00Z',totales:{usuarios:3,proveedores:2,clientes:1,sin_tipo:0,proveedores_push:1,clientes_push:1,proveedores_publicados:1,proveedores_pendientes:1,proveedores_con_trabajos:1,servicios:2,trabajos:1,altas_hoy:1},
    rubros:[{rubro:'Plomería',registrados:1,con_push:0,con_servicio:1},{rubro:'Cerrajería',registrados:1,con_push:1,con_servicio:0}],
    altas:Array.from({length:14},(_,i)=>({dia:`2026-10-${String(i+6).padStart(2,'0')}`,proveedores:i===13?1:0,clientes:i===11?1:0,sin_tipo:0})),total_filtrado:filtered.length,usuarios:filtered};
  }
  await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0'},body:JSON.stringify(body)});
 });
 await page.goto('/users');
 await expect(page.getByRole('heading',{name:'Usuarios de la app'})).toBeVisible();
 await expect(page.locator('.au-person')).toHaveCount(3);
 await expect(page.locator('.au-metric').filter({hasText:'Oferentes de servicios'})).toContainText('2');
 await expect(page.getByText('Pendiente de publicar',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Sin servicio',exact:true}).click();
 await expect(page.locator('.au-person')).toHaveCount(1);await expect(page.locator('.au-person')).toContainText('Oferente nuevo');
 await page.getByRole('button',{name:'Todos',exact:true}).click();
 await page.getByLabel('Ordenar rubros').selectOption('con_push');
 await expect(page.locator('.au-rubro').first()).toContainText('Cerrajería');
 await page.getByLabel('Buscar persona').fill('inexistente');await expect(page.getByText('No hay personas con estos filtros')).toBeVisible();
 await page.getByRole('button',{name:'Limpiar búsqueda y filtros'}).click();await expect(page.locator('.au-person')).toHaveCount(3);
 await page.getByRole('radio',{name:'Clientes',exact:true}).click();await expect(page.locator('.au-person')).toHaveCount(1);await expect(page.locator('.au-person')).toContainText('Cliente de prueba');
 await page.getByRole('radio',{name:'Todos',exact:true}).click();await expect(page.locator('.au-person')).toHaveCount(3);
 const nav=await page.locator('.nav-item').allTextContents();expect(nav.indexOf('Usuarios de la app')).toBe(nav.indexOf('Claude / Codex')+1);
 if(width===390) await page.getByRole('button',{name:'Menú',exact:true}).click();
 await expect(page.getByRole('link',{name:'Usuarios de la app',exact:true})).toBeVisible();
 if(width===390) await page.getByRole('link',{name:'Usuarios de la app',exact:true}).click();
 await page.locator('.contenido').evaluate(el=>el.scrollTop=0);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:`/tmp/tratto-users-${width}.png`,fullPage:true});
 expect(errors).toEqual([]);
});
