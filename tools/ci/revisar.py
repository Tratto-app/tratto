"""Chequeos rápidos que corren en cada push y PR (.github/workflows/ci.yml).

1. Sintaxis del JavaScript embebido en cada .html (node --check).
2. Que los .json del sitio sean JSON válido.
3. Que no se haya colado ninguna credencial en archivos versionados.

Uso: python3 tools/ci/revisar.py   (sale con código 1 si algo falla)
"""
import base64, json, pathlib, re, subprocess, sys, tempfile

RAIZ = pathlib.Path(__file__).resolve().parents[2]
fallas = []

def versionados():
    salida = subprocess.run(['git', 'ls-files'], cwd=RAIZ, capture_output=True, text=True, check=True).stdout
    return [RAIZ / l for l in salida.splitlines() if l and (RAIZ / l).is_file()]

archivos = versionados()

# 1) JavaScript de los HTML del sitio (no las herramientas internas)
for html in [p for p in archivos if p.suffix == '.html' and p.parent == RAIZ]:
    bloques = re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*type="application/ld\+json")[^>]*>(.*?)</script>',
                         html.read_text(encoding='utf-8'), re.S)
    if not bloques:
        continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as t:
        t.write('\n;\n'.join(bloques))
    r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True)
    if r.returncode:
        fallas.append(f'{html.name}: error de sintaxis JS\n{r.stderr.strip()[:800]}')

# 2) JSON del sitio
for js in [p for p in archivos if p.suffix == '.json' and ('.well-known' in p.parts or p.parent == RAIZ)]:
    try:
        json.loads(js.read_text(encoding='utf-8'))
    except Exception as e:
        fallas.append(f'{js.relative_to(RAIZ)}: JSON inválido ({e})')

# 3) Credenciales
PATRONES = {
    'clave secreta de Supabase': r'sb_secret_[A-Za-z0-9_-]{20,}',
    'API key de Brevo': r'xkeysib-[a-f0-9]{40,}',
    'clave SMTP de Brevo': r'xsmtpsib-[a-f0-9]{40,}',
    'token de Mercado Pago': r'\bAPP_USR-\d{6,}-\d{6}-[a-f0-9]{20,}',
    'API key de OpenAI': r'\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}',
    'clave privada': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'API key de Google': r'\bAIza[0-9A-Za-z_-]{35}\b',
}
JWT = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}')
BINARIOS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.mp4', '.mp3', '.wav', '.m4a',
            '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.zip', '.aab', '.apk', '.xlsx'}
for p in archivos:
    if p.suffix.lower() in BINARIOS or p.stat().st_size > 5_000_000:
        continue
    try:
        texto = p.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    rel = p.relative_to(RAIZ)
    for nombre, patron in PATRONES.items():
        if re.search(patron, texto):
            fallas.append(f'{rel}: parece contener una {nombre}')
    # Un JWT de Supabase con rol service_role es una llave maestra; el anon es público.
    for m in JWT.finditer(texto):
        try:
            cuerpo = json.loads(base64.urlsafe_b64decode(m.group(1) + '=' * (-len(m.group(1)) % 4)))
        except Exception:
            continue
        if cuerpo.get('role') == 'service_role':
            fallas.append(f'{rel}: contiene un JWT service_role de Supabase')

if fallas:
    print('Falló la revisión:\n- ' + '\n- '.join(fallas))
    sys.exit(1)
print(f'OK: {len(archivos)} archivos revisados.')
