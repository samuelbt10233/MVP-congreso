import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { registrarAlPerderSesion, token } from '../api/cliente';
import { api } from '../api/recursos';
import type { Perfil } from '../api/tipos';

type EstadoSesion =
  { estado: 'cargando' } | { estado: 'anonima' } | ({ estado: 'activa' } & Perfil);

type ValorSesion = {
  sesion: EstadoSesion;
  iniciarSesion: (numeroDocumento: string, codigo: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const ContextoSesion = createContext<ValorSesion | undefined>(undefined);

/**
 * Origen de la verdad de la interfaz (§9.2): la persona y su arreglo de permisos,
 * tal como los devuelve la API. Se refresca al volver a iniciar sesión.
 */
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>(() =>
    token.leer() ? { estado: 'cargando' } : { estado: 'anonima' },
  );

  useEffect(() => {
    registrarAlPerderSesion(() => setSesion({ estado: 'anonima' }));
    if (!token.leer()) return;
    api.auth
      .yo()
      .then((perfil) => setSesion({ estado: 'activa', ...perfil }))
      .catch(() => {
        token.borrar();
        setSesion({ estado: 'anonima' });
      });
  }, []);

  const iniciarSesion = useCallback(async (numeroDocumento: string, codigo: string) => {
    const { token: nuevo, ...perfil } = await api.auth.iniciarSesion(numeroDocumento, codigo);
    token.guardar(nuevo);
    setSesion({ estado: 'activa', ...perfil });
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.auth.salir();
    } finally {
      token.borrar();
      setSesion({ estado: 'anonima' });
    }
  }, []);

  return (
    <ContextoSesion.Provider value={{ sesion, iniciarSesion, cerrarSesion }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion() fuera de <ProveedorSesion>');
  return valor;
}

/** Perfil de la sesión activa; solo se usa dentro de las rutas protegidas. */
export function usePerfil(): Perfil {
  const { sesion } = useSesion();
  if (sesion.estado !== 'activa') throw new Error('usePerfil() sin sesión activa');
  return sesion;
}
