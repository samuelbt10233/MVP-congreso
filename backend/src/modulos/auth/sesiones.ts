import { randomBytes } from 'node:crypto';

/**
 * Sesiones en memoria del servidor (D10). Reiniciar el servidor las cierra todas;
 * la versión persistente e invalidable al regenerar códigos está en la deuda (S4).
 */

const VIGENCIA_POR_DEFECTO_MS = 12 * 60 * 60 * 1000;

type Sesion = { personaId: number; expira: number };

export class AlmacenSesiones {
  private readonly sesiones = new Map<string, Sesion>();

  constructor(
    private readonly vigenciaMs = VIGENCIA_POR_DEFECTO_MS,
    private readonly reloj: () => number = Date.now,
  ) {}

  crear(personaId: number): string {
    const token = randomBytes(32).toString('base64url');
    this.sesiones.set(token, { personaId, expira: this.reloj() + this.vigenciaMs });
    return token;
  }

  /** Persona dueña del token, o `undefined` si no existe o venció. */
  personaDe(token: string): number | undefined {
    const sesion = this.sesiones.get(token);
    if (!sesion) return undefined;
    if (sesion.expira <= this.reloj()) {
      this.sesiones.delete(token);
      return undefined;
    }
    return sesion.personaId;
  }

  eliminar(token: string): void {
    this.sesiones.delete(token);
  }
}
