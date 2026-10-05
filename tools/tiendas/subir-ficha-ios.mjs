// Sube la ficha de la App Store con la API de App Store Connect: textos,
// capturas, subtítulo, categorías, clasificación por edad, datos para el
// revisor y la build. Los datos salen de ficha-ios.json y las capturas de esta
// carpeta. Se puede correr más de una vez: pisa lo que haya.
//
// Corre en Codemagic (workflow "ios-ficha"), que ya tiene la clave de Apple en
// la integración "Tratto App Store Connect". Para correrlo en otra máquina:
//   ASC_ISSUER_ID=... ASC_KEY_ID=... ASC_PRIVATE_KEY_PATH=archivo.p8 node subir-ficha-ios.mjs
// Opcionales: ASC_CONTACT_PHONE y ASC_DEMO_PASSWORD (datos para el revisor),
// PASOS=textos,capturas,... para correr solo algunos pasos.
//
// Lo que Apple no deja cargar por la API (cuestionario de privacidad) y lo que
// no va en el repo (contraseña de la cuenta demo, teléfono) se completa a mano.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ficha = JSON.parse(fs.readFileSync(path.join(AQUI, 'ficha-ios.json'), 'utf8'));
const API = 'https://api.appstoreconnect.apple.com';

const issuer = process.env.ASC_ISSUER_ID || process.env.APP_STORE_CONNECT_ISSUER_ID;
const keyId = process.env.ASC_KEY_ID || process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
// En Codemagic la clave puede llegar con los saltos de línea escritos como "\n"
const clave = (process.env.ASC_PRIVATE_KEY_PATH
  ? fs.readFileSync(process.env.ASC_PRIVATE_KEY_PATH, 'utf8')
  : process.env.APP_STORE_CONNECT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!issuer || !keyId || !clave) {
  console.error('Faltan las credenciales de App Store Connect (issuer, key id o clave privada).');
  process.exit(1);
}
console.log(`Clave de API: ${keyId} (issuer ${issuer})`);

const b64 = (x) => Buffer.from(x).toString('base64url');
function token() {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const cuerpo = b64(JSON.stringify({ iss: issuer, iat: ahora, exp: ahora + 15 * 60, aud: 'appstoreconnect-v1' }));
  const firma = crypto.sign('sha256', Buffer.from(`${cab}.${cuerpo}`), { key: clave, dsaEncoding: 'ieee-p1363' });
  return `${cab}.${cuerpo}.${b64(firma)}`;
}

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const det = (j.errors || []).map((e) => `${e.title}: ${e.detail}`).join(' | ');
    throw new Error(`${metodo} ${ruta} → ${r.status} ${det}`);
  }
  return j;
}

// PASOS=textos,capturas,... corre solo esos (por defecto, todos)
const SOLO = process.env.PASOS ? process.env.PASOS.split(',') : null;
const pasos = [];
async function paso(nombre, fn, clave) {
  if (SOLO && !SOLO.includes(clave)) return;
  try { const extra = await fn(); console.log(`✓ ${nombre}${typeof extra === 'string' ? ` (${extra})` : ''}`); pasos.push([nombre, true]); }
  catch (e) { console.log(`✗ ${nombre}: ${e.message}`); pasos.push([nombre, false]); }
}

// Versión en preparación y su idioma
const versiones = await api('GET', `/v1/apps/${ficha.appId}/appStoreVersions?filter[platform]=IOS&limit=10`);
const version = versiones.data.find((v) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState));
if (!version) { console.error('No hay una versión en preparación para editar.'); process.exit(1); }
console.log(`Versión ${version.attributes.versionString} (${version.attributes.appStoreState})`);
const locs = await api('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
const loc = locs.data.find((l) => l.attributes.locale === ficha.locale) || locs.data[0];
console.log(`Idioma de la ficha: ${loc.attributes.locale}`);

await paso('Build', async () => {
  const builds = await api('GET', `/v1/builds?filter[app]=${ficha.appId}&sort=-uploadedDate&limit=5&include=preReleaseVersion`);
  const build = builds.data.find((b) => b.attributes.processingState === 'VALID');
  if (!build) throw new Error('todavía no hay una build procesada');
  const pre = (builds.included || []).find((i) => i.id === build.relationships.preReleaseVersion.data.id);
  const numero = pre ? pre.attributes.version : version.attributes.versionString;
  if (numero !== version.attributes.versionString) {
    await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: { versionString: numero } } });
  }
  await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
  return `versión ${numero}, build ${build.attributes.version}`;
}, 'build');

await paso('Derechos de autor y publicación manual', () =>
  api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: ficha.version } }), 'version');

await paso('Descripción, palabras clave, texto promocional y URLs', () =>
  api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: ficha.localizacion } }), 'textos');

await paso('Capturas de pantalla', async () => {
  const sets = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === ficha.capturas.tipo);
  if (!set) {
    set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: ficha.capturas.tipo },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } })).data;
  }
  const viejas = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
  for (const v of viejas.data) await api('DELETE', `/v1/appScreenshots/${v.id}`);
  for (const nombre of ficha.capturas.archivos) {
    const datos = fs.readFileSync(path.join(AQUI, nombre));
    const res = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: nombre, fileSize: datos.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
    for (const op of res.attributes.uploadOperations) {
      const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: datos.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`subida de ${nombre} → ${r.status}`);
    }
    const md5 = crypto.createHash('md5').update(datos).digest('hex');
    await api('PATCH', `/v1/appScreenshots/${res.id}`, { data: { type: 'appScreenshots', id: res.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  }
  // Apple procesa cada imagen; se espera a que estén todas listas
  for (let i = 0; i < 75; i++) {
    const ahora = await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    const estados = ahora.data.map((s) => s.attributes.assetDeliveryState?.state);
    if (estados.some((e) => e === 'FAILED')) {
      const err = ahora.data.flatMap((s) => s.attributes.assetDeliveryState?.errors || []).map((e) => e.description).join(' | ');
      throw new Error(`Apple rechazó una captura: ${err}`);
    }
    if (estados.length === ficha.capturas.archivos.length && estados.every((e) => e === 'COMPLETE')) return `${estados.length} listas`;
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error('Apple sigue procesando las capturas; revisar en unos minutos');
}, 'capturas');

// Información de la app (la que está en edición)
const infos = await api('GET', `/v1/apps/${ficha.appId}/appInfos`);
const info = infos.data.find((i) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(i.attributes.appStoreState || i.attributes.state)) || infos.data[0];

await paso('Subtítulo y política de privacidad', async () => {
  const il = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
  const l = il.data.find((x) => x.attributes.locale === ficha.locale) || il.data[0];
  await api('PATCH', `/v1/appInfoLocalizations/${l.id}`, { data: { type: 'appInfoLocalizations', id: l.id,
    attributes: { subtitle: ficha.infoApp.subtitle, privacyPolicyUrl: ficha.infoApp.privacyPolicyUrl } } });
}, 'info');

await paso('Categorías', () => api('PATCH', `/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships: {
  primaryCategory: { data: { type: 'appCategories', id: ficha.infoApp.categoriaPrincipal } },
  secondaryCategory: { data: { type: 'appCategories', id: ficha.infoApp.categoriaSecundaria } } } } }), 'categorias');

await paso('Clasificación por edad', async () => {
  const decl = (await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
  // Todo en "ninguno", salvo chat entre usuarios y contenido que cargan ellos.
  // Solo se mandan los campos que la API muestra hoy, así no falla si Apple cambia el formulario.
  const NINGUNO = ['alcoholTobaccoOrDrugUseOrReferences', 'contests', 'gamblingSimulated', 'gunsOrOtherWeapons',
    'horrorOrFearThemes', 'matureOrSuggestiveThemes', 'medicalOrTreatmentInformation', 'profanityOrCrudeHumor',
    'sexualContentGraphicAndNudity', 'sexualContentOrNudity', 'violenceCartoonOrFantasy', 'violenceRealistic',
    'violenceRealisticProlongedGraphicOrSadistic'];
  const NO = ['gambling', 'unrestrictedWebAccess', 'lootBox', 'advertising', 'ageAssurance', 'healthOrWellnessTopics', 'parentalControls'];
  const SI = ['messagingAndChat', 'userGeneratedContent'];
  const valores = {};
  for (const k of Object.keys(decl.attributes)) {
    if (NINGUNO.includes(k)) valores[k] = 'NONE';
    else if (NO.includes(k)) valores[k] = false;
    else if (SI.includes(k)) valores[k] = true;
  }
  await api('PATCH', `/v1/ageRatingDeclarations/${decl.id}`, { data: { type: 'ageRatingDeclarations', id: decl.id, attributes: valores } });
}, 'edad');

await paso('Datos para el revisor', async () => {
  // El teléfono y la contraseña demo no van en el repo (es público): se pasan al correrlo
  const attrs = { ...ficha.revision };
  if (process.env.ASC_CONTACT_PHONE) attrs.contactPhone = process.env.ASC_CONTACT_PHONE;
  if (process.env.ASC_DEMO_PASSWORD) attrs.demoAccountPassword = process.env.ASC_DEMO_PASSWORD;
  const actual = await api('GET', `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null);
  if (actual && actual.data) {
    await api('PATCH', `/v1/appStoreReviewDetails/${actual.data.id}`, { data: { type: 'appStoreReviewDetails', id: actual.data.id, attributes: attrs } });
  } else {
    await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: attrs,
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } });
  }
}, 'revision');

await paso('Precio gratis', async () => {
  const puntos = await api('GET', `/v1/apps/${ficha.appId}/appPricePoints?filter[territory]=USA&limit=200`);
  const gratis = puntos.data.find((p) => Number(p.attributes.customerPrice) === 0);
  if (!gratis) throw new Error('no encontré el precio gratis');
  await api('POST', '/v1/appPriceSchedules', {
    data: { type: 'appPriceSchedules', relationships: {
      app: { data: { type: 'apps', id: ficha.appId } },
      baseTerritory: { data: { type: 'territories', id: 'USA' } },
      manualPrices: { data: [{ type: 'appPrices', id: '${precio}' }] } } },
    included: [{ type: 'appPrices', id: '${precio}', attributes: { startDate: null },
      relationships: { appPricePoint: { data: { type: 'appPricePoints', id: gratis.id } } } }] });
}, 'precio');

await paso('Disponible solo en Argentina', async () => {
  // Apple pide la lista completa de países, cada uno marcado como disponible o no
  const paises = (await api('GET', '/v1/territories?limit=200')).data.map((t) => t.id);
  await api('POST', '/v2/appAvailabilities', {
    data: { type: 'appAvailabilities', attributes: { availableInNewTerritories: false }, relationships: {
      app: { data: { type: 'apps', id: ficha.appId } },
      territoryAvailabilities: { data: paises.map((p) => ({ type: 'territoryAvailabilities', id: '${' + p + '}' })) } } },
    included: paises.map((p) => ({ type: 'territoryAvailabilities', id: '${' + p + '}', attributes: { available: p === 'ARG' },
      relationships: { territory: { data: { type: 'territories', id: p } } } })) });
  return `${paises.length} países, disponible en ARG`;
}, 'disponibilidad');

const fallas = pasos.filter((p) => !p[1]).length;
console.log(`\n${pasos.length - fallas} de ${pasos.length} pasos bien.`);
console.log('Falta a mano: contraseña de la cuenta demo y teléfono (datos para el revisor) y el cuestionario de privacidad.');
process.exit(fallas ? 1 : 0);
