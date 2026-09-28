import type { ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ProveedorSesion } from '../auth/sesion';
import { Acceso } from '../paginas/Acceso';
import { Cronograma } from '../paginas/Cronograma';
import { GestionActividades } from '../paginas/GestionActividades';
import { Inicio } from '../paginas/Inicio';
import { MiPerfil } from '../paginas/MiPerfil';
import { MisAsistencias } from '../paginas/MisAsistencias';
import { NoEncontrada } from '../paginas/NoEncontrada';
import { Panel } from '../paginas/Panel';
import { Personas } from '../paginas/Personas';
import { Recepcion } from '../paginas/Recepcion';
import { RegistrarAsistencia } from '../paginas/RegistrarAsistencia';
import { RequierePantalla, RequiereSesion } from './guardas';
import { PANTALLAS, type ClavePantalla } from './pantallas';

/** Componente de cada pantalla. */
const COMPONENTES: Record<ClavePantalla, ComponentType> = {
  inicio: Inicio,
  cronograma: Cronograma,
  perfil: MiPerfil,
  asistencia: RegistrarAsistencia,
  misAsistencias: MisAsistencias,
  personas: Personas,
  actividades: GestionActividades,
  recepcion: Recepcion,
  panel: Panel,
};

export function Rutas() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Routes>
          <Route path="/acceso" element={<Acceso />} />
          <Route element={<RequiereSesion />}>
            {(Object.keys(PANTALLAS) as ClavePantalla[]).map((clave) => {
              const Componente = COMPONENTES[clave];
              return (
                <Route
                  key={clave}
                  path={PANTALLAS[clave].ruta}
                  element={
                    <RequierePantalla pantalla={PANTALLAS[clave]}>
                      <Componente />
                    </RequierePantalla>
                  }
                />
              );
            })}
            <Route path="*" element={<NoEncontrada />} />
          </Route>
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  );
}
