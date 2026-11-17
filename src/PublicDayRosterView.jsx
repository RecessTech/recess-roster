import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  Page, Spinner, PinPad, addDays, fmtWindow,
  BLUE, RED, AMBER_INK, INK, MUTED, FAINT, HAIRLINE, FONT, CARD_RADIUS, CARD_SHADOW,
} from './PublicMyRosterView';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// The whole team's roster for one day, behind a single shared 4-digit PIN
// (see supabase/functions/day-roster). Opens on today; the date strip scrolls
// through nearby days, the calendar button jumps to any date, and swiping the
// roster left/right steps a day. Read-only -- edits happen on desktop.

const LABEL_W = 96;   // staff-name column
const TRACK_PAD = 12; // right padding of the time track
const ROW_H = 48;
const STRIP_BEHIND = 14;
const STRIP_AHEAD = 28;
const STRIP_REANCHOR_MARGIN = 4; // re-centre the strip when the selection gets this close to its edge

const pinKey = (token) => `rr_dayroster_pin_${token}`;
function readStoredPin(token) { try { return sessionStorage.getItem(pinKey(token)) || ''; } catch { return ''; } }
function storePin(token, pin) { try { sessionStorage.setItem(pinKey(token), pin); } catch { /* private mode */ } }
function clearStoredPin(token) { try { sessionStorage.removeItem(pinKey(token)); } catch { /* ignore */ } }

const utc = (dateKey) => new Date(`${dateKey}T00:00:00Z`);
const fmtDate = (dateKey, opts) => utc(dateKey).toLocaleDateString('en-AU', { timeZone: 'UTC', ...opts });
const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// "6:30a–2:30p", "7–11a": a shift's times in as few characters as will read,
// so a couple of shifts still fit under a name. The am/pm is dropped from the
// start when it matches the end.
function shortRange(start, end) {
  const part = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return { text: `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''}`, pm: h % 24 >= 12 };
  };
  const a = part(start);
  const b = part(end);
  return `${a.text}${a.pm !== b.pm ? (a.pm ? 'p' : 'a') : ''}–${b.text}${b.pm ? 'p' : 'a'}`;
}

// "7a", "12p" -- compact hour labels for the time axis.
function hourLabel(h) {
  const h24 = h % 24;
  const suffix = h24 >= 12 ? 'p' : 'a';
  return `${h24 % 12 === 0 ? 12 : h24 % 12}${suffix}`;
}

const EXTRA_CSS = `
  .rr-strip { scrollbar-width: none; -ms-overflow-style: none; }
  .rr-strip::-webkit-scrollbar { display: none; }
`;

export default function PublicDayRosterView({ token }) {
  const [pin, setPin] = useState(() => readStoredPin(token));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!readStoredPin(token));
  const [fetching, setFetching] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [locked, setLocked] = useState(false);
  const [fatal, setFatal] = useState('');
  const [date, setDate] = useState(null);      // null until the server tells us "today"
  const [anchor, setAnchor] = useState(null);  // centre of the date strip
  const [site, setSite] = useState('');        // '' = all sites
  const [loadedAt, setLoadedAt] = useState(0);
  const [tick, setTick] = useState(0);
  const reqId = useRef(0);
  const stripRef = useRef(null);
  const firstScroll = useRef(true);
  const touch = useRef(null);

  const signOut = useCallback(() => {
    clearStoredPin(token);
    setPin(''); setData(null); setDate(null); setAnchor(null); setSite(''); setPinError(''); setLocked(false);
    firstScroll.current = true;
  }, [token]);

  const load = useCallback(async (pinValue, dateKey) => {
    const id = ++reqId.current;
    const { data: result, error: err } = await supabase.functions.invoke('day-roster', {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
      body: { token, pin: pinValue, ...(dateKey ? { date: dateKey } : {}) },
    });
    if (id !== reqId.current) return; // a newer request superseded this one
    if (err) throw new Error('Unable to reach the server. Check your connection and try again.');
    if (result?.error) {
      if (result.code === 'bad_link') { setFatal(result.error); return; }
      if (result.code === 'bad_pin' || result.code === 'locked') {
        clearStoredPin(token);
        setPin(''); setData(null);
        setPinError(result.error);
        setLocked(result.code === 'locked');
        return;
      }
      throw new Error(result.error); // e.g. a date out of range -- keep the current view
    }
    setData(result);
    setLoadedAt(Date.now());
    setPinError(''); setLocked(false);
    setDate(prev => prev || result.date);
    setAnchor(prev => prev || result.date);
  }, [token]);

  // Load on sign-in and whenever the selected day changes.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    setFetching(true);
    (async () => {
      try {
        await load(pin, date);
      } catch (e) {
        if (!cancelled) { if (data) setFetching(false); else setFatal(e.message); }
      } finally {
        if (!cancelled) { setLoading(false); setPinBusy(false); setFetching(false); }
      }
    })();
    return () => { cancelled = true; };
  // `data` is deliberately omitted: it only decides how a failed *refetch* is reported
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, date, load]);

  // Keep the "now" line moving on a page left open.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const submitPin = (entered) => {
    setPinError(''); setPinBusy(true);
    storePin(token, entered);
    setPin(entered);
  };

  // Select a day; re-centre the strip only when the pick nears its edge, so
  // tapping chips doesn't make the strip jump under the finger.
  const goTo = useCallback((key) => {
    if (!key) return;
    setDate(key);
    setAnchor(prev => (!prev || key < addDays(prev, -STRIP_BEHIND + STRIP_REANCHOR_MARGIN) || key > addDays(prev, STRIP_AHEAD - STRIP_REANCHOR_MARGIN)) ? key : prev);
  }, []);

  const selected = date || data?.date;

  // Scroll the selected chip to the middle of the strip.
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-selected="true"]');
    if (!el) return;
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: firstScroll.current ? 'auto' : 'smooth' });
    firstScroll.current = false;
  }, [selected, anchor, data ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── What to draw (all derived from the loaded day + the site filter) ──────
  const view = useMemo(() => {
    if (!data) return null;
    const inSite = (loc) => !site || loc === site;
    const working = [];
    const off = [];
    data.staff.forEach((s, order) => {
      const shifts = s.shifts.filter(sh => inSite(sh.locationId));
      if (shifts.length > 0) working.push({ ...s, shifts, order });
      else if (s.shifts.length === 0 && (!site || !s.homeLocationId || s.homeLocationId === site)) off.push(s);
    });
    working.sort((a, b) => mins(a.shifts[0].start) - mins(b.shifts[0].start) || a.order - b.order);

    const startMin = data.startHour * 60;
    const span = (data.endHour - data.startHour) * 60;
    const hours = Array.from({ length: data.endHour - data.startHour }, (_, i) => data.startHour + i);
    const coverage = hours.map(h => working.filter(s => s.shifts.some(sh => mins(sh.start) <= h * 60 + 30 && mins(sh.end) > h * 60 + 30)).length);
    const roles = [];
    working.forEach(s => s.shifts.forEach(sh => { if (sh.roleCode && !roles.find(r => r.code === sh.roleCode)) roles.push({ code: sh.roleCode, color: sh.roleColor }); }));
    const totalHours = working.reduce((sum, s) => sum + s.shifts.reduce((a, sh) => a + sh.hours, 0), 0);
    return { working, off, startMin, span, hours, coverage, roles, totalHours };
  }, [data, site]);

  // ── Early states ──────────────────────────────────────────────────────────
  if (fatal) {
    return (
      <Page center>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '30px 24px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
          <p style={{ color: INK, fontWeight: 700, margin: '0 0 6px' }}>Couldn't load the roster</p>
          <p style={{ color: MUTED, fontSize: 13, margin: '0 0 16px' }}>{fatal}</p>
          <button className="rr-btn" onClick={() => window.location.reload()} style={{ border: 'none', borderRadius: 12, background: BLUE, color: 'white', fontSize: 15, fontWeight: 700, padding: '10px 22px' }}>Try again</button>
        </div>
      </Page>
    );
  }
  if (loading) return <Spinner label="Loading the roster…" />;
  if (!data) {
    return <PinPad token={token} busy={pinBusy} error={pinError} locked={locked} onSubmit={submitPin}
      title="Day Roster" subtitle="Enter the roster PIN" icon="👥" hint="Ask your manager for the PIN." />;
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  const isToday = selected === data.today;
  const stripDays = Array.from({ length: STRIP_BEHIND + STRIP_AHEAD + 1 }, (_, i) => addDays(anchor || selected, i - STRIP_BEHIND));
  const nowMins = data.nowMins == null || !isToday ? null : data.nowMins + Math.floor((Date.now() - loadedAt) / 60000);
  const nowPct = nowMins != null && nowMins >= view.startMin && nowMins <= view.startMin + view.span ? ((nowMins - view.startMin) / view.span) * 100 : null;
  const labelStep = view.hours.length <= 9 ? 1 : view.hours.length <= 14 ? 2 : 3;
  void tick; // re-render driver for the now line
  const pct = (m) => `${Math.max(0, Math.min(100, ((m - view.startMin) / view.span) * 100))}%`;

  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) goTo(addDays(selected, dx < 0 ? 1 : -1));
  };

  return (
    <Page>
      <style>{EXTRA_CSS}</style>

      {/* Header */}
      <div style={{ flexShrink: 0, background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, borderRadius: CARD_RADIUS, padding: '11px 14px', boxShadow: '0 10px 24px -12px rgba(59,91,219,0.55)', marginBottom: 10, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: 2 }}>{data.businessName}</div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Day roster</div>
        </div>
        <button className="rr-btn" onClick={signOut} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Sign out</button>
      </div>

      {/* Date picker: title + calendar, then a scrollable day strip */}
      <div style={{ flexShrink: 0, background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 6px 14px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            {isToday && <span style={{ fontSize: 10, fontWeight: 800, color: 'white', background: BLUE, borderRadius: 6, padding: '2px 6px' }}>TODAY</span>}
          </div>
          {!isToday && (
            <button className="rr-btn" onClick={() => goTo(data.today)} style={{ border: `1px solid #DBE4FF`, background: '#EEF2FF', color: BLUE, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Today</button>
          )}
          {/* A transparent native date input over the button: taps open the phone's own calendar */}
          <label style={{ position: 'relative', width: 36, height: 36, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
            <span aria-hidden="true">📅</span>
            <input type="date" value={selected} onChange={e => goTo(e.target.value)} aria-label="Pick a date"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
          </label>
        </div>
        <div ref={stripRef} className="rr-strip" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 12px 12px', scrollSnapType: 'x proximity' }}>
          {stripDays.map(key => {
            const sel = key === selected;
            const dow = utc(key).getUTCDay();
            const day = Number(key.slice(8));
            const today = key === data.today;
            return (
              <button key={key} className="rr-btn" data-selected={sel} onClick={() => goTo(key)} aria-label={fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' })}
                style={{
                  flex: '0 0 auto', width: 46, padding: '7px 0 6px', borderRadius: 13, scrollSnapAlign: 'center', position: 'relative',
                  border: sel ? `1px solid ${BLUE}` : '1px solid transparent', background: sel ? BLUE : dow === 0 || dow === 6 ? '#F8FAFC' : 'transparent',
                  color: sel ? 'white' : INK, boxShadow: sel ? '0 6px 14px -6px rgba(59,91,219,0.6)' : 'none',
                }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: sel ? 0.85 : 1, color: sel ? 'white' : today ? BLUE : FAINT }}>{fmtDate(key, { weekday: 'short' })}</div>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, color: sel ? 'white' : today ? BLUE : INK }}>{day}</div>
                <div style={{ fontSize: 9, fontWeight: 700, height: 11, color: sel ? 'rgba(255,255,255,0.8)' : FAINT, textTransform: 'uppercase' }}>{day === 1 ? fmtDate(key, { month: 'short' }) : today && !sel ? '•' : ''}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Site filter -- only when there's more than one site */}
      {data.locations.length > 1 && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }} className="rr-strip">
          {[{ id: '', name: 'All sites' }, ...data.locations].map(l => (
            <button key={l.id || 'all'} className="rr-btn" onClick={() => setSite(l.id)} style={{
              flex: '0 0 auto', padding: '6px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              border: `1px solid ${site === l.id ? BLUE : '#E2E8F0'}`, background: site === l.id ? BLUE : 'white', color: site === l.id ? 'white' : MUTED,
            }}>{l.name}</button>
          ))}
        </div>
      )}

      {/* The day's roster */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, opacity: fetching ? 0.55 : 1, transition: 'opacity 0.15s' }}>
        {/* Time axis */}
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'white', borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', height: 28 }}>
          <div style={{ width: LABEL_W, flexShrink: 0, padding: '0 0 0 14px', display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: FAINT }}>
            {view.working.length} on · {Number.isInteger(view.totalHours) ? view.totalHours : view.totalHours.toFixed(1)}h
          </div>
          <div style={{ flex: 1, position: 'relative', marginRight: TRACK_PAD }}>
            {view.hours.map((h, i) => i % labelStep === 0 && (
              <span key={h} style={{ position: 'absolute', left: `${(i / view.hours.length) * 100}%`, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600, color: FAINT, transform: 'translateX(-2px)' }}>{hourLabel(h)}</span>
            ))}
          </div>
        </div>

        {view.working.length === 0 ? (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: FAINT, fontSize: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🌤️</div>
            Nobody's rostered {isToday ? 'today' : 'on this day'}{site ? ' at this site' : ''}.
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Hour gridlines + "now" line, spanning all rows */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: LABEL_W, right: TRACK_PAD, pointerEvents: 'none',
              backgroundImage: `repeating-linear-gradient(90deg, ${HAIRLINE} 0, ${HAIRLINE} 1px, transparent 1px, transparent ${100 / view.hours.length}%)` }}>
              {nowPct != null && (
                <div style={{ position: 'absolute', left: `${nowPct}%`, top: 0, bottom: 0, width: 2, background: RED, zIndex: 3, borderRadius: 1 }}>
                  <div style={{ position: 'absolute', top: -3, left: -3, width: 8, height: 8, borderRadius: '50%', background: RED }} />
                </div>
              )}
            </div>

            {view.working.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', height: ROW_H, borderBottom: `1px solid ${HAIRLINE}`, background: i % 2 ? 'rgba(248,250,252,0.7)' : 'transparent', position: 'relative' }}>
                <div style={{ width: LABEL_W, flexShrink: 0, padding: '0 6px 0 14px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 10.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.shifts.map(sh => shortRange(sh.start, sh.end)).join(' · ')}
                  </div>
                </div>
                <div style={{ flex: 1, position: 'relative', height: '100%', marginRight: TRACK_PAD }}>
                  {s.shifts.map((sh, k) => (
                    <div key={k} style={{
                      position: 'absolute', top: 11, height: ROW_H - 22, left: pct(mins(sh.start)), width: `calc(${pct(mins(sh.end))} - ${pct(mins(sh.start))})`, minWidth: 4,
                      background: sh.roleColor || BLUE, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.18)',
                    }}>{sh.roleCode}</div>
                  ))}
                </div>
              </div>
            ))}

            {/* Coverage: how many people are on each hour */}
            <div style={{ display: 'flex', alignItems: 'center', height: 30, background: '#FAFBFD' }}>
              <div style={{ width: LABEL_W, flexShrink: 0, padding: '0 0 0 14px', fontSize: 10.5, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On shift</div>
              <div style={{ flex: 1, display: 'flex', marginRight: TRACK_PAD }}>
                {view.coverage.map((n, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: n === 0 ? '#CBD5E1' : '#475569' }}>{n}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view.roles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '10px 14px 4px' }}>
            {view.roles.map(r => (
              <span key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: MUTED }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color || BLUE }} />{r.code}
              </span>
            ))}
          </div>
        )}

        {view.off.length > 0 && (
          <div style={{ padding: '10px 14px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Not rostered · {view.off.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {view.off.map(s => {
                const av = s.availability;
                const tone = av ? (av.kind === 'partial' ? ['#FFFBEB', '#FDE68A', AMBER_INK] : ['#FEF2F2', '#FECACA', RED]) : ['#F8FAFC', '#E8EDF3', MUTED];
                return (
                  <span key={s.id} title={av?.note || undefined} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: tone[0], border: `1px solid ${tone[1]}`, color: tone[2] }}>
                    {s.name}
                    {av && <span style={{ fontWeight: 500, opacity: 0.85 }}> · {av.kind === 'partial' ? fmtWindow(av.from, av.to) : 'unavailable'}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, textAlign: 'center', fontSize: 11, color: '#B5BEC9', fontWeight: 500, paddingTop: 8, fontFamily: FONT }}>
        <a href={`/hub/${token}`} style={{ color: FAINT, textDecoration: 'none', fontWeight: 600 }}>← Hub</a> · Powered by Recess Roster
      </div>
    </Page>
  );
}
