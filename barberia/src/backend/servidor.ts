import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Contexto } from '../booking/servicio.js';
import { env, esProduccion, iaConfigurada, sheetsConfigurado, whatsappConfigurado, driverBD } from '../config/env.js';
import { log } from '../shared/log.js';
import { rutasWebhook } from './routes/webhook.js';
import { rutasPanel } from './routes/panel.js';
import { rutasSimulador } from './routes/simulador.js';
import { manejadorDeErrores, noEncontrado } from './middleware/errores.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.resolve(AQUI, '../../public');

export function crearServidor(ctx: Contexto): Express {
  const app = express();

  // Detras de Render/Railway/Vercel hay un proxy: sin esto, el rate limit ve
  // una sola IP para todo el mundo.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: esProduccion,
    }),
  );

  app.get('/salud', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      servicio: 'barberia-turnos',
      entorno: env.NODE_ENV,
      base_de_datos: driverBD,
      ia: iaConfigurada,
      whatsapp: whatsappConfigurado,
      sheets: sheetsConfigurado,
      hora_local: ctx.ahora().toISO(),
    });
  });

  app.use('/webhook', rutasWebhook(ctx));

  // El simulador se monta ANTES que el panel: el router del panel exige sesión
  // para todo lo que cuelga de /api, y si fuera primero taparía estas rutas.
  if (env.SIMULADOR_HABILITADO) {
    app.use('/api/simulador', rutasSimulador(ctx));
  }

  app.use('/api', rutasPanel(ctx));

  // Panel del barbero y simulador (archivos estaticos).
  app.use(
    express.static(PUBLICO, {
      maxAge: esProduccion ? '1h' : 0,
      index: false,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  const limiteEstatico = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

  app.get('/', limiteEstatico, (_req, res) => res.redirect('/panel'));
  app.get('/panel', limiteEstatico, (_req, res) => res.sendFile(path.join(PUBLICO, 'panel.html')));
  app.get('/test-chat', limiteEstatico, (_req, res) => {
    if (!env.SIMULADOR_HABILITADO) {
      res.status(404).send('El simulador está deshabilitado.');
      return;
    }
    res.sendFile(path.join(PUBLICO, 'simulador.html'));
  });

  app.use(noEncontrado);
  app.use(manejadorDeErrores);

  return app;
}

export function escuchar(app: Express): { cerrar: () => Promise<void> } {
  const servidor = app.listen(env.PORT, () => {
    log.info({ puerto: env.PORT, entorno: env.NODE_ENV }, 'servidor escuchando');
    if (!esProduccion) {
      const base = env.APP_BASE_URL ?? `http://localhost:${env.PORT}`;
      // eslint-disable-next-line no-console
      console.log(`\n  Panel del barbero: ${base}/panel`);
      // eslint-disable-next-line no-console
      console.log(`  Simulador de chat: ${base}/test-chat`);
      // eslint-disable-next-line no-console
      console.log(`  Webhook WhatsApp:  ${base}/webhook/whatsapp\n`);
    }
  });

  // Un error al escuchar (puerto ocupado, permisos) es fatal: si no se corta
  // acá, el proceso queda vivo sin atender nada y parece que todo funciona.
  servidor.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      log.fatal({ puerto: env.PORT }, 'el puerto ya está en uso');
      // eslint-disable-next-line no-console
      console.error(`\n❌ El puerto ${env.PORT} ya está ocupado. Cerrá el otro proceso o cambiá PORT en .env\n`);
    } else {
      log.fatal({ err: e.message }, 'no se pudo abrir el servidor');
    }
    process.exit(1);
  });

  return {
    cerrar: () =>
      new Promise<void>((resolve) => {
        servidor.close(() => resolve());
      }),
  };
}
