import type { Contexto } from '../../contexto.js';
import { ErrorApi } from '../../middleware/errores.js';
import { normalizarCodigo } from '../../utils/codigo.js';
import { aUtcSql } from '../../utils/fechas.js';
import { verificarCodigo } from '../../utils/hash.js';
import type { DatosLogin } from './esquemas.js';
import {
  buscarCredencial,
  buscarPersonaConAcceso,
  permisosDe,
  registrarAcceso,
  type PersonaSesion,
} from './repositorio.js';

export type Perfil = { persona: PersonaSesion; permisos: string[] };

/**
 * Único error de login para todo fallo: documento inexistente, sin usuario,
 * inactivo o código incorrecto (regla 4). No confirma qué documentos existen.
 */
function credencialesInvalidas(): ErrorApi {
  return new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'Documento o código de acceso incorrectos.');
}

export async function iniciarSesion(
  ctx: Contexto,
  datos: DatosLogin,
): Promise<Perfil & { token: string }> {
  const credencial = buscarCredencial(ctx.bd, datos.numero_documento);
  if (!credencial) throw credencialesInvalidas();

  const codigoValido = await verificarCodigo(
    normalizarCodigo(datos.codigo),
    credencial.codigo_hash,
  );
  if (!codigoValido || !credencial.persona_activa || !credencial.usuario_activo) {
    throw credencialesInvalidas();
  }

  registrarAcceso(ctx.bd, credencial.persona_id, aUtcSql(new Date()));
  const perfil = perfilDe(ctx, credencial.persona_id);
  if (!perfil) throw credencialesInvalidas();
  return { token: ctx.sesiones.crear(credencial.persona_id), ...perfil };
}

export function perfilDe(ctx: Contexto, personaId: number): Perfil | undefined {
  const persona = buscarPersonaConAcceso(ctx.bd, personaId);
  return persona && { persona, permisos: permisosDe(ctx.bd, personaId) };
}
