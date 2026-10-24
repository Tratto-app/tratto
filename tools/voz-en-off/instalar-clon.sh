#!/usr/bin/env bash
# Instala la voz clonada (Chatterbox multilingue, MIT) en un entorno aparte, para
# no pisar los paquetes del sistema. Una vez por sesion; tarda unos 4 minutos
# (torch para procesador, el modelo y faster-whisper para el control).
set -e
V=${TRATTO_VENV_VOZ:-/root/venv-voz}
[ -x "$V/bin/python" ] || python3 -m venv "$V"
"$V/bin/pip" install -q --upgrade pip
"$V/bin/pip" install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
"$V/bin/pip" install -q chatterbox-tts==0.1.7 faster-whisper==1.2.1
"$V/bin/python" -c "from chatterbox.mtl_tts import ChatterboxMultilingualTTS as M; M.from_pretrained(device='cpu'); print('voz clonada lista')"
