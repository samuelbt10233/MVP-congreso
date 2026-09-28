import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Error de negocio o de acceso con la forma única de error del diseño (§5).
 * Los servicios lanzan esta clase; el manejador central la traduce a HTTP.
 */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalle: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

type CuerpoError = {
  error: { codigo: string; mensaje: string; detalle: Record<string, unknown> };
};

function cuerpoError(
  codigo: string,
  mensaje: string,
  detalle: Record<string, unknown> = {},
): CuerpoError {
  return { error: { codigo, mensaje, detalle } };
}

export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json(cuerpoError('RUTA_NO_ENCONTRADA', 'El recurso solicitado no existe.'));
};

export const manejadorErrores: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ErrorApi) {
    res.status(err.estado).json(cuerpoError(err.codigo, err.message, err.detalle));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      cuerpoError('CUERPO_INVALIDO', 'Hay campos faltantes o con formato inválido.', {
        campos: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      }),
    );
    return;
  }

  // JSON mal formado en el cuerpo: lo detecta express.json() antes de llegar a las rutas.
  if (err instanceof SyntaxError && 'body' in err) {
    res
      .status(400)
      .json(cuerpoError('CUERPO_INVALIDO', 'El cuerpo de la petición no es JSON válido.'));
    return;
  }

  console.error(err);
  res.status(500).json(cuerpoError('ERROR_INTERNO', 'Ocurrió un error inesperado.'));
};
