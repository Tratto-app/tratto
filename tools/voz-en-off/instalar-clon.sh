#!/usr/bin/env bash
# Instala la voz clonada del fundador (Qwen3-TTS 1.7B Base, Apache 2.0) en un
# entorno aparte, para no pisar los paquetes del sistema. Una vez por sesion;
# tarda unos 5 minutos (torch para procesador, el modelo de 4,3 GB y
# faster-whisper para los controles).
set -e
V=${TRATTO_VENV_VOZ:-/root/venv-voz}
[ -x "$V/bin/python" ] || python3 -m venv "$V"
"$V/bin/pip" install -q --upgrade pip
"$V/bin/pip" install -q torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
"$V/bin/pip" install -q qwen-tts==0.1.1 transformers==4.57.3 faster-whisper==1.2.1 soundfile
"$V/bin/python" -c "import torch; from qwen_tts import Qwen3TTSModel as M; M.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cpu', dtype=torch.float32); print('voz clonada lista')"
