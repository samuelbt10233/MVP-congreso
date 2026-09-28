import { beforeEach, describe, expect, it } from 'vitest';
import { aUtcSql, instanteBogota } from '../src/utils/fechas.js';
import { cuenta, crearEntorno } from './apoyo.js';

type Entorno = Awaited<ReturnType<typeof crearEntorno>>;

// A las 10:47 de Bogotá la semilla deja, entre otras (hora local):
//   «Movilidad eléctrica en Bogotá»      10:00–11:00, en curso, responsable: participante de demo
//   «Gestión del agua en zonas urbanas»  11:30–12:30, próxima (su ventana abre 11:15)
//   «Blockchain para la trazabilidad…»   12:00–13:00, cancelada
//   «Gemelos digitales en la manufactura» 07:30–08:30, terminada, de otro responsable
const DIA = '2026-10-15';
const AHORA = instanteBogota(DIA, '10:47');
const a = (hhmm: string, segundos = 0) =>
  new Date(instanteBogota(DIA, hhmm).getTime() + segundos * 1000);

let entorno: Entorno;
beforeEach(async () => {
  entorno = await crearEntorno({ ahora: AHORA });
});

function actividad(nombre: string): { id: number; codigo: string } {
  return entorno.bd.prepare('SELECT id, codigo FROM actividad WHERE nombre = ?').get(nombre) as {
    id: number;
    codigo: string;
  };
}

const MOVILIDAD = 'Movilidad eléctrica en Bogotá';
const AGUA = 'Gestión del agua en zonas urbanas';
const CANCELADA = 'Blockchain para la trazabilidad de alimentos';
const GEMELOS = 'Gemelos digitales en la manufactura';

async function marcar(codigo: string, clave: Parameters<Entorno['como']>[0] = 'visitante') {
  const cliente = await entorno.como(clave);
  return cliente.post('/api/v1/registros/asistencia', { codigo });
}

describe('POST /registros/asistencia', () => {
  it('registra la asistencia de la persona del token dentro de la ventana', async () => {
    const res = await marcar(actividad(MOVILIDAD).codigo);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      actividad: { id: actividad(MOVILIDAD).id, nombre: MOVILIDAD, zona: 'Salón A202' },
      fecha_hora: aUtcSql(AHORA),
    });
  });

  it('acepta el código en minúsculas, con espacios y guiones', async () => {
    const { codigo } = actividad(MOVILIDAD);
    const tecleado = ` ${codigo.slice(0, 2).toLowerCase()}-${codigo.slice(2)} `;
    expect((await marcar(tecleado)).status).toBe(201);
  });

  describe('rechazos, en el orden del diseño', () => {
    it('1. código inexistente: 422 CODIGO_ACTIVIDAD_INVALIDO', async () => {
      for (const codigo of ['ZZZZ', '', '!!']) {
        const res = await marcar(codigo);
        expect(res.status).toBe(422);
        expect(res.body.error.codigo).toBe('CODIGO_ACTIVIDAD_INVALIDO');
      }
    });

    it('2. I9, actividad cancelada: 422 ACTIVIDAD_CANCELADA, aunque además esté fuera de ventana', async () => {
      const res = await marcar(actividad(CANCELADA).codigo);
      expect(res.status).toBe(422);
      expect(res.body.error.codigo).toBe('ACTIVIDAD_CANCELADA');
    });

    it('3. I7, fuera de ventana: 422 FUERA_DE_VENTANA con la ventana en el detalle', async () => {
      const res = await marcar(actividad(AGUA).codigo);
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        codigo: 'FUERA_DE_VENTANA',
        detalle: { abre: aUtcSql(a('11:15')), cierra: aUtcSql(a('12:30')) },
      });
    });

    it('4. I3, ya registrada: 409 ASISTENCIA_YA_REGISTRADA', async () => {
      const { codigo } = actividad(MOVILIDAD);
      expect((await marcar(codigo)).status).toBe(201);
      const res = await marcar(codigo);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({
        codigo: 'ASISTENCIA_YA_REGISTRADA',
        detalle: { fecha_hora: aUtcSql(AHORA) },
      });
    });
  });

  describe('I7: bordes de la ventana (15 minutos antes del inicio hasta el fin)', () => {
    it.each([
      ['un segundo antes de abrir', a('11:15', -1), 422],
      ['justo al abrir', a('11:15'), 201],
      ['justo al terminar', a('12:30'), 201],
      ['un segundo después de terminar', a('12:30', 1), 422],
    ])('%s responde %s', async (_caso, instante, estado) => {
      entorno.fijarHora(instante);
      expect((await marcar(actividad(AGUA).codigo)).status).toBe(estado);
    });

    it('el margen se configura: con 5 minutos, a las 11:20 aún no abre', async () => {
      // Con el margen por defecto (15) a las 11:20 ya estaría abierta.
      entorno = await crearEntorno({ ahora: AHORA, ventanaAsistenciaAntesMin: 5 });
      entorno.fijarHora(a('11:20'));
      expect((await marcar(actividad(AGUA).codigo)).status).toBe(422);
      entorno.fijarHora(a('11:25'));
      expect((await marcar(actividad(AGUA).codigo)).status).toBe(201);
    });
  });

  it('no requiere permisos: basta con estar autenticado', async () => {
    expect(
      entorno.bd
        .prepare('SELECT 1 FROM autorizacion WHERE persona_id = ?')
        .get(entorno.idDe('persona', 'numero_documento', cuenta('visitante').numeroDocumento)),
    ).toBeUndefined();
    expect((await marcar(actividad(MOVILIDAD).codigo)).status).toBe(201);
  });
});

describe('GET /registros/asistencia/mias', () => {
  it('devuelve solo las asistencias de quien consulta', async () => {
    const visitante = await entorno.como('visitante');
    expect((await visitante.get('/api/v1/registros/asistencia/mias')).body).toEqual([]);
    await marcar(actividad(MOVILIDAD).codigo);
    const res = await visitante.get('/api/v1/registros/asistencia/mias');
    expect(res.body).toEqual([
      {
        fecha_hora: aUtcSql(AHORA),
        actividad: expect.objectContaining({ id: actividad(MOVILIDAD).id, nombre: MOVILIDAD }),
      },
    ]);
  });
});

describe('GET /actividades/:id/asistentes', () => {
  const url = (nombre: string) => `/api/v1/actividades/${actividad(nombre).id}/asistentes`;
  const total = (nombre: string) =>
    (
      entorno.bd
        .prepare('SELECT COUNT(*) AS n FROM registro_actividad WHERE actividad_id = ?')
        .get(actividad(nombre).id) as { n: number }
    ).n;

  it('el responsable ve los asistentes de su actividad sin tener registro.leer', async () => {
    const participante = await entorno.como('participante');
    const res = await participante.get(url(MOVILIDAD));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(total(MOVILIDAD));
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.asistentes[0].persona).not.toHaveProperty('numero_documento');
  });

  it('el responsable no ve los de una actividad ajena', async () => {
    const participante = await entorno.como('participante');
    expect((await participante.get(url(GEMELOS))).status).toBe(403);
  });

  it('un visitante recibe 403 y quien tiene registro.leer los ve todos', async () => {
    expect((await (await entorno.como('visitante')).get(url(MOVILIDAD))).status).toBe(403);
    const organizador = await entorno.como('organizador');
    const res = await organizador.get(url(GEMELOS));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(total(GEMELOS));
  });

  it('una actividad inexistente responde 404', async () => {
    const organizador = await entorno.como('organizador');
    expect((await organizador.get('/api/v1/actividades/99999/asistentes')).status).toBe(404);
  });
});

describe('recepción y llegadas', () => {
  const documentoVisitante = cuenta('visitante').numeroDocumento;

  async function registrarLlegada(numero_documento = documentoVisitante) {
    const recepcion = await entorno.como('recepcion');
    return recepcion.post('/api/v1/registros/llegada', { numero_documento });
  }

  it('la búsqueda devuelve solo nombre, rol y estado de llegada', async () => {
    const recepcion = await entorno.como('recepcion');
    const res = await recepcion.get(`/api/v1/recepcion/buscar?documento=${documentoVisitante}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      persona: {
        id: expect.any(Number),
        nombres: cuenta('visitante').nombres,
        apellidos: cuenta('visitante').apellidos,
        rol: 'visitante',
        activo: true,
      },
      llegada_hoy: null,
    });
  });

  it('la búsqueda exige llegada.registrar, no persona.leer', async () => {
    const organizador = await entorno.como('organizador');
    const res = await organizador.get(`/api/v1/recepcion/buscar?documento=${documentoVisitante}`);
    expect(res.status).toBe(403);
  });

  it('un documento desconocido responde 404 y sin documento responde 400', async () => {
    const recepcion = await entorno.como('recepcion');
    expect((await recepcion.get('/api/v1/recepcion/buscar?documento=000')).status).toBe(404);
    expect((await recepcion.get('/api/v1/recepcion/buscar')).status).toBe(400);
    expect((await registrarLlegada('000')).status).toBe(404);
  });

  it('registra la llegada con quién la registró', async () => {
    const res = await registrarLlegada();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      persona: { rol: 'visitante' },
      llegada: { fecha_hora: aUtcSql(AHORA) },
    });
    const { registrado_por } = entorno.bd
      .prepare('SELECT registrado_por FROM registro_llegada WHERE id = ?')
      .get(res.body.llegada.id) as { registrado_por: number };
    expect(registrado_por).toBe(
      entorno.idDe('persona', 'numero_documento', cuenta('recepcion').numeroDocumento),
    );

    const recepcion = await entorno.como('recepcion');
    const busqueda = await recepcion.get(
      `/api/v1/recepcion/buscar?documento=${documentoVisitante}`,
    );
    expect(busqueda.body.llegada_hoy).toEqual({ fecha_hora: aUtcSql(AHORA) });
  });

  it('I4: una segunda llegada el mismo día responde 409 con la hora de la primera', async () => {
    entorno.fijarHora(instanteBogota('2026-10-16', '08:00'));
    expect((await registrarLlegada()).status).toBe(201);

    // 19:30 de Bogotá ya es el día siguiente en UTC, pero es el mismo día local.
    entorno.fijarHora(instanteBogota('2026-10-16', '19:30'));
    const res = await registrarLlegada();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      codigo: 'LLEGADA_YA_REGISTRADA',
      detalle: { fecha_hora: aUtcSql(instanteBogota('2026-10-16', '08:00')) },
    });

    entorno.fijarHora(instanteBogota('2026-10-17', '07:00'));
    expect((await registrarLlegada()).status).toBe(201);
  });

  it('GET /registros/llegada lista las del día con registro.leer', async () => {
    await registrarLlegada();
    const organizador = await entorno.como('organizador');
    const res = await organizador.get('/api/v1/registros/llegada');
    expect(res.status).toBe(200);
    const enBase = entorno.bd.prepare('SELECT COUNT(*) AS n FROM registro_llegada').get() as {
      n: number;
    };
    expect(res.body).toMatchObject({ dia: DIA, total: enBase.n });
    expect(res.body.llegadas[0]).toMatchObject({
      persona: { nombres: cuenta('visitante').nombres },
      registrado_por: { nombres: cuenta('recepcion').nombres },
    });

    const otroDia = await organizador.get('/api/v1/registros/llegada?dia=2026-10-20');
    expect(otroDia.body.total).toBe(0);
  });

  it('GET /recepcion/resumen da a recepción el total del día sin nombres', async () => {
    const recepcion = await entorno.como('recepcion');
    const antes = await recepcion.get('/api/v1/recepcion/resumen');
    expect(antes.status).toBe(200);
    expect(Object.keys(antes.body).sort()).toEqual(['dia', 'llegadas']);
    await registrarLlegada();
    const despues = await recepcion.get('/api/v1/recepcion/resumen');
    expect(despues.body).toEqual({ dia: DIA, llegadas: antes.body.llegadas + 1 });
    const visitante = await entorno.como('visitante');
    expect((await visitante.get('/api/v1/recepcion/resumen')).status).toBe(403);
  });

  it('recepción no puede consultar el listado de llegadas', async () => {
    const recepcion = await entorno.como('recepcion');
    expect((await recepcion.get('/api/v1/registros/llegada')).status).toBe(403);
  });
});
