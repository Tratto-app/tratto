import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const receipts = JSON.parse(await readFile(path.join(root, 'assets/fonts/SOURCES.json'), 'utf8'));
let verified = 0;
for (const row of receipts.sources.filter(x => x.file)) {
  const data = await readFile(path.join(root,row.file));
  assert.equal(createHash('sha256').update(data).digest('hex'),row.sha256,row.file);
  if (row.bytes !== undefined) assert.equal(data.length,row.bytes,row.file);
  if (row.integrity) assert.equal('sha384-'+createHash('sha384').update(data).digest('base64'),row.integrity);
  verified++;
}
const css = await readFile(path.join(root,'assets/fonts/tratto-fonts.css'),'utf8');
assert.equal(/url\(\s*['"]?https?:/i.test(css),false,'remote font source');
for (const family of ['Montserrat','IBM Plex Sans','IBM Plex Sans Condensed','IBM Plex Mono'])
  assert.ok(css.includes("font-family: '"+family+"'"),family);
for (const ref of css.matchAll(/url\(([^)]+)\)/g)) {
  assert.match(ref[1],/^\.\/font-[a-f0-9]{16}\.woff2$/);
  assert.equal((await readFile(path.join(root,'assets/fonts',ref[1]))).subarray(0,4).toString(),'wOF2');
}
console.log(`OK: ${verified} archivos y licencias con hash; fuentes locales, cuatro familias y SRI del SDK.`);
