import { z } from 'zod';
import { aUtcSql, esDia, esUtcSql } from '../../utils/fechas.js';

const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Instante de inicio o fin. Se acepta ISO-8601 con zona horaria explícita
 * ('2026-10-15T08:00:00-05:00') o el formato de almacenamiento en UTC, y siempre se
 * normaliza a UTC 'YYYY-MM-DD HH:MM:SS' (regla 10).
 */
const instante = z
  .string()
  .trim()
  .transform((valor, ctx) => {
    if (esUtcSql(valor)) return valor;
    const fecha = ISO_CON_ZONA.test(valor) ? new Date(valor) : undefined;
    if (fecha && !Number.isNaN(fecha.getTime())) return aUtcSql(fecha);
    ctx.addIssue({
      code: 'custom',
      message:
        'Usa ISO-8601 con zona horaria (2026-10-15T08:00:00-05:00) o UTC YYYY-MM-DD HH:MM:SS',
    });
    return z.NEVER;
  });

const id = z.number().int().positive();

const camposActividad = {
  nombre: z.string().trim().min(1).max(200),
  descripcion: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  tipo_actividad_id: id,
  categoria_id: id.nullable().optional(),
  zona_id: id,
  responsable_id: id.nullable().optional(),
  inicio: instante,
  fin: instante,
};

export const esquemaAltaActividad = z.object(camposActividad);

export const esquemaEdicionActividad = z
  .object(camposActividad)
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un campo a modificar');

const idConsulta = z.coerce.number().int().positive().optional();

export const esquemaListadoActividades = z.object({
  dia: z.string().refine(esDia, 'Usa el formato YYYY-MM-DD').optional(),
  zona_id: idConsulta,
  tipo_id: idConsulta,
  categoria_id: idConsulta,
});

export type DatosAltaActividad = z.infer<typeof esquemaAltaActividad>;
export type DatosEdicionActividad = z.infer<typeof esquemaEdicionActividad>;
export type FiltrosActividades = z.infer<typeof esquemaListadoActividades>;
