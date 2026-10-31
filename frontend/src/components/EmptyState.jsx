// A friendly box shown when a list has nothing in it yet.
// props: icon, title, message. Any links or buttons go between the tags.
import Icon from './Icon';

function EmptyState(props) {
  return (
    <div className="empty">
      <Icon name={props.icon || 'file'} large />
      <p className="empty-title">{props.title}</p>
      <p>{props.message}</p>
      {props.children}
    </div>
  );
}

export default EmptyState;
