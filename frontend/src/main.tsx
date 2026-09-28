import '@picocss/pico/css/pico.min.css';
import './estilos.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Rutas } from './rutas/Rutas';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el elemento raíz');

createRoot(raiz).render(
  <StrictMode>
    <Rutas />
  </StrictMode>,
);
