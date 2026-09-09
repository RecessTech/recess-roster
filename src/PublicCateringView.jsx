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
function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
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

function JobCard({ job, expanded, onToggle }) {
  const dotColor = TYPE_DOT[job.job_type] || TYPE_DOT.Other;
  const totalPieces = computeTotalPieces(job.platter_size, job.pieces_per_person);
  const dietaryTags = DIETARY_FIELDS.filter(f => job[f.key] > 0);
  const itemsTotal = (job.items || []).reduce((s, it) => s + (Number(it.pieces) || 0), 0);

  return (
    <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px',
          background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', width: 46, flexShrink: 0 }}>{job.ready_by || '—'}</div>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.company || 'Untitled job'}</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{[job.contact, job.job_type].filter(Boolean).join(' · ')}</div>
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

export default function PublicCateringView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('d') || todayStr();
  });
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-catering', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, date: d },
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('d', date);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    load(date);
    setExpandedId(null);
  }, [date, load]);

  // First job open by default -- most days have one or two jobs, and
  // someone tapping this link on their phone wants the details now, not
  // another tap first.
  useEffect(() => {
    if (data?.jobs?.length) setExpandedId(prev => prev ?? data.jobs[0].id);
  }, [data]);

  const jobs = useMemo(() => data?.jobs || [], [data]);

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
            {dayLabel(date)} · {fmtDateShort(date)}
          </div>
        </div>

        {/* Date navigation */}
        <div style={{ background: '#FDF2F8', borderLeft: '1px solid #FBCFE8', borderRight: '1px solid #FBCFE8', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setDate(d => addDays(d, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ROSE, fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>←</button>
          <span style={{ fontSize: 12, color: ROSE_DK, fontWeight: 600 }}>read-only</span>
          <button onClick={() => setDate(d => addDays(d, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ROSE, fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>→</button>
        </div>

        <div style={{ background: '#F1F5F9', border: '1px solid transparent', borderTop: 'none', padding: '14px 0 4px' }}>
          {jobs.length === 0 ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No catering jobs on this day.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
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
    </div>
  );
}
