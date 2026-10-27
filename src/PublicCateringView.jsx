import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const ROSE = '#BE185D';
const ROSE_DK = '#9D174D';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const TYPE_DOT = {
  'Breakfast':     '#D97706',
  'Morning Tea':   '#2563EB',
  'Lunch':         ROSE,
  'Afternoon Tea': '#7C3AED',
  'Other':         '#64748B',
};
const PACKAGING_LABEL = { none: 'Pieces', roll: 'Roll', slab: 'Slab' };
const DIETARY_FIELDS = [
  { key: 'gf_ppl',         label: 'GF' },
  { key: 'vego_ppl',       label: 'Vego' },
  { key: 'pb_ppl',         label: 'Plant-Based' },
  { key: 'dairy_free_ppl', label: 'Dairy Free' },
  { key: 'halal_ppl',      label: 'Halal' },
];
const STATUS_FIELDS = [
  { key: 'confirmed',       label: 'Confirmed' },
  { key: 'bread_ordered',   label: 'Bread Ordered' },
  { key: 'delivery_booked', label: 'Delivery Booked' },
];

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return fmtISO(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmtISO(d);
}
function dayLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase();
}
function dayAbbrev(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase();
}
function dayNum(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDate();
}
function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}
// Monday-based start-of-week for a date string.
function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dow);
  return fmtISO(d);
}
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const gridStart = new Date(year, month, 1 - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}
function computeTotalPieces(platterSize, piecesPerPerson) {
  const p = Number(platterSize);
  const pp = Number(piecesPerPerson);
  if (!p || !pp) return null;
  return Math.round(p * pp);
}

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';

function Tag({ children, bg = '#F1F5F9', fg = '#475569' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600,
      padding: '4px 9px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function StatTile({ label, value, highlight }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', borderRadius: 10, padding: '8px 6px',
      background: highlight ? '#FDF2F8' : '#FAFBFC', border: highlight ? 'none' : '1px solid #F1F5F9',
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: highlight ? ROSE_DK : '#1E293B' }}>{value}</div>
    </div>
  );
}

// `showDate`, when true, swaps the leading ready-by column for a day
// badge (used in the week list, where jobs span several different days)
// and moves ready-by into the subtitle line instead.
function JobCard({ job, expanded, onToggle, showDate }) {
  const dotColor = TYPE_DOT[job.job_type] || TYPE_DOT.Other;
  const totalPieces = computeTotalPieces(job.platter_size, job.pieces_per_person);
  const dietaryTags = DIETARY_FIELDS.filter(f => job[f.key] > 0);
  const itemsTotal = (job.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0);
  const subtitle = [job.contact, job.job_type, showDate ? job.ready_by : null].filter(Boolean).join(' · ');

  return (
    <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px',
          background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
        }}
      >
        {showDate ? (
          <div style={{ width: 34, flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.04em' }}>{dayAbbrev(job.job_date)}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>{dayNum(job.job_date)}</div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', width: 46, flexShrink: 0 }}>{job.ready_by || '—'}</div>
        )}
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.company || 'Untitled job'}</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{subtitle}</div>
        </div>
        <span style={{ fontSize: 16, color: '#CBD5E1', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {job.platter_size ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <StatTile label="Platter Size" value={`${job.platter_size} ppl`} />
              <StatTile label="Pieces / Person" value={job.pieces_per_person ?? '—'} />
              <StatTile label="Total Pieces" value={totalPieces ?? '—'} highlight />
            </div>
          ) : null}

          {(job.breakfast_ppl > 0 || job.coffee_ppl > 0 || job.salads || dietaryTags.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.breakfast_ppl > 0 && <Tag>Breakfast: {job.breakfast_ppl} ppl</Tag>}
              {job.coffee_ppl > 0 && <Tag>Coffee: {job.coffee_ppl} ppl</Tag>}
              {job.salads && <Tag>Salads: {job.salads}</Tag>}
              {dietaryTags.map(f => (
                <Tag key={f.key} bg="#FDF2F8" fg={ROSE_DK}>{f.label}: {job[f.key]}</Tag>
              ))}
            </div>
          )}

          {job.items && job.items.length > 0 && (
            <div style={{ borderRadius: 10, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
              <div style={{ padding: '6px 10px', fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#FAFBFC' }}>
                Menu Breakdown
              </div>
              {job.items.map((it, i) => {
                const unitLabel = PACKAGING_LABEL[it.packaging];
                const showUnits = it.packaging && it.packaging !== 'none' && it.unit_qty != null && it.unit_qty !== '';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '7px 10px', fontSize: 13, borderTop: '1px solid #F8FAFC' }}>
                    <span style={{ color: '#334155' }}>{it.name}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      {showUnits && <span style={{ fontSize: 11, color: '#94A3B8' }}>{it.unit_qty} {unitLabel.toLowerCase()}{it.unit_qty === 1 ? '' : 's'}</span>}
                      <span style={{ fontWeight: 700, color: '#1E293B' }}>{it.pieces}</span>
                    </span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontSize: 12.5, background: '#FAFBFC', fontWeight: 700 }}>
                <span style={{ color: '#64748B' }}>Total pieces</span>
                <span style={{ color: '#1E293B' }}>{itemsTotal}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 5, fontSize: 12, color: '#64748B' }}>
            {job.company && <div>🏢 {job.company}</div>}
            {job.contact && <div>👤 {job.contact}</div>}
            {job.address && <div>📍 {job.address}</div>}
            {job.delivery_method && <div>🚚 {job.delivery_method}</div>}
            {job.ready_by && <div>🕒 Pick-Up Time: {job.ready_by}</div>}
            {job.deliver_by && <div>📦 Deliver By: {job.deliver_by}</div>}
          </div>

          {job.notes && (
            <div style={{ fontSize: 12.5, color: '#475569', background: '#FAFBFC', borderRadius: 10, padding: '9px 11px', whiteSpace: 'pre-wrap' }}>
              {job.notes}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid #F8FAFC' }}>
            {STATUS_FIELDS.map(f => (
              <Tag key={f.key} bg={job[f.key] ? '#DCFCE7' : '#F1F5F9'} fg={job[f.key] ? '#15803D' : '#94A3B8'}>
                {job[f.key] ? '✓' : '—'} {f.label}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Full-screen month calendar -- tapping a date hands it back via
// onSelectDate and lets the caller decide what to do (switch to day view).
// Dots mark every date with at least one job, computed from the same
// full job list the week view uses, so no extra fetch is needed as the
// user pages between months.
function CalendarOverlay({ year, month, onMonthChange, selectedDate, jobCountByDate, onSelectDate, onClose }) {
  const days = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayKey = todayStr();

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F1F5F9', zIndex: 50, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <div style={{ background: ROSE, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Calendar</span>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 999, width: 30, height: 30, fontSize: 15, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => onMonthChange(-1)} style={{ background: 'none', border: 'none', color: ROSE, fontSize: 20, padding: '4px 10px', cursor: 'pointer' }}>‹</button>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{monthLabel(year, month)}</span>
              <button onClick={() => onMonthChange(1)} style={{ background: 'none', border: 'none', color: ROSE, fontSize: 20, padding: '4px 10px', cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {days.map((d, i) => {
                const key = fmtISO(d);
                const inMonth = d.getMonth() === month;
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                const count = jobCountByDate.get(key) || 0;
                return (
                  <button
                    key={i}
                    onClick={() => onSelectDate(key)}
                    style={{
                      position: 'relative', aspectRatio: '1', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', borderRadius: 10, fontSize: 13, border: 'none',
                      cursor: 'pointer', fontFamily: FONT,
                      color: !inMonth ? '#D1D5DB' : isSelected ? 'white' : isToday ? ROSE_DK : '#374151',
                      background: isSelected ? ROSE : isToday ? '#FDF2F8' : 'transparent',
                      fontWeight: isToday || isSelected ? 700 : 400,
                    }}
                  >
                    {d.getDate()}
                    {count > 0 && (
                      <span style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'white' : ROSE }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => onSelectDate(todayStr())}
            style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: ROSE_DK, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Jump to Today
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicCateringView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // `view` is 'week' (default -- this week's jobs, like the desktop app's
  // feed) or 'day' (a single date, reached via the calendar or a deep
  // link like the catering-alert emails' "View this job" button).
  const [view, setView] = useState(() => (new URLSearchParams(window.location.search).get('d') ? 'day' : 'week'));
  const [selectedDate, setSelectedDate] = useState(() => new URLSearchParams(window.location.search).get('d') || todayStr());
  const [expandedId, setExpandedId] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calDate, setCalDate] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-catering', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load catering jobs.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Keep the URL's ?d= in sync with day view, so the page stays
  // shareable/bookmarkable and a browser refresh lands back where it was.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (view === 'day') params.set('d', selectedDate);
    else params.delete('d');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [view, selectedDate]);

  const allJobs = useMemo(() => data?.jobs || [], [data]);

  const jobCountByDate = useMemo(() => {
    const m = new Map();
    allJobs.forEach(j => m.set(j.job_date, (m.get(j.job_date) || 0) + 1));
    return m;
  }, [allJobs]);

  const thisWeekStart = useMemo(() => startOfWeek(todayStr()), []);
  const thisWeekEnd = useMemo(() => addDays(thisWeekStart, 6), [thisWeekStart]);
  const weekJobs = useMemo(
    () => allJobs.filter(j => j.job_date >= thisWeekStart && j.job_date <= thisWeekEnd),
    [allJobs, thisWeekStart, thisWeekEnd]
  );
  const dayJobs = useMemo(() => allJobs.filter(j => j.job_date === selectedDate), [allJobs, selectedDate]);

  const visibleJobs = view === 'day' ? dayJobs : weekJobs;

  // Auto-expand the single relevant job on a deep-linked day view --
  // someone tapping an email's "View this job" link wants the details
  // immediately, not another tap. Week view starts fully collapsed since
  // it can span several jobs across several days.
  useEffect(() => {
    if (view === 'day' && dayJobs.length) setExpandedId(prev => prev ?? dayJobs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, data]);

  function openDay(dateStr) {
    setSelectedDate(dateStr);
    setView('day');
    setExpandedId(null);
    setCalendarOpen(false);
  }
  function backToWeek() {
    setView('week');
    setExpandedId(null);
  }
  function openCalendar() {
    setCalDate(new Date((view === 'day' ? selectedDate : todayStr()) + 'T12:00:00'));
    setCalendarOpen(true);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: ROSE,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading catering jobs…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load catering jobs</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: FONT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: ROSE, borderRadius: '16px 16px 0 0', padding: '20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {data.businessName}
            </div>
            <a
              href={`/hub/${token}`}
              style={{
                color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999, flexShrink: 0,
              }}
            >
              🏠 Home
            </a>
          </div>
          <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            Catering
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            {view === 'day'
              ? `${dayLabel(selectedDate)} · ${fmtDateShort(selectedDate)}`
              : `This Week · ${fmtDateShort(thisWeekStart)} – ${fmtDateShort(thisWeekEnd)}`}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ background: '#FDF2F8', borderLeft: '1px solid #FBCFE8', borderRight: '1px solid #FBCFE8', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {view === 'day' ? (
            <button onClick={backToWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ROSE_DK, fontSize: 12.5, fontWeight: 700, padding: '6px 4px' }}>
              ← This Week
            </button>
          ) : (
            <span style={{ fontSize: 12, color: ROSE_DK, fontWeight: 600, padding: '6px 4px' }}>read-only</span>
          )}
          <button
            onClick={openCalendar}
            style={{
              background: ROSE, color: 'white', border: 'none', borderRadius: 999, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📅 View Calendar
          </button>
        </div>

        <div style={{ background: '#F1F5F9', border: '1px solid transparent', borderTop: 'none', padding: '14px 0 4px' }}>
          {visibleJobs.length === 0 ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              {view === 'day' ? 'No catering jobs on this day.' : 'No catering jobs this week.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  showDate={view === 'week'}
                  expanded={expandedId === job.id}
                  onToggle={() => setExpandedId(prev => prev === job.id ? null : job.id)}
                />
              ))}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>

      {calendarOpen && (
        <CalendarOverlay
          year={calDate.getFullYear()}
          month={calDate.getMonth()}
          onMonthChange={(delta) => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))}
          selectedDate={view === 'day' ? selectedDate : null}
          jobCountByDate={jobCountByDate}
          onSelectDate={openDay}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}
