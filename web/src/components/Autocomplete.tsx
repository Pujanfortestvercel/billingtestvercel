// ---------------------------------------------------------------------------
// Autocomplete — a text box that shows a live dropdown of suggestions as you
// type, and fills in the value when you click one. Generic, so it works for
// BOTH customers and items. Web port of the original AutocompleteInput.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';

type Props<T> = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  fetchSuggestions: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder?: string;
  minChars?: number;
  error?: string | null;
};

export function Autocomplete<T>({
  label,
  value,
  onChangeText,
  fetchSuggestions,
  getKey,
  getLabel,
  onSelect,
  placeholder,
  minChars = 1,
  error,
}: Props<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(value, 250);
  const skipNextRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Callers pass a fresh inline `fetchSuggestions` on every render. Keep the
  // latest in a ref so the search effect can depend ONLY on the typed text —
  // otherwise every unrelated parent re-render re-fired the search and re-opened
  // the dropdown over whatever field the user had moved on to.
  const fetchRef = useRef(fetchSuggestions);
  fetchRef.current = fetchSuggestions;

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    let active = true;
    const q = debounced.trim();
    if (q.length < minChars) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    fetchRef.current(q)
      .then(results => {
        if (!active) return;
        setSuggestions(results);
        setOpen(results.length > 0);
      })
      .catch(() => active && setOpen(false));
    return () => {
      active = false;
    };
  }, [debounced, minChars]);

  // Close when clicking outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleSelect(item: T) {
    skipNextRef.current = true;
    onSelect(item);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="field" style={{ position: 'relative' }} ref={wrapRef}>
      {label ? <label className="field-label">{label}</label> : null}
      <input
        className={`input ${error ? 'error' : ''}`}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={e => {
          // A real keystroke should always fetch — clear any pending skip left
          // over from a selection that didn't change the text.
          skipNextRef.current = false;
          onChangeText(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {error ? <div className="field-error">{error}</div> : null}
      {open ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% - 12px)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: 240,
            overflowY: 'auto',
            zIndex: 50,
          }}
        >
          {suggestions.map(item => (
            <div
              key={getKey(item)}
              onClick={() => handleSelect(item)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = 'var(--surface-2)')
              }
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {getLabel(item)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
