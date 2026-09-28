import express from 'express';
import request, { type Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Contexto } from '../src/contexto.js';
import { autenticacion } from '../src/middleware/autenticacion.js';
import { manejadorErrores } from '../src/middleware/errores.js';
import { exigePermiso } from '../src/middleware/permisos.js';
import { AlmacenSesiones } from '../src/modulos/auth/sesiones.js';
import { PAQUETE_RECEPCION, PLANTILLAS_ROL } from '../src/modulos/permisos/catalogo.js';
import { cuenta, crearEntorno } from './apoyo.js';

type Entorno = Awaited<ReturnType<typeof crearEntorno>>;

// Toda respuesta recibida en este archivo se revisa al final: ninguna debe
// filtrar el hash ni el código de acceso (reglas 1 y 2).
const respuestas: Response[] = [];
function registrar(res: Response): Response {
  respuestas.push(res);
  return res;
}

let entorno: Entorno;
beforeEach(async () => {
  entorno = await crearEntorno();
});

async function login(numero_documento: string, codigo: string) {
  return registrar(
    await request(entorno.app).post('/api/v1/auth/login').send({ numero_documento, codigo }),
  );
}

async function yo(token?: string) {
  const peticion = request(entorno.app).get('/api/v1/auth/yo');
  return registrar(await (token ? peticion.set('Authorization', `Bearer ${token}`) : peticion));
}

describe('POST /auth/login', () => {
  it.each(['administrador', 'organizador', 'participante', 'visitante', 'recepcion'] as const)(
    'la cuenta de %s inicia sesión y recibe sus permisos',
    async (clave) => {
      const c = cuenta(clave);
      const res = await login(c.numeroDocumento, c.codigo);
      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.persona).toMatchObject({
        numero_documento: c.numeroDocumento,
        nombres: c.nombres,
        rol: c.rol,
      });
      const esperados = [...PLANTILLAS_ROL[c.rol], ...(c.permisosExtra ?? [])].sort();
      expect(res.body.permisos).toEqual(esperados);
    },
  );

  it('acepta el código en minúsculas, con espacios y guiones', async () => {
    const c = cuenta('administrador');
    const res = await login(c.numeroDocumento, ' admn-2 ');
    expect(res.status).toBe(200);
  });

  it('registra el último acceso', async () => {
    const c = cuenta('visitante');
    await login(c.numeroDocumento, c.codigo);
    const { ultimo_acceso } = entorno.bd
      .prepare(
        `SELECT u.ultimo_acceso FROM usuario u JOIN persona p ON p.id = u.persona_id
         WHERE p.numero_documento = ?`,
      )
      .get(c.numeroDocumento) as { ultimo_acceso: string | null };
    expect(ultimo_acceso).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('responde exactamente igual a todo fallo, sin revelar qué documentos existen (regla 4)', async () => {
    const visitante = cuenta('visitante');
    const organizador = cuenta('organizador');
    const sinUsuario = entorno.bd
      .prepare(
        'SELECT numero_documento FROM persona WHERE id NOT IN (SELECT persona_id FROM usuario) LIMIT 1',
      )
      .get() as { numero_documento: string };

    const documentoInexistente = await login('9999999999', visitante.codigo);
    const codigoIncorrecto = await login(visitante.numeroDocumento, 'ZZZZZ');
    const personaSinUsuario = await login(sinUsuario.numero_documento, 'ABCDE');

    entorno.bd
      .prepare(
        'UPDATE usuario SET activo = 0 WHERE persona_id = (SELECT id FROM persona WHERE numero_documento = ?)',
      )
      .run(visitante.numeroDocumento);
    const usuarioInactivo = await login(visitante.numeroDocumento, visitante.codigo);

    entorno.bd
      .prepare('UPDATE persona SET activo = 0 WHERE numero_documento = ?')
      .run(organizador.numeroDocumento);
    const personaInactiva = await login(organizador.numeroDocumento, organizador.codigo);

    const esperado = {
      status: 401,
      body: {
        error: {
          codigo: 'CREDENCIALES_INVALIDAS',
          mensaje: 'Documento o código de acceso incorrectos.',
          detalle: {},
        },
      },
    };
    for (const res of [
      documentoInexistente,
      codigoIncorrecto,
      personaSinUsuario,
      usuarioInactivo,
      personaInactiva,
    ]) {
      expect({ status: res.status, body: res.body }).toEqual(esperado);
    }
  });

  it('responde 400 si faltan campos', async () => {
    const res = registrar(
      await request(entorno.app).post('/api/v1/auth/login').send({ codigo: 'ABCDE' }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('CUERPO_INVALIDO');
    expect(res.body.error.detalle.campos).toEqual([
      { campo: 'numero_documento', mensaje: expect.any(String) },
    ]);
  });
});

describe('sesión', () => {
  it('GET /auth/yo devuelve la persona autenticada y sus permisos', async () => {
    const token = await entorno.tokenDe('recepcion');
    const res = await yo(token);
    expect(res.status).toBe(200);
    expect(res.body.persona.numero_documento).toBe(cuenta('recepcion').numeroDocumento);
    expect(res.body.permisos).toEqual([...PAQUETE_RECEPCION].sort());
  });

  it.each([
    ['sin cabecera', undefined],
    ['con un token inventado', 'no-existe'],
  ])('responde 401 %s', async (_caso, token) => {
    const res = await yo(token);
    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('responde 401 si la cabecera no usa el esquema Bearer', async () => {
    const token = await entorno.tokenDe('visitante');
    const res = registrar(
      await request(entorno.app).get('/api/v1/auth/yo').set('Authorization', `Token ${token}`),
    );
    expect(res.status).toBe(401);
  });

  it('tras POST /auth/salir el token deja de servir', async () => {
    const token = await entorno.tokenDe('visitante');
    const salir = registrar(
      await request(entorno.app).post('/api/v1/auth/salir').set('Authorization', `Bearer ${token}`),
    );
    expect(salir.status).toBe(204);
    expect((await yo(token)).status).toBe(401);
  });

  it('la sesión vence a las 12 horas', async () => {
    let ahora = Date.now();
    entorno = await crearEntorno({ sesiones: new AlmacenSesiones(12 * 3600_000, () => ahora) });
    const token = await entorno.tokenDe('visitante');
    ahora += 12 * 3600_000 - 1;
    expect((await yo(token)).status).toBe(200);
    ahora += 1;
    expect((await yo(token)).status).toBe(401);
  });

  it('desactivar a una persona corta su sesión en la siguiente petición', async () => {
    const token = await entorno.tokenDe('organizador');
    entorno.bd
      .prepare('UPDATE persona SET activo = 0 WHERE numero_documento = ?')
      .run(cuenta('organizador').numeroDocumento);
    expect((await yo(token)).status).toBe(401);
  });
});

describe('exigePermiso', () => {
  // Ruta de prueba protegida con un permiso; se monta igual que las reales.
  function appProtegida(ctx: Contexto) {
    const app = express();
    app.get('/protegida', autenticacion(ctx), exigePermiso('actividad.gestionar'), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(manejadorErrores);
    return app;
  }

  async function pedir(token?: string) {
    const app = appProtegida({ bd: entorno.bd, sesiones: entorno.sesiones });
    const peticion = request(app).get('/protegida');
    return registrar(await (token ? peticion.set('Authorization', `Bearer ${token}`) : peticion));
  }

  it('sin token responde 401', async () => {
    expect((await pedir()).status).toBe(401);
  });

  it('con token pero sin el permiso responde 403 indicando cuál falta', async () => {
    const res = await pedir(await entorno.tokenDe('visitante'));
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      codigo: 'SIN_PERMISO',
      mensaje: expect.any(String),
      detalle: { permiso: 'actividad.gestionar' },
    });
  });

  it('con el permiso deja pasar', async () => {
    const res = await pedir(await entorno.tokenDe('organizador'));
    expect(res.status).toBe(200);
  });

  it('decide por permiso, no por rol: un visitante con el permiso pasa, sin cerrar sesión', async () => {
    const token = await entorno.tokenDe('visitante');
    expect((await pedir(token)).status).toBe(403);

    entorno.bd
      .prepare(
        `INSERT INTO autorizacion (persona_id, permiso_id)
         SELECT p.id, pm.id FROM persona p, permiso pm
         WHERE p.numero_documento = ? AND pm.codigo = 'actividad.gestionar'`,
      )
      .run(cuenta('visitante').numeroDocumento);
    expect((await pedir(token)).status).toBe(200);
  });
});

describe('credenciales en las respuestas', () => {
  it('ninguna respuesta de este archivo contiene el hash ni el código de acceso', () => {
    expect(respuestas.length).toBeGreaterThan(20);
    for (const res of respuestas) {
      const texto = res.text;
      expect(texto).not.toContain('codigo_hash');
      expect(texto).not.toMatch(/\$2[aby]\$/);
      for (const c of ['ADMN2', 'RGNZ3', 'PART4', 'VSTA5', 'RECP6']) {
        expect(texto).not.toContain(c);
      }
    }
  });
});
