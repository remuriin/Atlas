// The one <h1> of a page. It also does the jobs every page change needs:
//   1. sets the browser tab title
//   2. starts the new page at the top
//   3. moves keyboard and screen reader focus to the heading, so people
//      start at the top of the new page instead of where the old link was
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function PageHeading(props) {
  const location = useLocation();

  useEffect(() => {
    document.title = `${props.title} · Atlas`;
  }, [props.title]);

  useEffect(() => {
    // React Router gives the page you first landed on the key "default".
    // Focus is left alone there, so the skip link stays the first Tab stop.
    if (location.key === 'default') {
      return;
    }
    window.scrollTo(0, 0);
    const heading = document.getElementById('page-heading');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
    // Runs when the heading first appears and when the page (the path) changes.
    // It deliberately ignores changes to the "?sort=new" part of the address:
    // choosing a tab or a filter is not a new page, and focus should stay put.
  }, [location.pathname]);

  return (
    <h1 id="page-heading" className="page-title" tabIndex="-1">
      {props.title}
    </h1>
  );
}

export default PageHeading;
