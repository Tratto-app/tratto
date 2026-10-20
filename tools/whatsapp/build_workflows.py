"""Genera workflows importables; no activa ni ejecuta nada. Sin secretos."""
import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = 'https://qglsonbcsncgekzbfafk.supabase.co'
WS = 'e92e7144-af22-4a98-9e18-52ca8d3cd0c3'
REF = {'id': 'SELECCIONAR_EN_N8N', 'name': 'Tratto · Supabase (service role)'}

def node(name, typ, params, x=0, y=0, version=1):
    return {'id': name.replace(' ', '-'), 'name': name, 'type': 'n8n-nodes-base.' + typ,
            'typeVersion': version, 'position': [x, y], 'parameters': params}

def request(name, path, body, x=0, y=0):
    n = node(name, 'httpRequest', {'method': 'POST', 'url': BASE + path,
        'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'supabaseApi',
        'sendBody': True, 'specifyBody': 'json', 'jsonBody': body,
        'options': {'timeout': 60000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}}, x, y, 4.2)
    n['credentials'] = {'supabaseApi': REF.copy()}
    n['retryOnFail'] = False
    return n

def condition(name, expr, x, y):
    return node(name, 'if', {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'strict', 'version': 2},
        'conditions': [{'id': name, 'leftValue': expr, 'rightValue': True,
        'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'options': {}}, x, y, 2.2)

def workflow(name, nodes, edges):
    connections = {}
    for src, output, dst in edges:
        main = connections.setdefault(src, {'main': []})['main']
        while len(main) <= output:
            main.append([])
        main[output].append({'node': dst, 'type': 'main', 'index': 0})
    return {'name': name, 'active': False, 'nodes': nodes, 'connections': connections,
        'settings': {'executionOrder': 'v1', 'timezone': 'America/Argentina/Buenos_Aires',
        'saveDataSuccessExecution': 'none',
        'saveDataErrorExecution': 'all', 'executionTimeout': 1800}}

def build():
    manual = node('Prueba manual', 'manualTrigger', {})
    schedule = node('Diario 11 Buenos Aires', 'scheduleTrigger', {'rule': {'interval': [{'field': 'cronExpression', 'expression': '0 11 * * *'}]}}, 0, 160, 1.2)
    health = request('Verificar cuenta y plantilla', '/functions/v1/growth-whatsapp-webhook/health', json.dumps({'workspace_id': WS}), 240)
    healthy = condition('Cuenta lista', '={{ $json.statusCode === 200 && $json.body.ok === true }}', 480, 0)
    claim = request('Reservar hasta 20', '/rest/v1/rpc/growth_wa_claim', json.dumps({'p_workspace': WS, 'p_limit': 20}), 720)
    has = condition('Hay destinatarios', '={{ $json.statusCode === 200 && Array.isArray($json.body) && $json.body.length > 0 }}', 960, 0)
    unpack = node('Desplegar reservas', 'code', {'jsCode': 'return $json.body.map(j => ({ json: j }));'}, 1200, 0, 2)
    loop = node('Uno por vez', 'splitInBatches', {'batchSize': 1, 'options': {}}, 1440, 0, 3)
    send = request('Intentar una sola vez', '/functions/v1/growth-whatsapp-webhook/dispatch', '={{ JSON.stringify({id:$json.id,claim_token:$json.claim_token}) }}', 1680)
    accepted = condition('API aceptó', '={{ $json.statusCode === 200 && $json.body.ok === true }}', 1920, 0)
    report = request('Actualizar informe CRM', '/rest/v1/rpc/growth_wa_daily_report', json.dumps({'p_workspace': WS}), 1920, 320)
    daily = workflow('Tratto · WhatsApp · Invitaciones diarias (PENDIENTE CHIP)',
        [manual, schedule, health, healthy, claim, has, unpack, loop, send, accepted, report],
        [('Prueba manual', 0, health['name']), (schedule['name'], 0, health['name']), (health['name'], 0, healthy['name']),
         (healthy['name'], 0, claim['name']), (healthy['name'], 1, report['name']), (claim['name'], 0, has['name']),
         (has['name'], 0, unpack['name']), (has['name'], 1, report['name']), (unpack['name'], 0, loop['name']),
         (loop['name'], 0, claim['name']), (loop['name'], 1, send['name']), (send['name'], 0, accepted['name']),
         (accepted['name'], 0, loop['name']), (accepted['name'], 1, report['name'])])
    fields = [
        {'fieldLabel': 'Teléfono WhatsApp internacional', 'placeholder': '+54 9 ...', 'requiredField': True},
        {'fieldLabel': 'Nombre del negocio', 'requiredField': True},
        {'fieldLabel': 'Nombre de contacto'}, {'fieldLabel': 'Email (opcional)', 'fieldType': 'email'},
        {'fieldLabel': 'Rubro exacto de Tratto', 'requiredField': True},
        {'fieldLabel': 'Zona', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': z} for z in ['CABA', 'GBA Norte', 'GBA Oeste', 'GBA Sur', 'Buenos Aires (interior)']]}, 'requiredField': True},
        {'fieldLabel': 'Localidad o barrio', 'requiredField': True}, {'fieldLabel': 'Web del negocio (opcional)'}]
    form = node('Datos del proveedor', 'formTrigger', {'formTitle': 'Proveedores de Tratto por WhatsApp',
        'formDescription': 'Completá tus datos después de escribirnos por WhatsApp y aceptar las invitaciones de Tratto. No hace falta registrarte en la app. El formulario solo no concede permiso.',
        'formFields': {'values': fields}, 'options': {}, 'responseMode': 'lastNode'}, 0, 0, 2.2)
    form['webhookId'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'tratto/whatsapp/proveedores/v1'))
    qualify = request('Validar permiso y separar del mail', '/rest/v1/rpc/growth_wa_qualify',
        '={{ JSON.stringify({p_workspace:"' + WS + '",p_phone:$json["Teléfono WhatsApp internacional"],p_company:$json["Nombre del negocio"],p_name:$json["Nombre de contacto"]||"",p_email:$json["Email (opcional)"]||"",p_rubro:$json["Rubro exacto de Tratto"],p_zone:$json.Zona,p_city:$json["Localidad o barrio"],p_source:$json["Web del negocio (opcional)"]||""}) }}', 280)
    ending = node('Resultado del formulario', 'form', {'operation': 'completion',
        'completionTitle': '={{ $json.body.ok ? "Datos recibidos" : "Falta completar un paso" }}',
        'completionMessage': '={{ $json.body.ok ? "Tu invitación quedó en la cola. No creamos una cuenta en Tratto." : ($json.body.reason || "No pudimos validar los datos. Contactanos por WhatsApp.") }}', 'options': {}}, 560, 0, 1)
    lead = workflow('Tratto · WhatsApp · Alta con permiso (PENDIENTE CHIP)', [form, qualify, ending],
        [(form['name'], 0, qualify['name']), (qualify['name'], 0, ending['name'])])
    query = request('Ver estado sin enviar', '/rest/v1/rpc/growth_wa_report', json.dumps({'p_workspace': WS}), 280)
    probe_health = request('Probar guardia apagada', '/functions/v1/growth-whatsapp-webhook/health', json.dumps({'workspace_id': WS}), 560)
    zero = request('Comprobar cero reservas', '/rest/v1/rpc/growth_wa_claim', json.dumps({'p_workspace': WS, 'p_limit': 0}), 840)
    summary = node('Resultado sin envíos', 'code', {'jsCode': "const r=$('Ver estado sin enviar').first().json;const h=$('Probar guardia apagada').first().json;const c=$json;return [{json:{ok:r.statusCode===200 && h.statusCode===200 && c.statusCode===200 && r.body.enabled===false && h.body.reason==='disabled_or_unapproved' && Array.isArray(c.body) && c.body.length===0,enabled:r.body.enabled,guard_status:h.statusCode,guard_reason:h.body.reason,reservations:Array.isArray(c.body)?c.body.length:null,counts:r.body.counts,permission_verified:r.body.permission_verified}}];"}, 1120, 0, 2)
    hook = node('Prueba HTTP protegida', 'webhook', {'httpMethod': 'POST', 'path': 'tratto-wa-diagnostico', 'authentication': 'headerAuth', 'responseMode': 'lastNode', 'options': {}}, 0, 200, 2)
    hook['webhookId'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'tratto/whatsapp/diagnostico/v1'))
    hook['credentials'] = {'httpHeaderAuth': {'id': 'SELECCIONAR_EN_N8N', 'name': 'Tratto · Diagnóstico WhatsApp (sin envíos)'}}
    diag = workflow('Tratto · WhatsApp · Diagnóstico sin envíos', [manual, query, hook, probe_health, zero, summary],
        [('Prueba manual', 0, query['name']), (hook['name'], 0, query['name']), (query['name'], 0, probe_health['name']),
         (probe_health['name'], 0, zero['name']), (zero['name'], 0, summary['name'])])
    return {'whatsapp-invitaciones-diarias.json': daily, 'whatsapp-alta-con-permiso.json': lead, 'whatsapp-diagnostico.json': diag}

if __name__ == '__main__':
    out = ROOT / 'tools/n8n/workflows'
    for filename, data in build().items():
        (out / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print(filename, 'inactive')
