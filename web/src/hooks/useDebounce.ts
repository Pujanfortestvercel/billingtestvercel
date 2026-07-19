// ---------------------------------------------------------------------------
// useDebounce — wait until the user STOPS typing before doing work.
// ---------------------------------------------------------------------------
// For autocomplete, we don't want to hit the database on every keystroke.
// This hook returns a value that only updates after the user pauses for
// `delay` milliseconds. Example:
//   const debouncedText = useDebounce(text, 250);
//   // run the search whenever debouncedText changes
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // cancel if value changes before delay
  }, [value, delay]);

  return debounced;
}
