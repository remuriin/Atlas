// A round profile picture. Google accounts bring their own photo; everyone else
// (and anyone whose photo fails to load) gets a circle with their initials.
// It is decoration: the person's name is always written next to it.
//
// props:
//   photoUrl   the picture's address, or null
//   name       the display name (for the initials)
//   size       'small' (header) or 'large' (profile page)
import { useState } from 'react';

// "Ana Maria Cruz" -> "AC", "renato" -> "R", "" -> "?"
const toInitials = (name) => {
  const words = (name || '').trim().split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) {
    return '?';
  }
  let initials = words[0].charAt(0);
  if (words.length > 1) {
    initials += words[words.length - 1].charAt(0);
  }
  return initials.toUpperCase();
};

function Avatar(props) {
  // Remembers which address failed, so a new photo gets its own chance to load.
  const [failedUrl, setFailedUrl] = useState('');

  let className = 'avatar avatar--small';
  if (props.size === 'large') {
    className = 'avatar avatar--large';
  }

  if (props.photoUrl && props.photoUrl !== failedUrl) {
    // no-referrer: Google often refuses to send profile photos to other websites otherwise.
    return (
      <img
        className={className}
        src={props.photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(props.photoUrl)}
      />
    );
  }

  return (
    <span className={`${className} avatar--initials`} aria-hidden="true">
      {toInitials(props.name)}
    </span>
  );
}

export default Avatar;
