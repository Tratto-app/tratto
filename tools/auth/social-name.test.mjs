import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const source=html.match(/async function guardarNombreSocial\(j, nombre\)\{[\s\S]*?^\}/m)[0];
function fixture({metadata={},status=200,fail=false}={}){
 const calls=[],session={access_token:'fake-session',user:{id:'test-user',user_metadata:metadata}};
 const save=vm.runInNewContext('('+source+')',{AbortController,setTimeout,clearTimeout,SUPABASE_URL:'https://example.invalid',SUPABASE_ANON:'public-test',fetch:async(url,options)=>{
  calls.push({url,...options,body:JSON.parse(options.body)});
  if(fail)throw Error('offline');
  return {ok:status===200,json:async()=>({id:'test-user',user_metadata:{full_name:calls.at(-1).body.data.full_name}})};
 }});
 return {save,calls,session};
}
test('Apple conserva el nombre recibido fuera del token sin inventar rol ni permisos',async()=>{
 const f=fixture();await f.save(f.session,'  Persona de prueba  ');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'PUT');
 assert.equal(f.calls[0].url,'https://example.invalid/auth/v1/user');
 assert.equal(f.calls[0].headers.Authorization,'Bearer fake-session');
 assert.ok(f.calls[0].signal instanceof AbortSignal);
 assert.deepEqual(f.calls[0].body,{data:{full_name:'Persona de prueba'}});
 assert.equal(f.session.user.user_metadata.full_name,'Persona de prueba');
});
test('no sobreescribe nombres existentes de Tratto o Google ni inventa uno ausente',async()=>{
 for(const metadata of [{nombre:'Elegido'},{full_name:'Google'},{name:'Social'}]){
  const f=fixture({metadata});await f.save(f.session,'Otro');assert.equal(f.calls.length,0);
 }
 const f=fixture();await f.save(f.session,'');assert.equal(f.calls.length,0);
});
test('fallos al guardar nombre no invalidan una sesión social ya aceptada',async()=>{
 for(const options of [{status:500},{fail:true}]){
  const f=fixture(options);assert.equal(await f.save(f.session,'Persona'),f.session);
  assert.equal(f.session.user.id,'test-user');assert.deepEqual(f.session.user.user_metadata,{});
 }
});
