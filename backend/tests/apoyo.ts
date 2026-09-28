import request from 'supertest';
import { CUENTAS_DEMO } from '../database/semillas/demo.js';
import { crearApp } from '../src/app.js';
import { abrirBase } from '../src/db/conexion.js';
import { poblarBase } from '../src/db/reset.js';
import { AlmacenSesiones } from '../src/modulos/auth/sesiones.js';

export type ClaveCuenta = (typeof CUENTAS_DEMO)[number]['clave'];

export function cuenta(clave: ClaveCuenta) {
  return CUENTAS_DEMO.find((c) => c.clave === clave)!;
}

/** App sobre una base en memoria con la semilla de demo. */
export async function crearEntorno(opciones: { sesiones?: AlmacenSesiones; ahora?: Date } = {}) {
  const bd = abrirBase(':memory:');
  await poblarBase(bd, { ahora: opciones.ahora });
  const sesiones = opciones.sesiones ?? new AlmacenSesiones();
  const app = crearApp({ bd, sesiones });

  async function tokenDe(clave: ClaveCuenta): Promise<string> {
    const c = cuenta(clave);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ numero_documento: c.numeroDocumento, codigo: c.codigo });
    if (res.status !== 200) throw new Error(`Login de ${clave} falló: ${res.status}`);
    return res.body.token as string;
  }

  return { bd, sesiones, app, tokenDe };
}
