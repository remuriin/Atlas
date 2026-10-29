// A fold-out key that shows which color belongs to which strand.
// Each entry is also a link that filters the feed to that strand.
// props: activeStrand   the strand the feed is filtered to ('' for none)
import { Link } from 'react-router-dom';
import { STRANDS, strandSlug } from '../services/categories';

function StrandLegend(props) {
  // <details> opens and closes with the keyboard and screen readers on its own.
  // aria-current marks the strand the feed is showing (bold text marks it on screen).
  return (
    <details className="strand-legend">
      <summary className="strand-legend__summary">Strand colors</summary>
      <ul className="strand-legend__list" aria-label="Strand colors">
        {STRANDS.map((strand) => {
          const isActive = strand === props.activeStrand;
          let ariaCurrent;
          if (isActive) {
            ariaCurrent = 'true';
          }
          return (
            <li key={strand}>
              <Link
                className={`strand-legend__link strand--${strandSlug(strand)}`}
                to={`/?strand=${encodeURIComponent(strand)}`}
                aria-current={ariaCurrent}
              >
                <span className="strand-legend__swatch" aria-hidden="true"></span>
                {strand}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default StrandLegend;
