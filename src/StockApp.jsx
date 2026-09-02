import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Plus, Trash2, Edit2, X, MapPin, Upload,
  ClipboardList, Truck, AlertTriangle, XCircle, ChevronDown, ShoppingCart, History, Box, ArrowLeftRight, Search,
  TrendingUp, ChevronLeft, ChevronRight, Tag, User, Settings,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const BRAND = '#E85018';
const CHART_TICK_STYLE = { fontSize: 11, fill: '#94a3b8' };

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  no_stock:  { label: 'No Stock',              bg: 'bg-red-100',   text: 'text-red-700',   border: 'border-red-200',   dot: 'bg-red-500'   },
  low_stock: { label: 'Low Stock',              bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  order_moq: { label: 'Order if MOQ Required',  bg: 'bg-purple-100',text: 'text-purple-700',border: 'border-purple-200',dot: 'bg-purple-500'},
  in_stock:  { label: 'In Stock',               bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  request_transfer: { label: 'Request Transfer', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86400000);
}

function relativeDayLabel(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// Pack-style units carry their own count (e.g. "12-pack") -- without a
// separator, "2 12-pack" reads as one ambiguous number. An "x" makes it
// "2 x 12-pack": two of the 12-packs. Weight/volume/simple units (kg, g,
// L, units, carton, box, bunch...) don't start with a digit and are left
// exactly as they were.
function isPackUnit(unit) {
  return !!unit && /^\d/.test(unit.trim());
}

function formatQty(value, unit) {
  if (!unit) return String(value);
  return isPackUnit(unit) ? `${value} x ${unit}` : `${value} ${unit}`;
}

// Prefers a still-live "ordered today, not yet archived" flag over the
// archived history, since the archive won't have today's entry until the
// midnight job runs. Returns { label, days, never } so callers can both
// display and color-code by staleness (used on Stocktake and Insights).
function lastOrderedInfo(row, lastOrderedByKey) {
  if (row.ordered && row.ordered_at) {
    const days = daysAgo(row.ordered_at);
    return { label: `Last ordered ${relativeDayLabel(days)}`, days, never: false };
  }
  const lastDate = lastOrderedByKey[`${row.item_id}:${row.location_id}`];
  // Not "never" as in a red flag -- just an item that hasn't been through
  // an R-Stock order cycle yet (e.g. newly added, or from before this
  // module existed). Nothing to act on, so it's shown neutral, not stale.
  if (!lastDate) return { label: 'N/A', days: null, never: true };
  const days = daysAgo(lastDate);
  return { label: `Last ordered ${relativeDayLabel(days)}`, days, never: false };
}

// Traffic-light scheme matching STATUS_CONFIG's bg/text/dot convention,
// so the same at-a-glance scanning works for "when was this last
// ordered" as already works for stock status. "fresh" is genuinely
// green (a real positive signal) rather than gray, which used to make
// it indistinguishable from "N/A" -- both just blended into the rest
// of the row's gray text.
const LAST_ORDERED_TONE_CLASSES = {
  fresh:   { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500' },
  warn:    { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  stale:   { bg: 'bg-red-50',   text: 'text-red-600',   dot: 'bg-red-500'   },
  neutral: { bg: 'bg-gray-50',  text: 'text-gray-400',  dot: 'bg-gray-300'  },
};

function lastOrderedTone(info) {
  if (info.never) return 'neutral';
  if (info.days >= 14) return 'stale';
  if (info.days >= 7) return 'warn';
  return 'fresh';
}

function formatHistoryDate(dateStr) {
  const days = daysAgo(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(dateStr.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Shared bits ───────────────────────────────────────────────────────────────

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

function LocationSwitcher({ locations, selectedLocationId, onSelectLocation }) {
  if (locations.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
      {locations.map(loc => (
        <button
          key={loc.id}
          onClick={() => onSelectLocation(loc.id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedLocationId === loc.id ? 'bg-white text-gray-900 shadow-soft' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {loc.name}
        </button>
      ))}
    </div>
  );
}

// Supplier (default) vs Category grouping — shared by Stocktake and
// Ordering, which both group their worklist the same two ways.
function GroupBySwitcher({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      {[['supplier', 'Supplier'], ['category', 'Category']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${value === key ? 'tab-active' : 'tab-inactive'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Multi-select category filter — a checkbox list in a portal-positioned
// dropdown (same escape-overflow pattern as StatusDropdown) rather than a
// native <select multiple>, which needs ctrl/cmd-click and is a poor fit
// for a handful of short codes.
function CategoryFilterMultiSelect({ value, onChange, categories }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleDismiss() { setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [open]);

  if (categories.length === 0) return null;

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(o => !o);
  }

  function toggleCategory(c) {
    onChange(value.includes(c) ? value.filter(x => x !== c) : [...value, c]);
  }

  const label = value.length === 0 ? 'All categories' : value.length === 1 ? value[0] : `${value.length} categories`;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`input-base bg-white w-auto py-1.5 text-sm flex items-center gap-1.5 ${value.length > 0 ? 'font-medium' : 'text-gray-500'}`}
        style={value.length > 0 ? { borderColor: 'color-mix(in srgb, var(--primary) 40%, white)', color: 'var(--primary-dk)' } : undefined}
      >
        {label}
        <ChevronDown size={13} className="opacity-60" />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="bg-white rounded-xl shadow-elevated border border-gray-100 z-50 overflow-hidden min-w-[180px] animate-fade-in"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {categories.map(c => (
              <label
                key={c}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={value.includes(c)}
                  onChange={() => toggleCategory(c)}
                  className="w-3.5 h-3.5 rounded border-gray-300"
                  style={{ accentColor: 'var(--primary)' }}
                />
                {c}
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100"
            >
              Clear
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// "My Suppliers" — a convenience filter, not access control. Toggles
// whether the current tab's supplier groups are narrowed down to just
// the ones assigned (via SupplierAssignmentsModal) to the logged-in
// user. Disabled with a hint when they have no assignments yet.
function MySuppliersToggle({ active, onToggle, hasAssignments, onManage }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onToggle}
        disabled={!hasAssignments}
        title={hasAssignments ? 'Show only the suppliers assigned to you' : 'No suppliers assigned to you yet — click the gear to set that up'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${active ? 'tab-active' : 'bg-gray-100 tab-inactive'}`}
      >
        <User size={13} />
        My Suppliers
      </button>
      <button
        onClick={onManage}
        title="Assign suppliers to team members"
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Settings size={14} />
      </button>
    </div>
  );
}

function SupplierAssignmentsModal({ suppliers, assignments, orgMembers, orgId, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => {
    const initial = {};
    for (const a of assignments) initial[a.supplier] = a.user_id;
    return initial;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const original = {};
      for (const a of assignments) original[a.supplier] = a.user_id;

      await Promise.all(suppliers.map(supplier => {
        const was = original[supplier] || null;
        const now = draft[supplier] || null;
        if (was === now) return null;
        return now
          ? db.setSupplierAssignment(orgId, supplier, now)
          : db.removeSupplierAssignment(orgId, supplier);
      }));

      toast.success('Supplier assignments saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save assignments');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Supplier Assignments" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Assign each supplier to whoever orders it. Anyone can still see every supplier — this just powers the "My Suppliers" filter.
        </p>
        {suppliers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No suppliers in the catalog yet.</p>
        ) : (
          <div className="space-y-2">
            {suppliers.map(supplier => (
              <div key={supplier} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-800 truncate">{supplier}</span>
                <select
                  value={draft[supplier] || ''}
                  onChange={e => setDraft(d => ({ ...d, [supplier]: e.target.value || null }))}
                  className="input-base bg-white w-auto py-1.5 text-sm flex-shrink-0"
                >
                  <option value="">Unassigned</option>
                  {orgMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.email}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={save} disabled={saving || suppliers.length === 0} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base pl-9"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// Click-to-edit order qty — used on both Stocktake and Ordering, always
// the same stock_item_sites.order_qty field, so editing it in either
// place updates the same value. isSet distinguishes "explicitly set"
// from "falling back to the reference qty" with a subtle highlight.
function EditableQty({ value, isSet, unit, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function start() {
    setDraft(String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (isNaN(parsed) || parsed < 0) return;
    if (parsed === value) return;
    onCommit(parsed);
  }

  if (editing) {
    return (
      <input
        type="number" min="0" step="any" autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
        className="input-base w-20 text-center px-2 py-1"
      />
    );
  }

  return (
    <button
      onClick={start}
      className={`w-20 inline-flex items-center justify-center px-2 py-1 rounded-lg font-semibold transition-colors hover:bg-gray-100 ${isSet ? 'text-gray-900' : 'text-gray-500'}`}
      style={isSet ? { backgroundColor: 'color-mix(in srgb, var(--primary) 10%, white)' } : undefined}
      title="Click to set how much to order"
    >
      {formatQty(value, unit)}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-md' }) {
  return (
    <div className="modal-overlay">
      <div className={`modal-container ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="modal-header flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Status Dropdown ────────────────────────────────────────────────────────────

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function handleDismiss() { setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(o => !o);
  }

  const cfg = STATUS_CONFIG[value] || STATUS_CONFIG.in_stock;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:shadow-soft whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
        <ChevronDown size={11} className="ml-0.5 opacity-60 flex-shrink-0" />
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="bg-white rounded-xl shadow-elevated border border-gray-100 z-50 overflow-hidden min-w-[190px] animate-fade-in"
        >
          {Object.entries(STATUS_CONFIG).map(([key, s]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 text-left ${key === value ? 'bg-gray-50' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Stocktake Tab ─────────────────────────────────────────────────────────────
// Pure flagging — status only. Order qty and marking things as ordered
// live in the Ordering tab, which works off whatever gets flagged here.

function StocktakeTab({ items, sites, locations, selectedLocationId, onSelectLocation, onUpdateStatus, onUpdateOrderQty, lastOrderedByKey, pinnedCategory, mySuppliers, onManageSuppliers }) {
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const [collapsed, setCollapsed] = useState({});
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('supplier');
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [myOnly, setMyOnly] = useState(false);
  const toggleGroup = key => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const availableCategories = useMemo(
    () => [...new Set(items.map(i => i.category).filter(Boolean))].sort(),
    [items]
  );

  // pinnedCategory scopes this same view to one category (e.g. the
  // Packaging tab) without needing a separate data model or component —
  // items still show up in the unfiltered Stocktake tab too. categoryFilters
  // is the user-facing version of the same idea for the general tab, and
  // can select several categories at once. myOnly is the same idea again,
  // for "just the suppliers assigned to me".
  const siteRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites
      .filter(s => s.location_id === selectedLocationId)
      .map(s => ({ ...s, item: itemById.get(s.item_id) }))
      .filter(r => r.item)
      .filter(r => !pinnedCategory || r.item.category === pinnedCategory)
      .filter(r => categoryFilters.length === 0 || categoryFilters.includes(r.item.category))
      .filter(r => !myOnly || mySuppliers.includes(r.supplier))
      .filter(r => !q || r.item.name.toLowerCase().includes(q) || (r.item.sku || '').toLowerCase().includes(q));
  }, [sites, selectedLocationId, itemById, pinnedCategory, categoryFilters, myOnly, mySuppliers, search]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const row of siteRows) {
      const key = groupBy === 'category' ? (row.item.category || 'Uncategorized') : (row.supplier || 'No Supplier');
      (groups[key] = groups[key] || []).push(row);
    }
    // Within each group, sort by category then name -- a no-op on the
    // category itself when grouped by category, but on the default
    // supplier grouping this keeps same-category items clustered
    // together before falling back to alphabetical.
    for (const rows of Object.values(groups)) {
      rows.sort((a, b) =>
        (a.item.category || '').localeCompare(b.item.category || '') ||
        a.item.name.localeCompare(b.item.name)
      );
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [siteRows, groupBy]);

  // Balance the two columns by total item count, not just alternating —
  // a plain left/right split leaves a huge gap next to a short supplier
  // when its row-partner (e.g. Bidfood) has way more items.
  const [leftColumn, rightColumn] = useMemo(() => {
    const left = [];
    const right = [];
    let leftCount = 0;
    let rightCount = 0;
    for (const entry of grouped) {
      const rowCount = entry[1].length;
      if (leftCount <= rightCount) { left.push(entry); leftCount += rowCount; }
      else { right.push(entry); rightCount += rowCount; }
    }
    return [left, right];
  }, [grouped]);

  const noStock  = siteRows.filter(r => r.current_status === 'no_stock').length;
  const lowStock = siteRows.filter(r => r.current_status === 'low_stock').length;

  if (locations.length === 0) {
    return <EmptyState Icon={MapPin} title="No locations set up yet" hint="Add a site in the Locations tab first." />;
  }

  function renderGroup([groupKey, rows]) {
    const isCollapsed = !!collapsed[groupKey];
    const GroupIcon = groupBy === 'category' ? Tag : Truck;
    return (
      <div key={groupKey}>
        <button
          onClick={() => toggleGroup(groupKey)}
          className="w-full flex items-center gap-1.5 mb-2 group"
        >
          <ChevronDown size={13} className={`text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          <GroupIcon size={12} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">
            {groupKey}
          </h3>
          <span className="text-xs text-gray-400">· {rows.length} item{rows.length !== 1 ? 's' : ''}</span>
        </button>
        {!isCollapsed && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="w-[46%] px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                <th className="w-[22%] px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="w-[32%] px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const info = lastOrderedInfo(row, lastOrderedByKey);
                const tone = lastOrderedTone(info);
                return (
                <tr key={row.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/70 transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-gray-900 truncate">{row.item.name}</span>
                      {row.item.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{row.item.category}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate mb-1">{row.item.sku} · {row.item.uom}</div>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${LAST_ORDERED_TONE_CLASSES[tone].bg} ${LAST_ORDERED_TONE_CLASSES[tone].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LAST_ORDERED_TONE_CLASSES[tone].dot}`} />
                      {info.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="text-[10px] text-gray-400 leading-none mb-1">ref {row.reference_order_qty}</div>
                    <EditableQty
                      value={row.order_qty ?? row.reference_order_qty ?? 0}
                      isSet={row.order_qty !== null && row.order_qty !== undefined}
                      unit={row.item.uom}
                      onCommit={val => onUpdateOrderQty(row.id, val)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusDropdown
                      value={row.current_status}
                      onChange={status => onUpdateStatus(row.id, status)}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <LocationSwitcher locations={locations} selectedLocationId={selectedLocationId} onSelectLocation={onSelectLocation} />
        <div className="flex items-center gap-2 flex-wrap">
          {!pinnedCategory && (
            <CategoryFilterMultiSelect value={categoryFilters} onChange={setCategoryFilters} categories={availableCategories} />
          )}
          <GroupBySwitcher value={groupBy} onChange={setGroupBy} />
          <MySuppliersToggle active={myOnly} onToggle={() => setMyOnly(o => !o)} hasAssignments={mySuppliers.length > 0} onManage={onManageSuppliers} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search items or SKU…" />
        </div>
      </div>

      {noStock > 0 && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <XCircle size={14} className="text-red-600" />
          </div>
          <span className="text-sm font-medium text-red-700">{noStock} item{noStock !== 1 ? 's' : ''} with no stock</span>
        </div>
      )}
      {lowStock > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={14} className="text-amber-600" />
          </div>
          <span className="text-sm font-medium text-amber-700">{lowStock} item{lowStock !== 1 ? 's' : ''} running low</span>
        </div>
      )}

      {siteRows.length === 0 ? (
        <EmptyState
          Icon={search ? Search : Package}
          title={
            search ? `No items match "${search}"`
            : myOnly ? 'None of your assigned suppliers have items at this site'
            : categoryFilters.length > 0 ? `No items in ${categoryFilters.join(', ')} assigned to this site`
            : pinnedCategory ? `No ${pinnedCategory} items assigned to this site yet`
            : 'No items assigned to this site yet'
          }
          hint={search || categoryFilters.length > 0 || myOnly ? 'Try a different filter.' : 'Add or upload some in the Items tab.'}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 w-full space-y-4">{leftColumn.map(renderGroup)}</div>
          <div className="flex-1 min-w-0 w-full space-y-4">{rightColumn.map(renderGroup)}</div>
        </div>
      )}
    </div>
  );
}

// ── Ordering Tab ──────────────────────────────────────────────────────────────
// The actionable worklist: only items flagged as needing attention in
// Stocktake (anything but In Stock), with an editable order qty and a
// checkbox to confirm it's been ordered.

const NEEDS_ORDER_STATUSES = ['no_stock', 'low_stock', 'order_moq'];

function OrderingTab({ items, sites, locations, selectedLocationId, onSelectLocation, onUpdateOrderQty, onUpdateOrdered, mySuppliers, onManageSuppliers }) {
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const [groupBy, setGroupBy] = useState('supplier');
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [myOnly, setMyOnly] = useState(false);

  const availableCategories = useMemo(
    () => [...new Set(items.map(i => i.category).filter(Boolean))].sort(),
    [items]
  );

  const siteRows = useMemo(() => {
    return sites
      .filter(s => s.location_id === selectedLocationId && NEEDS_ORDER_STATUSES.includes(s.current_status))
      .map(s => ({ ...s, item: itemById.get(s.item_id) }))
      .filter(r => r.item)
      .filter(r => categoryFilters.length === 0 || categoryFilters.includes(r.item.category))
      .filter(r => !myOnly || mySuppliers.includes(r.supplier));
  }, [sites, selectedLocationId, itemById, categoryFilters, myOnly, mySuppliers]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const row of siteRows) {
      const key = groupBy === 'category' ? (row.item.category || 'Uncategorized') : (row.supplier || 'No Supplier');
      (groups[key] = groups[key] || []).push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [siteRows, groupBy]);

  const orderedCount = siteRows.filter(r => r.ordered).length;

  if (locations.length === 0) {
    return <EmptyState Icon={MapPin} title="No locations set up yet" hint="Add a site in the Locations tab first." />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <LocationSwitcher locations={locations} selectedLocationId={selectedLocationId} onSelectLocation={onSelectLocation} />
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryFilterMultiSelect value={categoryFilters} onChange={setCategoryFilters} categories={availableCategories} />
          <GroupBySwitcher value={groupBy} onChange={setGroupBy} />
          <MySuppliersToggle active={myOnly} onToggle={() => setMyOnly(o => !o)} hasAssignments={mySuppliers.length > 0} onManage={onManageSuppliers} />
        </div>
      </div>

      {siteRows.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 border" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 8%, white)', borderColor: 'color-mix(in srgb, var(--primary) 20%, white)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 18%, white)' }}>
            <ShoppingCart size={14} style={{ color: 'var(--primary)' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--primary-dk)' }}>
            {siteRows.length} item{siteRows.length !== 1 ? 's' : ''} need{siteRows.length === 1 ? 's' : ''} ordering
            {orderedCount > 0 && ` · ${orderedCount} already marked as ordered`}
          </span>
        </div>
      )}

      {siteRows.length === 0 ? (
        <EmptyState
          Icon={ShoppingCart}
          title={
            myOnly ? 'Nothing from your assigned suppliers needs ordering right now'
            : categoryFilters.length > 0 ? `Nothing in ${categoryFilters.join(', ')} needs ordering right now`
            : 'Nothing needs ordering at this site right now'
          }
          hint="Flag items as low or out of stock in the Stocktake tab and they'll show up here."
        />
      ) : (
        grouped.map(([groupKey, rows]) => (
          <div key={groupKey}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              {groupBy === 'category' ? <Tag size={12} className="text-gray-400" /> : <Truck size={12} className="text-gray-400" />}
              {groupKey}
            </h3>
            <div className="card overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="w-2/5 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="w-[28%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="w-[16%] px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Qty</th>
                    <th className="w-[16%] px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const qty = row.order_qty ?? row.reference_order_qty ?? 0;
                    const sc = STATUS_CONFIG[row.current_status];
                    return (
                      <tr key={row.id} className={`border-b border-gray-50 last:border-b-0 hover:bg-gray-50/70 transition-colors ${row.ordered ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.item.name}</div>
                          <div className="text-xs text-gray-400">{row.item.sku} · {row.item.uom}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${sc.bg} ${sc.text} ${sc.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <EditableQty
                            value={qty}
                            isSet={row.order_qty !== null && row.order_qty !== undefined}
                            unit={row.item.uom}
                            onCommit={val => onUpdateOrderQty(row.id, val)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.ordered}
                            onChange={e => onUpdateOrdered(row.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-current"
                            style={{ color: 'var(--primary)' }}
                            title={row.ordered_at ? `Ordered ${new Date(row.ordered_at).toLocaleDateString('en-AU')}` : 'Confirm ordered for next delivery'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Transfers Tab ─────────────────────────────────────────────────────────────
// Cross-site worklist for items flagged "Request Transfer" in Stocktake —
// unlike Ordering (scoped to one site's supplier orders), this pools every
// site's requests so whichever site is fulfilling them can see the lot.
// "Transferred" reuses the same ordered/ordered_at fields as Ordering's
// "Ordered" checkbox, so the nightly archive job picks these up for free.

function TransfersTab({ items, sites, locations, onUpdateOrderQty, onUpdateOrdered }) {
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const locationById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

  const transferRows = useMemo(() => {
    return sites
      .filter(s => s.current_status === 'request_transfer')
      .map(s => ({ ...s, item: itemById.get(s.item_id), location: locationById.get(s.location_id) }))
      .filter(r => r.item && r.location);
  }, [sites, itemById, locationById]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const row of transferRows) {
      (groups[row.location.name] = groups[row.location.name] || []).push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [transferRows]);

  const transferredCount = transferRows.filter(r => r.ordered).length;

  if (locations.length === 0) {
    return <EmptyState Icon={MapPin} title="No locations set up yet" hint="Add a site in the Locations tab first." />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {transferRows.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 border" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 8%, white)', borderColor: 'color-mix(in srgb, var(--primary) 20%, white)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 18%, white)' }}>
            <ArrowLeftRight size={14} style={{ color: 'var(--primary)' }} />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--primary-dk)' }}>
            {transferRows.length} item{transferRows.length !== 1 ? 's' : ''} requested for transfer
            {transferredCount > 0 && ` · ${transferredCount} already marked as transferred`}
          </span>
        </div>
      )}

      {transferRows.length === 0 ? (
        <EmptyState
          Icon={ArrowLeftRight}
          title="No transfer requests right now"
          hint="Flag an item as &ldquo;Request Transfer&rdquo; in Stocktake and it'll show up here for whichever site fulfils it."
        />
      ) : (
        grouped.map(([locationName, rows]) => (
          <div key={locationName}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin size={12} className="text-gray-400" />
              {locationName} needs
            </h3>
            <div className="card overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="w-1/2 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="w-1/4 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="w-1/4 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Transferred</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const qty = row.order_qty ?? row.reference_order_qty ?? 0;
                    return (
                      <tr key={row.id} className={`border-b border-gray-50 last:border-b-0 hover:bg-gray-50/70 transition-colors ${row.ordered ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.item.name}</div>
                          <div className="text-xs text-gray-400">{row.item.sku} · {row.item.uom}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <EditableQty
                            value={qty}
                            isSet={row.order_qty !== null && row.order_qty !== undefined}
                            unit={row.item.uom}
                            onCommit={val => onUpdateOrderQty(row.id, val)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.ordered}
                            onChange={e => onUpdateOrdered(row.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-current"
                            style={{ color: 'var(--primary)' }}
                            title={row.ordered_at ? `Transferred ${new Date(row.ordered_at).toLocaleDateString('en-AU')}` : 'Confirm transferred'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
// Read-only record of what got archived by the midnight job — grouped by
// the day it was ordered, then by supplier within that day.

function HistoryTab({ items, locations, orderHistory, selectedLocationId, onSelectLocation }) {
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const locationRows = useMemo(() => {
    return orderHistory
      .filter(h => h.location_id === selectedLocationId)
      .map(h => ({ ...h, item: itemById.get(h.item_id) }))
      .filter(h => h.item);
  }, [orderHistory, selectedLocationId, itemById]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    for (const row of locationRows) {
      (groups[row.ordered_date] = groups[row.ordered_date] || []).push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [locationRows]);

  if (locations.length === 0) {
    return <EmptyState Icon={MapPin} title="No locations set up yet" hint="Add a site in the Locations tab first." />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <LocationSwitcher locations={locations} selectedLocationId={selectedLocationId} onSelectLocation={onSelectLocation} />

      {groupedByDate.length === 0 ? (
        <EmptyState
          Icon={History}
          title="No order history yet for this site"
          hint="Items ticked as ordered are archived here automatically each night."
        />
      ) : (
        groupedByDate.map(([date, rows]) => {
          const bySupplier = {};
          for (const row of rows) {
            const label = row.status_at_order === 'request_transfer' ? 'Internal Transfer' : (row.supplier || 'No Supplier');
            (bySupplier[label] = bySupplier[label] || []).push(row);
          }
          return (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <History size={14} className="text-gray-400" />
                {formatHistoryDate(date)}
                <span className="text-xs font-normal text-gray-400">· {rows.length} item{rows.length !== 1 ? 's' : ''} ordered</span>
              </h3>
              <div className="card overflow-hidden divide-y divide-gray-50">
                {Object.entries(bySupplier).sort(([a], [b]) => a.localeCompare(b)).map(([supplier, supplierRows]) => (
                  <div key={supplier} className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {supplier === 'Internal Transfer' ? <ArrowLeftRight size={11} /> : <Truck size={11} />}
                      {supplier}
                    </p>
                    <div className="space-y-1.5">
                      {supplierRows.map(row => {
                        const sc = STATUS_CONFIG[row.status_at_order] || STATUS_CONFIG.in_stock;
                        return (
                          <div key={row.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                              <span className="text-gray-800 truncate">{row.item.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{row.item.sku}</span>
                            </div>
                            <span className="text-gray-500 font-medium flex-shrink-0 ml-3">
                              {row.order_qty != null ? formatQty(row.order_qty, row.item.uom) : `— ${row.item.uom}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Insights Tab ─────────────────────────────────────────────────────────────
// Two views built purely from stock_order_history (no new schema): which
// items haven't been ordered in a while, and per-SKU volumes for a given
// week — both scoped to the selected site, matching how ordering itself
// is site-scoped.

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', opts)}`;
}

// Simple dark tooltip shared by both charts below — matches the pattern
// used in BusinessDashboard.jsx (ChartTooltip) but scoped to this file
// since these charts are single-series and need less machinery.
function InsightsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-elevated">
      <p className="font-medium mb-0.5">{label}</p>
      <p className="text-gray-300">{p.tooltipLabel}</p>
    </div>
  );
}

function InsightsTab({ items, sites, locations, orderHistory, selectedLocationId, onSelectLocation, lastOrderedByKey }) {
  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const [weekOffset, setWeekOffset] = useState(0);

  const siteRows = useMemo(() => {
    return sites
      .filter(s => s.location_id === selectedLocationId)
      .map(s => ({ ...s, item: itemById.get(s.item_id) }))
      .filter(r => r.item);
  }, [sites, selectedLocationId, itemById]);

  // "N/A" items (never been through an R-Stock order cycle) aren't a
  // staleness signal — nothing to act on — so they're excluded here,
  // not just recolored.
  const staleRows = useMemo(() => {
    return siteRows
      .map(row => ({ row, info: lastOrderedInfo(row, lastOrderedByKey) }))
      .filter(({ info }) => !info.never && info.days >= 7)
      .sort((a, b) => b.info.days - a.info.days)
      .slice(0, 20);
  }, [siteRows, lastOrderedByKey]);

  // Trailing 8 weeks of ordering activity at this site — a count of order
  // lines rather than summed qty, since qty mixes incompatible units
  // (kg, L, units) across different SKUs and a summed total would be
  // meaningless.
  const trendWeeks = useMemo(() => {
    const thisWeekStart = getWeekStart(new Date());
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisWeekStart);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startISO = toISODate(start);
      const endISO = toISODate(end);
      const count = orderHistory.filter(h =>
        h.location_id === selectedLocationId && h.ordered_date >= startISO && h.ordered_date <= endISO
      ).length;
      weeks.push({
        label: start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
        count,
        tooltipLabel: `${count} item${count !== 1 ? 's' : ''} ordered`,
      });
    }
    return weeks;
  }, [orderHistory, selectedLocationId]);

  const weekStart = useMemo(() => {
    const start = getWeekStart(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weekVolumes = useMemo(() => {
    const startISO = toISODate(weekStart);
    const endISO = toISODate(weekEnd);
    const rows = orderHistory.filter(h =>
      h.location_id === selectedLocationId && h.ordered_date >= startISO && h.ordered_date <= endISO
    );
    const byItem = new Map();
    for (const row of rows) {
      const entry = byItem.get(row.item_id) || { qty: 0, times: 0, supplier: row.supplier };
      entry.qty += row.order_qty || 0;
      entry.times += 1;
      entry.supplier = row.supplier || entry.supplier;
      byItem.set(row.item_id, entry);
    }
    return [...byItem.entries()]
      .map(([itemId, entry]) => ({ item: itemById.get(itemId), ...entry }))
      .filter(r => r.item)
      .sort((a, b) => b.qty - a.qty);
  }, [orderHistory, selectedLocationId, weekStart, weekEnd, itemById]);

  // Grouped by UoM so each item's bar is only ever scaled against other
  // items measured the same way — 12 tins of Tuna and 3kg of Roast Beef
  // aren't comparable numbers, so they never share a bar's 0-100% scale.
  // Groups are ordered by their own total qty, items within a group by
  // their own qty, both descending.
  const weekVolumesByUom = useMemo(() => {
    const groups = {};
    for (const r of weekVolumes) {
      (groups[r.item.uom] = groups[r.item.uom] || []).push(r);
    }
    return Object.entries(groups)
      .map(([uom, rows]) => ({
        uom,
        rows: [...rows].sort((a, b) => b.qty - a.qty),
        maxQty: Math.max(...rows.map(r => r.qty)),
        totalQty: rows.reduce((sum, r) => sum + r.qty, 0),
      }))
      .sort((a, b) => b.totalQty - a.totalQty);
  }, [weekVolumes]);

  const isCurrentWeek = weekOffset === 0;

  if (locations.length === 0) {
    return <EmptyState Icon={MapPin} title="No locations set up yet" hint="Add a site in the Locations tab first." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <LocationSwitcher locations={locations} selectedLocationId={selectedLocationId} onSelectLocation={onSelectLocation} />

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          Needs Attention
          <span className="text-xs font-normal text-gray-400">· ordered 7+ days ago</span>
        </h3>
        {staleRows.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-gray-400">Everything at this site has been ordered recently. Nice.</div>
        ) : (
          <div className="card overflow-hidden divide-y divide-gray-50">
            {staleRows.map(({ row, info }) => {
              const tone = lastOrderedTone(info);
              return (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{row.item.name}</div>
                    <div className="text-xs text-gray-400">{row.item.sku} · {row.supplier || 'No Supplier'}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${LAST_ORDERED_TONE_CLASSES[tone].bg} ${LAST_ORDERED_TONE_CLASSES[tone].text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LAST_ORDERED_TONE_CLASSES[tone].dot}`} />
                    {info.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <TrendingUp size={14} className="text-gray-400" />
          Order Activity Trend
          <span className="text-xs font-normal text-gray-400">· items ordered per week, last 8 weeks</span>
        </h3>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendWeeks} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<InsightsTooltip />} />
              <Line type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3, fill: BRAND, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp size={14} className="text-gray-400" />
            Weekly Volumes
          </h3>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-medium text-gray-600 min-w-[150px] text-center">
              {formatWeekRange(weekStart)}{isCurrentWeek && ' (this week)'}
            </span>
            <button
              onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
              disabled={isCurrentWeek}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {weekVolumes.length === 0 ? (
          <EmptyState Icon={TrendingUp} title="Nothing ordered this week" hint="Volumes fill in each night as orders get archived." />
        ) : (
          <div className="card overflow-hidden divide-y divide-gray-50">
            {weekVolumesByUom.map(({ uom, rows, maxQty }) => (
              <div key={uom} className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{uom}</p>
                <div className="space-y-1.5">
                  {rows.map(r => {
                    const pct = maxQty > 0 ? (r.qty / maxQty) * 100 : 0;
                    return (
                      <div key={r.item.id} className="flex items-center gap-3">
                        <div className="w-36 sm:w-44 flex-shrink-0 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{r.item.name}</div>
                          <div className="text-[10px] text-gray-400 truncate">{r.item.sku} · {r.supplier || 'No Supplier'}</div>
                        </div>
                        <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden">
                          <div className="h-full rounded-md" style={{ width: `${pct}%`, backgroundColor: BRAND }} />
                        </div>
                        <div className="w-20 flex-shrink-0 text-right text-sm font-semibold text-gray-900">
                          {r.qty}{isPackUnit(uom) ? ' x' : ''} <span className="font-normal text-gray-400 text-xs">{uom}</span>
                        </div>
                        <div className="w-10 flex-shrink-0 text-right text-xs text-gray-400">{r.times}×</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────────

// Known category codes — shown as suggestions, but any code can be typed;
// new ones are just free text on the item, no schema change needed.
const CATEGORY_SUGGESTIONS = [
  { code: 'PCK', label: 'Packaging' },
  { code: 'DAI', label: 'Dairy' },
  { code: 'FZN', label: 'Frozen' },
  { code: 'PHF', label: 'Fruit & Veg' },
  { code: 'PTN', label: 'Protein' },
];

function CsvImportModal({ orgId, locations, onClose, onSave, defaultCategory = '' }) {
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [categoryDefault, setCategoryDefault] = useState(defaultCategory);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const normalised = results.data.map(r => {
          const keys = Object.keys(r).reduce((acc, k) => { acc[k.toLowerCase().trim()] = r[k]; return acc; }, {});
          return {
            name:                (keys['item'] || keys['name'] || '').toString().trim(),
            reference_order_qty: parseFloat(keys['qty'] || keys['quantity'] || '0') || 0,
            uom:                 (keys['uom'] || keys['unit'] || 'units').toString().trim(),
            supplier:            (keys['supplier'] || '').toString().trim(),
            supplier_code:       (keys['supplier code'] || keys['supplier_code'] || keys['product code'] || keys['code'] || '').toString().trim(),
            category:            (keys['category'] || '').toString().trim(),
            description:         (keys['description'] || '').toString().trim(),
            units_per_carton:    parseFloat(keys['units per carton'] || keys['units_per_carton'] || keys['carton'] || '') || null,
          };
        }).filter(r => r.name);

        if (normalised.length === 0) {
          setError('No valid rows found. Ensure your CSV has an "Item" column.');
          return;
        }
        setPreview(normalised);
      },
      error(err) { setError('Could not parse CSV: ' + err.message); },
    });
  }

  async function handleImport() {
    if (!preview || !locationId) return;
    setImporting(true);
    try {
      const rows = preview.map(r => ({ ...r, category: r.category || categoryDefault || null }));
      await db.bulkImportStockItems(orgId, locationId, rows);
      toast.success(`Imported ${preview.length} items — matched to existing SKUs where names already exist`);
      onSave();
      onClose();
    } catch (err) {
      toast.error('Import failed: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Bulk Upload Items" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Site</label>
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="input-base bg-white"
          >
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">Every row is assigned to this site. If an item with the same name already exists (e.g. uploaded for another site), it's reused — not duplicated.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Default Category (optional)</label>
          <input
            list="category-suggestions"
            value={categoryDefault}
            onChange={e => setCategoryDefault(e.target.value)}
            placeholder="e.g. PCK — applied to rows with no Category column"
            className="input-base"
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </datalist>
          <p className="text-xs text-gray-400 mt-1.5">Used for any row that doesn't have its own Category column — handy for uploading a whole single-category list at once.</p>
        </div>

        <div className="rounded-xl p-3 text-xs space-y-1 border" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 6%, white)', borderColor: 'color-mix(in srgb, var(--primary) 18%, white)', color: 'var(--primary-dk)' }}>
          <p className="font-semibold">Expected columns:</p>
          <p>
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Item</code>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Qty</code>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>uOm</code>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Supplier</code>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Category</code> <span className="opacity-70">(optional)</span>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Supplier Code</code>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Description</code>{', '}
            <code className="px-1 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, white)' }}>Units Per Carton</code> <span className="opacity-70">(all optional)</span>
          </p>
          <p className="opacity-80">SKU is assigned automatically — any SKU column in the file is ignored.</p>
        </div>

        {!preview ? (
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Upload size={20} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Drop your CSV here or <span className="font-medium" style={{ color: 'var(--primary)' }}>browse</span></p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2 font-medium">{preview.length} rows ready to import</p>
            <div className="bg-gray-50 rounded-xl overflow-hidden max-h-48 overflow-y-auto border border-gray-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500">Item</th>
                    <th className="text-left px-3 py-2 text-gray-500">Qty</th>
                    <th className="text-left px-3 py-2 text-gray-500">uOm</th>
                    <th className="text-left px-3 py-2 text-gray-500">Supplier</th>
                    <th className="text-left px-3 py-2 text-gray-500">Category</th>
                    <th className="text-left px-3 py-2 text-gray-500">Units/Ctn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{r.name}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.reference_order_qty}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.uom}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.supplier || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.category || categoryDefault || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.units_per_carton ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setPreview(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">
              Choose a different file
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || !locationId || importing}
            className="btn-primary flex-1"
          >
            {importing ? 'Importing…' : `Import ${preview?.length ?? 0} items`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Items Tab ──────────────────────────────────────────────────────────────────

const BLANK_ITEM = { name: '', category: '', uom: 'units', description: '', units_per_carton: '' };

function ItemsTab({ items, sites, locations, orgId, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(BLANK_ITEM);
  const [siteAssignments, setSiteAssignments] = useState({}); // locationId -> { assigned, supplier, referenceOrderQty }
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const sitesByItem = useMemo(() => {
    const map = new Map();
    sites.forEach(s => {
      if (!map.has(s.item_id)) map.set(s.item_id, []);
      map.get(s.item_id).push(s);
    });
    return map;
  }, [sites]);

  // Suggestions for the Supplier field, drawn from what's already in use —
  // free text stays flexible, but autocomplete steers toward the existing
  // name instead of a near-duplicate typo (e.g. "PNP" vs "Premier North
  // Pak" needing a manual fix later).
  const knownSuppliers = useMemo(
    () => [...new Set(sites.map(s => s.supplier).filter(Boolean))].sort(),
    [sites]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  function blankAssignments() {
    const initial = {};
    locations.forEach(loc => { initial[loc.id] = { assigned: false, supplier: '', supplierCode: '', referenceOrderQty: 0 }; });
    return initial;
  }

  function openAdd() {
    setEditingItem(null);
    setForm(BLANK_ITEM);
    setSiteAssignments(blankAssignments());
    setShowForm(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category || '',
      uom: item.uom || 'units',
      description: item.description || '',
      units_per_carton: item.units_per_carton ?? '',
    });
    const initial = blankAssignments();
    (sitesByItem.get(item.id) || []).forEach(s => {
      initial[s.location_id] = { assigned: true, supplier: s.supplier || '', supplierCode: s.supplier_code || '', referenceOrderQty: s.reference_order_qty ?? 0 };
    });
    setSiteAssignments(initial);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        description: form.description || null,
        units_per_carton: form.units_per_carton === '' ? null : parseFloat(form.units_per_carton),
      };
      let item = editingItem;
      if (editingItem) {
        await db.updateStockItem(editingItem.id, payload);
      } else {
        item = await db.createStockItem(orgId, payload);
      }

      const previouslyAssigned = editingItem ? new Set((sitesByItem.get(editingItem.id) || []).map(s => s.location_id)) : new Set();
      await Promise.all(locations.map(loc => {
        const a = siteAssignments[loc.id];
        if (a?.assigned) {
          return db.assignItemToSite(orgId, item.id, loc.id, { supplier: a.supplier, supplierCode: a.supplierCode, referenceOrderQty: parseFloat(a.referenceOrderQty) || 0 });
        } else if (previouslyAssigned.has(loc.id)) {
          return db.unassignItemFromSite(item.id, loc.id);
        }
        return null;
      }));

      toast.success(editingItem ? 'Item updated' : 'Item added');
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error('Failed to save item');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(itemId) {
    if (!window.confirm('Delete this item from the catalog? It will be removed from every site.')) return;
    try {
      await db.deleteStockItem(itemId);
      toast.success('Item deleted');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-gray-500 whitespace-nowrap">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
            {search && filteredItems.length !== items.length && <span className="text-gray-400"> of {items.length}</span>}
          </p>
          <SearchInput value={search} onChange={setSearch} placeholder="Search items, SKU, category…" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCsvImport(true)}
            disabled={locations.length === 0}
            className="btn-ghost border border-gray-200 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Upload size={14} />
            Bulk Upload
          </button>
          <button
            onClick={openAdd}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Item
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          Icon={search ? Search : Package}
          title={search ? `No items match "${search}"` : 'No items yet'}
          hint={search ? 'Try a different name, SKU, or category.' : 'Add one or bulk-upload a CSV.'}
        />
      ) : (
        <div className="card overflow-hidden divide-y divide-gray-50">
          {filteredItems.map(item => {
            const itemSites = sitesByItem.get(item.id) || [];
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.sku}</span>
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    {item.category && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.category}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>{item.uom}</span>
                    {item.units_per_carton && <span>· {item.units_per_carton}/carton</span>}
                    {itemSites.length === 0 ? (
                      <span className="text-amber-500">· not assigned to any site</span>
                    ) : itemSites.map(s => {
                      const loc = locations.find(l => l.id === s.location_id);
                      return (
                        <span
                          key={s.id}
                          className="px-1.5 py-0.5 rounded flex items-center gap-1"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 8%, white)', color: 'var(--primary-dk)' }}
                        >
                          <MapPin size={10} />{loc?.name || '—'}{s.supplier ? ` · ${s.supplier}` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Edit">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => remove(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editingItem ? 'Edit Item' : 'Add Item'} onClose={() => setShowForm(false)} maxWidth="max-w-lg">
          <div className="space-y-4">
            {editingItem && (
              <div className="text-xs text-gray-400">SKU: <span className="font-mono">{editingItem.sku}</span></div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text" value={form.name} autoFocus
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Full Cream Milk 10L"
                className="input-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="Optional"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UoM</label>
                <input
                  type="text" value={form.uom}
                  onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                  placeholder="units, kg, L…"
                  className="input-base"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional — supplier spec"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Units / Carton</label>
                <input
                  type="number" min="0" step="any" value={form.units_per_carton}
                  onChange={e => setForm(f => ({ ...f, units_per_carton: e.target.value }))}
                  placeholder="Optional"
                  className="input-base"
                />
              </div>
            </div>

            <datalist id="supplier-suggestions">
              {knownSuppliers.map(s => <option key={s} value={s} />)}
            </datalist>

            {locations.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                No sites yet — add one in the Locations tab, then come back to assign this item.
              </p>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Sites carrying this item</label>
                <div className="space-y-2">
                  {locations.map(loc => {
                    const a = siteAssignments[loc.id] || { assigned: false, supplier: '', supplierCode: '', referenceOrderQty: 0 };
                    return (
                      <div
                        key={loc.id}
                        className="border rounded-lg p-2.5 transition-colors"
                        style={a.assigned ? { borderColor: 'color-mix(in srgb, var(--primary) 30%, white)', backgroundColor: 'color-mix(in srgb, var(--primary) 5%, white)' } : { borderColor: '#e5e7eb' }}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={a.assigned}
                            onChange={e => setSiteAssignments(s => ({ ...s, [loc.id]: { ...a, assigned: e.target.checked } }))}
                            className="w-4 h-4 rounded border-gray-300"
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span className="text-sm font-medium text-gray-800">{loc.name}</span>
                        </label>
                        {a.assigned && (
                          <div className="grid grid-cols-2 gap-2 mt-2 pl-6">
                            <div>
                              <span className="text-xs text-gray-500">Supplier</span>
                              <input
                                type="text" value={a.supplier}
                                onChange={e => setSiteAssignments(s => ({ ...s, [loc.id]: { ...a, supplier: e.target.value } }))}
                                placeholder="Optional"
                                list="supplier-suggestions"
                                className="input-base py-1.5"
                              />
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Supplier Code</span>
                              <input
                                type="text" value={a.supplierCode}
                                onChange={e => setSiteAssignments(s => ({ ...s, [loc.id]: { ...a, supplierCode: e.target.value } }))}
                                placeholder="Optional"
                                className="input-base py-1.5"
                              />
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-gray-500">Reference Qty</span>
                              <input
                                type="number" min="0" step="any" value={a.referenceOrderQty}
                                onChange={e => setSiteAssignments(s => ({ ...s, [loc.id]: { ...a, referenceOrderQty: e.target.value } }))}
                                className="input-base py-1.5"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editingItem ? 'Update' : 'Add Item'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCsvImport && (
        <CsvImportModal
          orgId={orgId}
          locations={locations}
          onClose={() => setShowCsvImport(false)}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}

// ── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab({ locations, orgId, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await db.createLocation(orgId, name.trim());
      toast.success('Location added');
      setName('');
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      toast.error('Failed to add location');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(loc) {
    try {
      await db.updateLocation(loc.id, { active: !loc.active });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update location');
    }
  }

  async function remove(locId) {
    if (!window.confirm('Delete this location? Items assigned only to this site will lose that assignment.')) return;
    try {
      await db.deleteLocation(locId);
      toast.success('Location deleted');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete location');
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={14} />
          Add Location
        </button>
      </div>

      {locations.length === 0 ? (
        <EmptyState Icon={MapPin} title="No locations yet" hint='Add your first site (e.g. "Crown St", "Bourke St").' />
      ) : (
        <div className="card overflow-hidden divide-y divide-gray-50">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, white)' }}>
                  <MapPin size={15} style={{ color: 'var(--primary)' }} />
                </div>
                <span className={`text-sm font-medium ${loc.active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{loc.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(loc)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {loc.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => remove(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Location" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                autoFocus value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()}
                placeholder="e.g. Crown St, Bourke St"
                className="input-base"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={add} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StockApp({ user, org }) {
  const [activeTab, setActiveTab] = useState('items');
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [sites, setSites] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [supplierAssignments, setSupplierAssignments] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  useEffect(() => { loadData(); }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    if (!org?.id) return;
    setLoading(true);
    try {
      const [locs, stockItems, itemSites, history, assignments, members] = await Promise.all([
        db.getLocations(org.id),
        db.getStockItems(org.id),
        db.getStockItemSites(org.id),
        db.getStockOrderHistory(org.id),
        db.getSupplierAssignments(org.id),
        db.getOrgMembersWithEmail(org.id),
      ]);
      setLocations(locs);
      setItems(stockItems);
      setSites(itemSites);
      setOrderHistory(history);
      setSupplierAssignments(assignments);
      setOrgMembers(members);
      setSelectedLocationId(prev => prev && locs.some(l => l.id === prev) ? prev : (locs.find(l => l.active)?.id || locs[0]?.id || null));
    } catch (err) {
      toast.error('Failed to load stock data');
      console.error(err);
    }
    setLoading(false);
  }

  // Suppliers assigned to whoever's logged in — the "My Suppliers" filter
  // narrows to these. Distinct suppliers across all sites, for the
  // assignment modal's list.
  const mySuppliers = useMemo(
    () => supplierAssignments.filter(a => a.user_id === user?.id).map(a => a.supplier),
    [supplierAssignments, user?.id]
  );
  const allSuppliers = useMemo(
    () => [...new Set(sites.map(s => s.supplier).filter(Boolean))].sort(),
    [sites]
  );

  const activeLocations = useMemo(() => locations.filter(l => l.active), [locations]);

  // Most recent ordered_date per (item, location) — orderHistory is
  // already sorted newest-first, so the first hit per key wins.
  const lastOrderedByKey = useMemo(() => {
    const map = {};
    for (const row of orderHistory) {
      const key = `${row.item_id}:${row.location_id}`;
      if (!(key in map)) map[key] = row.ordered_date;
    }
    return map;
  }, [orderHistory]);

  async function handleStatusUpdate(siteRowId, status) {
    setSites(prev => prev.map(s => s.id === siteRowId ? { ...s, current_status: status } : s));
    try {
      await db.updateSiteItemStatus(siteRowId, status);
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
      loadData();
    }
  }

  async function handleOrderQtyUpdate(siteRowId, orderQty) {
    setSites(prev => prev.map(s => s.id === siteRowId ? { ...s, order_qty: orderQty } : s));
    try {
      await db.updateSiteItemOrderQty(siteRowId, orderQty);
    } catch (err) {
      toast.error('Failed to update order qty');
      console.error(err);
      loadData();
    }
  }

  async function handleOrderedUpdate(siteRowId, ordered) {
    setSites(prev => prev.map(s => s.id === siteRowId ? { ...s, ordered, ordered_at: ordered ? new Date().toISOString() : null } : s));
    try {
      await db.updateSiteItemOrdered(siteRowId, ordered);
    } catch (err) {
      toast.error('Failed to update ordered status');
      console.error(err);
      loadData();
    }
  }

  const TABS = [
    { id: 'items',     label: 'Items',     Icon: Package },
    { id: 'stocktake', label: 'Stocktake', Icon: ClipboardList },
    { id: 'packaging', label: 'Packaging', Icon: Box },
    { id: 'ordering',  label: 'Ordering',  Icon: ShoppingCart },
    { id: 'transfers', label: 'Transfers', Icon: ArrowLeftRight },
    { id: 'history',   label: 'History',   Icon: History },
    { id: 'insights',  label: 'Insights',  Icon: TrendingUp },
    { id: 'locations', label: 'Locations', Icon: MapPin },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200" style={{ borderTopColor: 'var(--primary)' }} />
        <span className="text-xs text-gray-400">Loading R-Stock…</span>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-soft" style={{ backgroundColor: 'var(--primary)' }}>
            <Package size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">R-Stock</h2>
            <p className="text-xs text-gray-400 mt-0.5">Inventory &amp; ordering</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-soft">
            <Package size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{items.length}</span>
            <span className="text-xs text-gray-500">item{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-soft">
            <MapPin size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{activeLocations.length}</span>
            <span className="text-xs text-gray-500">location{activeLocations.length !== 1 ? 's' : ''}</span>
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
          </button>
        ))}
      </div>

      {activeTab === 'items' && (
        <ItemsTab
          items={items}
          sites={sites}
          locations={activeLocations}
          orgId={org.id}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'stocktake' && (
        <StocktakeTab
          items={items}
          sites={sites}
          locations={activeLocations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          onUpdateStatus={handleStatusUpdate}
          onUpdateOrderQty={handleOrderQtyUpdate}
          lastOrderedByKey={lastOrderedByKey}
          mySuppliers={mySuppliers}
          onManageSuppliers={() => setShowAssignmentsModal(true)}
        />
      )}
      {activeTab === 'packaging' && (
        <StocktakeTab
          items={items}
          sites={sites}
          locations={activeLocations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          onUpdateStatus={handleStatusUpdate}
          onUpdateOrderQty={handleOrderQtyUpdate}
          lastOrderedByKey={lastOrderedByKey}
          pinnedCategory="PCK"
          mySuppliers={mySuppliers}
          onManageSuppliers={() => setShowAssignmentsModal(true)}
        />
      )}
      {activeTab === 'ordering' && (
        <OrderingTab
          items={items}
          sites={sites}
          locations={activeLocations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          onUpdateOrderQty={handleOrderQtyUpdate}
          onUpdateOrdered={handleOrderedUpdate}
          mySuppliers={mySuppliers}
          onManageSuppliers={() => setShowAssignmentsModal(true)}
        />
      )}
      {activeTab === 'transfers' && (
        <TransfersTab
          items={items}
          sites={sites}
          locations={activeLocations}
          onUpdateOrderQty={handleOrderQtyUpdate}
          onUpdateOrdered={handleOrderedUpdate}
        />
      )}
      {activeTab === 'history' && (
        <HistoryTab
          items={items}
          locations={activeLocations}
          orderHistory={orderHistory}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
        />
      )}
      {activeTab === 'insights' && (
        <InsightsTab
          items={items}
          sites={sites}
          locations={activeLocations}
          orderHistory={orderHistory}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          lastOrderedByKey={lastOrderedByKey}
        />
      )}
      {activeTab === 'locations' && (
        <LocationsTab
          locations={locations}
          orgId={org.id}
          onRefresh={loadData}
        />
      )}
    </div>
    {showAssignmentsModal && (
      <SupplierAssignmentsModal
        suppliers={allSuppliers}
        assignments={supplierAssignments}
        orgMembers={orgMembers}
        orgId={org.id}
        onClose={() => setShowAssignmentsModal(false)}
        onSaved={loadData}
      />
    )}
    </>
  );
}
