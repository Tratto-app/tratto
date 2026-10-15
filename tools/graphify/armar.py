#!/usr/bin/env python3
"""Arma el mapa del código de Tratto con graphify (gratis, sin IA).

graphify no lee HTML, y la app (index.html) y la calculadora tienen el código
adentro de <script>. Este script copia esos bloques a graphify-src/<archivo>.js
dejando en blanco todo lo demás, así cada función queda en la MISMA línea que
en el .html original: si el mapa dice graphify-src/index.html.js L2901, es
index.html línea 2901.

Uso (desde la raíz del repo):
    python3 tools/graphify/armar.py

Necesita graphify:  pip install "graphifyy[sql]"   (o pipx en la Mac)
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "graphify-src"
NO_ENTRAR = ("crm/", "node_modules/", "graphify-src/", "graphify-out/", "growth/web/dist/")
SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S | re.I)


def html_del_repo():
    r = subprocess.run(["git", "ls-files", "*.html"], cwd=RAIZ, capture_output=True, text=True, check=True)
    return [p for p in r.stdout.split() if not p.startswith(NO_ENTRAR)]


def solo_scripts(texto):
    """Devuelve el mismo texto con todo en blanco menos el JS de los <script>."""
    salida = []
    cursor = 0
    for m in SCRIPT.finditer(texto):
        salida.append(re.sub(r"[^\n]", "", texto[cursor:m.start(1)]))
        salida.append(m.group(1))
        cursor = m.end(1)
    salida.append(re.sub(r"[^\n]", "", texto[cursor:]))
    return "".join(salida)


def main():
    if shutil.which("graphify") is None:
        sys.exit('Falta graphify. Instalalo con: pip install "graphifyy[sql]"')
    shutil.rmtree(SALIDA, ignore_errors=True)
    copiados = 0
    for rel in html_del_repo():
        texto = (RAIZ / rel).read_text(encoding="utf-8", errors="replace")
        js = solo_scripts(texto)
        if not js.strip():
            continue
        destino = SALIDA / (rel + ".js")
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(js, encoding="utf-8")
        copiados += 1
    print(f"{copiados} páginas con código copiadas a graphify-src/ (mismas líneas que el .html)")
    # --no-gitignore: graphify-src/ está en .gitignore (no se sube) pero tiene que
    # entrar al mapa. Lo que no debe entrar está en .graphifyignore.
    subprocess.run(["graphify", "extract", ".", "--code-only", "--no-gitignore"], cwd=RAIZ, check=True)
    # update suma la estructura de los .md (skills, agentes, docs) sin IA y
    # arma GRAPH_REPORT.md. Recuerda el --no-gitignore de arriba.
    subprocess.run(["graphify", "update", "."], cwd=RAIZ, check=True)


if __name__ == "__main__":
    main()
