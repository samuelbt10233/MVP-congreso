import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from './cliente';

type Carga<T> = {
  datos: T | undefined;
  error: ErrorApi | undefined;
  cargando: boolean;
  recargar: () => void;
};

/** Carga datos de la API al montar y cada vez que cambian las dependencias. */
export function useCarga<T>(cargar: () => Promise<T>, dependencias: unknown[]): Carga<T> {
  const [datos, setDatos] = useState<T>();
  const [error, setError] = useState<ErrorApi>();
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(undefined);
    cargar()
      .then((resultado) => vigente && setDatos(resultado))
      .catch((e: unknown) => {
        if (!vigente) return;
        setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR_DESCONOCIDO', String(e)));
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [...dependencias, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, error, cargando, recargar };
}
