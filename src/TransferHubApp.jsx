import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeftRight, Package, MapPin, Search, Check, XCircle, Clock, User, Send, ClipboardList, History as HistoryIcon,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// Transfer Hub deliberately lives outside R-Stock: it's a standalone
// worklist for "what does a site need right now", not tied to a
// stocktake count. See supabase_transfer_hub_migration.sql.

function EmptyState({ Icon, title, hint }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

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

// ── SKU picker ────────────────────────────────────────────────────────────
// Searches the shared stock_items catalog by name or SKU. A plain <select>
// doesn't scale once a catalog has hundreds of SKUs, so this is a small
// filtered dropdown instead.

function ItemPicker({ items, value, onChange, placeholder = 'Search SKUs by name…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = items.find(i => i.id === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter(i => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q))
      : items;
    return pool.slice(0, 50);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input-base pl-8"
          placeholder={placeholder}
          value={open ? query : (selected ? `${selected.name} · ${selected.sku || 'no SKU'}` : '')}
          onChange={e => { setQuery(e.target.value); onChange(null); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto card border border-gray-200 shadow-soft py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No matching SKUs</div>
          ) : filtered.map(i => (
            <button
              key={i.id}
              type="button"
              onClick={() => { onChange(i.id); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
            >
              <span className="font-medium text-gray-900">{i.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{i.sku} · {i.uom}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Request tab ───────────────────────────────────────────────────────────
// Anyone at either site flags a SKU they need. No stock-on-hand check --
// this is intent, not a reconciled count.

function RequestTab({ items, locations, myOpenRequests, itemById, locationById, onCreate, onCancel }) {
  const [locationId, setLocationId] = useState(locations[0]?.id || null);
  const [itemId, setItemId] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!locationId && locations[0]) setLocationId(locations[0].id);
  }, [locations, locationId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!locationId || !itemId || !quantity || Number(quantity) <= 0) {
      toast.error('Pick a site, a SKU and a quantity greater than 0');
      return;
    }
    setSubmitting(true);
    await onCreate({ itemId, locationId, quantity: Number(quantity), note: note.trim() });
    setItemId(null);
    setQuantity('');
    setNote('');
    setSubmitting(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
      <form onSubmit={handleSubmit} className="card p-5 space-y-4 h-fit">
        <h3 className="text-sm font-semibold text-gray-900">What do you need?</h3>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Which site needs it</label>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
            {locations.map(loc => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setLocationId(loc.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${locationId === loc.id ? 'bg-white text-gray-900 shadow-soft' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">SKU</label>
          <ItemPicker items={items} value={itemId} onChange={setItemId} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quantity</label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="e.g. 4"
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Note (optional)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Need by tomorrow AM"
            className="input-base"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-1.5">
          <Send size={14} />
          {submitting ? 'Sending…' : 'Send Request'}
        </button>
      </form>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your open requests</h3>
        {myOpenRequests.length === 0 ? (
          <EmptyState Icon={ArrowLeftRight} title="No open requests from you" hint="Requests you send will show up here until they're actioned." />
        ) : (
          <div className="card divide-y divide-gray-50">
            {myOpenRequests.map(r => {
              const item = itemById.get(r.item_id);
              const loc = locationById.get(r.requesting_location_id);
              if (!item) return null;
              return (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {r.quantity} {item.uom} · {loc?.name} · {timeAgo(r.requested_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => onCancel(r.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Cancel request"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Action Queue tab ──────────────────────────────────────────────────────
// Pools every open request across both sites so whoever's actioning
// transfers can see the lot. Fulfilling is manual: pick which site is
// sending the stock, no stock-on-hand check.

function QueueRow({ row, item, requestingLocation, locations, requesterEmail, onFulfill, onCancel }) {
  const fallbackSource = locations.find(l => l.id !== row.requesting_location_id)?.id || locations[0]?.id || '';
  const [sourceLocationId, setSourceLocationId] = useState(fallbackSource);

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 text-sm">{item.name}</div>
        <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
          <span>{row.quantity} {item.uom}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><User size={11} />{requesterEmail || 'Unknown'}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(row.requested_at)}</span>
        </div>
        {row.note && <div className="text-xs text-gray-500 mt-1 italic">&ldquo;{row.note}&rdquo;</div>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={sourceLocationId}
          onChange={e => setSourceLocationId(e.target.value)}
          className="input-base bg-white text-xs py-1.5"
          title="Which site is sending this"
        >
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button
          onClick={() => onFulfill(row.id, sourceLocationId)}
          disabled={!sourceLocationId}
          className="btn-primary text-xs py-1.5 px-2.5 flex items-center gap-1"
        >
          <Check size={13} /> Fulfil
        </button>
        <button
          onClick={() => onCancel(row.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Cancel request"
        >
          <XCircle size={16} />
        </button>
      </div>
    </div>
  );
}

function QueueTab({ requests, itemById, locationById, locations, emailByUserId, onFulfill, onCancel }) {
  const grouped = useMemo(() => {
    const groups = {};
    for (const r of requests) {
      const loc = locationById.get(r.requesting_location_id);
      const item = itemById.get(r.item_id);
      if (!loc || !item) continue;
      (groups[loc.name] = groups[loc.name] || []).push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [requests, locationById, itemById]);

  if (requests.length === 0) {
    return <EmptyState Icon={ClipboardList} title="No open transfer requests" hint="Requests sent from either site will show up here to action." />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {grouped.map(([locationName, rows]) => (
        <div key={locationName}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin size={12} className="text-gray-400" />
            {locationName} needs
          </h3>
          <div className="card divide-y divide-gray-50">
            {rows.map(row => (
              <QueueRow
                key={row.id}
                row={row}
                item={itemById.get(row.item_id)}
                requestingLocation={locationById.get(row.requesting_location_id)}
                locations={locations}
                requesterEmail={emailByUserId.get(row.requested_by)}
                onFulfill={onFulfill}
                onCancel={onCancel}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────

function HistoryTab({ requests, itemById, locationById, emailByUserId }) {
  const sorted = useMemo(
    () => [...requests].sort((a, b) => new Date(b.actioned_at || b.requested_at) - new Date(a.actioned_at || a.requested_at)),
    [requests]
  );

  if (sorted.length === 0) {
    return <EmptyState Icon={HistoryIcon} title="No history yet" hint="Fulfilled and cancelled requests will show up here." />;
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested by</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">From → To</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">When</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const item = itemById.get(r.item_id);
            const reqLoc = locationById.get(r.requesting_location_id);
            const srcLoc = locationById.get(r.source_location_id);
            if (!item) return null;
            return (
              <tr key={r.id} className="border-b border-gray-50 last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{r.quantity} {item.uom}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{emailByUserId.get(r.requested_by) || 'Unknown'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{srcLoc?.name || '—'} → {reqLoc?.name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'fulfilled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.status === 'fulfilled' ? 'Fulfilled' : 'Cancelled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(r.actioned_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Top-level app ─────────────────────────────────────────────────────────

export default function TransferHubApp({ user, org }) {
  const [activeTab, setActiveTab] = useState('request');
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    if (!org?.id) return;
    setLoading(true);
    try {
      const [locs, stockItems, reqs, members] = await Promise.all([
        db.getLocations(org.id),
        db.getStockItems(org.id),
        db.getTransferRequests(org.id),
        db.getOrgMembersWithEmail(org.id),
      ]);
      setLocations(locs);
      setItems(stockItems);
      setRequests(reqs);
      setOrgMembers(members);
    } catch (err) {
      toast.error('Failed to load Transfer Hub: ' + (err.message || 'unknown error'));
      console.error(err);
    }
    setLoading(false);
  }

  const activeLocations = useMemo(() => locations.filter(l => l.active), [locations]);
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const locationById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
  const emailByUserId = useMemo(() => new Map(orgMembers.map(m => [m.user_id, m.email])), [orgMembers]);

  const openRequests = useMemo(() => requests.filter(r => r.status === 'open'), [requests]);
  const historyRequests = useMemo(() => requests.filter(r => r.status !== 'open'), [requests]);
  const myOpenRequests = useMemo(
    () => openRequests.filter(r => r.requested_by === user?.id),
    [openRequests, user?.id]
  );

  async function handleCreate({ itemId, locationId, quantity, note }) {
    try {
      const created = await db.createTransferRequest(org.id, { itemId, locationId, quantity, note, requestedBy: user?.id });
      setRequests(prev => [created, ...prev]);
      toast.success('Transfer request sent');
    } catch (err) {
      toast.error('Failed to send request: ' + (err.message || 'unknown error'));
      console.error(err);
    }
  }

  async function handleFulfill(requestId, sourceLocationId) {
    setRequests(prev => prev.map(r => r.id === requestId
      ? { ...r, status: 'fulfilled', source_location_id: sourceLocationId, actioned_by: user?.id, actioned_at: new Date().toISOString() }
      : r));
    try {
      await db.fulfillTransferRequest(requestId, { sourceLocationId, actionedBy: user?.id });
      toast.success('Marked as fulfilled');
    } catch (err) {
      toast.error('Failed to update: ' + (err.message || 'unknown error'));
      console.error(err);
      loadData();
    }
  }

  async function handleCancel(requestId) {
    setRequests(prev => prev.map(r => r.id === requestId
      ? { ...r, status: 'cancelled', actioned_by: user?.id, actioned_at: new Date().toISOString() }
      : r));
    try {
      await db.cancelTransferRequest(requestId, user?.id);
      toast.success('Request cancelled');
    } catch (err) {
      toast.error('Failed to cancel: ' + (err.message || 'unknown error'));
      console.error(err);
      loadData();
    }
  }

  const TABS = [
    { id: 'request', label: 'Request',      Icon: Send },
    { id: 'queue',   label: 'Action Queue', Icon: ClipboardList },
    { id: 'history', label: 'History',      Icon: HistoryIcon },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200" style={{ borderTopColor: 'var(--primary)' }} />
        <span className="text-xs text-gray-400">Loading Transfer Hub…</span>
      </div>
    );
  }

  if (activeLocations.length < 2) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <EmptyState
          Icon={MapPin}
          title="Need at least two sites"
          hint="Transfer Hub is for moving stock between sites — add another location in R-Stock's Locations tab first."
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-soft" style={{ backgroundColor: 'var(--primary)' }}>
            <ArrowLeftRight size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Transfer Hub</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cross-site stock requests</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-soft">
            <ClipboardList size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{openRequests.length}</span>
            <span className="text-xs text-gray-500">open</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-soft">
            <Package size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{items.length}</span>
            <span className="text-xs text-gray-500">SKUs</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id ? 'tab-active' : 'tab-inactive'}`}
          >
            <Icon size={15} />
            {label}
            {id === 'queue' && openRequests.length > 0 && (
              <span className="text-xs font-semibold px-1.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 18%, white)', color: 'var(--primary-dk)' }}>
                {openRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'request' && (
        <RequestTab
          items={items}
          locations={activeLocations}
          myOpenRequests={myOpenRequests}
          itemById={itemById}
          locationById={locationById}
          onCreate={handleCreate}
          onCancel={handleCancel}
        />
      )}
      {activeTab === 'queue' && (
        <QueueTab
          requests={openRequests}
          itemById={itemById}
          locationById={locationById}
          locations={activeLocations}
          emailByUserId={emailByUserId}
          onFulfill={handleFulfill}
          onCancel={handleCancel}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab
          requests={historyRequests}
          itemById={itemById}
          locationById={locationById}
          emailByUserId={emailByUserId}
        />
      )}
    </div>
  );
}
