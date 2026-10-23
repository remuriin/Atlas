// Draws one small inline SVG icon by name.
// Icons here are always decoration next to visible text, so they are hidden
// from screen readers. The text beside them carries the meaning.

// Each icon is a list of SVG path shapes on a 24 x 24 grid.
const ICON_PATHS = {
  home: ['M3 11l9-8 9 8', 'M5 9.5V20h14V9.5', 'M10 20v-6h4v6'],
  book: ['M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h11'],
  'arrow-up': ['M12 4l8 9h-5v7H9v-7H4z'],
  'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  bookmark: ['M6 3h12v18l-6-4.5L6 21z'],
  cards: ['M4 8h12v12H4z', 'M8 4h12v12'],
  flip: ['M4 12a8 8 0 0 1 14-5.3', 'M19 3v4h-4', 'M20 12a8 8 0 0 1-14 5.3', 'M5 21v-4h4'],
  shuffle: ['M3 7h4l10 10h4', 'M3 17h4L17 7h4', 'M18 4l3 3-3 3', 'M18 14l3 3-3 3'],
  search: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M21 21l-4.3-4.3'],
  sun: [
    'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  download: ['M12 4v12', 'M7 11l5 5 5-5', 'M4 20h16'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  file: ['M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z', 'M14 3v5h5'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  alert: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18h.01'],
  info: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 11v6', 'M12 7.5h.01'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
  'eye-off': [
    'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z',
    'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    'M4 4l16 16',
  ],
  pencil: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  user: ['M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M4 21a8 8 0 0 1 16 0'],
  clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7v5l3 2'],
};

function Icon(props) {
  const paths = ICON_PATHS[props.name] || [];

  let className = 'icon';
  if (props.filled) {
    className = `${className} icon--filled`;
  }
  if (props.large) {
    className = `${className} icon--large`;
  }

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export default Icon;
