import { crearApp } from './app.js';

const puerto = Number(process.env.PUERTO ?? 3000);

crearApp().listen(puerto, () => {
  console.log(`API escuchando en http://localhost:${puerto}/api/v1`);
});
