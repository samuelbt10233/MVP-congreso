import { rutaBase } from './conexion.js';
import { resetearArchivo } from './reset.js';

const ruta = rutaBase();
const resumen = await resetearArchivo(ruta);

console.log(`Base recreada en ${ruta}\n`);
console.log(
  `${resumen.totales.personas} personas · ${resumen.totales.actividades} actividades · ` +
    `${resumen.totales.llegadas} llegadas · ${resumen.totales.asistencias} asistencias\n`,
);
console.log('Cuentas de demo (documento / código):');
console.table(
  resumen.cuentas.map((c) => ({
    cuenta: c.clave,
    nombre: c.nombre,
    documento: c.numeroDocumento,
    codigo: c.codigo,
  })),
);
console.log('Actividades en curso (código para registrar asistencia):');
console.table(resumen.actividadesEnCurso);
console.log('Si la API estaba corriendo, reiníciala para que use la base nueva.');
