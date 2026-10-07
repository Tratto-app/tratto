// Arma el mail (HTML y texto) a partir del texto de una automatización.
// Lógica pura, sin red: se prueba con vitest y la usa channels.ts.
//
// Formato del texto:
//   * línea en blanco = párrafo nuevo; un salto simple = salto de línea
//   * una línea sola con [Texto](https://...) = botón
//   * [texto](https://...) dentro de un párrafo = link
//   * una URL suelta queda como link

export interface EmailOptions {
  unsubscribeUrl?: string | null;
  logoUrl?: string;
  reason?: string; // por qué le llega el mail (pie)
}

const LOGO = 'https://www.trattoapp.com.ar/logo-mail.png';
const BOTON = /^\[([^\]]{1,80})\]\((https:\/\/[^\s)]+)\)$/;
const LINK = /\[([^\]]{1,120})\]\((https:\/\/[^\s)]+)\)/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(line: string): string {
  // Primero los [texto](url), después las URL sueltas que quedaron
  const parts: string[] = [];
  let last = 0;
  for (const m of line.matchAll(LINK)) {
    parts.push(bare(line.slice(last, m.index)));
    parts.push(`<a href="${escapeHtml(m[2])}" style="color:#1E5D49;font-weight:600">${escapeHtml(m[1])}</a>`);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(bare(line.slice(last)));
  return parts.join('');
}

function bare(s: string): string {
  return escapeHtml(s).replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#1E5D49">${u}</a>`);
}

function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td style="border-radius:10px;background:#1E5D49">`
    + `<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;font:600 16px/1 Arial,Helvetica,sans-serif;color:#FCFBF8;text-decoration:none;border-radius:10px">${escapeHtml(texto)}</a>`
    + `</td></tr></table>`;
}

export function emailHtml(body: string, o: EmailOptions = {}): string {
  const bloques = body.replace(/\r/g, '').trim().split(/\n{2,}/);
  const html = bloques.map((b) => {
    const t = b.trim();
    const m = t.match(BOTON);
    if (m) return boton(m[1], m[2]);
    return `<p style="margin:0 0 16px">${t.split('\n').map(inline).join('<br>')}</p>`;
  }).join('\n');
  const motivo = escapeHtml(o.reason || 'Te llega este mail porque nos diste permiso para escribirte.');
  const baja = o.unsubscribeUrl
    ? ` <a href="${escapeHtml(o.unsubscribeUrl)}" style="color:#5B6B64">No quiero recibir más mails</a>.`
    : '';
  return `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF3F0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FCFBF8;border-radius:16px;border:1px solid #DCE5E0">
<tr><td style="padding:26px 30px 0"><img src="${escapeHtml(o.logoUrl || LOGO)}" alt="Tratto" width="150" style="display:block;border:0"></td></tr>
<tr><td style="padding:16px 30px 0"><div style="height:2px;border-radius:2px;background:#C9A227;background:linear-gradient(90deg,#C9A227,#2B7E62 45%,#FCFBF8)"></div></td></tr>
<tr><td style="padding:22px 30px 10px;font:16px/1.6 Arial,Helvetica,sans-serif;color:#0E1815">
${html}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 30px;font:12px/1.5 Arial,Helvetica,sans-serif;color:#5B6B64">
${motivo}${baja}<br>Tratto · <a href="https://www.trattoapp.com.ar" style="color:#5B6B64">trattoapp.com.ar</a>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

// Versión en texto (para clientes sin HTML): los botones quedan como "Texto: url"
export function emailText(body: string, o: EmailOptions = {}): string {
  const t = body.replace(/\r/g, '').trim()
    .split('\n').map((l) => {
      const m = l.trim().match(BOTON);
      return m ? `${m[1]}: ${m[2]}` : l.replace(LINK, '$1 ($2)');
    }).join('\n');
  const pie = [o.reason || 'Te llega este mail porque nos diste permiso para escribirte.',
    o.unsubscribeUrl ? `Para no recibir más mails: ${o.unsubscribeUrl}` : ''].filter(Boolean).join('\n');
  return `${t}\n\n--\n${pie}`;
}

// Asunto con tildes para SMTP (RFC 2047, base64, en tramos de hasta 45 bytes
// para no pasar los 75 caracteres por palabra codificada). El espacio inicial
// es a propósito: denomailer vuelve a codificar todo asunto que empiece con
// "=?" y lo rompe; con el espacio lo deja pasar tal cual (y no se ve).
export function encodeSubject(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const enc = new TextEncoder();
  const words: string[] = [];
  let chunk: number[] = [];
  const flush = () => {
    if (chunk.length) words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...chunk))}?=`);
    chunk = [];
  };
  for (const ch of s) {
    const b = enc.encode(ch); // nunca se corta un caracter por la mitad
    if (chunk.length + b.length > 45) flush();
    chunk.push(...b);
  }
  flush();
  return ' ' + words.join(' ');
}
