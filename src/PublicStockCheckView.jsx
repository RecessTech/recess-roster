import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const NAME_STORAGE_KEY = 'stockCheck_yourName';

// R-Shift's own brand system -- the same tokens used across every R-Shift
// email (send-schedule-email, send-order-status-email): blue gradient
// header with the app logo, a white card with a closing tinted accent
// strip, and the same status palette the order-status email already uses
// for good/warn/bad. Rooted in that real source rather than inventing a
// new look, so this reads as one consistent product instead of each
// screen (or each staff page) picking its own aesthetic.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
const BODY_BG = '#F1F5F9';
const CARD_BORDER = '#E2E8F0';
const ROW_BORDER = '#F1F5F9';
const TEXT_PRIMARY = '#1E293B';
const TEXT_SECONDARY = '#334155';
const TEXT_MUTED = '#64748B';
const TEXT_FAINT = '#94A3B8';
const LABEL_BG = '#F8FAFC';
const ACCENT_BG = '#EEF2FF';
const ACCENT_BORDER = '#C7D2FE';
const ACCENT_TEXT = '#3730A3';
const GOOD = '#0f9d4e';
const GOOD_BG = '#EAF7EF';
const WARN = '#B45309';
const WARN_BG = '#FFFBEB';
const BAD = '#d0393b';
const BAD_BG = '#FDECEC';
const LOGO_URL = '/logo192.png';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const LEVELS = [
  { key: 'ok',         label: 'Stocked',     color: GOOD, bg: GOOD_BG },
  { key: 'low',        label: 'Running Low', color: WARN, bg: WARN_BG },
  { key: 'order_soon', label: 'Urgent',      color: BAD,  bg: BAD_BG },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map(l => [l.key, l.label]));

// Maps a stock_items category code onto a human label -- same mapping as
// CateringApp's stockCategoryLabel, duplicated here since this view ships
// standalone (no shared import graph with the rest of the app).
const CATEGORY_LABELS = {
  PTN: 'Protein', PHF: 'Produce & Fresh Herbs', DRY: 'Dry Goods & Grocery',
  DAI: 'Dairy', BEV: 'Beverage', FZN: 'Frozen', PCK: 'Packaging', SNK: 'Snacks', CLN: 'Cleaning',
};
function categoryLabel(code) {
  return CATEGORY_LABELS[code] || code || 'Uncategorized';
}

// Groups a long checklist into labelled category sections instead of one
// undifferentiated wall of items -- sorts by category (stable within each
// category, so admin-curated ordering survives) and marks the first row
// of each cluster so the caller can render a divider there.
function withCategoryDividers(items) {
  const sorted = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const ca = a.item.category || '';
      const cb = b.item.category || '';
      return ca === cb ? a.i - b.i : ca.localeCompare(cb);
    })
    .map(x => x.item);
  let prevCategory = null;
  return sorted.map((item, idx) => {
    const cat = item.category || '';
    const isNewCategory = idx === 0 || cat !== prevCategory;
    prevCategory = cat;
    return { item, isNewCategory, category: cat };
  });
}

// A pseudo-group id for "flag anything" sessions that don't start from an
// admin-curated list at all -- selecting it jumps straight to an empty
// checklist that's built entirely out of searched-and-added items.
const CUSTOM_GROUP_ID = '__custom__';

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function loadStoredName() {
  try { return localStorage.getItem(NAME_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeName(name) {
  try { localStorage.setItem(NAME_STORAGE_KEY, name); } catch { /* private browsing etc. -- fine to skip */ }
}

// iOS Safari auto-zooms the whole page on focus for any text input/select
// under 16px -- 16px avoids it without disabling pinch-zoom.
const inputStyle = {
  width: '100%', fontSize: 16, padding: '11px 14px', fontFamily: FONT,
  borderRadius: 10, border: `1px solid ${CARD_BORDER}`, color: TEXT_PRIMARY, background: LABEL_BG, boxSizing: 'border-box',
};
const eyebrowStyle = {
  fontSize: 10, fontWeight: 700, color: TEXT_FAINT, textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 8, display: 'block',
};
const primaryButtonStyle = (disabled) => ({
  width: '100%', padding: '13px 20px', borderRadius: 11, border: 'none', cursor: disabled ? 'default' : 'pointer',
  background: BRAND, color: '#ffffff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
  opacity: disabled ? 0.55 : 1, boxShadow: disabled ? 'none' : '0 4px 12px -4px rgba(59,91,219,0.45)',
});

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function CheckIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={TEXT_FAINT} strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function PlusIcon({ color = 'currentColor' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function XIcon({ color = 'currentColor' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// Staff-facing, no login: a quick EOD walk through an admin-curated SKU
// group (see R-Stock -> Groups), tapping each item Stocked/Running Low/Urgent, then
// one batch Submit. Writes to the same staff_flag_level signal Transfer
// Hub's old Flag Low Stock used to -- see supabase/functions/public-stock-check.

export default function PublicStockCheckView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState(loadStoredName);

  const [step, setStep] = useState('setup'); // 'setup' | 'checklist' | 'done'
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [levels, setLevels] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [doneSummary, setDoneSummary] = useState(null);
  // Items added by search rather than picked up from the chosen list --
  // lets staff flag any SKU carried at the site, not just what's on a
  // curated list (or, via CUSTOM_GROUP_ID, flag things with no list at all).
  const [extraItems, setExtraItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');

  const load = useCallback(async (extra) => {
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-stock-check', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, ...extra },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
      return result;
    } catch (e) {
      setError(e.message || 'Unable to load Stock Check.');
      throw e;
    }
  }, [token]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!selectedLocationId && data?.locations?.[0]) setSelectedLocationId(data.locations[0].id);
  }, [data, selectedLocationId]);

  function handleNameChange(v) {
    setName(v);
    storeName(v);
  }

  const selectedGroup = useMemo(() => {
    if (selectedGroupId === CUSTOM_GROUP_ID) return { id: CUSTOM_GROUP_ID, name: 'Other Items', items: [] };
    return data?.groups.find(g => g.id === selectedGroupId) || null;
  }, [data, selectedGroupId]);

  // A group's SKUs might not all be carried at every site -- only show
  // ones that actually have a stock_item_sites row at the chosen site.
  const carriedIds = useMemo(() => {
    if (!data || !selectedLocationId) return new Set();
    return new Set(data.siteRows.filter(r => r.location_id === selectedLocationId).map(r => r.item_id));
  }, [data, selectedLocationId]);

  const listItems = useMemo(() => {
    if (!selectedGroup) return [];
    // Stock SKUs only show if actually carried at the chosen site; a
    // prepared component has no such per-site catalog, so it always shows.
    return selectedGroup.items.filter(i => i.kind === 'component' || carriedIds.has(i.id));
  }, [selectedGroup, carriedIds]);

  // The checklist is the chosen list's items plus anything staff has
  // searched for and added on top -- extraItems is never cleared just
  // because it overlaps the list (de-duped here instead).
  const checklistItems = useMemo(() => {
    const listIds = new Set(listItems.map(i => i.id));
    return [...listItems, ...extraItems.filter(i => !listIds.has(i.id))];
  }, [listItems, extraItems]);

  const extraItemIds = useMemo(() => new Set(extraItems.map(i => i.id)), [extraItems]);

  // Search pool for "flag another item": every active SKU carried at the
  // chosen site, minus whatever's already on the checklist.
  const searchResults = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q || !data) return [];
    const onChecklist = new Set(checklistItems.map(i => i.id));
    return (data.items || [])
      .filter(i => carriedIds.has(i.id) && !onChecklist.has(i.id))
      .filter(i => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [itemSearch, data, carriedIds, checklistItems]);

  function addExtraItem(item) {
    setExtraItems(prev => (prev.some(i => i.id === item.id) ? prev : [...prev, item]));
    setLevels(prev => (item.id in prev ? prev : { ...prev, [item.id]: 'ok' }));
    setItemSearch('');
  }

  function removeExtraItem(itemId) {
    setExtraItems(prev => prev.filter(i => i.id !== itemId));
    setLevels(prev => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  // Last-known flag per item at this site, for context only -- staff still
  // has to make an explicit tap, this doesn't pre-fill anything.
  const existingFlagByItem = useMemo(() => {
    const map = new Map();
    if (!data || !selectedLocationId) return map;
    for (const r of data.siteRows) {
      if (r.location_id === selectedLocationId && r.staff_flag_level) map.set(r.item_id, r);
    }
    for (const r of (data.componentSiteRows || [])) {
      if (r.location_id === selectedLocationId && r.staff_flag_level) map.set(r.component_id, r);
    }
    return map;
  }, [data, selectedLocationId]);

  // Everything starts "Stocked" -- staff only need to tap the exceptions
  // (Running Low / Urgent), not confirm every single item one by one.
  const flaggedCount = useMemo(
    () => checklistItems.filter(i => (levels[i.id] || 'ok') !== 'ok').length,
    [checklistItems, levels]
  );

  function startCheck() {
    if (!selectedGroupId || !selectedLocationId) return;
    setLevels(Object.fromEntries(listItems.map(i => [i.id, 'ok'])));
    setExtraItems([]);
    setItemSearch('');
    setSubmitError(null);
    setStep('checklist');
  }

  function setLevel(itemId, level) {
    setLevels(prev => ({ ...prev, [itemId]: level }));
  }

  function changeChecklist() {
    setStep('setup');
    setSelectedGroupId(null);
    setLevels({});
    setExtraItems([]);
    setItemSearch('');
    setSubmitError(null);
  }

  async function handleSubmit() {
    const entries = checklistItems.map(i => ({
      ...(i.kind === 'component' ? { componentId: i.id } : { itemId: i.id }),
      level: levels[i.id] || 'ok',
    }));
    if (entries.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await load({ action: 'submit', locationId: selectedLocationId, name, entries });
      setDoneSummary({
        low: entries.filter(e => e.level === 'low').length,
        orderSoon: entries.filter(e => e.level === 'order_soon').length,
        ok: entries.filter(e => e.level === 'ok').length,
      });
      setStep('done');
    } catch (e) {
      setSubmitError(e.message || 'Could not submit the check.');
    } finally {
      setSubmitting(false);
    }
  }

  function runAnother() {
    setStep('setup');
    setSelectedGroupId(null);
    setLevels({});
    setExtraItems([]);
    setItemSearch('');
    setDoneSummary(null);
    setSubmitError(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${CARD_BORDER}`, borderTopColor: BRAND,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading Stock Check…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
        <div style={{ background: '#ffffff', border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '32px 24px', maxWidth: 340, textAlign: 'center' }}>
          <p style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Couldn't load Stock Check</p>
          <p style={{ color: TEXT_MUTED, fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const subtitle = step === 'checklist'
    ? `${selectedGroup?.name || ''} · ${data.locations.find(l => l.id === selectedLocationId)?.name || ''}`
    : step === 'done'
    ? 'Checklist complete'
    : 'No login required';

  const headerPill = step === 'checklist'
    ? (flaggedCount > 0 ? `${flaggedCount} flagged` : 'All stocked')
    : step === 'done'
    ? 'Done'
    : `${data.groups.length} list${data.groups.length !== 1 ? 's' : ''}`;

  return (
    <div style={{ minHeight: '100vh', background: BODY_BG, padding: '20px 14px 32px', fontFamily: FONT, touchAction: 'manipulation' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Brand header -- same gradient, logo badge and eyebrow label as
            the R-Shift emails, so this reads as the same product. */}
        <div style={{
          background: BRAND, backgroundImage: `linear-gradient(160deg, ${BRAND}, ${BRAND_DARK})`,
          borderRadius: '14px 14px 0 0', padding: '20px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <img src={LOGO_URL} alt="" width={36} height={36} style={{ display: 'block', borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)' }}>R-Shift &middot; Stock Check</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', marginTop: 1 }}>Stock Check</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{
                fontSize: 11.5, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.2)',
                padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
              }}>
                {headerPill}
              </span>
              <a
                href={`/hub/${token}`}
                aria-label="Back to Staff Hub"
                style={{
                  width: 28, height: 28, borderRadius: 999, background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <HomeIcon />
              </a>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 10 }}>{subtitle}</div>
        </div>

        {/* Body card */}
        <div style={{ background: '#ffffff', borderLeft: `1px solid ${CARD_BORDER}`, borderRight: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`, borderRadius: '0 0 14px 14px', padding: '18px 18px 20px' }}>

          {step === 'setup' && (
            <SetupStep
              data={data}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              selectedLocationId={selectedLocationId}
              onSelectLocation={setSelectedLocationId}
              name={name}
              onNameChange={handleNameChange}
              onStart={startCheck}
            />
          )}

          {step === 'checklist' && (
            <ChecklistStep
              items={checklistItems}
              levels={levels}
              onSetLevel={setLevel}
              existingFlagByItem={existingFlagByItem}
              extraItemIds={extraItemIds}
              onRemoveExtra={removeExtraItem}
              itemSearch={itemSearch}
              onItemSearchChange={setItemSearch}
              searchResults={searchResults}
              onAddExtra={addExtraItem}
              flaggedCount={flaggedCount}
              onChangeChecklist={changeChecklist}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitError={submitError}
            />
          )}

          {step === 'done' && (
            <DoneStep summary={doneSummary} onRunAnother={runAnother} />
          )}

        </div>

        <div style={{ textAlign: 'center', padding: '16px 4px 0' }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: BRAND, marginRight: 6, verticalAlign: 'middle' }} />
          <span style={{ fontSize: 11, color: TEXT_FAINT, verticalAlign: 'middle' }}>R-Shift</span>
        </div>
      </div>
    </div>
  );
}

function SetupStep({ data, selectedGroupId, onSelectGroup, selectedLocationId, onSelectLocation, name, onNameChange, onStart }) {
  const hasGroups = data.groups.length > 0;

  return (
    <div>
      <label style={eyebrowStyle}>Which checklist?</label>
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: hasGroups ? 18 : 8, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        {data.groups.map((g, idx) => {
          const active = selectedGroupId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '13px 14px', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', border: 'none',
                borderTop: idx === 0 ? 'none' : `1px solid ${ROW_BORDER}`,
                background: active ? ACCENT_BG : '#ffffff',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY }}>{g.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: TEXT_FAINT, marginTop: 2 }}>{g.items.length} item{g.items.length !== 1 ? 's' : ''}</span>
              </span>
              <span style={{
                width: 24, height: 24, flexShrink: 0, borderRadius: 999,
                background: active ? BRAND : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <CheckIcon size={12} color="#ffffff" />}
              </span>
            </button>
          );
        })}

        {/* Always available, even with no curated lists -- jumps straight
            to an empty checklist built out of searched-and-added items. */}
        {(() => {
          const active = selectedGroupId === CUSTOM_GROUP_ID;
          return (
            <button
              type="button"
              onClick={() => onSelectGroup(CUSTOM_GROUP_ID)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '13px 14px', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', border: 'none',
                borderTop: hasGroups ? `1px solid ${ROW_BORDER}` : 'none',
                background: active ? ACCENT_BG : '#ffffff',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{
                  width: 24, height: 24, flexShrink: 0, borderRadius: 999, background: active ? BRAND : '#F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PlusIcon color={active ? '#ffffff' : TEXT_MUTED} />
                </span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY }}>Other Items</span>
              </span>
              <span style={{ fontSize: 11.5, color: TEXT_FAINT, flexShrink: 0 }}>Search &amp; flag</span>
            </button>
          );
        })()}
      </div>

      {!hasGroups && (
        <div style={{ fontSize: 12, color: TEXT_FAINT, marginBottom: 16 }}>
          No checklists set up yet -- ask an admin to create one in R-Stock &rarr; Groups, or flag items individually above.
        </div>
      )}

      {selectedGroupId && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={eyebrowStyle}>Which site</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.locations.map(loc => {
                const active = selectedLocationId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => onSelectLocation(loc.id)}
                    style={{
                      flex: '1 0 auto', padding: '10px 14px', minHeight: 44, fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                      borderRadius: 10, border: `1px solid ${active ? BRAND : CARD_BORDER}`,
                      background: active ? BRAND : '#ffffff', color: active ? '#ffffff' : TEXT_SECONDARY, cursor: 'pointer',
                    }}
                  >
                    {loc.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={eyebrowStyle}>Your name</label>
            <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="So this check has a name on it" style={inputStyle} />
          </div>

          <button type="button" onClick={onStart} disabled={!selectedLocationId} style={primaryButtonStyle(!selectedLocationId)}>
            Start Check
          </button>
        </>
      )}
    </div>
  );
}

function ChecklistStep({
  items, levels, onSetLevel, existingFlagByItem, extraItemIds, onRemoveExtra,
  itemSearch, onItemSearchChange, searchResults, onAddExtra,
  flaggedCount, onChangeChecklist, onSubmit, submitting, submitError,
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          onClick={onChangeChecklist}
          style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, padding: '4px 0' }}
        >
          &larr; Change checklist
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '18px 10px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: TEXT_MUTED }}>No items yet &mdash; search below to flag one.</div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {withCategoryDividers(items).map(({ item, isNewCategory, category }, idx) => {
            const existing = existingFlagByItem.get(item.id);
            const isExtra = extraItemIds.has(item.id);
            return (
              <React.Fragment key={item.id}>
                {isNewCategory && (
                  <div style={{ padding: idx === 0 ? '0 0 9px' : '20px 0 9px' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {categoryLabel(category)}
                    </span>
                  </div>
                )}
                <div style={{ borderTop: (idx === 0 || isNewCategory) ? 'none' : `1px solid ${ROW_BORDER}`, padding: '13px 0' }}>
                  <div style={{ marginBottom: 9, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY }}>{item.name}</div>
                      <div style={{ fontSize: 11.5, color: TEXT_FAINT, marginTop: 1 }}>
                        {(item.kind === 'component' ? 'Component' : item.sku) ? `${item.kind === 'component' ? 'Component' : item.sku} · ` : ''}{item.uom}
                        {existing && ` · previously ${LEVEL_LABEL[existing.staff_flag_level].toLowerCase()} (${timeAgo(existing.staff_flagged_at)})`}
                      </div>
                    </div>
                    {isExtra && (
                      <button
                        type="button"
                        onClick={() => onRemoveExtra(item.id)}
                        aria-label={`Remove ${item.name}`}
                        style={{
                          flexShrink: 0, width: 24, height: 24, borderRadius: 999, border: 'none', background: LABEL_BG,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT_FAINT,
                        }}
                      >
                        <XIcon />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {LEVELS.map(l => {
                      const active = (levels[item.id] || 'ok') === l.key;
                      return (
                        <button
                          key={l.key}
                          type="button"
                          onClick={() => onSetLevel(item.id, l.key)}
                          style={{
                            flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            borderRadius: 7, border: `1.5px solid ${active ? l.color : CARD_BORDER}`,
                            background: active ? l.bg : '#ffffff',
                            color: active ? l.color : TEXT_SECONDARY, fontSize: 11.5, fontWeight: 700,
                            fontFamily: FONT, cursor: 'pointer', padding: '0 4px',
                          }}
                        >
                          {active && <CheckIcon size={11} color={l.color} />}
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Search & add -- always available, whether this checklist came
          from a curated list or is being built entirely from scratch. */}
      <div style={{ marginBottom: items.length > 0 ? 14 : 4 }}>
        <label style={eyebrowStyle}>Flag another item</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
            <SearchIcon />
          </span>
          <input
            value={itemSearch}
            onChange={e => onItemSearchChange(e.target.value)}
            placeholder="Search by name or SKU"
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 8, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
            {searchResults.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAddExtra(item)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
                  padding: '11px 13px', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', border: 'none',
                  borderTop: idx === 0 ? 'none' : `1px solid ${ROW_BORDER}`, background: '#ffffff',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY }}>{item.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: TEXT_FAINT, marginTop: 1 }}>{item.sku} &middot; {item.uom}</span>
                </span>
                <span style={{
                  width: 22, height: 22, flexShrink: 0, borderRadius: 999, background: ACCENT_BG,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PlusIcon color={BRAND} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 10, padding: '11px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT_TEXT }}>Flagged</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: BRAND }}>{flaggedCount}/{items.length}</span>
        </div>
      )}

      {submitError && <div style={{ fontSize: 12.5, color: BAD, fontWeight: 500, marginBottom: 10, textAlign: 'center' }}>{submitError}</div>}

      {items.length > 0 && (
        <button type="button" onClick={onSubmit} disabled={submitting} style={primaryButtonStyle(submitting)}>
          {submitting ? 'Submitting…' : 'Submit Check'}
        </button>
      )}
    </>
  );
}

function DoneStep({ summary, onRunAnother }) {
  const parts = [];
  if (summary?.orderSoon > 0) parts.push(`${summary.orderSoon} Urgent`);
  if (summary?.low > 0) parts.push(`${summary.low} Running Low`);
  if (summary?.ok > 0) parts.push(`${summary.ok} Stocked`);

  return (
    <div style={{ padding: '22px 6px 6px', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 999, background: GOOD, margin: '0 auto 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckIcon size={22} color="#ffffff" />
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: GOOD, marginBottom: 6 }}>Check submitted</div>
      <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 22 }}>
        {parts.length > 0 ? parts.join(' · ') : 'All good — nothing flagged'}
      </div>
      <button type="button" onClick={onRunAnother} style={primaryButtonStyle(false)}>
        Run Another Check
      </button>
    </div>
  );
}
