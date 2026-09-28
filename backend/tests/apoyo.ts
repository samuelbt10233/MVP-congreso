import request from 'supertest';
import { CUENTAS_DEMO } from '../database/semillas/demo.js';
import { crearApp } from '../src/app.js';
import type { Contexto } from '../src/contexto.js';
import { abrirBase } from '../src/db/conexion.js';
import { poblarBase } from '../src/db/reset.js';
import { AlmacenSesiones } from '../src/modulos/auth/sesiones.js';

export type ClaveCuenta = (typeof CUENTAS_DEMO)[number]['clave'];

export function cuenta(clave: ClaveCuenta) {
  return CUENTAS_DEMO.find((c) => c.clave === clave)!;
}

/** App sobre una base en memoria con la semilla de demo. */
export async function crearEntorno(
  opciones: { sesiones?: AlmacenSesiones; ahora?: Date; ventanaAsistenciaAntesMin?: number } = {},
) {
  const bd = abrirBase(':memory:');
  // La semilla y el reloj del servidor parten del mismo instante; `fijarHora` lo mueve.
  let horaActual = opciones.ahora ?? new Date();
  await poblarBase(bd, { ahora: horaActual });
  const sesiones = opciones.sesiones ?? new AlmacenSesiones();
  const ctx: Contexto = {
    bd,
    sesiones,
    ahora: () => horaActual,
    ventanaAsistenciaAntesMin: opciones.ventanaAsistenciaAntesMin ?? 15,
  };
  const app = crearApp(ctx);
  const fijarHora = (instante: Date) => {
    horaActual = instante;
  };

  async function tokenDe(clave: ClaveCuenta): Promise<string> {
    const c = cuenta(clave);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ numero_documento: c.numeroDocumento, codigo: c.codigo });
    if (res.status !== 200) throw new Error(`Login de ${clave} falló: ${res.status}`);
    return res.body.token as string;
  }

  /** Cliente HTTP autenticado como una cuenta de demo. */
  async function como(clave: ClaveCuenta) {
    const autorizacion = `Bearer ${await tokenDe(clave)}`;
    return {
      get: (url: string) => request(app).get(url).set('Authorization', autorizacion),
      post: (url: string, cuerpo: object = {}) =>
        request(app).post(url).set('Authorization', autorizacion).send(cuerpo),
      patch: (url: string, cuerpo: object) =>
        request(app).patch(url).set('Authorization', autorizacion).send(cuerpo),
      put: (url: string, cuerpo: object) =>
        request(app).put(url).set('Authorization', autorizacion).send(cuerpo),
    };
  }

  /** Id de una fila por una columna única; para preparar escenarios. */
  function idDe(tabla: string, columna: string, valor: string): number {
    const fila = bd.prepare(`SELECT id FROM ${tabla} WHERE ${columna} = ?`).get(valor) as
      { id: number } | undefined;
    if (!fila) throw new Error(`No existe ${tabla}.${columna} = ${valor}`);
    return fila.id;
  }

  return { bd, sesiones, ctx, app, tokenDe, como, idDe, fijarHora };
}
