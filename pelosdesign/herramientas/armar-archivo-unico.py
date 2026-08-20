#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARMAR ARCHIVO ÚNICO
═══════════════════════════════════════════════════════════════════════════

Toma el sitio y arma dos archivos HTML que funcionan solos: con el diseño,
el JavaScript, las tipografías y las fotos adentro. Se abren con doble click
desde cualquier carpeta y se pueden mandar por mail o por WhatsApp.

CUÁNDO USARLO
    Cada vez que cargues precios, reseñas o fotos en js/datos.js y quieras
    volver a mandarle el sitio a alguien. Los archivos que arma son una foto
    del momento: no se actualizan solos.

CÓMO USARLO
    Abrí una terminal en la carpeta del proyecto y escribí:

        python3 herramientas/armar-archivo-unico.py

    Los dos archivos quedan en la carpeta  para-enviar/

QUÉ NECESITA
    Nada. Solo Python 3, que ya viene instalado en Mac y en Linux. En Windows
    se baja de python.org.

    Si además tenés instalado fonttools, el script achica las tipografías y
    los archivos salen menos de la mitad de pesados. Es opcional:

        pip install fonttools brotli
═══════════════════════════════════════════════════════════════════════════
"""

import base64
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "para-enviar"

# Cómo se va a llamar cada página una vez armada
NOMBRES = {
    "index.html":   "pelos-design.html",
    "precios.html": "pelos-design-lista-de-precios.html",
}

# Los ejes que el diseño realmente usa. Sirven para achicar las tipografías
# sin perder el contraste de anchos, que es la firma del sitio.
EJES = {
    "archivo-var-latin.woff2":    {"wdth": (76, 118), "wght": (400, 620)},
    "newsreader-var-latin.woff2": {"opsz": 16,        "wght": (300, 500)},
}

# Los caracteres del castellano, más la puntuación y los símbolos que aparecen
UNICODES = (
    "U+0020-007E,U+00A0,U+00A1,U+00BF,U+00B7,U+00AA,U+00BA,U+00C0-00FF,"
    "U+0131,U+0152-0153,U+2013,U+2014,U+2018-201A,U+201C-201E,U+2026,"
    "U+2032-2033,U+2039-203A,U+20AC,U+2190,U+2192,U+00AB,U+00BB"
)

TIPOS_IMAGEN = {
    ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".gif": "image/gif", ".avif": "image/avif",
    ".svg": "image/svg+xml",
}


def kb(n):
    return f"{n / 1024:,.0f} KB".replace(",", ".")


def a_base64(ruta):
    return base64.b64encode(ruta.read_bytes()).decode("ascii")


# ── Tipografías ──────────────────────────────────────────────────────────

def preparar_tipografias():
    """Devuelve {nombre_de_archivo: data-uri}. Achica las tipografías si se
    puede; si no, usa las originales, que se ven exactamente igual."""
    achicadas = {}
    try:
        from fontTools.ttLib import TTFont
        from fontTools import subset as ft_subset
        from fontTools.varLib import instancer
    except ImportError:
        print("   fonttools no está instalado: se usan las tipografías completas.")
        print("   (opcional: pip install fonttools brotli para archivos más livianos)")
        for nombre in EJES:
            ruta = RAIZ / "fonts" / nombre
            achicadas[nombre] = f"data:font/woff2;base64,{a_base64(ruta)}"
        return achicadas

    import io
    for nombre, ejes in EJES.items():
        ruta = RAIZ / "fonts" / nombre

        opciones = ft_subset.Options()
        opciones.layout_features = ["*"]
        opciones.flavor = "woff2"
        fuente = ft_subset.load_font(str(ruta), opciones)
        subconjunto = ft_subset.Subsetter(options=opciones)
        subconjunto.populate(unicodes=ft_subset.parse_unicodes(UNICODES))
        subconjunto.subset(fuente)

        instancer.instantiateVariableFont(fuente, ejes, inplace=True)

        buffer = io.BytesIO()
        fuente.flavor = "woff2"
        fuente.save(buffer)
        fuente.close()

        crudo = buffer.getvalue()
        print(f"   {nombre:30} {kb(ruta.stat().st_size):>9} → {kb(len(crudo)):>9}")
        achicadas[nombre] = "data:font/woff2;base64," + base64.b64encode(crudo).decode("ascii")

    return achicadas


# ── Fotos de la galería ──────────────────────────────────────────────────

def incrustar_fotos(datos_js):
    """Reemplaza los nombres de archivo de la galería por la foto entera, para
    que las imágenes viajen adentro del HTML."""
    faltantes = []

    def reemplazo(m):
        nombre = m.group(1)
        ruta = RAIZ / "img" / nombre
        if not ruta.exists():
            faltantes.append(nombre)
            return m.group(0)
        tipo = TIPOS_IMAGEN.get(ruta.suffix.lower())
        if not tipo:
            faltantes.append(nombre + " (formato no soportado)")
            return m.group(0)
        return f'archivo: "data:{tipo};base64,{a_base64(ruta)}"'

    resultado = re.sub(r'archivo:\s*"([^"]+)"', reemplazo, datos_js)
    return resultado, faltantes


# ── Armado ───────────────────────────────────────────────────────────────

def leer_js(nombre):
    texto = (RAIZ / "js" / nombre).read_text(encoding="utf-8")
    # Por las dudas: una cadena "</script" adentro del JS cerraría la etiqueta
    return texto.replace("</script", r"<\/script")


def main():
    print("\nArmando los archivos únicos de Pelo's Design\n")

    faltan = [p for p in ["css/estilo.css", "js/datos.js", "index.html"] if not (RAIZ / p).exists()]
    if faltan:
        print("No encuentro estos archivos:", ", ".join(faltan))
        print("Corré el script desde adentro de la carpeta del proyecto.")
        return 1

    print("Tipografías:")
    tipografias = preparar_tipografias()

    css = (RAIZ / "css/estilo.css").read_text(encoding="utf-8")
    for nombre, datauri in tipografias.items():
        css = css.replace(f'url("../fonts/{nombre}") format("woff2")',
                          f'url("{datauri}") format("woff2")')
    if "data:font/woff2" not in css:
        print("\nNo pude incrustar las tipografías: cambió el nombre de algún archivo.")
        return 1

    favicon = "data:image/svg+xml;base64," + a_base64(RAIZ / "img/favicon.svg")

    datos_js, sin_foto = incrustar_fotos(leer_js("datos.js"))
    guiones = {"datos.js": datos_js}
    for nombre in ["comun.js", "sitio.js", "precios.js"]:
        guiones[nombre] = leer_js(nombre)

    SALIDA.mkdir(exist_ok=True)
    print("\nPáginas:")

    for origen, destino in NOMBRES.items():
        html = (RAIZ / origen).read_text(encoding="utf-8")

        # Las tipografías ya viajan adentro: precargarlas no tiene sentido
        html = re.sub(r'<link rel="preload" href="fonts/[^"]+"[^>]*>\n?', "", html)
        html = html.replace('<link rel="stylesheet" href="css/estilo.css">',
                            "<style>\n" + css + "\n</style>")

        html = html.replace('<link rel="icon" href="img/favicon.svg" type="image/svg+xml">',
                            f'<link rel="icon" href="{favicon}" type="image/svg+xml">')
        html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\n?', "", html)

        for nombre, contenido in guiones.items():
            etiqueta = f'<script src="js/{nombre}"></script>'
            if etiqueta in html:
                html = html.replace(etiqueta, "<script>\n" + contenido + "\n</script>")

        # La galería ya trae la foto entera, no un nombre de archivo
        html = html.replace("img/${esc(g.archivo)}", "${esc(g.archivo)}")

        # Que el link de una página a la otra siga funcionando
        for viejo, nuevo in NOMBRES.items():
            html = html.replace(f'href="{viejo}"', f'href="{nuevo}"')

        salida = SALIDA / destino
        salida.write_text(html, encoding="utf-8")
        print(f"   {destino:38} {kb(salida.stat().st_size):>9}")

    if sin_foto:
        print("\nOjo: estas fotos están anotadas en datos.js pero no están en img/")
        for f in sin_foto:
            print("   ·", f)

    print(f"\nListo. Los dos archivos están en:  {SALIDA}")
    print("Guardalos en la misma carpeta: el botón de la lista de precios salta")
    print("de uno al otro.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
