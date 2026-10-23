// A fold-out key that shows which color belongs to which subject.
// Each entry is also a link that filters the feed to that subject.
// props: activeSubject   the subject the feed is filtered to ('' for none)
import { Link } from 'react-router-dom';
import { SUBJECTS, subjectSlug } from '../services/subjects';

function SubjectLegend(props) {
  // <details> opens and closes with the keyboard and screen readers on its own.
  // aria-current marks the subject the feed is showing (bold text marks it on screen).
  return (
    <details className="subject-legend">
      <summary className="subject-legend__summary">Subject colors</summary>
      <ul className="subject-legend__list" aria-label="Subject colors">
        {SUBJECTS.map((subject) => {
          const isActive = subject === props.activeSubject;
          let ariaCurrent;
          if (isActive) {
            ariaCurrent = 'true';
          }
          return (
            <li key={subject}>
              <Link
                className={`subject-legend__link subject--${subjectSlug(subject)}`}
                to={`/?subject=${encodeURIComponent(subject)}`}
                aria-current={ariaCurrent}
              >
                <span className="subject-legend__swatch" aria-hidden="true"></span>
                {subject}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default SubjectLegend;
