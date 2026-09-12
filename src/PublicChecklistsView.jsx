import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const INDIGO = '#4F46E5';
const INDIGO_DK = '#3730A3';
const NAME_STORAGE_KEY = 'checklists_yourName';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function loadStoredName() {
  try { return localStorage.getItem(NAME_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeName(name) {
  try { localStorage.setItem(NAME_STORAGE_KEY, name); } catch { /* private browsing etc. -- fine to skip */ }
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

// iOS Safari auto-zooms the whole page on focus for any text input under
// 16px -- 16px avoids it without disabling pinch-zoom.
const inputStyle = {
  width: '100%', fontSize: 16, padding: '11px 12px', borderRadius: 10,
  border: '1px solid #E5E9EF', color: '#1E293B', fontFamily: 'inherit', boxSizing: 'border-box',
  background: '#FAFBFC',
};
const labelStyle = { fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };
const tileStyle = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '18px 18px',
  border: 'none', cursor: 'pointer', marginBottom: 10, fontFamily: FONT,
};

// Staff-facing, no login: work through today's opening or closing
// checklist for a site and sign off with a typed name. See
// supabase/functions/public-checklists -- writes carry no real identity,
// just whatever name someone types in below. One run per site+type+day,
// keyed to the org's local timezone so it resets at actual local
// midnight; ticking items is optional before signing off -- this is a
// record of what happened, not a gate that blocks closing the shop.

export default function PublicChecklistsView({ token }) {
  const [sites, setSites] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [siteId, setSiteId] = useState(null);
  const [type, setType] = useState(null); // null | 'opening' | 'closing'

  const [checklist, setChecklist] = useState(null); // { site, run, runItems, handoff }
  const [checklistLoading, setChecklistLoading] = useState(false);

  const [name, setName] = useState(loadStoredName);
  const [notes, setNotes] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  const [signOffError, setSignOffError] = useState(null);

  const call = useCallback(async (body) => {
    const { data, error: err } = await supabase.functions.invoke('public-checklists', {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
      body: { token, ...body },
    });
    if (err) throw new Error(err.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [token]);

  useEffect(() => {
    setLoading(true);
    call({}).then(result => {
      setBusinessName(result.businessName || 'Daily Checklists');
      setSites(result.sites || []);
    }).catch(e => setError(e.message || 'Unable to load checklists.')).finally(() => setLoading(false));
  }, [call]);

  const loadChecklist = useCallback(async (site, checklistType) => {
    setChecklistLoading(true);
    setSignOffError(null);
    try {
      const result = await call({ action: 'get_checklist', siteId: site, type: checklistType });
      setChecklist(result);
      setNotes(result.run?.notes || '');
    } catch (e) {
      setError(e.message || 'Unable to load this checklist.');
    } finally {
      setChecklistLoading(false);
    }
  }, [call]);

  function openChecklist(site, checklistType) {
    setSiteId(site);
    setType(checklistType);
    loadChecklist(site, checklistType);
  }

  function goBack() {
    setSiteId(null);
    setType(null);
    setChecklist(null);
    setError(null);
  }

  async function toggleItem(item) {
    const nextChecked = !item.checked;
    setChecklist(c => ({
      ...c,
      runItems: c.runItems.map(i => i.id === item.id ? { ...i, checked: nextChecked, checked_at: nextChecked ? new Date().toISOString() : null } : i),
    }));
    try {
      await call({ action: 'toggle_item', runItemId: item.id, checked: nextChecked });
    } catch (e) {
      // Revert on failure -- the optimistic flip above didn't actually save.
      setChecklist(c => ({
        ...c,
        runItems: c.runItems.map(i => i.id === item.id ? { ...i, checked: item.checked, checked_at: item.checked_at } : i),
      }));
      setError(e.message || 'Could not save that -- try again.');
    }
  }

  function handleNameChange(v) {
    setName(v);
    storeName(v);
  }

  async function signOff() {
    if (!name.trim()) { setSignOffError('Enter your name to sign off.'); return; }
    setSigningOff(true);
    setSignOffError(null);
    try {
      await call({ action: 'sign_off', runId: checklist.run.id, name, notes: type === 'closing' ? notes : undefined });
      await loadChecklist(siteId, type);
    } catch (e) {
      setSignOffError(e.message || 'Could not sign off -- try again.');
    } finally {
      setSigningOff(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: INDIGO,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !checklist) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load this page</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  // ── Screen 1: pick a site ─────────────────────────────────────────────
  if (!siteId) {
    return (
      <Shell businessName={businessName} title="Daily Checklists" subtitle="Pick a site">
        {(sites || []).length === 0 ? (
          <EmptyCard text="No sites have a checklist set up yet." />
        ) : sites.map(s => (
          <button key={s.id} onClick={() => setSiteId(s.id)} style={tileStyle}>
            <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 15 }}>{s.name}</span>
            <span style={{ color: INDIGO }}>→</span>
          </button>
        ))}
      </Shell>
    );
  }

  // ── Screen 2: pick opening or closing ───────────────────────────────
  if (!type) {
    const site = sites.find(s => s.id === siteId);
    return (
      <Shell businessName={businessName} title={site?.name || 'Checklists'} subtitle="Opening or closing?" onBack={goBack}>
        <button onClick={() => openChecklist(siteId, 'opening')} style={tileStyle}>
          <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 15 }}>☀️ Opening Checklist</span>
          <span style={{ color: INDIGO }}>→</span>
        </button>
        <button onClick={() => openChecklist(siteId, 'closing')} style={tileStyle}>
          <span style={{ fontWeight: 700, color: '#1E293B', fontSize: 15 }}>🌙 Closing Checklist</span>
          <span style={{ color: INDIGO }}>→</span>
        </button>
      </Shell>
    );
  }

  // ── Screen 3: the checklist itself ──────────────────────────────────
  const site = sites.find(s => s.id === siteId);
  const signedOff = !!checklist?.run?.signed_off_at;
  const checkedCount = checklist?.runItems?.filter(i => i.checked).length || 0;
  const totalCount = checklist?.runItems?.length || 0;

  return (
    <Shell
      businessName={businessName}
      title={`${site?.name || ''} · ${type === 'opening' ? 'Opening' : 'Closing'}`}
      subtitle={checklistLoading ? 'Loading…' : `${checkedCount} of ${totalCount} done`}
      onBack={() => setType(null)}
    >
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', color: '#B91C1C', fontSize: 12.5, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {checklist?.handoff && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: CARD_RADIUS, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Note from last close{checklist.handoff.signed_off_by_name ? ` (${checklist.handoff.signed_off_by_name})` : ''}
          </div>
          <div style={{ fontSize: 13.5, color: '#78350F', whiteSpace: 'pre-wrap' }}>{checklist.handoff.notes}</div>
        </div>
      )}

      {signedOff && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: CARD_RADIUS, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>
              Signed off by {checklist.run.signed_off_by_name}
            </div>
            <div style={{ fontSize: 11.5, color: '#4D7C58' }}>{formatTime(checklist.run.signed_off_at)}</div>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, marginBottom: 14, overflow: 'hidden' }}>
        {(checklist?.runItems || []).map((item, idx) => (
          <button
            key={item.id}
            onClick={() => toggleItem(item)}
            style={{
              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
              padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              borderTop: idx === 0 ? 'none' : '1px solid #F1F5F9', fontFamily: FONT,
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              border: item.checked ? 'none' : '2px solid #E2E8F0',
              background: item.checked ? INDIGO : 'white', color: 'white',
            }}>
              {item.checked ? '✓' : ''}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: item.checked ? '#94A3B8' : '#1E293B', textDecoration: item.checked ? 'line-through' : 'none' }}>
                {item.name}
              </div>
              {item.details && (
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, lineHeight: 1.4 }}>{item.details}</div>
              )}
            </span>
          </button>
        ))}
      </div>

      {type === 'closing' && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Notes for the next opener (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything the opener should know -- e.g. a fridge acting up, low on something…"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      )}

      <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: 16 }}>
        <label style={labelStyle}>Your name</label>
        <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Type your name" style={{ ...inputStyle, marginBottom: 12 }} />
        {signOffError && <div style={{ color: '#B91C1C', fontSize: 12.5, marginBottom: 10 }}>{signOffError}</div>}
        <button
          onClick={signOff}
          disabled={signingOff}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: signingOff ? 'default' : 'pointer',
            background: signingOff ? '#C7D2FE' : INDIGO, color: 'white', fontWeight: 700, fontSize: 14.5, fontFamily: FONT,
          }}
        >
          {signingOff ? 'Signing off…' : signedOff ? 'Update sign-off' : 'Sign off'}
        </button>
      </div>
    </Shell>
  );
}

function EmptyCard({ text }) {
  return (
    <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '28px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13.5, fontFamily: FONT }}>
      {text}
    </div>
  );
}

function Shell({ businessName, title, subtitle, onBack, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8', padding: '16px 12px 32px', fontFamily: FONT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{
          background: `linear-gradient(135deg, ${INDIGO}, ${INDIGO_DK})`, borderRadius: CARD_RADIUS,
          padding: '22px 20px 20px', boxShadow: '0 10px 24px -10px rgba(79,70,229,0.5)', marginBottom: 16,
        }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700, padding: 0, marginBottom: 10, cursor: 'pointer', fontFamily: FONT }}>
              ← Back
            </button>
          )}
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {businessName}
          </div>
          <div style={{ color: 'white', fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500, marginTop: 3 }}>{subtitle}</div>
          )}
        </div>

        {children}

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}
