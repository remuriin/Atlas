// Your own notes for one saved study reviewer, with simple formatting. They are
// saved to your account automatically a moment after you stop typing, so they
// are there on any device.
//
// props:
//   savedId          id of the saved item the notes belong to
//   title            the study reviewer's title (used for the download name)
//   initialNotes     the notes as last saved
//   initialFormat    'html', or 'text' for notes written before formatting existed
//   initialSavedAt   when they were last saved (null if never)
import { useEffect, useState } from 'react';
import { saveNotes } from '../services/savedService';
import { toPlainText, visibleText } from '../services/noteHtml';
import Icon from './Icon';
import NoteEditor from './NoteEditor';

const NOTES_MAX = 20000;
// The formatting takes up room too; the server allows this much in total.
const NOTES_HTML_MAX = 100000;
const AUTOSAVE_DELAY_MS = 1500;

// The name of the shortcut key in the hint: Cmd on Apple devices, Ctrl elsewhere.
let MOD = 'Ctrl';
if (/Mac|iPhone|iPad/.test(navigator.platform)) {
  MOD = 'Cmd';
}

// Notes typed in the last moment before leaving the page. Kept outside React so
// the clean-up below can still send them after the page has gone.
let unsavedNotes = null;

const formatTime = (isoDate) => {
  return new Date(isoDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// "Cell Biology: Notes?" -> "Cell Biology Notes" (characters some systems refuse in file names)
const toFileName = (title) => {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, '').trim();
  if (cleaned === '') {
    return 'notes';
  }
  return cleaned.slice(0, 80);
};

function NotesPanel(props) {
  // Both start empty and are filled in once the editor has read the stored notes.
  const [notes, setNotes] = useState('');
  // The notes the server has right now. When notes differ from it, a save is due.
  const [savedNotes, setSavedNotes] = useState('');
  const [savedAt, setSavedAt] = useState(props.initialSavedAt);
  // saveState is 'idle', 'saving', 'saved', or 'error'.
  const [saveState, setSaveState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const hasUnsavedChanges = notes !== savedNotes;
  const textLength = visibleText(notes).length;
  const isTooLong = textLength > NOTES_MAX || notes.length > NOTES_HTML_MAX;

  const sendNotes = async (html) => {
    setSaveState('saving');
    setErrorMessage('');
    try {
      const result = await saveNotes(props.savedId, html);
      setSavedNotes(result.notes);
      setSavedAt(result.notesUpdatedAt);
      setSaveState('saved');
    } catch (err) {
      setErrorMessage(err.message);
      setSaveState('error');
    }
  };

  // The editor has read the stored notes: that cleaned version counts as saved.
  const handleReady = (html) => {
    setNotes(html);
    setSavedNotes(html);
  };

  // Autosave: every change restarts the timer, so saving happens once typing pauses.
  useEffect(() => {
    if (notes === savedNotes) {
      unsavedNotes = null;
      return undefined;
    }
    unsavedNotes = { savedId: props.savedId, html: notes };
    if (isTooLong) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      sendNotes(notes);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notes, savedNotes]);

  // Leaving the page within the autosave delay: send what was typed anyway.
  useEffect(() => {
    return () => {
      if (unsavedNotes) {
        saveNotes(unsavedNotes.savedId, unsavedNotes.html).catch(() => {
          // Nothing can be shown any more; the page is already gone.
        });
      }
      unsavedNotes = null;
    };
  }, []);

  // Closing the tab or reloading with unsaved notes: the browser asks "Leave site?".
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleSaveNow = () => {
    if (saveState === 'saving' || !hasUnsavedChanges || isTooLong) {
      return;
    }
    sendNotes(notes);
  };

  // Saves the notes as a plain text file on the device, for reading offline.
  // Headings keep a "#", bullets a "-", so the layout still reads well as text.
  const handleDownload = () => {
    const header = `Notes: ${props.title}\nDownloaded from LearnHub on ${new Date().toLocaleString()}\n\n`;
    const blob = new Blob([header + toPlainText(notes)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${toFileName(props.title)} - notes.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // One short sentence about the save, read out politely by screen readers.
  let statusText = '';
  if (textLength > NOTES_MAX) {
    statusText = `Too long to save: remove ${textLength - NOTES_MAX} characters.`;
  } else if (isTooLong) {
    statusText = 'Too long to save: remove some text or formatting.';
  } else if (saveState === 'saving') {
    statusText = 'Saving…';
  } else if (saveState === 'error') {
    statusText = `Not saved: ${errorMessage}`;
  } else if (hasUnsavedChanges) {
    statusText = 'Changes not saved yet.';
  } else if (savedAt) {
    statusText = `All notes saved at ${formatTime(savedAt)}.`;
  }

  let statusClassName = 'notes-panel__status';
  if (isTooLong || saveState === 'error') {
    statusClassName = 'notes-panel__status notes-panel__status--error';
  }

  return (
    <section className="study-section notes-panel" aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="section-heading">
        Your notes
      </h2>

      <div className="field">
        <span className="field__label" id="study-notes-label">
          Notes for this study reviewer
        </span>
        <p className="field__hint" id="study-notes-hint">
          Only you can see these. They save on their own a moment after you stop typing.
          Shortcuts: {MOD}+B bold, {MOD}+I italic, {MOD}+Alt+1, 2, or 3 headings, {MOD}+Shift+8
          bullets, {MOD}+] and {MOD}+[ indent. Tab moves on to the next button.
        </p>
        <NoteEditor
          id="study-notes"
          labelId="study-notes-label"
          hintId="study-notes-hint"
          initialNotes={props.initialNotes}
          initialFormat={props.initialFormat}
          onReady={handleReady}
          onChange={setNotes}
        />
      </div>

      <div className="notes-panel__footer">
        <p className={statusClassName} role="status">
          {saveState === 'saved' && !hasUnsavedChanges && <Icon name="check" />}
          {(isTooLong || saveState === 'error') && <Icon name="alert" />}
          <span>{statusText}</span>
        </p>
        <p className="text-muted text-small">
          {textLength.toLocaleString()} / {NOTES_MAX.toLocaleString()} characters
        </p>
      </div>

      <div className="row">
        <button
          type="button"
          className="button"
          aria-disabled={saveState === 'saving' || !hasUnsavedChanges || isTooLong}
          onClick={handleSaveNow}
        >
          <Icon name="check" />
          Save now
        </button>
        <button type="button" className="button" onClick={handleDownload}>
          <Icon name="download" />
          Download notes
        </button>
      </div>
    </section>
  );
}

export default NotesPanel;
