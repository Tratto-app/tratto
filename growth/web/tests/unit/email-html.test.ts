import { describe, expect, it } from 'vitest';
import { emailHtml, emailText, encodeSubject, escapeHtml } from '../../../supabase/functions/_shared/email-html';

const cuerpo = 'Hola Ana,\n\nComparaste "DJ para un 15" en Morón: $450.000.\nQuedó caro.\n\n[Pedir presupuestos](https://x.supabase.co/functions/v1/growth-go/mail-calculadora?r=abc123)\n\nEquipo de Tratto';

describe('emailHtml', () => {
  it('arma párrafos, saltos de línea y el botón', () => {
    const h = emailHtml(cuerpo, { unsubscribeUrl: 'https://x/baja?ws=tratto&r=abc123' });
    expect(h).toContain('<p style="margin:0 0 16px">Hola Ana,</p>');
    expect(h).toContain('$450.000.<br>Quedó caro.');
    expect(h).toContain('>Pedir presupuestos</a>');
    expect(h).toContain('href="https://x.supabase.co/functions/v1/growth-go/mail-calculadora?r=abc123"');
    expect(h).toContain('No quiero recibir más mails');
    expect(h).toContain('href="https://x/baja?ws=tratto&amp;r=abc123"');
  });

  it('escapa el HTML que venga en los datos', () => {
    const h = emailHtml('Hola <script>alert(1)</script>');
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });

  it('convierte links dentro del texto y URLs sueltas', () => {
    const h = emailHtml('Mirá [la calculadora](https://www.trattoapp.com.ar/calculadora) o https://www.trattoapp.com.ar');
    expect(h).toContain('<a href="https://www.trattoapp.com.ar/calculadora" style="color:#1E5D49;font-weight:600">la calculadora</a>');
    expect(h).toContain('<a href="https://www.trattoapp.com.ar" style="color:#1E5D49">https://www.trattoapp.com.ar</a>');
  });

  it('no acepta links que no sean https', () => {
    const h = emailHtml('[Entrá](javascript:alert(1))');
    expect(h).not.toContain('href="javascript');
  });

  it('usa el motivo del permiso en el pie', () => {
    const h = emailHtml('Hola', { reason: 'Te llega porque marcaste la casilla.' });
    expect(h).toContain('Te llega porque marcaste la casilla.');
  });
});

describe('emailText', () => {
  it('deja el botón como texto con la URL y agrega la baja', () => {
    const t = emailText(cuerpo, { unsubscribeUrl: 'https://x/baja' });
    expect(t).toContain('Pedir presupuestos: https://x.supabase.co/functions/v1/growth-go/mail-calculadora?r=abc123');
    expect(t).toContain('Para no recibir más mails: https://x/baja');
  });
});

describe('escapeHtml', () => {
  it('escapa comillas y signos', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('encodeSubject', () => {
  it('deja igual un asunto sin tildes', () => {
    expect(encodeSubject('Hola Ana')).toBe('Hola Ana');
  });
  const decode = (s: string) => s.trim().split(' ').map((w) => {
    const b64 = w.slice(10, -2);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }).reduce((acc, b) => new Uint8Array([...acc, ...b]), new Uint8Array());
  it('codifica en base64 los asuntos con tildes, con un espacio adelante', () => {
    const s = encodeSubject('Tu comparación: Instalación');
    expect(s.startsWith(' =?UTF-8?B?')).toBe(true);
    expect(new TextDecoder().decode(decode(s))).toBe('Tu comparación: Instalación');
  });
  it('parte los asuntos largos en palabras de hasta 75 caracteres sin cortar letras', () => {
    const asunto = 'Tu comparación: Instalación de split de 3.000 a 4.500 frigorías en Barracas, ñandú';
    const s = encodeSubject(asunto);
    for (const w of s.trim().split(' ')) expect(w.length).toBeLessThanOrEqual(75);
    expect(new TextDecoder().decode(decode(s))).toBe(asunto);
  });
});
