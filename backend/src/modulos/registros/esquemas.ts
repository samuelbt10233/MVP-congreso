import { z } from 'zod';
import { esDia } from '../../utils/fechas.js';

const documento = z.string().trim().min(1).max(30);

export const esquemaBusquedaRecepcion = z.object({ documento });

export const esquemaLlegada = z.object({ numero_documento: documento });

export const esquemaListadoLlegadas = z.object({
  dia: z.string().refine(esDia, 'Usa el formato YYYY-MM-DD').optional(),
});

export const esquemaAsistencia = z.object({ codigo: z.string().max(30) });
