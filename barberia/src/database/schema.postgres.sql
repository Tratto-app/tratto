-- Refuerzos especificos de PostgreSQL.
--
-- La restriccion de exclusion hace fisicamente imposible que dos turnos vivos
-- se superpongan, aun si dos procesos distintos escriben al mismo tiempo.
-- No necesita extensiones: GiST soporta rangos de forma nativa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turnos_sin_superposicion'
  ) THEN
    ALTER TABLE turnos
      ADD CONSTRAINT turnos_sin_superposicion
      EXCLUDE USING gist (int8range(inicio_ms, fin_ms) WITH &&)
      WHERE (estado IN ('pendiente','reservado','confirmado'));
  END IF;
END
$$;
