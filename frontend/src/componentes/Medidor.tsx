/**
 * Ocupación de una zona: barra de un solo tono sobre una pista más clara de la
 * misma escala. El porcentaje va además en texto, así que el dato nunca depende
 * solo del color; el aforo completo lleva etiqueta.
 */
export function Medidor({ valor, etiqueta }: { valor: number | null; etiqueta: string }) {
  if (valor === null) return <span className="texto-tenue">Sin capacidad registrada</span>;
  const porcentaje = Math.round(valor * 100);
  const lleno = valor >= 1;
  return (
    <span className="medidor-celda" title={`${etiqueta}: ${porcentaje} % de la capacidad`}>
      <span
        className={lleno ? 'medidor medidor--lleno' : 'medidor'}
        role="meter"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
      >
        <span style={{ width: `${Math.min(porcentaje, 100)}%` }} />
      </span>
      <span className="numeros">{porcentaje} %</span>
      {lleno && <span className="etiqueta etiqueta--alerta">⚠ Aforo completo</span>}
    </span>
  );
}
