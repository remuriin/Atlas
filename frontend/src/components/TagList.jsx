// A row of tags. Choosing a tag searches the feed for it.
// props: tags (a list of words)
import { Link } from 'react-router-dom';

function TagList(props) {
  if (props.tags.length === 0) {
    return null;
  }

  return (
    <ul className="tag-list" aria-label="Tags">
      {props.tags.map((tag) => (
        <li key={tag}>
          <Link className="chip-link" to={`/browse?q=${encodeURIComponent(tag)}`}>
            <span className="tag">
              <span className="visually-hidden">Tag: </span>
              {tag}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default TagList;
