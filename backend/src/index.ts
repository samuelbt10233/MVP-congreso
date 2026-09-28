import { existsSync } from 'node:fs';
import { crearApp } from './app.js';
import { rutaBase } from './db/conexion.js';

if (!existsSync(rutaBase())) {
  console.error(`No existe la base en ${rutaBase()}. Ejecuta primero: npm run reset`);
  process.exit(1);
}

const puerto = Number(process.env.PUERTO ?? 3000);

crearApp().listen(puerto, () => {
  console.log(`API escuchando en http://localhost:${puerto}/api/v1`);
});
