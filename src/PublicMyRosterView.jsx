import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BLUE = '#3B5BDB';
const RED = '#DC2626';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const MAX_RANGE_DAYS = 62; // keep in step with the staff-roster edge function

// A staff member's own roster, behind a personal 4-digit PIN (see
// supabase/functions/staff-roster). The Staff Hub token says which org; the
// PIN says who. The PIN is kept in sessionStorage so a refresh doesn't
// re-prompt, but closing the tab signs out -- these are often shared phones.

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

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromKey, toKey) {
  return Math.round((new Date(`${toKey}T00:00:00Z`) - new Date(`${fromKey}T00:00:00Z`)) / 86400000);
}

function longLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function weekLabel(weekStart) {
  const fmt = (k, withYear) => new Date(`${k}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  });
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6), true)}`;
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

const SPIN_CSS = '@keyframes spin { to { transform: rotate(360deg); } } @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } } html, body { overscroll-behavior-y: none; }';

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#F4F6F8', fontFamily: FONT, boxSizing: 'border-box', padding: '14px 14px 32px' }}>
      <style>{SPIN_CSS}</style>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{SPIN_CSS}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: BLUE, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748B', fontSize: 14 }}>{label}</p>
      </div>
    </div>
  );
}

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

  const keyStyle = {
    height: 64, borderRadius: CARD_RADIUS, border: 'none', background: 'white', boxShadow: CARD_SHADOW,
    fontSize: 24, fontWeight: 600, color: '#1E293B', fontFamily: FONT, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  };

  return (
    <Shell>
      <div style={{ background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, borderRadius: CARD_RADIUS, padding: '22px 20px', textAlign: 'center', boxShadow: '0 10px 24px -10px rgba(59,91,219,0.5)', marginBottom: 22 }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>🗓️</div>
        <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>My Roster</div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>Enter your 4-digit PIN</div>
      </div>

      <div key={shakeKey} style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12, animation: error ? 'shake 0.35s' : 'none' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            background: i < digits.length ? BLUE : 'transparent',
            border: `2px solid ${error ? RED : i < digits.length ? BLUE : '#CBD5E1'}`,
            transition: 'background 0.1s',
          }} />
        ))}
      </div>

      <div style={{ minHeight: 40, textAlign: 'center', fontSize: 13, color: locked || error ? RED : '#94A3B8', fontWeight: 500, marginBottom: 8, padding: '0 8px' }}>
        {busy ? 'Checking…' : error || "Don't have a PIN? Ask your manager."}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, opacity: locked ? 0.4 : 1 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => press(d)} style={keyStyle}>{d}</button>
        ))}
        <a href={`/hub/${token}`} style={{ ...keyStyle, boxShadow: 'none', background: 'transparent', fontSize: 13, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontWeight: 600 }}>← Hub</a>
        <button onClick={() => press('0')} style={keyStyle}>0</button>
        <button onClick={back} aria-label="Delete" style={{ ...keyStyle, boxShadow: 'none', background: 'transparent', fontSize: 22, color: '#64748B' }}>⌫</button>
      </div>
    </Shell>
  );
}

// ── Bottom sheet: mark one day unavailable (or take it back) ────────────────

function DaySheet({ day, saving, onClose, onSetUnavailable, onClear }) {
  const [note, setNote] = useState('');
  const isUnavailable = !!day.unavailable;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: '20px 18px calc(22px + env(safe-area-inset-bottom))', fontFamily: FONT, boxSizing: 'border-box' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>{day.label}</div>

        {isUnavailable ? (
          <>
            <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 16px' }}>
              You're marked unavailable{day.unavailable.note ? ` — "${day.unavailable.note}"` : ''}.
            </p>
            <button disabled={saving} onClick={onClear} style={primaryBtn(BLUE, saving)}>
              {saving ? 'Saving…' : 'Mark me available again'}
            </button>
          </>
        ) : (
          <>
            {day.shifts.length > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, borderRadius: 10, padding: '8px 10px', margin: '6px 0 4px' }}>
                You're rostered on this day. Marking it unavailable won't remove your shift — let your manager know too.
              </div>
            )}
            <p style={{ fontSize: 14, color: '#64748B', margin: '4px 0 12px' }}>Let your manager know you can't work this day.</p>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={200}
              placeholder="Reason (optional)"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', fontSize: 16, fontFamily: FONT, marginBottom: 14, outline: 'none' }}
            />
            <button disabled={saving} onClick={() => onSetUnavailable(note)} style={primaryBtn(RED, saving)}>
              {saving ? 'Saving…' : "I'm unavailable"}
            </button>
          </>
        )}
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: 12, background: 'none', border: 'none', color: '#64748B', fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

const primaryBtn = (color, disabled) => ({
  width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: color, color: 'white',
  fontSize: 16, fontWeight: 700, fontFamily: FONT, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
});

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
        flash('ok', 'You\'re available again.');
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
      <Shell>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', textAlign: 'center', boxShadow: CARD_SHADOW, marginTop: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6 }}>Couldn't load your roster</p>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>{fatal}</p>
          <button onClick={() => window.location.reload()} style={{ ...primaryBtn(BLUE, false), width: 'auto', padding: '10px 22px' }}>Try again</button>
        </div>
      </Shell>
    );
  }

  if (loading) return <Spinner label="Loading your roster…" />;

  if (!data) {
    return <PinPad token={token} busy={pinBusy} error={pinError} locked={locked} onSubmit={submitPin} />;
  }

  const sheetDay = sheetDate ? data.days.find(d => d.dateKey === sheetDate) : null;
  const timeOffGroups = groupTimeOff(data.timeOff);
  const isCurrentWeek = data.days.some(d => d.isToday);

  return (
    <Shell>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, borderRadius: CARD_RADIUS, padding: '16px 18px', boxShadow: '0 10px 24px -10px rgba(59,91,219,0.5)', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{data.businessName}</div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>Hi {data.staffName.split(' ')[0]} 👋</div>
          </div>
          <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>Sign out</button>
        </div>
        <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.16)', borderRadius: 12, padding: '10px 12px', color: 'white', fontSize: 13 }}>
          {data.nextShift ? (
            <>
              <span style={{ opacity: 0.8 }}>Next shift · </span>
              <strong>{data.nextShift.dateKey === data.today ? 'Today' : data.nextShift.label}</strong>, {fmtTime(data.nextShift.start)} – {fmtTime(data.nextShift.end)}
            </>
          ) : (
            <span style={{ opacity: 0.85 }}>No upcoming shifts in the next 4 weeks.</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#E8ECF1', borderRadius: 12, padding: 3, marginBottom: 10 }}>
        {[['week', 'My week'], ['timeoff', `Time off${data.timeOff.length ? ` (${timeOffGroups.length})` : ''}`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
            background: tab === key ? 'white' : 'transparent', color: tab === key ? '#1E293B' : '#64748B',
            boxShadow: tab === key ? '0 1px 2px rgba(15,23,42,0.1)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {notice && (
        <div role="status" style={{
          borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 10,
          background: notice.kind === 'error' ? '#FEF2F2' : notice.kind === 'warn' ? '#FFFBEB' : '#F0FDF4',
          color: notice.kind === 'error' ? '#B91C1C' : notice.kind === 'warn' ? '#92400E' : '#15803D',
          border: `1px solid ${notice.kind === 'error' ? '#FECACA' : notice.kind === 'warn' ? '#FDE68A' : '#BBF7D0'}`,
        }}>{notice.text}</div>
      )}

      {tab === 'week' ? (
        <>
          {/* Week nav */}
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={() => setWeekStart(addDays(data.weekStart, -7))} aria-label="Previous week" style={navBtn}>←</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{weekLabel(data.weekStart)}</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                {fmtHours(data.weekHours)} rostered
                {!isCurrentWeek && <> · <button onClick={() => setWeekStart(null)} style={{ background: 'none', border: 'none', color: BLUE, fontWeight: 700, fontSize: 12, padding: 0, fontFamily: FONT, cursor: 'pointer' }}>This week</button></>}
              </div>
            </div>
            <button onClick={() => setWeekStart(addDays(data.weekStart, 7))} aria-label="Next week" style={navBtn}>→</button>
          </div>

          {!data.published && data.days.some(d => d.shifts.length > 0) && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 12.5, borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
              This week hasn't been published yet — shifts may still change.
            </div>
          )}

          {/* Days */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.days.map(day => {
              const working = day.shifts.length > 0;
              return (
                <div key={day.dateKey} style={{
                  background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '12px 14px',
                  borderLeft: `4px solid ${day.unavailable ? RED : working ? BLUE : 'transparent'}`,
                  opacity: day.isPast ? 0.6 : 1,
                  outline: day.isToday ? `2px solid ${BLUE}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>
                        {day.label}
                        {day.isToday && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: 'white', background: BLUE, borderRadius: 6, padding: '2px 6px', verticalAlign: 'middle' }}>TODAY</span>}
                      </div>
                      {working ? day.shifts.map((sh, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 15, color: '#334155', fontWeight: 600 }}>
                          {sh.roleColor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: sh.roleColor, flexShrink: 0 }} />}
                          <span>{fmtTime(sh.start)} – {fmtTime(sh.end)}</span>
                          {sh.roleCode && <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 13 }}>({sh.roleCode})</span>}
                          <span style={{ color: BLUE, fontWeight: 700, fontSize: 13 }}>{fmtHours(sh.hours)}</span>
                        </div>
                      )) : (
                        <div style={{ marginTop: 2, fontSize: 13, color: '#94A3B8' }}>{day.unavailable ? '' : 'Not rostered'}</div>
                      )}
                      {day.unavailable && (
                        <div style={{ marginTop: working ? 6 : 2, fontSize: 13, color: RED, fontWeight: 600 }}>
                          Unavailable{day.unavailable.note ? ` · ${day.unavailable.note}` : ''}
                        </div>
                      )}
                    </div>
                    {!day.isPast && (
                      <button onClick={() => setSheetDate(day.dateKey)} style={{
                        flexShrink: 0, border: `1px solid ${day.unavailable ? '#FECACA' : '#E2E8F0'}`, background: day.unavailable ? '#FEF2F2' : 'white',
                        color: day.unavailable ? RED : '#64748B', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
                      }}>{day.unavailable ? 'Edit' : 'Unavailable?'}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <TimeOffTab today={data.today} groups={timeOffGroups} saving={saving}
          onAdd={(from, to, note) => {
            const count = daysBetween(from, to) + 1;
            const dates = Array.from({ length: count }, (_, i) => addDays(from, i));
            return mutate('set-unavailable', dates, note);
          }}
          onRemove={(dates) => mutate('clear-unavailable', dates)} />
      )}

      {sheetDay && (
        <DaySheet day={sheetDay} saving={saving}
          onClose={() => setSheetDate(null)}
          onSetUnavailable={async (note) => { if (await mutate('set-unavailable', [sheetDay.dateKey], note)) setSheetDate(null); }}
          onClear={async () => { if (await mutate('clear-unavailable', [sheetDay.dateKey])) setSheetDate(null); }} />
      )}

      <p style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, fontWeight: 500, marginTop: 18 }}>
        <a href={`/hub/${token}`} style={{ color: '#94A3B8', textDecoration: 'none', fontWeight: 600 }}>← Back to hub</a> · Powered by Recess Roster
      </p>
    </Shell>
  );
}

const navBtn = { background: '#F1F5F9', border: 'none', cursor: 'pointer', color: BLUE, fontSize: 18, width: 40, height: 40, borderRadius: 10, lineHeight: 1, fontFamily: FONT };

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

  const dateInput = { width: '100%', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: 12, padding: '11px 12px', fontSize: 16, fontFamily: FONT, background: 'white', color: '#1E293B' };

  return (
    <>
      <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginBottom: 10 }}>Add time off</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            From
            <input type="date" value={from} min={today} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} style={{ ...dateInput, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            To
            <input type="date" value={to} min={from || today} onChange={e => setTo(e.target.value)} style={{ ...dateInput, marginTop: 4 }} />
          </label>
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Reason (optional)" style={{ ...dateInput, marginBottom: 10 }} />
        {formError && <div style={{ color: RED, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{formError}</div>}
        <button disabled={saving} onClick={submit} style={primaryBtn(RED, saving)}>{saving ? 'Saving…' : "I'm unavailable on these dates"}</button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 4px 8px' }}>Upcoming</div>
      {groups.length === 0 ? (
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '22px 14px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
          No time off set. You're available for all upcoming shifts.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(g => (
            <div key={g.from} style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '12px 14px', borderLeft: `4px solid ${RED}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>
                  {g.from === g.to ? longLabel(g.from) : `${longLabel(g.from)} → ${longLabel(g.to)}`}
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {g.dates.length > 1 ? `${g.dates.length} days` : '1 day'}{g.note ? ` · ${g.note}` : ''}
                </div>
              </div>
              <button disabled={saving} onClick={() => onRemove(g.dates)} style={{ flexShrink: 0, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
