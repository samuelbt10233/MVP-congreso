import type { PersonaSesion } from '../api/tipos';

/**
 * Vista de escarapela construida con los datos de la persona (§1). No muestra el
 * código de acceso ni el documento: la escarapela es visible y fotografiable (D8).
 */
export function Escarapela({ persona }: { persona: PersonaSesion }) {
  return (
    <figure className={`escarapela escarapela--${persona.rol}`} aria-label="Escarapela">
      <header>
        <strong>V Congreso de Ingeniería</strong>
        <small>Desarrollo Humano y Sostenibilidad Global</small>
        <small>ETITC · Bogotá · 15 y 16 de octubre de 2026</small>
      </header>
      <div className="escarapela__nombre">
        <span>{persona.nombres}</span>
        <span>{persona.apellidos}</span>
      </div>
      {persona.organizacion && <p className="escarapela__organizacion">{persona.organizacion}</p>}
      {persona.nacionalidad && persona.nacionalidad !== 'Colombia' && (
        <p className="escarapela__pais">{persona.nacionalidad}</p>
      )}
      <footer className="escarapela__rol">{persona.rol}</footer>
    </figure>
  );
}
