import { describe, expect, it } from 'vitest';
import {
  PAQUETE_RECEPCION,
  PERMISOS,
  PLANTILLAS_ROL,
} from '../../../backend/src/modulos/permisos/catalogo';
import { CODIGOS_PERMISO } from '../api/tipos';
import { PANTALLAS, pantallasVisibles, puedeVer } from './pantallas';

const titulos = (permisos: readonly string[]) => pantallasVisibles(permisos).map((p) => p.titulo);

const BASE = ['Inicio', 'Cronograma', 'Registrar asistencia', 'Mis asistencias', 'Mi perfil'];

describe('mapa de pantallas', () => {
  it('los códigos de permiso del frontend son los del catálogo del backend', () => {
    expect([...CODIGOS_PERMISO]).toEqual(PERMISOS.map((p) => p.codigo));
  });

  it('toda pantalla con permisos usa códigos que existen', () => {
    for (const pantalla of Object.values(PANTALLAS)) {
      for (const p of 'permisos' in pantalla ? pantalla.permisos : []) {
        expect(CODIGOS_PERMISO).toContain(p);
      }
    }
  });

  it('el menú depende solo de los permisos: cada paquete produce su propio menú', () => {
    const menus = {
      administrador: titulos(PLANTILLAS_ROL.administrador),
      organizador: titulos(PLANTILLAS_ROL.organizador),
      recepcion: titulos([...PLANTILLAS_ROL.visitante, ...PAQUETE_RECEPCION]),
      visitante: titulos(PLANTILLAS_ROL.visitante),
    };

    expect(menus.visitante).toEqual(BASE);
    expect(menus.recepcion).toEqual([...BASE, 'Recepción']);
    expect(menus.organizador).toEqual([...BASE, 'Personas', 'Gestión de actividades', 'Panel']);
    expect(menus.administrador).toEqual([
      ...BASE,
      'Recepción',
      'Personas',
      'Gestión de actividades',
      'Panel',
    ]);
    expect(new Set(Object.values(menus).map((m) => m.join('|'))).size).toBe(4);
  });

  it('participante y visitante comparten menú porque tienen los mismos permisos (regla 8)', () => {
    expect(titulos(PLANTILLAS_ROL.participante)).toEqual(titulos(PLANTILLAS_ROL.visitante));
  });

  it('el panel se ve con estadistica.leer o con registro.leer', () => {
    expect(puedeVer(PANTALLAS.panel, ['estadistica.leer'])).toBe(true);
    expect(puedeVer(PANTALLAS.panel, ['registro.leer'])).toBe(true);
    expect(puedeVer(PANTALLAS.panel, ['persona.leer'])).toBe(false);
  });
});
