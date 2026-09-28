import bcrypt from 'bcryptjs';

/** Costo de bcrypt para los códigos de acceso (I10). */
const COSTO = 10;

export function hashCodigo(codigo: string): Promise<string> {
  return bcrypt.hash(codigo, COSTO);
}

export function verificarCodigo(codigo: string, hash: string): Promise<boolean> {
  return bcrypt.compare(codigo, hash);
}
