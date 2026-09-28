import { useEffect, useState } from 'react';

type EstadoApi = 'consultando' | 'ok' | 'sin conexión';

export function App() {
  const [estadoApi, setEstadoApi] = useState<EstadoApi>('consultando');

  useEffect(() => {
    fetch('/api/v1/salud')
      .then((res) => setEstadoApi(res.ok ? 'ok' : 'sin conexión'))
      .catch(() => setEstadoApi('sin conexión'));
  }, []);

  return (
    <main>
      <h1>Quinto Congreso de Ingeniería</h1>
      <p>Estado de la API: {estadoApi}</p>
    </main>
  );
}
