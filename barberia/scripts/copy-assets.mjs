// Copia al build los archivos que tsc no toca (SQL del esquema).
import fs from 'node:fs';
import path from 'node:path';

const pares = [
  ['src/database/schema.sql', 'dist/database/schema.sql'],
  ['src/database/schema.postgres.sql', 'dist/database/schema.postgres.sql'],
];
for (const [origen, destino] of pares) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
}
console.log('assets copiados al build');
