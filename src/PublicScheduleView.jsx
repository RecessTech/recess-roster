import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Group sorted time slots into { start, end } shift blocks
function slotsToShifts(slots) {
  if (!slots || slots.length === 0) return [];
  const shifts = [];
  let current = null;
  for (const slot of slots) {
    if (!current) {
      current = { start: slot, end: slot };
    } else {
      const [ph, pm] = current.end.split(':').map(Number);
      const [ch, cm] = slot.split(':').map(Number);
      if ((ch * 60 + cm) - (ph * 60 + pm) === 15) {
        current.end = slot;
      } else {
        shifts.push(current);
        current = { start: slot, end: slot };
      }
    }
  }
  if (current) shifts.push(current);
  return shifts;
}

function addMins(slot, mins) {
  const [h, m] = slot.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

function shiftWeek(weekStart, delta) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split('T')[0];
}

function weekLabel(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const startStr = start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export default function PublicScheduleView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekStart, setWeekStart] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('w') || getMondayOfWeek(new Date());
  });

  const load = useCallback(async (week) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-schedule', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, weekStart: week },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load schedule.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('w', weekStart);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    load(weekStart);
  }, [weekStart, load]);

  const navigate = (delta) => setWeekStart(w => shiftWeek(w, delta));

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#3B5BDB',
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>Loading roster…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 600, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Couldn't load schedule</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalHours = data.days.reduce((sum, day) => {
    const shifts = slotsToShifts(day.slots);
    return sum + shifts.reduce((s, sh) => {
      const [sh_h, sh_m] = sh.start.split(':').map(Number);
      const [eh, em] = sh.end.split(':').map(Number);
      return s + ((eh * 60 + em) - (sh_h * 60 + sh_m) + 15) / 60;
    }, 0);
  }, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: '#3B5BDB', borderRadius: '12px 12px 0 0', padding: '22px 24px' }}>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            {data.businessName}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            {data.staffName}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            {weekLabel(weekStart)}
          </div>
        </div>

        {/* Week navigation */}
        <div style={{ background: '#EEF2FF', borderLeft: '1px solid #C7D2FE', borderRight: '1px solid #C7D2FE', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B5BDB', fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>←</button>
          <span style={{ fontSize: 12, color: '#4338CA', fontWeight: 600 }}>
            {totalHours > 0 ? `${totalHours.toFixed(1)}h this week` : 'No shifts this week'}
          </span>
          <button onClick={() => navigate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B5BDB', fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>→</button>
        </div>

        {/* Schedule rows */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {data.days.map((day, i) => {
            const shifts = slotsToShifts(day.slots);
            const isOff = shifts.length === 0;
            const isLast = i === data.days.length - 1;
            return (
              <div key={day.dateKey} style={{
                display: 'flex', alignItems: 'center', padding: '13px 16px',
                borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                background: day.isWeekend ? '#FAFBFF' : 'white',
              }}>
                <div style={{ width: 90, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isOff ? '#94A3B8' : '#1E293B' }}>
                    {day.label.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    {day.label.split(' ').slice(1).join(' ')}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {isOff ? (
                    <span style={{ fontSize: 13, color: '#CBD5E1', fontStyle: 'italic' }}>Off</span>
                  ) : (
                    shifts.map((sh, si) => (
                      <div key={si} style={{ fontSize: 13, color: '#334155', fontFamily: '"Courier New", monospace', marginBottom: si < shifts.length - 1 ? 3 : 0 }}>
                        {sh.start} – {addMins(sh.end, 15)}
                      </div>
                    ))
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {!isOff && shifts.map((sh, si) => {
                    const [sh_h, sh_m] = sh.start.split(':').map(Number);
                    const [eh, em] = sh.end.split(':').map(Number);
                    const hrs = ((eh * 60 + em) - (sh_h * 60 + sh_m) + 15) / 60;
                    return (
                      <div key={si} style={{ fontSize: 13, fontWeight: 700, color: '#3B5BDB', marginBottom: si < shifts.length - 1 ? 3 : 0 }}>
                        {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}h
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}
