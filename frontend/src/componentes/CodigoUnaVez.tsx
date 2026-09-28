/**
 * Código de acceso recién generado (§9.6). Se muestra una sola vez: vive en el
 * estado de quien lo pinta, que lo descarta al pasar a otra persona. En la base
 * solo queda su hash, así que no se puede volver a consultar.
 */
export function CodigoUnaVez({
  codigo,
  para,
  alCerrar,
}: {
  codigo: string;
  para: string;
  alCerrar: () => void;
}) {
  return (
    <aside className="codigo-una-vez" role="status" aria-live="polite">
      <p>
        Código de acceso de <strong>{para}</strong>
      </p>
      <output className="codigo-una-vez__valor">{codigo}</output>
      <p>
        <small>
          Entrégalo a la persona ahora. No se volverá a mostrar y no se imprime en la escarapela.
        </small>
      </p>
      <button type="button" className="secondary" onClick={alCerrar}>
        Ya lo entregué
      </button>
    </aside>
  );
}
