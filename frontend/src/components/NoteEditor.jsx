// A small document editor for notes: bold, italic, headings, bullets, indents,
// text colors, and highlights, formatted while you type.
//
// It is a browser "contentEditable" box driven by the browser's own editing
// commands (document.execCommand), so no editor library is needed. React does
// not draw what is inside the box: the notes are put in once, and read back
// (cleaned by services/noteHtml.js) after every change.
//
// props:
//   id, labelId, hintId    ids for the box, its visible label, and its hint
//   initialNotes           the notes as stored
//   initialFormat          'html', or 'text' for notes written before formatting
//   onReady(notes)         called once with the notes in their cleaned form
//   onChange(notes)        called with the cleaned notes after every change
import { useEffect, useState } from 'react';
import { HIGHLIGHTS, TEXT_COLORS, fillEditor, readEditor, tidyEditor } from '../services/noteHtml';
import Icon from './Icon';

// Where the cursor or selection was when the box last lost focus, so a toolbar
// button pressed from the keyboard still knows which text to change.
let savedRange = null;

// The name of the shortcut key shown in button tooltips.
let MOD = 'Ctrl';
if (/Mac|iPhone|iPad/.test(navigator.platform)) {
  MOD = 'Cmd';
}

const HEADINGS = ['h1', 'h2', 'h3'];

// Commands that change how letters look, not the shape of the lines.
const INLINE_COMMANDS = ['bold', 'italic', 'foreColor', 'hiliteColor'];

const EMPTY_STATE = { bold: false, italic: false, list: false, block: '' };

function NoteEditor(props) {
  const [state, setState] = useState(EMPTY_STATE);
  // Which color menu is open: '', 'color', or 'highlight'.
  const [openMenu, setOpenMenu] = useState('');

  const getEditor = () => document.getElementById(props.id);

  // Shows the placeholder only while the box holds nothing at all.
  const markEmpty = (editor) => {
    const isEmpty = editor.textContent.trim() === '' && !editor.querySelector('li');
    editor.setAttribute('data-empty', String(isEmpty));
  };

  // Reads the formatting under the cursor into the toolbar's pressed buttons, and
  // remembers the selection for toolbar buttons pressed from the keyboard.
  const updateToolbar = () => {
    const editor = getEditor();
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }
    if (!editor.contains(selection.anchorNode)) {
      return;
    }
    savedRange = selection.getRangeAt(0).cloneRange();
    setState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      list: document.queryCommandState('insertUnorderedList'),
      block: String(document.queryCommandValue('formatBlock') || '').toLowerCase(),
    });
  };

  const reportChange = () => {
    const editor = getEditor();
    if (!editor) {
      return;
    }
    markEmpty(editor);
    // Ctrl+B and similar change the text without moving the cursor, so the
    // toolbar is refreshed after every change, not only when the cursor moves.
    updateToolbar();
    props.onChange(readEditor(editor));
  };

  // Put the stored notes in once, when the editor first appears.
  useEffect(() => {
    const editor = getEditor();
    // New lines become <p> paragraphs (not <div>), and colors use tags, not styles.
    document.execCommand('defaultParagraphSeparator', false, 'p');
    fillEditor(editor, props.initialNotes, props.initialFormat);
    markEmpty(editor);
    props.onReady(readEditor(editor));
  }, []);

  // Keep the toolbar's pressed buttons in step with the text under the cursor.
  useEffect(() => {
    document.addEventListener('selectionchange', updateToolbar);
    return () => {
      document.removeEventListener('selectionchange', updateToolbar);
      savedRange = null;
    };
  }, []);

  // An open color menu closes with Esc (focus goes back to its button) or a click elsewhere.
  useEffect(() => {
    if (openMenu === '') {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        const opener = document.getElementById(`${props.id}-${openMenu}-button`);
        setOpenMenu('');
        if (opener) {
          opener.focus();
        }
      }
    };
    const handlePointerDown = (event) => {
      const menuArea = document.getElementById(`${props.id}-${openMenu}-area`);
      if (menuArea && !menuArea.contains(event.target)) {
        setOpenMenu('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [openMenu]);

  // Runs one editing command on the text in the box.
  const runCommand = (command, value) => {
    const editor = getEditor();
    const selection = window.getSelection();
    editor.focus();
    // Coming from a toolbar button reached with the keyboard: put the selection back.
    if (savedRange && selection && !editor.contains(selection.anchorNode)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    // Highlights only work as a style; everything else is written as plain tags.
    document.execCommand('styleWithCSS', false, command === 'hiliteColor');
    document.execCommand(command, false, value);
    document.execCommand('styleWithCSS', false, false);

    // Tidy up what the browser made. Not for bold, italic, or colors with just a
    // cursor (no selection): those set the style for the next typed letters,
    // which rebuilding the text would forget.
    const isInline = INLINE_COMMANDS.indexOf(command) !== -1;
    const currentSelection = window.getSelection();
    const isCollapsed = !currentSelection || currentSelection.isCollapsed;
    if (!(isInline && isCollapsed)) {
      tidyEditor(editor);
    }
    reportChange();
  };

  // Pressing the heading the text already has turns it back into a paragraph.
  const toggleHeading = (tag) => {
    if (state.block === tag) {
      runCommand('formatBlock', '<p>');
    } else {
      runCommand('formatBlock', `<${tag}>`);
    }
  };

  const toggleMenu = (kind) => {
    if (openMenu === kind) {
      setOpenMenu('');
    } else {
      setOpenMenu(kind);
    }
  };

  const chooseColor = (kind, marker) => {
    setOpenMenu('');
    if (kind === 'color') {
      runCommand('foreColor', marker);
    } else {
      runCommand('hiliteColor', marker);
    }
  };

  const handleKeyDown = (event) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (!isMod) {
      return;
    }
    if (event.altKey && (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3')) {
      event.preventDefault();
      toggleHeading(`h${event.code.charAt(5)}`);
    } else if (event.shiftKey && event.code === 'Digit8') {
      event.preventDefault();
      runCommand('insertUnorderedList');
    } else if (event.code === 'BracketRight') {
      event.preventDefault();
      runCommand('indent');
    } else if (event.code === 'BracketLeft') {
      event.preventDefault();
      runCommand('outdent');
    } else if (event.code === 'KeyU') {
      // Underline is not one of the kept formats, so the shortcut does nothing
      // rather than add something that would vanish after saving.
      event.preventDefault();
    }
  };

  // Pasted text always arrives as plain text, so formatting, links, and images
  // copied from other sites never come in. It can then be formatted here.
  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    reportChange();
  };

  // Dropped content could carry pictures or links from other pages, so dropping
  // is turned off. Copy and paste still works.
  const handleDrop = (event) => {
    event.preventDefault();
  };

  // A toolbar button. Pressing it with the mouse must not take the selection
  // away from the text, hence preventDefault on mousedown.
  const toolButton = (key, label, visible, isPressed, onPress, shortcut) => {
    let pressed;
    if (isPressed !== null) {
      pressed = isPressed;
    }
    return (
      <button
        key={key}
        type="button"
        className="button note-toolbar-button"
        aria-label={label}
        aria-pressed={pressed}
        title={`${label} (${shortcut})`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onPress}
      >
        {visible}
      </button>
    );
  };

  const colorMenu = (kind, label, items) => {
    const isOpen = openMenu === kind;
    const menuId = `${props.id}-${kind}-menu`;
    return (
      <div className="note-toolbar-menu-area" id={`${props.id}-${kind}-area`}>
        <button
          type="button"
          id={`${props.id}-${kind}-button`}
          className="button note-toolbar-button"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => toggleMenu(kind)}
        >
          {label}
          <Icon name="chevron-down" />
        </button>
        {isOpen && (
          <ul className="note-toolbar-menu" id={menuId} aria-label={label}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="note-toolbar-swatch-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseColor(kind, item.marker)}
                >
                  <span
                    className={`note-swatch note-swatch-${kind}-${item.id}`}
                    aria-hidden="true"
                  ></span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="note-editor-wrap">
      <div className="note-toolbar" role="group" aria-label="Formatting">
        {toolButton('bold', 'Bold', <strong>B</strong>, state.bold, () => runCommand('bold'), `${MOD}+B`)}
        {toolButton('italic', 'Italic', <em>I</em>, state.italic, () => runCommand('italic'), `${MOD}+I`)}
        {HEADINGS.map((tag, index) =>
          toolButton(
            tag,
            `${tag.toUpperCase()} heading`,
            tag.toUpperCase(),
            state.block === tag,
            () => toggleHeading(tag),
            `${MOD}+Alt+${index + 1}`
          )
        )}
        {toolButton(
          'list',
          'Bulleted list',
          <Icon name="list" />,
          state.list,
          () => runCommand('insertUnorderedList'),
          `${MOD}+Shift+8`
        )}
        {toolButton('indent', 'Indent', <Icon name="indent" />, null, () => runCommand('indent'), `${MOD}+]`)}
        {toolButton('outdent', 'Outdent', <Icon name="outdent" />, null, () => runCommand('outdent'), `${MOD}+[`)}
        {colorMenu('color', 'Text color', TEXT_COLORS)}
        {colorMenu('highlight', 'Highlight', HIGHLIGHTS)}
      </div>

      <div
        id={props.id}
        className="note-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={props.labelId}
        aria-describedby={props.hintId}
        aria-placeholder="Start typing your notes…"
        tabIndex="0"
        spellCheck="true"
        onInput={reportChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
      ></div>
    </div>
  );
}

export default NoteEditor;
