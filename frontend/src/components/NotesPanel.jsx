// Your own notes for one saved study reviewer. They are saved to your account
// automatically a moment after you stop typing, so they are there on any device.
//
// props:
//   savedId          id of the saved item the notes belong to
//   title            the study reviewer's title (used for the download name)
//   initialNotes     the notes as last saved
//   initialSavedAt   when they were last saved (null if never)
import { useEffect, useState } from 'react';
import { saveNotes } from '../services/savedService';
import FormField from './FormField';
import Icon from './Icon';

const NOTES_MAX = 20000;
const AUTOSAVE_DELAY_MS = 1500;

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
  const [notes, setNotes] = useState(props.initialNotes);
  // The text the server has right now. When notes differ from it, a save is due.
  const [savedNotes, setSavedNotes] = useState(props.initialNotes);
  const [savedAt, setSavedAt] = useState(props.initialSavedAt);
  // saveState is 'idle', 'saving', 'saved', or 'error'.
  const [saveState, setSaveState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const hasUnsavedChanges = notes !== savedNotes;

  const sendNotes = async (text) => {
    setSaveState('saving');
    setErrorMessage('');
    try {
      const result = await saveNotes(props.savedId, text);
      setSavedNotes(result.notes);
      setSavedAt(result.notesUpdatedAt);
      setSaveState('saved');
    } catch (err) {
      setErrorMessage(err.message);
      setSaveState('error');
    }
  };

  // Autosave: every change restarts the timer, so saving happens once typing pauses.
  useEffect(() => {
    if (notes === savedNotes) {
      unsavedNotes = null;
      return undefined;
    }
    unsavedNotes = { savedId: props.savedId, text: notes };
    if (notes.length > NOTES_MAX) {
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
      if (unsavedNotes && unsavedNotes.text.length <= NOTES_MAX) {
        saveNotes(unsavedNotes.savedId, unsavedNotes.text).catch(() => {
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
    if (saveState === 'saving' || !hasUnsavedChanges || notes.length > NOTES_MAX) {
      return;
    }
    sendNotes(notes);
  };

  // Saves the notes as a plain text file on the device, for reading offline.
  const handleDownload = () => {
    const header = `Notes: ${props.title}\nDownloaded from LearnHub on ${new Date().toLocaleString()}\n\n`;
    const blob = new Blob([header + notes], { type: 'text/plain;charset=utf-8' });
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
  if (notes.length > NOTES_MAX) {
    statusText = `Too long to save: remove ${notes.length - NOTES_MAX} characters.`;
  } else if (saveState === 'saving') {
    statusText = 'Saving…';
  } else if (saveState === 'error') {
    statusText = `Not saved: ${errorMessage}`;
  } else if (hasUnsavedChanges) {
    statusText = 'Changes not saved yet.';
  } else if (savedAt) {
    statusText = `All notes saved at ${formatTime(savedAt)}.`;
  }

  let error = '';
  if (notes.length > NOTES_MAX) {
    error = `Notes can be at most ${NOTES_MAX.toLocaleString()} characters.`;
  }

  return (
    <section className="study-section notes-panel" aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="section-heading">
        Your notes
      </h2>

      <FormField
        id="study-notes"
        label="Notes for this study reviewer"
        type="textarea"
        rows={14}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        hint="Only you can see these. They save on their own a moment after you stop typing."
        error={error}
      />

      <div className="notes-panel__footer">
        <p className="notes-panel__status" role="status">
          {saveState === 'saved' && !hasUnsavedChanges && <Icon name="check" />}
          <span>{statusText}</span>
        </p>
        <p className="text-muted text-small">
          {notes.length.toLocaleString()} / {NOTES_MAX.toLocaleString()} characters
        </p>
      </div>

      <div className="row">
        <button
          type="button"
          className="button"
          aria-disabled={saveState === 'saving' || !hasUnsavedChanges}
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
