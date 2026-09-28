import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PLANTILLAS_ROL } from '../src/modulos/permisos/catalogo.js';
import { esCodigoValido } from '../src/utils/codigo.js';
import { cuenta, crearEntorno } from './apoyo.js';

type Entorno = Awaited<ReturnType<typeof crearEntorno>>;

let entorno: Entorno;
beforeEach(async () => {
  entorno = await crearEntorno();
});

const nuevaPersona = (extra: object = {}) => ({
  tipo_documento: 'CC',
  numero_documento: '52123456',
  nombres: 'Lucía',
  apellidos: 'Méndez Prieto',
  organizacion: 'Universidad Distrital',
  ...extra,
});

const idPersona = (clave: Parameters<typeof cuenta>[0]) =>
  entorno.idDe('persona', 'numero_documento', cuenta(clave).numeroDocumento);

describe('permisos de las rutas de personas', () => {
  it.each([
    ['visitante', 'get', '/api/v1/personas'],
    ['recepcion', 'get', '/api/v1/personas'],
    ['organizador', 'patch', '/api/v1/personas/1'],
    ['organizador', 'put', '/api/v1/personas/1/permisos'],
    ['organizador', 'get', '/api/v1/personas/1/permisos'],
    ['organizador', 'post', '/api/v1/personas/1/codigo'],
    ['organizador', 'post', '/api/v1/personas'],
  ] as const)('%s recibe 403 en %s %s', async (clave, metodo, url) => {
    const cliente = await entorno.como(clave);
    const res = await cliente[metodo](url, {});
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('SIN_PERMISO');
  });

  it('sin sesión responde 401', async () => {
    const res = await request(entorno.app).get('/api/v1/personas');
    expect(res.status).toBe(401);
  });
});

describe('GET /personas', () => {
  it('pagina de 20 en 20 con el total', async () => {
    const admin = await entorno.como('administrador');
    const primera = await admin.get('/api/v1/personas');
    expect(primera.status).toBe(200);
    expect(primera.body).toMatchObject({ pagina: 1, por_pagina: 20, total: 53 });
    expect(primera.body.items).toHaveLength(20);
    const ultima = await admin.get('/api/v1/personas?pagina=3');
    expect(ultima.body.items).toHaveLength(13);
  });

  it('busca por nombre sin distinguir mayúsculas y por documento', async () => {
    const admin = await entorno.como('administrador');
    const porNombre = await admin.get('/api/v1/personas?q=valentina');
    expect(porNombre.body.items.map((p: { nombres: string }) => p.nombres)).toContain('Valentina');
    const porDocumento = await admin.get('/api/v1/personas?q=1030303030');
    expect(porDocumento.body.total).toBe(1);
  });

  it('con solo persona.leer el documento sale enmascarado y sin datos de contacto', async () => {
    const organizador = await entorno.como('organizador');
    const res = await organizador.get(`/api/v1/personas/${idPersona('participante')}`);
    expect(res.status).toBe(200);
    expect(res.body.numero_documento).toBe('****3030');
    expect(res.body).not.toHaveProperty('correo');
    expect(res.body).not.toHaveProperty('telefono');

    const listado = await organizador.get('/api/v1/personas');
    for (const p of listado.body.items) {
      expect(p.numero_documento).toMatch(/^\*{4}/);
      expect(p).not.toHaveProperty('correo');
    }
  });

  it('con persona.editar el documento sale completo, con correo', async () => {
    const admin = await entorno.como('administrador');
    const res = await admin.get(`/api/v1/personas/${idPersona('participante')}`);
    expect(res.body.numero_documento).toBe('1030303030');
    expect(res.body.correo).toBe(cuenta('participante').correo);
  });

  it('responde 404 con una persona inexistente y 400 con un id inválido', async () => {
    const admin = await entorno.como('administrador');
    expect((await admin.get('/api/v1/personas/99999')).body.error.codigo).toBe(
      'PERSONA_NO_ENCONTRADA',
    );
    expect((await admin.get('/api/v1/personas/abc')).status).toBe(400);
  });
});

describe('POST /personas', () => {
  it('I12: recepción da de alta un visitante sin permisos y recibe su código una vez', async () => {
    const recepcion = await entorno.como('recepcion');
    const res = await recepcion.post('/api/v1/personas', nuevaPersona());
    expect(res.status).toBe(201);
    expect(res.body.persona).toMatchObject({ nombres: 'Lucía', rol: 'visitante' });
    expect(res.body.permisos).toEqual([]);
    expect(esCodigoValido(res.body.codigo_acceso, 5)).toBe(true);

    // El código entregado sirve para iniciar sesión.
    const login = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ numero_documento: '52123456', codigo: res.body.codigo_acceso });
    expect(login.status).toBe(200);
  });

  it('I12: recepción recibe 403 al pedir otro rol, y no se crea nada', async () => {
    const recepcion = await entorno.como('recepcion');
    const res = await recepcion.post(
      '/api/v1/personas',
      nuevaPersona({ rol_id: entorno.idDe('rol', 'nombre', 'administrador') }),
    );
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('ALTA_ROL_NO_PERMITIDA');
    expect(
      entorno.bd.prepare("SELECT 1 FROM persona WHERE numero_documento = '52123456'").get(),
    ).toBeUndefined();
  });

  it('el administrador da de alta con cualquier rol y se aplica su plantilla', async () => {
    const admin = await entorno.como('administrador');
    const res = await admin.post(
      '/api/v1/personas',
      nuevaPersona({ rol_id: entorno.idDe('rol', 'nombre', 'organizador') }),
    );
    expect(res.status).toBe(201);
    expect(res.body.permisos).toEqual([...PLANTILLAS_ROL.organizador].sort());
    const { otorgado_por } = entorno.bd
      .prepare('SELECT DISTINCT otorgado_por FROM autorizacion WHERE persona_id = ?')
      .get(res.body.persona.id) as { otorgado_por: number };
    expect(otorgado_por).toBe(idPersona('administrador'));
  });

  it('I6: un documento repetido responde 409', async () => {
    const recepcion = await entorno.como('recepcion');
    const res = await recepcion.post(
      '/api/v1/personas',
      nuevaPersona({ numero_documento: cuenta('visitante').numeroDocumento }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe('DOCUMENTO_DUPLICADO');
  });

  it('valida el cuerpo: campos obligatorios y formato de documento', async () => {
    const admin = await entorno.como('administrador');
    const res = await admin.post('/api/v1/personas', {
      tipo_documento: 'CC',
      numero_documento: '52.123.456',
    });
    expect(res.status).toBe(400);
    const campos = res.body.error.detalle.campos.map((c: { campo: string }) => c.campo);
    expect(campos).toEqual(expect.arrayContaining(['numero_documento', 'nombres', 'apellidos']));
  });

  it('un rol inexistente responde 422', async () => {
    const admin = await entorno.como('administrador');
    const res = await admin.post('/api/v1/personas', nuevaPersona({ rol_id: 999 }));
    expect(res.status).toBe(422);
    expect(res.body.error.detalle.campo).toBe('rol_id');
  });
});

describe('PATCH /personas/:id', () => {
  it('modifica solo los campos enviados', async () => {
    const admin = await entorno.como('administrador');
    const id = idPersona('visitante');
    const res = await admin.patch(`/api/v1/personas/${id}`, {
      organizacion: 'ETITC',
      telefono: '3001234567',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      organizacion: 'ETITC',
      telefono: '3001234567',
      nombres: cuenta('visitante').nombres,
    });
  });

  it('I6: cambiar al documento de otra persona responde 409', async () => {
    const admin = await entorno.como('administrador');
    const res = await admin.patch(`/api/v1/personas/${idPersona('visitante')}`, {
      numero_documento: cuenta('organizador').numeroDocumento,
    });
    expect(res.status).toBe(409);
  });

  it('desactivar a una persona le impide iniciar sesión', async () => {
    const admin = await entorno.como('administrador');
    await admin.patch(`/api/v1/personas/${idPersona('visitante')}`, { activo: false });
    const c = cuenta('visitante');
    const login = await request(entorno.app)
      .post('/api/v1/auth/login')
      .send({ numero_documento: c.numeroDocumento, codigo: c.codigo });
    expect(login.status).toBe(401);
  });

  it('un cuerpo vacío responde 400', async () => {
    const admin = await entorno.como('administrador');
    expect((await admin.patch(`/api/v1/personas/${idPersona('visitante')}`, {})).status).toBe(400);
  });
});

describe('permisos de una persona', () => {
  it('PUT reemplaza el conjunto y GET lo devuelve', async () => {
    const admin = await entorno.como('administrador');
    const id = idPersona('participante');
    const put = await admin.put(`/api/v1/personas/${id}/permisos`, {
      permisos: ['llegada.registrar', 'persona.crear'],
    });
    expect(put.status).toBe(200);
    expect(put.body.permisos).toEqual(['llegada.registrar', 'persona.crear']);

    const quitar = await admin.put(`/api/v1/personas/${id}/permisos`, {
      permisos: ['persona.crear'],
    });
    expect(quitar.body.permisos).toEqual(['persona.crear']);
    expect((await admin.get(`/api/v1/personas/${id}/permisos`)).body.permisos).toEqual([
      'persona.crear',
    ]);

    const vaciar = await admin.put(`/api/v1/personas/${id}/permisos`, { permisos: [] });
    expect(vaciar.body.permisos).toEqual([]);
  });

  it('rechaza permisos que no existen en el catálogo', async () => {
    const admin = await entorno.como('administrador');
    const res = await admin.put(`/api/v1/personas/${idPersona('participante')}/permisos`, {
      permisos: ['zona.gestionar'],
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /personas/:id/codigo', () => {
  it('regenera el código: el anterior deja de servir y el nuevo sí', async () => {
    const admin = await entorno.como('administrador');
    const c = cuenta('visitante');
    const res = await admin.post(`/api/v1/personas/${idPersona('visitante')}/codigo`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ codigo_acceso: expect.any(String) });

    const login = (codigo: string) =>
      request(entorno.app)
        .post('/api/v1/auth/login')
        .send({ numero_documento: c.numeroDocumento, codigo });
    expect((await login(c.codigo)).status).toBe(401);
    expect((await login(res.body.codigo_acceso)).status).toBe(200);
  });

  it('crea el usuario si la persona no tenía (201)', async () => {
    const admin = await entorno.como('administrador');
    const sinUsuario = entorno.bd
      .prepare('SELECT id FROM persona WHERE id NOT IN (SELECT persona_id FROM usuario) LIMIT 1')
      .get() as { id: number };
    const res = await admin.post(`/api/v1/personas/${sinUsuario.id}/codigo`);
    expect(res.status).toBe(201);
  });

  it('el código no vuelve a aparecer en ninguna consulta posterior (regla 3)', async () => {
    const admin = await entorno.como('administrador');
    const id = idPersona('visitante');
    const { codigo_acceso } = (await admin.post(`/api/v1/personas/${id}/codigo`)).body;
    for (const url of [`/api/v1/personas/${id}`, '/api/v1/personas', '/api/v1/auth/yo']) {
      const res = await admin.get(url);
      expect(res.text).not.toContain(codigo_acceso);
      expect(res.text).not.toContain('codigo_hash');
    }
  });
});
