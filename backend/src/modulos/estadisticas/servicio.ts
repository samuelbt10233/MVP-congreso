import type { Contexto } from '../../contexto.js';
import { aUtcSql, desdeUtcSql, diaBogota } from '../../utils/fechas.js';
import { asistenciaPorActividad, contarTotales, instantesDeLlegada } from './repositorio.js';

export function resumen(ctx: Contexto) {
  const ahora = aUtcSql(ctx.ahora());

  const porDia = new Map<string, number>();
  for (const instante of instantesDeLlegada(ctx.bd)) {
    const dia = diaBogota(desdeUtcSql(instante));
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  const porActividad = asistenciaPorActividad(ctx.bd).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    inicio: a.inicio,
    fin: a.fin,
    cancelada: a.cancelada === 1,
    zona: a.zona,
    capacidad: a.capacidad,
    asistentes: a.asistentes,
    // Fracción de la capacidad de la zona; null si la zona no tiene capacidad registrada.
    ocupacion: a.capacidad ? Math.round((a.asistentes / a.capacidad) * 1000) / 1000 : null,
    en_curso: a.cancelada === 0 && a.inicio <= ahora && ahora < a.fin,
  }));

  return {
    generado_en: ahora,
    totales: contarTotales(ctx.bd),
    llegadas_por_dia: [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, total]) => ({ dia, total })),
    actividades_en_curso: porActividad.filter((a) => a.en_curso),
    por_actividad: porActividad,
  };
}
