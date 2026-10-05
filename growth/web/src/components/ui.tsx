import { useEffect, type ReactNode } from 'react';
import { delta, num } from '../lib/format';
import { MSG_STATUS, STATUS } from '../lib/labels';

export function PageHeader({ title, desc, actions }: { title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>{title}</h1>
          {desc && <p>{desc}</p>}
        </div>
        {actions && <div className="acciones">{actions}</div>}
      </div>
      <div className="hilo" />
    </>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-cab">
          {title && <h3>{title}</h3>}
          {actions && <div className="acciones">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, prev, format = num, help, highlight, raw }: {
  label: string; value: number | null | undefined; prev?: number | null; format?: (n: number | null | undefined) => string;
  help?: string; highlight?: boolean; raw?: string;
}) {
  const d = delta(value ?? null, prev ?? null);
  return (
    <div className={`card kpi ${highlight ? 'destacado' : ''}`}>
      <div className="etiqueta">{label}{help && <span className="ayuda" title={help}>?</span>}</div>
      <div className="valor">{raw ?? format(value)}</div>
      {prev !== undefined && <div className={`delta ${d.dir}`}>{d.text || ' '}</div>}
    </div>
  );
}

export function Badge({ tone = '', children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return <span className={`badge ${tone}`} title={title}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, tone: '' };
  return <Badge tone={s.tone}><span className="punto" />{s.label}</Badge>;
}

export function MsgStatus({ status }: { status: string }) {
  const s = MSG_STATUS[status] || { label: status, tone: '' };
  return <Badge tone={s.tone} title={status === 'mock_sent' ? 'No se envió de verdad: el canal está en modo simulado o faltan sus credenciales.' : undefined}>{s.label}</Badge>;
}

export function Score({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return (
    <span className={`score ${value >= 81 ? 'alto' : ''}`} title={value >= 81 ? 'Alta intención' : undefined}>
      <span className="barra"><i style={{ width: `${Math.max(2, value)}%` }} /></span>{value}
    </span>
  );
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return <div className="cargando"><span className="spinner" />{text}</div>;
}

export function ErrorBox({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {error} {onRetry && <button className="btn chico" onClick={onRetry} style={{ marginLeft: 8 }}>Reintentar</button>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="vacio">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'ancho' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-cab"><h2>{title}</h2><button className="btn fantasma chico" onClick={onClose} aria-label="Cerrar">✕</button></div>
        {children}
        {footer && <div className="modal-pie">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="campo">{label}{children}{hint && <small>{hint}</small>}</label>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmentado" role="tablist">
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={o.key === value} className={o.key === value ? 'activo' : ''} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

export function MockNote({ children }: { children?: ReactNode }) {
  return <div className="aviso">{children || 'Modo simulado: los datos de esta sección vienen de la demo o de un adaptador sin credenciales. No se inventan números reales.'}</div>;
}

// Paginación simple
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="fila" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
      <span className="muted pequeño">{num(total)} resultados · página {page + 1} de {pages}</span>
      <button className="btn chico" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</button>
      <button className="btn chico" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
    </div>
  );
}
