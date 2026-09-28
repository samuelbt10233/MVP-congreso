import { z } from 'zod';

export const esquemaLogin = z.object({
  numero_documento: z.string().trim().min(1).max(30),
  codigo: z.string().max(30),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
