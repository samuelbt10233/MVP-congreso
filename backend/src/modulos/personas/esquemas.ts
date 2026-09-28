import { z } from 'zod';
import { PERMISOS, type CodigoPermiso } from '../permisos/catalogo.js';

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const camposPersona = {
  tipo_documento: z.enum(['CC', 'CE', 'TI', 'PAS']),
  numero_documento: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9]+$/, 'Solo letras y números, sin espacios ni puntos'),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  correo: z.email().max(150).nullable().optional(),
  telefono: textoOpcional(30),
  organizacion: textoOpcional(150),
  nacionalidad: textoOpcional(60),
  descripcion: textoOpcional(300),
  rol_id: z.number().int().positive(),
};

export const esquemaAltaPersona = z.object({
  ...camposPersona,
  // Sin rol explícito, la persona se da de alta como visitante.
  rol_id: camposPersona.rol_id.optional(),
});

export const esquemaEdicionPersona = z
  .object({ ...camposPersona, activo: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'Indica al menos un campo a modificar');

export const esquemaListadoPersonas = z.object({
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

const codigosPermiso = PERMISOS.map((p) => p.codigo) as [CodigoPermiso, ...CodigoPermiso[]];

export const esquemaPermisos = z.object({
  permisos: z.array(z.enum(codigosPermiso)),
});

export type DatosAltaPersona = z.infer<typeof esquemaAltaPersona>;
export type DatosEdicionPersona = z.infer<typeof esquemaEdicionPersona>;
