/**
 * Cliente HTTP de la API. Adjunta el token, traduce la forma única de error a
 * `ErrorApi` y avisa cuando la sesión deja de ser válida (401).
 */

const BASE = '/api/v1';
const CLAVE_TOKEN = 'congreso.token';

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

// El token vive en sessionStorage (CLAUDE.md, convenciones de frontend); el código
// de acceso nunca se guarda en ningún lado.
export const token = {
  leer: () => sessionStorage.getItem(CLAVE_TOKEN),
  guardar: (valor: string) => sessionStorage.setItem(CLAVE_TOKEN, valor),
  borrar: () => sessionStorage.removeItem(CLAVE_TOKEN),
};

let alPerderSesion: (() => void) | undefined;

/** Registra qué hacer cuando el servidor rechaza la sesión (redirigir al acceso). */
export function registrarAlPerderSesion(accion: () => void): void {
  alPerderSesion = accion;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT';

export async function pedir<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  const tokenActual = token.leer();
  const cabeceras: Record<string, string> = {};
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (tokenActual) cabeceras['Authorization'] = `Bearer ${tokenActual}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Intenta de nuevo.');
  }

  if (respuesta.status === 204) return undefined as T;
  const datos: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = (datos as { error?: { codigo: string; mensaje: string; detalle?: object } })
      ?.error;
    if (respuesta.status === 401 && tokenActual) {
      token.borrar();
      alPerderSesion?.();
    }
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR_DESCONOCIDO',
      error?.mensaje ?? 'Ocurrió un error inesperado.',
      (error?.detalle as Record<string, unknown>) ?? {},
    );
  }
  return datos as T;
}

/** Arma una cadena de consulta omitiendo los valores vacíos. */
export function consulta(parametros: Record<string, string | number | undefined>): string {
  const pares = Object.entries(parametros).filter(
    (par): par is [string, string | number] => par[1] !== undefined && par[1] !== '',
  );
  return pares.length ? `?${new URLSearchParams(pares.map(([k, v]) => [k, String(v)]))}` : '';
}
