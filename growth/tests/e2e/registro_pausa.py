#!/usr/bin/env python3
"""Prueba del circuito de captación con envíos en pausa (contra staging).
Registra un proveedor y un cliente de prueba en el workspace Tratto, verifica
que:
 - growth-signup los crea con consentimiento opt_in y su kind/rubro/zona;
 - el disparador por tipo arranca la automatización correcta (provider→proveedor);
 - con envíos en pausa, growth-automations NO manda nada (los deja esperando);
 - growth-send bloquea un envío manual mientras está en pausa;
 - growth-baja marca opt_out.
Limpia los prospectos de prueba al final. No envía ningún mail.
Requiere las mismas variables que flujo_completo.py.
"""
import json, os, sys, time, urllib.request, urllib.error
URL=os.environ['GROWTH_SUPABASE_URL'].rstrip('/'); ANON=os.environ['GROWTH_ANON_KEY']; FN=URL+'/functions/v1'
def call(m,path,body=None,tok=None,headers=None):
    h={'apikey':ANON,'content-type':'application/json'}
    if tok:h['authorization']='Bearer '+tok
    h.update(headers or {})
    r=urllib.request.Request(path if path.startswith('http') else URL+path,data=json.dumps(body).encode() if body is not None else None,method=m,headers=h)
    try:
        with urllib.request.urlopen(r) as x:t=x.read();return x.status,(json.loads(t) if t and x.headers.get('content-type','').startswith('application/json') else t)
    except urllib.error.HTTPError as e:
        t=e.read()
        try:return e.code,json.loads(t)
        except Exception:return e.code,t
fail=0
def chk(n,c,d=''):
    global fail;print(('OK   ' if c else 'FALLA')+'  '+n+(f'  ({d})' if d and not c else ''));
    if not c:fail+=1
s,a=call('POST','/auth/v1/token?grant_type=password',{'email':os.environ['GROWTH_DEMO_EMAIL'],'password':os.environ['GROWTH_DEMO_PASSWORD']})
tok=a['access_token']
def rest(m,p,b=None,prefer=None): return call(m,'/rest/v1/'+p,b,tok,{'Prefer':prefer} if prefer else None)
s,ws=rest('GET','growth_workspaces?slug=eq.tratto&select=id,name'); WS=ws[0]['id']
chk('workspace Tratto visible', s==200 and ws)
s,app=rest('GET',f'growth_app_settings?workspace_id=eq.{WS}&select=sending_paused')
chk('Tratto arranca en pausa', app[0]['sending_paused'] is True, str(app))

stamp=int(time.time())
prov_email=f'prov-{stamp}@example.com'; cli_email=f'cli-{stamp}@example.com'
# 1) registro de proveedor (público, sin sesión)
s,r=call('POST',f'{FN}/growth-signup',{'workspace':'tratto','kind':'provider','consent':True,'first_name':'Pedro','email':prov_email,'rubro':'Pintura','zona':'GBA Oeste','company':'Pinturas Pedro'})
chk('growth-signup proveedor', s==200 and r.get('ok'), str(r)); prov_id=r.get('id')
# 2) registro de cliente
s,r=call('POST',f'{FN}/growth-signup',{'workspace':'tratto','kind':'customer','consent':True,'first_name':'Clara','email':cli_email,'zona':'CABA'})
chk('growth-signup cliente', s==200 and r.get('ok'), str(r)); cli_id=r.get('id')
# consentimiento y datos guardados
s,p=rest('GET',f'growth_prospects?id=eq.{prov_id}&select=kind,rubro,zona,consent,status')
chk('proveedor con opt_in/kind/rubro', p[0]['kind']=='provider' and p[0]['consent']=='opt_in' and p[0]['rubro']=='Pintura', str(p))
# 3) cada registro arrancó SU automatización (provider→proveedor, customer→cliente)
time.sleep(1)
s,runs=rest('GET',f'growth_workflow_runs?prospect_id=eq.{prov_id}&select=workflow_id,status,workflow:growth_workflows(name)')
chk('arrancó la automatización de proveedores', any('rovee' in x['workflow']['name'] for x in runs), str(runs))
s,runs2=rest('GET',f'growth_workflow_runs?prospect_id=eq.{cli_id}&select=workflow:growth_workflows(name)')
chk('arrancó la automatización de clientes', any('liente' in x['workflow']['name'] for x in runs2), str(runs2))
# 4) procesar automatizaciones: en pausa NO debe enviar nada
s,r=call('POST',f'{FN}/growth-automations',{'workspace_id':WS},tok)
chk('growth-automations corre', s==200 and r.get('ok'), str(r))
chk('ningún resultado "enviado": todo en pausa', all(x.get('status')=='paused' for x in r.get('results',[]) if x.get('run')), str(r.get('results')))
s,msgs=rest('GET',f'growth_messages?prospect_id=eq.{prov_id}&select=id')
chk('NO se creó ningún mensaje (nada enviado en pausa)', len(msgs)==0, str(msgs))
s,pp=rest('GET',f'growth_prospects?id=eq.{prov_id}&select=status,contact_count')
chk('el proveedor sigue "new", sin contactos', pp[0]['status']=='new' and pp[0]['contact_count']==0, str(pp))
# 5) envío manual bloqueado en pausa
s,r=call('POST',f'{FN}/growth-send',{'workspace_id':WS,'action':'send','prospect_id':prov_id,'channel':'email','body':'hola'},tok)
chk('growth-send bloquea envío manual en pausa', s==409 and r.get('paused'), f'{s} {r}')
# 6) baja
s,_=call('GET',f'{FN}/growth-baja?ws=tratto&c={prov_email}')
chk('growth-baja responde', s==200)
s,p=rest('GET',f'growth_prospects?id=eq.{prov_id}&select=consent,do_not_contact')
chk('baja marca opt_out', p[0]['consent']=='opt_out' and p[0]['do_not_contact'] is True, str(p))
# limpieza
rest('DELETE',f'growth_prospects?id=eq.{prov_id}'); rest('DELETE',f'growth_prospects?id=eq.{cli_id}')
print('\n'+('TODO OK' if not fail else f'{fail} FALLAS')+f'  · prospectos de prueba eliminados')
sys.exit(1 if fail else 0)
