import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BLUE = '#3B5BDB';
const RED = '#DC2626';
const INK = '#1E293B';
const MUTED = '#64748B';
const FAINT = '#94A3B8';
const HAIRLINE = '#EEF1F5';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const MAX_RANGE_DAYS = 62; // keep in step with the staff-roster edge function

// A staff member's own roster, behind a personal 4-digit PIN (see
// supabase/functions/staff-roster). The Staff Hub token says which org; the
// PIN says who. The PIN is kept in sessionStorage so a refresh doesn't
// re-prompt, but closing the tab signs out -- these are often shared phones.
//
// Laid out to fit one phone screen with no page scroll: header, tabs, then a
// single card whose seven day rows share whatever height is left.

const pinKey = (token) => `rr_pin_${token}`;

function readStoredPin(token) {
  try { return sessionStorage.getItem(pinKey(token)) || ''; } catch { return ''; }
}
function storePin(token, pin) {
  try { sessionStorage.setItem(pinKey(token), pin); } catch { /* private mode -- just re-prompt next time */ }
}
function clearStoredPin(token) {
  try { sessionStorage.removeItem(pinKey(token)); } catch { /* ignore */ }
}

// ── Date helpers: 'YYYY-MM-DD' keys, manipulated in UTC so the phone's own
// timezone can't shift a day. "Today" always comes from the server (the org's timezone).

const utc = (dateKey) => new Date(`${dateKey}T00:00:00Z`);

function addDays(dateKey, n) {
  const d = utc(dateKey);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromKey, toKey) {
  return Math.round((utc(toKey) - utc(fromKey)) / 86400000);
}

const fmtDate = (dateKey, opts) => utc(dateKey).toLocaleDateString('en-AU', { timeZone: 'UTC', ...opts });
const shortLabel = (dateKey) => fmtDate(dateKey, { weekday: 'short', day: 'numeric', month: 'short' });

function weekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const sameMonth = fmtDate(weekStart, { month: 'short' }) === fmtDate(end, { month: 'short' });
  return sameMonth
    ? `${fmtDate(weekStart, { day: 'numeric' })} – ${fmtDate(end, { day: 'numeric', month: 'short' })}`
    : `${fmtDate(weekStart, { day: 'numeric', month: 'short' })} – ${fmtDate(end, { day: 'numeric', month: 'short' })}`;
}

function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function fmtHours(h) {
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

// Collapse consecutive dates that share a note into ranges, so a week off
// reads as one line instead of seven.
function groupTimeOff(timeOff) {
  const groups = [];
  for (const t of timeOff) {
    const last = groups[groups.length - 1];
    if (last && last.note === t.note && addDays(last.to, 1) === t.dateKey) {
      last.to = t.dateKey;
      last.dates.push(t.dateKey);
    } else {
      groups.push({ from: t.dateKey, to: t.dateKey, note: t.note, dates: [t.dateKey] });
    }
  }
  return groups;
}

const GLOBAL_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
  @keyframes rise { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  html, body { overscroll-behavior-y: none; margin: 0; }
  .rr-btn { font-family: ${FONT}; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .rr-btn:active { transform: scale(0.97); }
  .rr-btn:disabled { cursor: default; opacity: 0.6; }
`;

// A full-height column that never scrolls the page; children decide what flexes.
function Page({ children, center }) {
  return (
    <div style={{ height: '100dvh', background: '#F4F6F8', fontFamily: FONT, boxSizing: 'border-box', overflow: 'hidden' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        maxWidth: 480, height: '100%', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        justifyContent: center ? 'center' : 'flex-start',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }}>
        {children}
      </div>
    </div>
  );
}

function Spinner({ label }) {
  return (
    <Page center>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 34, height: 34, border: '3px solid #E2E8F0', borderTopColor: BLUE, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>{label}</p>
      </div>
    </Page>
  );
}

const primaryBtn = (color) => ({
  width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: color, color: 'white',
  fontSize: 15, fontWeight: 700,
});

// ── PIN entry ───────────────────────────────────────────────────────────────

function PinPad({ token, busy, error, locked, onSubmit }) {
  const [digits, setDigits] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  // A wrong PIN clears the dots and shakes them.
  useEffect(() => {
    if (error) { setDigits(''); setShakeKey(k => k + 1); }
  }, [error]);

  const press = (d) => {
    if (busy || locked) return;
    const next = (digits + d).slice(0, 4);
    setDigits(next);
    if (next.length === 4) onSubmit(next);
  };
  const back = () => { if (!busy) setDigits(d => d.slice(0, -1)); };

  const key = {
    height: 'clamp(50px, 8.5dvh, 62px)', borderRadius: 14, border: 'none', background: 'white', boxShadow: CARD_SHADOW,
    fontSize: 22, fontWeight: 600, color: INK,
  };
  const ghost = { ...key, boxShadow: 'none', background: 'transparent', color: MUTED };

  return (
    <Page center>
      <div style={{ textAlign: 'center', marginBottom: 'clamp(14px, 3dvh, 28px)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 10px', background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, boxShadow: '0 10px 22px -10px rgba(59,91,219,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🗓️</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: INK }}>My Roster</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Enter your 4-digit PIN</div>
      </div>

      <div key={shakeKey} style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 10, animation: error ? 'shake 0.35s' : 'none' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%', boxSizing: 'border-box',
            background: i < digits.length ? BLUE : 'transparent',
            border: `2px solid ${error ? RED : i < digits.length ? BLUE : '#CBD5E1'}`,
            transition: 'background 0.1s',
          }} />
        ))}
      </div>

      <div style={{ height: 36, textAlign: 'center', fontSize: 12.5, lineHeight: 1.35, color: locked || error ? RED : FAINT, fontWeight: 500, marginBottom: 6, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {busy ? 'Checking…' : error || "Don't have a PIN? Ask your manager."}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, opacity: locked ? 0.4 : 1, maxWidth: 340, width: '100%', margin: '0 auto' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} className="rr-btn" onClick={() => press(d)} style={key}>{d}</button>
        ))}
        <a href={`/hub/${token}`} className="rr-btn" style={{ ...ghost, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>← Hub</a>
        <button className="rr-btn" onClick={() => press('0')} style={key}>0</button>
        <button className="rr-btn" onClick={back} aria-label="Delete" style={{ ...ghost, fontSize: 20 }}>⌫</button>
      </div>
    </Page>
  );
}

// ── Bottom sheet: mark one day unavailable (or take it back) ────────────────

function DaySheet({ day, saving, onClose, onSetUnavailable, onClear }) {
  const [note, setNote] = useState('');
  const isUnavailable = !!day.unavailable;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: '8px 18px calc(16px + env(safe-area-inset-bottom))', fontFamily: FONT, boxSizing: 'border-box', animation: 'rise 0.18s ease-out' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 2 }}>{shortLabel(day.dateKey)}</div>

        {isUnavailable ? (
          <>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 14px' }}>
              You're marked unavailable{day.unavailable.note ? ` — “${day.unavailable.note}”` : ''}.
            </p>
            <button className="rr-btn" disabled={saving} onClick={onClear} style={primaryBtn(BLUE)}>
              {saving ? 'Saving…' : 'Mark me available again'}
            </button>
          </>
        ) : (
          <>
            {day.shifts.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 12.5, borderRadius: 10, padding: '8px 10px', margin: '8px 0 2px' }}>
                You're rostered on this day. Marking it unavailable won't remove your shift — let your manager know too.
              </div>
            )}
            <p style={{ fontSize: 14, color: MUTED, margin: '6px 0 10px' }}>Let your manager know you can't work this day.</p>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={200}
              placeholder="Reason (optional)"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 16, fontFamily: FONT, marginBottom: 12, outline: 'none' }}
            />
            <button className="rr-btn" disabled={saving} onClick={() => onSetUnavailable(note)} style={primaryBtn(RED)}>
              {saving ? 'Saving…' : "I'm unavailable"}
            </button>
          </>
        )}
        <button className="rr-btn" onClick={onClose} style={{ width: '100%', marginTop: 4, padding: 11, background: 'none', border: 'none', color: MUTED, fontSize: 14, fontWeight: 600 }}>Cancel</button>
      </div>
    </div>
  );
}

// ── One day row inside the week card ────────────────────────────────────────

function DayRow({ day, last, onOpen }) {
  const working = day.shifts.length > 0;
  const bg = day.unavailable ? '#FEF8F8' : 'white';
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px 0 14px', background: bg,
      borderBottom: last ? 'none' : `1px solid ${HAIRLINE}`, opacity: day.isPast ? 0.5 : 1,
      boxShadow: working ? `inset 3px 0 0 ${BLUE}` : day.unavailable ? `inset 3px 0 0 ${RED}` : 'none',
    }}>
      {/* Date */}
      <div style={{ width: 38, flexShrink: 0, textAlign: 'center', lineHeight: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: day.isToday ? BLUE : FAINT, marginBottom: 3 }}>
          {fmtDate(day.dateKey, { weekday: 'short' })}
        </div>
        <div style={{
          fontSize: 17, fontWeight: 800, color: day.isToday ? 'white' : INK,
          background: day.isToday ? BLUE : 'transparent', borderRadius: 9, padding: day.isToday ? '4px 0' : '4px 0',
        }}>
          {fmtDate(day.dateKey, { day: 'numeric' })}
        </div>
      </div>

      {/* What's happening */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {working && day.shifts.map((sh, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 15, fontWeight: 650, color: '#273449', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
            {sh.roleColor && <span style={{ width: 7, height: 7, borderRadius: '50%', background: sh.roleColor, flexShrink: 0, alignSelf: 'center' }} />}
            <span>{fmtTime(sh.start)} – {fmtTime(sh.end)}</span>
            <span style={{ color: BLUE, fontWeight: 700, fontSize: 12.5 }}>{fmtHours(sh.hours)}</span>
            {sh.roleCode && <span style={{ color: FAINT, fontWeight: 500, fontSize: 12 }}>{sh.roleCode}</span>}
          </div>
        ))}
        {day.unavailable && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: RED, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Unavailable{day.unavailable.note ? ` · ${day.unavailable.note}` : ''}
          </div>
        )}
        {!working && !day.unavailable && <div style={{ fontSize: 13, color: '#B4BDC9' }}>Day off</div>}
      </div>

      {/* Action */}
      {!day.isPast && (
        <button className="rr-btn" onClick={onOpen} style={{
          flexShrink: 0, borderRadius: 999, padding: '6px 11px', fontSize: 12, fontWeight: 700,
          border: `1px solid ${day.unavailable ? '#FECACA' : '#E2E8F0'}`,
          background: day.unavailable ? '#FEE2E2' : 'white', color: day.unavailable ? RED : MUTED,
        }}>{day.unavailable ? 'Edit' : "Can't work"}</button>
      )}
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export default function PublicMyRosterView({ token }) {
  const [pin, setPin] = useState(() => readStoredPin(token));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!readStoredPin(token));
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [locked, setLocked] = useState(false);
  const [fatal, setFatal] = useState('');
  const [weekStart, setWeekStart] = useState(null); // null = the server's "this week"
  const [tab, setTab] = useState('week'); // 'week' | 'timeoff'
  const [sheetDate, setSheetDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: 'ok' | 'warn' | 'error', text }
  const noticeTimer = useRef(null);

  const flash = useCallback((kind, text) => {
    setNotice({ kind, text });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // One call shape for every action. Business errors come back as 200 with
  // { error, code }, matching the other public functions.
  const call = useCallback(async (action, pinValue, extra = {}) => {
    const { data: result, error: err } = await supabase.functions.invoke('staff-roster', {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
      body: { token, pin: pinValue, action, ...extra },
    });
    if (err) throw new Error('Unable to reach the server. Check your connection and try again.');
    return result;
  }, [token]);

  const signOut = useCallback(() => {
    clearStoredPin(token);
    setPin(''); setData(null); setWeekStart(null); setTab('week'); setPinError(''); setLocked(false);
  }, [token]);

  const load = useCallback(async (pinValue, week) => {
    const result = await call('load', pinValue, week ? { weekStart: week } : {});
    if (result?.error) {
      if (result.code === 'bad_link') { setFatal(result.error); return false; }
      // A stored PIN that no longer works (changed, or staff archived) -- back to the keypad.
      clearStoredPin(token);
      setPin(''); setData(null);
      setPinError(result.error);
      setLocked(result.code === 'locked');
      return false;
    }
    setData(result);
    setPinError(''); setLocked(false);
    return true;
  }, [call, token]);

  // Initial load from a remembered PIN, and week changes thereafter.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    (async () => {
      try {
        await load(pin, weekStart);
      } catch (e) {
        if (!cancelled) setFatal(e.message);
      } finally {
        if (!cancelled) { setLoading(false); setPinBusy(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [pin, weekStart, load]);

  // Setting the PIN hands off to the load effect above, which clears it again
  // (and shows the error) if the server rejects it.
  const submitPin = (entered) => {
    setPinError('');
    setPinBusy(true);
    setWeekStart(null);
    storePin(token, entered);
    setPin(entered);
  };

  const mutate = async (action, dates, note) => {
    setSaving(true);
    try {
      const result = await call(action, pin, { dates, ...(note !== undefined ? { note } : {}) });
      if (result?.error) { flash('error', result.error); return false; }
      await load(pin, data.weekStart);
      if (action === 'set-unavailable') {
        if (result.rostered?.length) {
          flash('warn', `Saved. You're already rostered on ${result.rostered.map(r => r.label).join(', ')} — tell your manager.`);
        } else {
          flash('ok', dates.length === 1 ? 'Marked unavailable.' : `Marked ${dates.length} days unavailable.`);
        }
      } else {
        flash('ok', "You're available again.");
      }
      return true;
    } catch (e) {
      flash('error', e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (fatal) {
    return (
      <Page center>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '30px 24px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
          <p style={{ color: INK, fontWeight: 700, margin: '0 0 6px' }}>Couldn't load your roster</p>
          <p style={{ color: MUTED, fontSize: 13, margin: '0 0 16px' }}>{fatal}</p>
          <button className="rr-btn" onClick={() => window.location.reload()} style={{ ...primaryBtn(BLUE), width: 'auto', padding: '10px 22px' }}>Try again</button>
        </div>
      </Page>
    );
  }

  if (loading) return <Spinner label="Loading your roster…" />;

  if (!data) {
    return <PinPad token={token} busy={pinBusy} error={pinError} locked={locked} onSubmit={submitPin} />;
  }

  const sheetDay = sheetDate ? data.days.find(d => d.dateKey === sheetDate) : null;
  const timeOffGroups = groupTimeOff(data.timeOff);
  const isCurrentWeek = data.days.some(d => d.isToday);
  const toastColors = {
    error: ['#FEF2F2', '#B91C1C', '#FECACA'], warn: ['#FFFBEB', '#92400E', '#FDE68A'], ok: ['#F0FDF4', '#15803D', '#BBF7D0'],
  };

  return (
    <Page>
      {/* Header: greeting + next shift in one compact card */}
      <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, borderRadius: CARD_RADIUS, padding: '12px 14px 11px', boxShadow: '0 10px 24px -12px rgba(59,91,219,0.55)', marginBottom: 10, color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: 2 }}>{data.businessName}</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Hi {data.staffName.split(' ')[0]} 👋</div>
          </div>
          <button className="rr-btn" onClick={signOut} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Sign out</button>
        </div>
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 13 }}>
          {data.nextShift ? (
            <>
              <span style={{ opacity: 0.75 }}>Next shift · </span>
              <strong>{data.nextShift.dateKey === data.today ? 'Today' : shortLabel(data.nextShift.dateKey)}</strong>
              <span>, {fmtTime(data.nextShift.start)} – {fmtTime(data.nextShift.end)}</span>
            </>
          ) : (
            <span style={{ opacity: 0.85 }}>No shifts in the next 4 weeks</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 3, background: '#E6EAF0', borderRadius: 11, padding: 3, marginBottom: 10 }}>
        {[['week', 'My week'], ['timeoff', `Time off${timeOffGroups.length ? ` · ${timeOffGroups.length}` : ''}`]].map(([key, label]) => (
          <button key={key} className="rr-btn" onClick={() => setTab(key)} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', fontSize: 13.5, fontWeight: 700,
            background: tab === key ? 'white' : 'transparent', color: tab === key ? INK : MUTED,
            boxShadow: tab === key ? '0 1px 2px rgba(15,23,42,0.1)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'week' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
          {/* Week nav lives inside the card, as its header bar */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '6px 8px', borderBottom: `1px solid ${HAIRLINE}`, background: '#FAFBFD' }}>
            <button className="rr-btn" onClick={() => setWeekStart(addDays(data.weekStart, -7))} aria-label="Previous week" style={navBtn}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.25 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>{weekLabel(data.weekStart)}</div>
              <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 500 }}>
                {fmtHours(data.weekHours)} rostered
                {!isCurrentWeek && <> · <button className="rr-btn" onClick={() => setWeekStart(null)} style={{ background: 'none', border: 'none', color: BLUE, fontWeight: 700, fontSize: 11.5, padding: 0 }}>This week</button></>}
              </div>
            </div>
            <button className="rr-btn" onClick={() => setWeekStart(addDays(data.weekStart, 7))} aria-label="Next week" style={navBtn}>›</button>
          </div>

          {/* Seven rows share the remaining height */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {data.days.map((day, i) => (
              <DayRow key={day.dateKey} day={day} last={i === data.days.length - 1} onOpen={() => setSheetDate(day.dateKey)} />
            ))}
          </div>
        </div>
      ) : (
        <TimeOffTab today={data.today} groups={timeOffGroups} saving={saving}
          onAdd={(from, to, note) => {
            const count = daysBetween(from, to) + 1;
            const dates = Array.from({ length: count }, (_, i) => addDays(from, i));
            return mutate('set-unavailable', dates, note);
          }}
          onRemove={(dates) => mutate('clear-unavailable', dates)} />
      )}

      <div style={{ flexShrink: 0, textAlign: 'center', fontSize: 11, color: '#B5BEC9', fontWeight: 500, paddingTop: 8 }}>
        <a href={`/hub/${token}`} style={{ color: FAINT, textDecoration: 'none', fontWeight: 600 }}>← Hub</a> · Powered by Recess Roster
      </div>

      {/* Floating toast: doesn't push the layout around */}
      {notice && (
        <div role="status" style={{
          position: 'fixed', left: 12, right: 12, bottom: 'calc(34px + env(safe-area-inset-bottom))', maxWidth: 456, margin: '0 auto', zIndex: 40,
          borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, animation: 'rise 0.18s ease-out',
          background: toastColors[notice.kind][0], color: toastColors[notice.kind][1], border: `1px solid ${toastColors[notice.kind][2]}`,
          boxShadow: '0 8px 24px -8px rgba(15,23,42,0.25)',
        }}>{notice.text}</div>
      )}

      {sheetDay && (
        <DaySheet day={sheetDay} saving={saving}
          onClose={() => setSheetDate(null)}
          onSetUnavailable={async (note) => { if (await mutate('set-unavailable', [sheetDay.dateKey], note)) setSheetDate(null); }}
          onClear={async () => { if (await mutate('clear-unavailable', [sheetDay.dateKey])) setSheetDate(null); }} />
      )}
    </Page>
  );
}

const navBtn = { background: 'none', border: 'none', color: BLUE, fontSize: 26, fontWeight: 400, width: 40, height: 36, borderRadius: 10, lineHeight: 1, padding: 0 };

// ── Time off tab: block out a date range, and see/undo what's upcoming ──────

function TimeOffTab({ today, groups, saving, onAdd, onRemove }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const submit = async () => {
    if (!from || !to) { setFormError('Pick a start and end date.'); return; }
    if (from < today) { setFormError("Start date can't be in the past."); return; }
    if (to < from) { setFormError('End date is before the start date.'); return; }
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) { setFormError(`That's more than ${MAX_RANGE_DAYS} days — add it in smaller chunks.`); return; }
    setFormError('');
    if (await onAdd(from, to, note)) setNote('');
  };

  const field = { width: '100%', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: 10, padding: '9px 10px', fontSize: 16, fontFamily: FONT, background: 'white', color: INK, minWidth: 0, outline: 'none' };
  const fieldLabel = { fontSize: 10.5, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', minWidth: 0 };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ flexShrink: 0, background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 8 }}>Add time off</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <label style={fieldLabel}>
            <span style={{ display: 'block', marginBottom: 3 }}>From</span>
            <input type="date" value={from} min={today} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} style={field} />
          </label>
          <label style={fieldLabel}>
            <span style={{ display: 'block', marginBottom: 3 }}>To</span>
            <input type="date" value={to} min={from || today} onChange={e => setTo(e.target.value)} style={field} />
          </label>
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Reason (optional)" style={{ ...field, marginBottom: 10 }} />
        {formError && <div style={{ color: RED, fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{formError}</div>}
        <button className="rr-btn" disabled={saving} onClick={submit} style={primaryBtn(RED)}>{saving ? 'Saving…' : "I'm unavailable on these dates"}</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 4px 6px' }}>Upcoming</div>
        {groups.length === 0 ? (
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '20px 14px', textAlign: 'center', color: FAINT, fontSize: 13.5 }}>
            No time off set — you're available for all upcoming shifts.
          </div>
        ) : (
          <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}>
            {groups.map((g, i) => (
              <div key={g.from} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px 10px 14px', borderBottom: i === groups.length - 1 ? 'none' : `1px solid ${HAIRLINE}`, boxShadow: `inset 3px 0 0 ${RED}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                    {g.from === g.to ? shortLabel(g.from) : `${shortLabel(g.from)} → ${shortLabel(g.to)}`}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.dates.length} {g.dates.length === 1 ? 'day' : 'days'}{g.note ? ` · ${g.note}` : ''}
                  </div>
                </div>
                <button className="rr-btn" disabled={saving} onClick={() => onRemove(g.dates)} style={{ flexShrink: 0, border: '1px solid #E2E8F0', background: 'white', color: MUTED, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
