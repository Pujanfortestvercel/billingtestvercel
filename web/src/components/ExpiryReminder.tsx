// ---------------------------------------------------------------------------
// EXPIRY REMINDER — when the user's plan ends within 2 days, nudge them to
// renew TWICE per day (tracked in localStorage so it doesn't spam on every
// page change, and resets each calendar day). The always-visible banner lives
// in the Layout; this component only fires the periodic toast reminders.
// ---------------------------------------------------------------------------
import { useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useToast } from './Toast';

const MAX_PER_DAY = 2;
const RECHECK_MS = 6 * 60 * 60 * 1000; // re-evaluate every 6 hours
const KEY = 'renewalReminder';

function todayKey(): string {
  return new Date().toDateString();
}

export function ExpiryReminder() {
  const { status, daysLeft } = useSubscription();
  const { toast } = useToast();

  // Eligible when on a time-limited plan (not permanent) ending within 2 days.
  const eligible =
    (status === 'trial' || status === 'active') &&
    daysLeft !== -1 &&
    daysLeft <= 2;

  useEffect(() => {
    if (!eligible) return;

    function maybeRemind() {
      let state = { date: todayKey(), count: 0 };
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) state = JSON.parse(raw);
      } catch {
        /* ignore parse errors */
      }
      if (state.date !== todayKey()) state = { date: todayKey(), count: 0 };
      if (state.count >= MAX_PER_DAY) return;

      const msg =
        daysLeft <= 0
          ? '⏰ Your subscription ends today — please renew to keep billing.'
          : `⏰ Your subscription ends in ${daysLeft} day${
              daysLeft === 1 ? '' : 's'
            } — please renew soon.`;
      toast(msg, 'error');

      state.count += 1;
      localStorage.setItem(KEY, JSON.stringify(state));
    }

    maybeRemind(); // once on load
    const id = setInterval(maybeRemind, RECHECK_MS); // and periodically
    return () => clearInterval(id);
  }, [eligible, daysLeft, toast]);

  return null;
}
