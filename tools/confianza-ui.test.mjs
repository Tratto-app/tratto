import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {safePhotoRef,safeImageUrl,dateOnly,money,errorText,receiptText}=require('../servicio-acuerdos.js');
const ref='11111111-1111-4111-8111-111111111111/17/22222222-2222-4222-8222-222222222222.jpg';
const signed='https://qglsonbcsncgekzbfafk.supabase.co/storage/v1/object/sign/servicio-evidencias/'+ref+'?token=prueba-no-real';

test('solo se muestran referencias privadas de evidencia del formato esperado',()=>{
 assert.equal(safePhotoRef(ref),ref);
 for(const bad of ['javascript:alert(1)','https://evil.invalid/foto.jpg',ref.replace('/17/','/0/'),ref.replace('/17/','/../'),ref.replace('.jpg','.svg'),ref+'?token=secreto',ref.replace('11111111-1111-4111-8111-111111111111','otro')])assert.equal(safePhotoRef(bad),null,bad);
});
test('las imágenes deben llegar como URLs firmadas del bucket privado de Tratto',()=>{
 assert.equal(safeImageUrl(signed),signed);
 for(const bad of [signed.replace('https:','http:'),signed.replace('qglsonbcsncgekzbfafk.supabase.co','qglsonbcsncgekzbfafk.supabase.co.evil.invalid'),signed.replace('/sign/servicio-evidencias/','/public/fotos/'),signed.replace('?token=prueba-no-real',''),signed+'&redirect=https://evil.invalid',signed+'#fragment',signed.replace('https://','https://user:pass@')])assert.equal(safeImageUrl(bad),null,bad);
});
test('la constancia distingue propuesta, retiro, devolución y no expone URLs firmadas',()=>{
 const pending=receiptText({id:'acuerdo-prueba',match_id:17,estado:'propuesta',created_at:'2026-10-28T13:00:00Z',updated_at:'2026-10-28T13:00:00Z',datos:{equipo:'Notebook',marca:'Ejemplo',estado_equipo:'Rayón en tapa',devolucion_prevista:'2026-11-01',fotos:[ref]}});
 assert.match(pending,/Esperando tu respuesta/);assert.match(pending,/Equipo: Notebook/);assert.match(pending,/01\/11\/2026/);assert.match(pending,/Fotos guardadas en Tratto: 1/);assert.match(pending,/no acredita por sí sola un pago/);assert.ok(!pending.includes('token='));
 const returned=receiptText({id:'prueba',estado:'devuelto',datos:{}});assert.match(returned,/Devolución confirmada por el cliente/);
});
test('errores de permiso, despliegue pendiente y concurrencia no simulan aceptación',()=>{
 assert.match(errorText(new Error('PGRST202 schema cache could not find servicio_proponer')),/todavía no están disponibles/);
 assert.match(errorText(new Error('42501 permission denied')),/No tenés permiso/);
 assert.match(errorText(new Error('version desactualizada')),/revisá la nueva versión/);
 assert.match(errorText(new Error('Failed to fetch')),/No se pudo confirmar el resultado/);
});
test('los datos básicos se muestran sin interpretar contenido como HTML',()=>{
 assert.equal(dateOnly('2026-10-28'),'28/10/2026');assert.equal(dateOnly('<script>'),'Fecha sin confirmar');
 assert.match(money(1500),/1\.500/);assert.equal(money('NaN'),'Monto sin confirmar');
 assert.throws(()=>globalThis.TrattoAcuerdos.mount(null,{}),/faltan contenedor/);
});
