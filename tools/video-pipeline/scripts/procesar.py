#!/usr/bin/env python3
"""
Pipeline de edicion automatica para contenido vertical (TikTok/Reels/Shorts).

Toma cada video de ../input, le saca silencios largos, lo recorta a 9:16
centrado en la cara si el original es horizontal, le agrega un zoom sutil
y subtitulos quemados, y guarda el resultado en ../output.

Uso:
    python3 procesar.py

Requiere: ffmpeg, ffprobe, opencv-python-headless, faster-whisper.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
INPUT_DIR = BASE / "input"
OUTPUT_DIR = BASE / "output"
EXTENSIONES = {".mp4", ".mov", ".mkv", ".avi"}

SILENCIO_DB = "-35dB"       # umbral para considerar silencio
SILENCIO_MIN_S = 0.6        # duracion minima de silencio a cortar
PADDING_S = 0.12            # margen que se deja alrededor de cada corte
ZOOM_FACTOR = 1.06          # empuje de zoom sutil (6%)
ANCHO_SALIDA = 1080
ALTO_SALIDA = 1920

WHISPER_MODEL_SIZE = "small"


def log(msg: str) -> None:
    print(f"[pipeline] {msg}", flush=True)


def correr(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def ffprobe_info(path: Path) -> dict | None:
    r = correr([
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ])
    if r.returncode != 0:
        log(f"  ffprobe fallo en {path.name}: {r.stderr.strip()[:300]}")
        return None
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None

    video_streams = [s for s in data.get("streams", []) if s.get("codec_type") == "video"]
    audio_streams = [s for s in data.get("streams", []) if s.get("codec_type") == "audio"]
    if not video_streams:
        return None

    v = video_streams[0]
    duracion = float(data.get("format", {}).get("duration", 0) or 0)
    ancho = int(v.get("width", 0))
    alto = int(v.get("height", 0))
    fr = v.get("r_frame_rate", "30/1")
    try:
        num, den = fr.split("/")
        fps = float(num) / float(den) if float(den) else 0
    except ValueError:
        fps = 0

    return {
        "duracion": duracion,
        "ancho": ancho,
        "alto": alto,
        "fps": fps,
        "tiene_audio": bool(audio_streams),
        "vertical": alto >= ancho,
        "tamano_mb": path.stat().st_size / (1024 * 1024),
    }


def detectar_silencios(path: Path, duracion_total: float) -> list[tuple[float, float]]:
    r = correr([
        "ffmpeg", "-i", str(path), "-af",
        f"silencedetect=noise={SILENCIO_DB}:d={SILENCIO_MIN_S}",
        "-f", "null", "-",
    ])
    salida = r.stderr
    inicios = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", salida)]
    fines = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", salida)]
    silencios = list(zip(inicios, fines))
    if len(inicios) > len(fines):
        silencios.append((inicios[-1], duracion_total))
    return silencios


def segmentos_a_conservar(duracion_total: float, silencios: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not silencios:
        return [(0.0, duracion_total)]

    cortes = []
    for s0, s1 in silencios:
        ini = max(0.0, s0 + PADDING_S)
        fin = min(duracion_total, s1 - PADDING_S)
        if fin > ini:
            cortes.append((ini, fin))

    conservar = []
    cursor = 0.0
    for ini, fin in cortes:
        if ini > cursor:
            conservar.append((cursor, ini))
        cursor = max(cursor, fin)
    if cursor < duracion_total:
        conservar.append((cursor, duracion_total))

    # Descarta fragmentos ridiculamente cortos (ruido de deteccion)
    conservar = [(a, b) for a, b in conservar if b - a > 0.25]
    return conservar or [(0.0, duracion_total)]


def detectar_centro_cara(path: Path, ancho: int, alto: int, duracion: float) -> float:
    """Devuelve la posicion x (0-1) donde centrar el recorte vertical."""
    import cv2

    cascada = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return 0.5

    muestras = 12
    centros = []
    for i in range(muestras):
        t = (i + 0.5) * duracion / muestras
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        gris = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        caras = cascada.detectMultiScale(gris, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        if len(caras) == 0:
            continue
        # la cara mas grande detectada en el frame
        x, y, w, h = max(caras, key=lambda c: c[2] * c[3])
        centros.append((x + w / 2) / frame.shape[1])

    cap.release()
    if not centros:
        log("  no se detecto cara en ninguna muestra, uso el centro")
        return 0.5

    centros.sort()
    mediana = centros[len(centros) // 2]
    return mediana


def transcribir(path: Path):
    from faster_whisper import WhisperModel

    log(f"  transcribiendo con faster-whisper ({WHISPER_MODEL_SIZE})...")
    modelo = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    segmentos, _info = modelo.transcribe(
        str(path), language="es", word_timestamps=True, vad_filter=True
    )
    palabras = []
    for seg in segmentos:
        for w in seg.words or []:
            palabras.append({"palabra": w.word.strip(), "inicio": w.start, "fin": w.end})
    return palabras


def segundos_a_ass(t: float) -> str:
    cs = int(round(t * 100))
    h, resto = divmod(cs, 360000)
    m, resto = divmod(resto, 6000)
    s, cs = divmod(resto, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def generar_ass(palabras: list[dict], ruta_ass: Path, ancho: int, alto: int) -> bool:
    if not palabras:
        return False

    margen_v = int(alto * 0.16)  # zona segura: lejos del borde inferior
    tamano_fuente = int(ancho * 0.062)

    encabezado = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {ancho}
PlayResY: {alto}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,IBM Plex Sans,{tamano_fuente},&H00FCFBF8,&H0027E0C9,&H002E1A0C,&H00000000,1,0,0,0,100,100,0,0,1,5,0,2,60,60,{margen_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    grupos = []
    actual = []
    for p in palabras:
        actual.append(p)
        if len(actual) >= 3:
            grupos.append(actual)
            actual = []
    if actual:
        grupos.append(actual)

    lineas = []
    for grupo in grupos:
        inicio = grupo[0]["inicio"]
        fin = grupo[-1]["fin"]
        texto = " ".join(p["palabra"] for p in grupo).upper()
        texto = texto.replace("{", "").replace("}", "")
        lineas.append(
            f"Dialogue: 0,{segundos_a_ass(inicio)},{segundos_a_ass(fin)},Default,,0,0,0,,{{\\fad(60,60)}}{texto}"
        )

    ruta_ass.write_text(encabezado + "\n".join(lineas) + "\n", encoding="utf-8")
    return True


def construir_filtro_seleccion(segmentos: list[tuple[float, float]]) -> tuple[str, str]:
    partes = [f"between(t,{a:.3f},{b:.3f})" for a, b in segmentos]
    expr = "+".join(partes)
    filtro_v = f"select='{expr}',setpts=N/FRAME_RATE/TB"
    filtro_a = f"aselect='{expr}',asetpts=N/SR/TB"
    return filtro_v, filtro_a


def procesar_video(path: Path, idx: int) -> tuple[bool, str]:
    info = ffprobe_info(path)
    if info is None:
        return False, "ffprobe no pudo leer el archivo (no es un video valido o esta corrupto)"

    log(f"  {info['ancho']}x{info['alto']} · {info['fps']:.1f}fps · {info['duracion']:.1f}s · "
        f"{'con' if info['tiene_audio'] else 'sin'} audio · {info['tamano_mb']:.1f}MB")

    if info["duracion"] <= 0:
        return False, "duracion invalida"

    # 1) silencios -> segmentos a conservar
    if info["tiene_audio"]:
        silencios = detectar_silencios(path, info["duracion"])
        segmentos = segmentos_a_conservar(info["duracion"], silencios)
        duracion_final = sum(b - a for a, b in segmentos)
        log(f"  {len(silencios)} silencio(s) detectado(s) -> {len(segmentos)} segmento(s), "
            f"{info['duracion']:.1f}s -> {duracion_final:.1f}s")
    else:
        segmentos = [(0.0, info["duracion"])]
        log("  sin pista de audio: no se recortan silencios")

    filtro_v_sel, filtro_a_sel = construir_filtro_seleccion(segmentos)

    # 2) encuadre 9:16
    filtros_video = [filtro_v_sel]
    if info["vertical"]:
        filtros_video.append(f"scale={ANCHO_SALIDA}:{ALTO_SALIDA}:force_original_aspect_ratio=increase")
        filtros_video.append(f"crop={ANCHO_SALIDA}:{ALTO_SALIDA}")
    else:
        log("  video horizontal: buscando la cara para centrar el recorte...")
        centro_x = detectar_centro_cara(path, info["ancho"], info["alto"], info["duracion"])
        ancho_recorte = info["alto"] * ANCHO_SALIDA / ALTO_SALIDA
        ancho_recorte = min(ancho_recorte, info["ancho"])
        x_px = centro_x * info["ancho"] - ancho_recorte / 2
        x_px = max(0, min(info["ancho"] - ancho_recorte, x_px))
        log(f"  centro de cara en x={centro_x:.2f} -> recorte en x={x_px:.0f}px de ancho {ancho_recorte:.0f}px")
        filtros_video.append(f"crop={ancho_recorte:.0f}:{info['alto']}:{x_px:.0f}:0")
        filtros_video.append(f"scale={ANCHO_SALIDA}:{ALTO_SALIDA}")

    # 3) zoom sutil constante (empuje tipo Ken Burns, no exagerado)
    filtros_video.append(
        f"zoompan=z='min(zoom+0.0007,{ZOOM_FACTOR})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":s={ANCHO_SALIDA}x{ALTO_SALIDA}:fps={max(info['fps'], 24):.0f}"
    )

    # 4) subtitulos (si hay audio)
    ruta_ass = None
    if info["tiene_audio"]:
        try:
            palabras = transcribir(path)
            if palabras:
                ruta_ass = OUTPUT_DIR / f"_tmp_{path.stem}.ass"
                if generar_ass(palabras, ruta_ass, ANCHO_SALIDA, ALTO_SALIDA):
                    escapado = str(ruta_ass).replace("\\", "\\\\").replace(":", "\\:")
                    filtros_video.append(f"ass='{escapado}'")
                else:
                    ruta_ass = None
            else:
                log("  no se detecto voz para subtitular")
        except Exception as e:  # noqa: BLE001
            log(f"  aviso: no se pudieron generar subtitulos ({e})")

    filtro_video_final = ",".join(filtros_video)

    salida = OUTPUT_DIR / f"video_{idx:02d}_editado.mp4"
    cmd = ["ffmpeg", "-y", "-i", str(path)]
    if info["tiene_audio"]:
        cmd += [
            "-filter_complex", f"[0:v]{filtro_video_final}[v];[0:a]{filtro_a_sel}[a]",
            "-map", "[v]", "-map", "[a]",
            "-c:a", "aac", "-b:a", "160k",
        ]
    else:
        cmd += ["-vf", filtro_video_final, "-an"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", str(salida)]

    r = correr(cmd)
    if ruta_ass and ruta_ass.exists():
        ruta_ass.unlink()

    if r.returncode != 0 or not salida.exists():
        return False, f"ffmpeg fallo al codificar: {r.stderr.strip()[-500:]}"

    verif = ffprobe_info(salida)
    if verif is None:
        return False, "el archivo de salida quedo invalido (no se pudo reproducir)"

    log(f"  listo -> {salida.name} ({verif['ancho']}x{verif['alto']}, {verif['duracion']:.1f}s, "
        f"{verif['tamano_mb']:.1f}MB)")
    return True, str(salida)


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    INPUT_DIR.mkdir(exist_ok=True)

    archivos = sorted(
        p for p in INPUT_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONES
    )

    if not archivos:
        log(f"No hay videos en {INPUT_DIR}. Coloca archivos .mp4/.mov/.mkv/.avi ahi y volve a correr.")
        return

    log(f"{len(archivos)} video(s) encontrado(s) en /input")
    resultados = []
    for idx, path in enumerate(archivos, start=1):
        log(f"[{idx}/{len(archivos)}] {path.name}")
        try:
            ok, detalle = procesar_video(path, idx)
        except Exception as e:  # noqa: BLE001
            ok, detalle = False, f"error inesperado: {e}"
        resultados.append((path.name, ok, detalle))
        if not ok:
            log(f"  ERROR: {detalle}")

    log("")
    log("=== Resumen ===")
    for nombre, ok, detalle in resultados:
        estado = "OK" if ok else "FALLO"
        log(f"  [{estado}] {nombre} -> {detalle}")


if __name__ == "__main__":
    sys.exit(main())
