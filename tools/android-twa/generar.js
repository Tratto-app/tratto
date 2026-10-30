const {TwaManifest, TwaGenerator, ConsoleLog} = require('@bubblewrap/core');
const path = require('path');
/* La versión sale de twa-manifest.json (subirla ahí antes de cada versión para
   Play). En Codemagic la clave de subida y la carpeta llegan por variables. */
const base = require('./twa-manifest.json');
(async () => {
  const log = new ConsoleLog('twa');
  const m = new TwaManifest({
    packageId: 'ar.com.trattoapp',
    host: 'www.trattoapp.com.ar',
    name: 'Tratto',
    launcherName: 'Tratto',
    display: 'standalone',
    orientation: 'portrait',
    themeColor: '#0D2721',
    themeColorDark: '#0D2721',
    navigationColor: '#0C2620',
    navigationColorDark: '#0C2620',
    navigationDividerColor: '#0C2620',
    navigationDividerColorDark: '#0C2620',
    backgroundColor: '#0C2620',
    enableNotifications: true,
    startUrl: '/?utm_source=android_app',
    iconUrl: 'https://www.trattoapp.com.ar/icon-512.png',
    maskableIconUrl: 'https://www.trattoapp.com.ar/icon-maskable-512.png',
    appVersion: base.appVersionName,
    appVersionCode: base.appVersionCode,
    shortcuts: [],
    signingKey: {path: process.env.CM_KEYSTORE_PATH || '/opt/twa-build/tratto-upload.keystore',
      alias: process.env.CM_KEY_ALIAS || 'tratto'},
    splashScreenFadeOutDuration: 300,
    generatorApp: 'bubblewrap-cli',
    webManifestUrl: 'https://www.trattoapp.com.ar/manifest.json',
    fallbackType: 'customtabs',
    features: {},
    alphaDependencies: {enabled: false},
    enableSiteSettingsShortcut: true,
    isChromeOSOnly: false,
    isMetaQuest: false,
    fullScopeUrl: 'https://www.trattoapp.com.ar/',
    minSdkVersion: 23,
    fingerprints: [],
    additionalTrustedOrigins: [],
    retainedBundles: [],
    protocolHandlers: [],
  });
  const dir = process.env.TWA_DIR || '/opt/twa-build/proyecto';
  await new TwaGenerator().createTwaProject(dir, m, log);
  await m.saveToFile(path.join(dir, 'twa-manifest.json'));
  console.log('OK proyecto en', dir);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
