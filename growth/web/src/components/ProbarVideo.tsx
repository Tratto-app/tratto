import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { analizar, type Resultado, type Zona } from '../lib/cerebro-core';
import { extraer, MAX_MB } from '../lib/cerebro-extraer';
import { supabase } from '../lib/supabase';
import { CerebroSvg, tono, ZONAS } from './CerebroSvg';
import { Card } from './ui';

// Probar un video en el CRM: se elige el archivo, el navegador lo analiza
// (cerebro-core.ts, el mismo que usan los agentes por la CLI) y se ve el
// cerebro segundo a segundo con el gancho, la retención y qué cambiar.
// Se puede guardar en una pieza de la cola (datos.cerebro).

export interface Opcion { id: string; etiqueta: string }
type Fase = 'vacio' | 'analizando' | 'listo';

const coma = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

function Anillo({ valor }: { valor: number }) {
  const r = 46, l = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="probar-anillo" role="img" aria-label={`Puntaje viral ${valor} de 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sup-3)" strokeWidth="9" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={tono(valor)} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(l * valor) / 100} ${l}`} transform="rotate(-90 60 60)" />
      <text x="60" y="62" textAnchor="middle" className="probar-anillo-num">{valor}</text>
      <text x="60" y="80" textAnchor="middle" className="probar-anillo-pie">VIRAL</text>
    </svg>
  );
}

export function ProbarVideo({ opciones, onGuardado }: { opciones: Opcion[]; onGuardado: () => void }) {
  const [fase, setFase] = useState<Fase>('vacio');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [res, setRes] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seg, setSeg] = useState<number | null>(null);
  const [encima, setEncima] = useState(false);
  const [pieza, setPieza] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<{ etiqueta: string; anterior: boolean } | null>(null);
  const [tic, setTic] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (fase !== 'analizando') return;
    const t = window.setInterval(() => setTic((x) => x + 1), 420);
    return () => window.clearInterval(t);
  }, [fase]);

  // Mientras analiza, las zonas se prenden y se apagan.
  const pensando = useMemo(() => Object.fromEntries(ZONAS.map((z, i) => [z.key, Math.round(25 + 65 * Math.abs(Math.sin(tic * 0.6 + i * 1.3)))])) as Record<Zona, number>, [tic]);

  async function elegir(f: File | undefined) {
    if (!f) return;
    setError(null); setRes(null); setSeg(null); setGuardado(null); setProgreso(0);
    setArchivo(f);
    setUrl(URL.createObjectURL(f));
    setFase('analizando');
    try {
      const e = await extraer(f, setProgreso);
      await new Promise((ok) => setTimeout(ok, 30));
      setRes(analizar(e));
      setProgreso(1);
      setFase('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFase('vacio');
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setEncima(false);
    if (fase !== 'analizando') elegir(e.dataTransfer.files?.[0]);
  }

  function ir(s: number) {
    setSeg(s);
    if (video.current) { video.current.currentTime = s + 0.05; video.current.pause(); }
  }

  async function guardar() {
    if (!res || !pieza || !archivo) return;
    setGuardando(true); setError(null);
    try {
      const actual = await supabase.from('growth_mkt_items').select('datos').eq('id', pieza).single();
      if (actual.error) throw new Error(actual.error.message);
      const datos = (actual.data?.datos || {}) as Record<string, unknown> & { cerebro?: Record<string, unknown> & { versiones?: unknown[] } };
      const prev = datos.cerebro;
      const versiones = [...(prev?.versiones || [])];
      if (prev && prev.estado !== 'pendiente' && (prev.viral !== undefined || prev.regiones)) {
        const { versiones: _v, zonas_por_segundo: _z, linea: _l, consejos: _c, ...resto } = prev;
        versiones.unshift({ ...resto, nombre: (prev.archivo as string) || (prev.herramienta as string) || 'anterior' });
      }
      const cerebro = { ...res, archivo: archivo.name, versiones: versiones.slice(0, 5) };
      const up = await supabase.from('growth_mkt_items').update({ datos: { ...datos, cerebro } }).eq('id', pieza);
      if (up.error) throw new Error(up.error.message);
      setGuardado({ etiqueta: opciones.find((o) => o.id === pieza)?.etiqueta || 'la pieza', anterior: versiones.length > (prev?.versiones?.length || 0) });
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  function otro() {
    setFase('vacio'); setRes(null); setArchivo(null); setUrl(null); setSeg(null); setGuardado(null); setError(null);
    if (entrada.current) entrada.current.value = '';
  }

  const regiones = res ? (seg !== null && res.zonas_por_segundo[seg]) || res.regiones : undefined;
  const sen = res?.senales;
  const maxLinea = 100;

  return (
    <Card className="probar" title="Probar un video"
      actions={fase === 'listo' && <button className="btn chico" onClick={otro}>Probar otro</button>}>
      <input ref={entrada} type="file" accept="video/*" hidden onChange={(e) => elegir(e.target.files?.[0])} />

      {fase === 'vacio' && (
        <button type="button" className={`probar-soltar ${encima ? 'encima' : ''}`} onClick={() => entrada.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setEncima(true); }} onDragLeave={() => setEncima(false)} onDrop={soltar}>
          <CerebroSvg apagado className="probar-soltar-cerebro" />
          <span className="probar-soltar-texto">
            <strong>Arrastrá un video acá o tocá para elegirlo</strong>
            <span>MP4, MOV o WEBM, hasta {MAX_MB} MB. Mira los primeros 30 segundos, con foco en los primeros 15.</span>
            <span className="probar-privado">Se analiza en tu navegador: el video no se sube a ningún lado.</span>
          </span>
        </button>
      )}
      {error && <div className="aviso probar-error">{error}</div>}

      {fase === 'analizando' && (
        <div className="probar-cargando">
          <CerebroSvg regiones={pensando} pensando />
          <div className="probar-progreso"><span style={{ width: `${Math.round(progreso * 100)}%` }} /></div>
          <div className="muted pequeño">
            {progreso < 0.8 ? 'Mirando el video cuadro por cuadro' : progreso < 0.95 ? 'Escuchando el sonido' : 'Calculando'}… {Math.round(progreso * 100)}%
          </div>
          <div className="muted pequeño">{archivo?.name}</div>
        </div>
      )}

      {fase === 'listo' && res && url && (
        <>
          <div className="probar-grilla">
            <div className="probar-video">
              <video ref={video} src={url} controls playsInline
                onTimeUpdate={(e) => { const v = e.currentTarget; if (!v.paused) setSeg(Math.min(Math.floor(v.currentTime), res.linea.length - 1)); }}
                onSeeked={(e) => setSeg(Math.min(Math.floor(e.currentTarget.currentTime), res.linea.length - 1))}
                onEnded={() => setSeg(null)} />
              <div className="muted pequeño probar-nombre" title={archivo?.name}>{archivo?.name} · {coma(res.duracion)} s</div>
            </div>

            <div className="probar-cerebro">
              <div className="probar-momento">
                {seg === null ? <span>Resumen de los primeros {Math.min(15, res.linea.length)} s</span> : <span>Segundo {seg} a {seg + 1}</span>}
                {seg !== null && <button className="btn fantasma chico" onClick={() => setSeg(null)}>Ver resumen</button>}
              </div>
              <CerebroSvg regiones={regiones} />
              <div className="cerebro-leyenda muted pequeño"><span className="frio" /> menos activación <span className="calido" /> más activación</div>
            </div>

            <div className="probar-puntos">
              <Anillo valor={res.viral} />
              <div className="cerebro-puntajes dos">
                <div className="cerebro-puntaje" title="Cuánto engancha el arranque (primeros 3 segundos)"><span>Gancho</span><strong>{res.gancho}</strong><small>/100</small></div>
                <div className="cerebro-puntaje" title="Cuánta gente seguiría mirando a los 15 segundos"><span>Retención</span><strong>{res.retencion}</strong><small>/100</small></div>
              </div>
              <ul className="cerebro-zonas">
                {ZONAS.map((z) => (
                  <li key={z.key} title={z.que}>
                    <span>{z.nombre}</span>
                    <span className={`barra ${z.key === 'foco' ? 'invertida' : ''}`}><span style={{ width: `${regiones?.[z.key] ?? 0}%` }} /></span>
                    <span className="valor">{regiones?.[z.key] ?? '—'}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="probar-linea-cab">
            <strong className="pequeño">Atención segundo a segundo</strong>
            <span className="muted pequeño">Tocá un segundo para verlo en el cerebro y en el video</span>
          </div>
          <div className="probar-linea" role="list">
            {res.linea.map((v, s) => (
              <button key={s} role="listitem" type="button"
                className={`probar-seg ${s < 3 ? 'gancho' : ''} ${seg === s ? 'activo' : ''} ${sen?.segundos_quietos.includes(s) ? 'quieto' : ''}`}
                title={`Segundo ${s}: atención ${v}${sen?.segundos_quietos.includes(s) ? ' · quieto' : ''}`} onClick={() => ir(s)}>
                <span className="col" style={{ height: `${Math.max(4, (v / maxLinea) * 100)}%`, background: tono(v) }} />
                <span className="num">{s}</span>
              </button>
            ))}
          </div>
          <div className="probar-marcas muted pequeño"><span className="m-gancho" /> los primeros 3 s deciden si se quedan <span className="m-quieto" /> segundo quieto</div>

          <div className="probar-senales">
            <span>{sen && sen.cortes_por_segundo > 0 ? `un cambio cada ${coma(1 / sen.cortes_por_segundo)} s` : 'sin cambios de plano'}</span>
            <span>{sen?.sonido_desde === null ? 'sin sonido' : `sonido desde ${coma(sen?.sonido_desde ?? 0)} s`}</span>
            <span>voz {Math.round((sen?.voz ?? 0) * 100)}%</span>
            <span>texto o detalle {Math.round((sen?.texto ?? 0) * 100)}%</span>
            <span>{sen?.cierre_con_marca === null ? 'cierre: no se pudo ver' : sen?.cierre_con_marca ? 'cierra con placa quieta' : 'sin placa final quieta'}</span>
          </div>

          <div className="probar-consejos">
            <strong className="pequeño">Qué cambiaría</strong>
            {res.consejos.length
              ? <ul>{res.consejos.map((c) => <li key={c}>{c}</li>)}</ul>
              : <div className="muted pequeño">Con estas señales no aparece nada para corregir.</div>}
          </div>

          <div className="probar-guardar">
            <select value={pieza} onChange={(e) => { setPieza(e.target.value); setGuardado(null); }} aria-label="Pieza donde guardar el análisis">
              <option value="">Elegí la pieza de la cola…</option>
              {opciones.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
            </select>
            <button className="btn primario" disabled={!pieza || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar en la pieza'}</button>
            {guardado && <span className="pequeño probar-ok">Guardado en «{guardado.etiqueta}».{guardado.anterior && ' El análisis anterior quedó en versiones.'}</span>}
          </div>
        </>
      )}

      <p className="muted pequeño probar-nota">
        Estimación de Tratto por señales del video: movimiento, cambios de plano o de texto, color, sonido y voz. No es un modelo del cerebro:
        el dibujo ubica cada señal en la zona que se asocia con ese estímulo. Sirve para comparar versiones antes de publicar, no garantiza resultados.
      </p>
    </Card>
  );
}
