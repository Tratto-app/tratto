// Pure request handler: the deployment supplies the Supabase client and secret.
// Storage deletion always precedes acknowledgement in the database.
const JOBS = [
  {
    bucket: 'publicaciones',
    list: 'fotos_para_borrar',
    listArgs: { limite: 200 },
    acknowledge: 'fotos_borradas',
    acknowledgeArg: 'nombres',
    count: 'borradas',
    references: 'pedidos',
  },
  {
    bucket: 'servicio-evidencias',
    list: 'servicio_evidencias_pendientes_borrado',
    listArgs: { p_limit: 100 },
    acknowledge: 'servicio_evidencias_borradas',
    acknowledgeArg: 'p_names',
    count: 'evidencias_borradas',
    references: 'evidencias_referencias',
  },
];

function objectNames(rows) {
  return [...new Set((Array.isArray(rows) ? rows : []).map((row) =>
    typeof row === 'string' ? row : row?.nombre ?? row?.name,
  ).filter((name) => typeof name === 'string' && name.length > 0))];
}

export function createCleanupHandler(client, signature, logger = console) {
  return async function cleanup(req) {
    if (!signature || req.headers.get('x-tratto-firma') !== signature) {
      return new Response('no autorizado', { status: 401 });
    }
    // The endpoint deliberately accepts no bucket/path from the caller.
    if (req.method !== 'POST') {
      return new Response('método no permitido', {
        status: 405, headers: { Allow: 'POST' },
      });
    }

    // The scheduled evidence-only job must never clean historical publications.
    // This selects one fixed server job, never a caller-supplied bucket or path.
    const query = new URL(req.url).searchParams;
    const mode = query.get('solo');
    if ([...query.keys()].some(key => key !== 'solo') || query.getAll('solo').length > 1
      || (mode !== null && mode !== 'evidencias')) {
      return new Response('modo no permitido', { status: 400 });
    }
    const jobs = mode === 'evidencias' ? JOBS.filter(job => job.bucket === 'servicio-evidencias') : JOBS;

    const result = { ok: true, borradas: 0, pedidos: 0, evidencias_borradas: 0,
      evidencias_referencias: 0, errores: [] };

    for (const job of jobs) {
      try {
        const listed = await client.rpc(job.list, job.listArgs);
        if (listed.error) {
          logger.error('limpieza-fotos', job.list, 'falló la selección');
          result.errores.push({ bucket: job.bucket, paso: 'listar' });
          continue;
        }
        const names = objectNames(listed.data);
        if (!names.length) continue;

        const removed = await client.storage.from(job.bucket).remove(names);
        if (removed.error) {
          logger.error('limpieza-fotos', job.bucket, 'falló Storage.remove');
          result.errores.push({ bucket: job.bucket, paso: 'borrar' });
          continue;
        }

        result[job.count] = Array.isArray(removed.data) ? removed.data.length : 0;
        // Success for the removal request also resolves an already-absent object.
        // A failed/uncertain Storage request must never clear the queue.
        const acknowledged = await client.rpc(job.acknowledge,
          { [job.acknowledgeArg]: names });
        if (acknowledged.error) {
          logger.error('limpieza-fotos', job.acknowledge, 'falló la confirmación');
          result.errores.push({ bucket: job.bucket, paso: 'confirmar' });
          continue;
        }
        result[job.references] = Number(acknowledged.data) || 0;
      } catch {
        // Do not log object paths, payloads, tokens or SDK error bodies.
        logger.error('limpieza-fotos', job.bucket, 'fallo de conexión');
        result.errores.push({ bucket: job.bucket, paso: 'conexion' });
      }
    }

    result.ok = result.errores.length === 0;
    return Response.json(result, { status: result.ok ? 200 : 500 });
  };
}
