import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, Trash2, Edit2, Loader2, ChevronDown, ChevronUp,
  MapPin, Clock, Truck, DollarSign, StickyNote, User, Building2, UtensilsCrossed,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// ── Date helpers ─────────────────────────────────────────────────────────────

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
function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}
// 42-cell (6 week) grid, Monday-first, for the given month.
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

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = ['Breakfast', 'Morning Tea', 'Lunch', 'Afternoon Tea', 'Other'];
const TYPE_COLORS = {
  'Breakfast':     { bg: '#FEF3C7', fg: '#92400E' },
  'Morning Tea':   { bg: '#DBEAFE', fg: '#1E40AF' },
  'Lunch':         { bg: '#FCE7F3', fg: '#9D174D' },
  'Afternoon Tea': { bg: '#EDE9FE', fg: '#5B21B6' },
  'Other':         { bg: '#F1F5F9', fg: '#475569' },
};
const COMMON_MENU_ITEMS = [
  'Chicken Avo Wrap', 'Recess Club', 'Chickpea Smash', 'BLT', 'Pastrami', 'Curried Egg',
  'Super Green', 'Ham, Cheese & Pickle', 'Big Tuna', 'The Deli', 'The Bella', 'Caesar',
  'Chicken & Greens Salad', 'Veg & Grains Salad', 'Herby Greens Salad',
];

const DIETARY_FIELDS = [
  { key: 'gf_ppl',         label: 'GF',    color: '#B45309', bg: '#FEF3C7' },
  { key: 'vego_ppl',       label: 'Vego',  color: '#15803D', bg: '#DCFCE7' },
  { key: 'pb_ppl',         label: 'PB',    color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'dairy_free_ppl', label: 'DF',    color: '#0F766E', bg: '#CCFBF1' },
  { key: 'halal_ppl',      label: 'Halal', color: '#BE185D', bg: '#FCE7F3' },
];

const CHECKBOX_FIELDS = [
  { key: 'confirmed',       label: 'Confirmed' },
  { key: 'invoiced',        label: 'Invoiced' },
  { key: 'bread_ordered',   label: 'Bread Ordered' },
  { key: 'delivery_booked', label: 'Delivery Booked' },
];

// ── Shared bits ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300";

// ── Mini month calendar ──────────────────────────────────────────────────────

function MiniCalendar({ year, month, onMonthChange, selectedDate, onSelectDate, jobCountByDate }) {
  const days = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayKey = todayStr();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={() => onMonthChange(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-gray-900">{monthLabel(year, month)}</span>
        <button onClick={() => onMonthChange(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
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
              className="relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors"
              style={{
                color: !inMonth ? '#D1D5DB' : isSelected ? 'white' : isToday ? 'var(--primary-dk)' : '#374151',
                background: isSelected ? 'var(--primary)' : isToday ? 'color-mix(in srgb, var(--primary) 12%, white)' : 'transparent',
                fontWeight: isToday || isSelected ? 700 : 500,
              }}
            >
              {d.getDate()}
              {count > 0 && (
                <span
                  className="absolute bottom-0.5 w-1 h-1 rounded-full"
                  style={{ background: isSelected ? 'white' : 'var(--primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Menu item breakdown editor ───────────────────────────────────────────────

function MenuItemsEditor({ items, onChange }) {
  function updateRow(idx, field, value) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function addRow() {
    onChange([...items, { name: '', qty: '' }]);
  }
  function removeRow(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <datalist id="menu-item-suggestions">
        {COMMON_MENU_ITEMS.map(n => <option key={n} value={n} />)}
      </datalist>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-1">No menu items added yet.</p>
      )}
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            list="menu-item-suggestions"
            value={it.name}
            onChange={e => updateRow(idx, 'name', e.target.value)}
            placeholder="e.g. Chicken Avo Wrap"
            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
          <input
            type="number"
            min="0"
            value={it.qty}
            onChange={e => updateRow(idx, 'qty', e.target.value)}
            placeholder="Qty"
            className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
          <button onClick={() => removeRow(idx)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
        <Plus size={13} /> Add menu item
      </button>
    </div>
  );
}

// ── Add / Edit Catering Job form ─────────────────────────────────────────────

function emptyJob(date) {
  return {
    job_date: date, company: '', contact: '', job_type: 'Lunch', address: '', ready_by: '',
    delivery_method: '', sambos_ppl: '', pieces_per_person: '', salads: '', breakfast_ppl: '',
    coffee_ppl: '', gf_ppl: '', vego_ppl: '', pb_ppl: '', dairy_free_ppl: '', halal_ppl: '',
    confirmed: false, invoiced: false, bread_ordered: false, delivery_booked: false,
    gross_rev: '', notes: '', items: [],
  };
}

function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function JobFormModal({ orgId, userId, date, job, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => job ? {
    ...emptyJob(date),
    ...job,
    sambos_ppl: job.sambos_ppl ?? '', pieces_per_person: job.pieces_per_person ?? '',
    breakfast_ppl: job.breakfast_ppl ?? '', coffee_ppl: job.coffee_ppl ?? '',
    gf_ppl: job.gf_ppl ?? '', vego_ppl: job.vego_ppl ?? '', pb_ppl: job.pb_ppl ?? '',
    dairy_free_ppl: job.dairy_free_ppl ?? '', halal_ppl: job.halal_ppl ?? '',
    gross_rev: job.gross_rev ?? '', items: job.items || [],
  } : emptyJob(date));
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        job_date: draft.job_date,
        company: draft.company.trim() || null,
        contact: draft.contact.trim() || null,
        job_type: draft.job_type || null,
        address: draft.address.trim() || null,
        ready_by: draft.ready_by.trim() || null,
        delivery_method: draft.delivery_method.trim() || null,
        sambos_ppl: toNumOrNull(draft.sambos_ppl),
        pieces_per_person: toNumOrNull(draft.pieces_per_person),
        salads: draft.salads.trim() || null,
        breakfast_ppl: toNumOrNull(draft.breakfast_ppl),
        coffee_ppl: toNumOrNull(draft.coffee_ppl),
        gf_ppl: toNumOrNull(draft.gf_ppl),
        vego_ppl: toNumOrNull(draft.vego_ppl),
        pb_ppl: toNumOrNull(draft.pb_ppl),
        dairy_free_ppl: toNumOrNull(draft.dairy_free_ppl),
        halal_ppl: toNumOrNull(draft.halal_ppl),
        confirmed: !!draft.confirmed,
        invoiced: !!draft.invoiced,
        bread_ordered: !!draft.bread_ordered,
        delivery_booked: !!draft.delivery_booked,
        gross_rev: toNumOrNull(draft.gross_rev),
        notes: draft.notes.trim() || null,
        items: (draft.items || [])
          .filter(it => it.name.trim())
          .map(it => ({ name: it.name.trim(), qty: toNumOrNull(it.qty) ?? 0 })),
      };
      if (job?.id) {
        await db.updateCateringJob(job.id, userId, payload);
        toast.success('Catering job updated');
      } else {
        await db.createCateringJob(orgId, userId, payload);
        toast.success('Catering job added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save job: ' + (err.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={job ? 'Edit Catering Job' : 'Add Catering Job'} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Basics */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={draft.job_date} onChange={e => set('job_date', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Type">
            <select value={draft.job_type} onChange={e => set('job_type', e.target.value)} className={inputCls + ' bg-white'}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Company">
            <input value={draft.company} onChange={e => set('company', e.target.value)} placeholder="e.g. Betashares" className={inputCls} />
          </Field>
          <Field label="Contact">
            <input value={draft.contact} onChange={e => set('contact', e.target.value)} placeholder="e.g. Karyne" className={inputCls} />
          </Field>
          <Field label="Address / Location">
            <input value={draft.address} onChange={e => set('address', e.target.value)} placeholder="Delivery address or Pick-up" className={inputCls} />
          </Field>
          <Field label="Ready By">
            <input value={draft.ready_by} onChange={e => set('ready_by', e.target.value)} placeholder="e.g. 11:30 or 11:30-12:00" className={inputCls} />
          </Field>
          <Field label="Delivery Method">
            <input value={draft.delivery_method} onChange={e => set('delivery_method', e.target.value)} placeholder="Pick-up / Courier / CW" className={inputCls} />
          </Field>
          <Field label="Gross Revenue $">
            <input type="number" min="0" step="0.01" value={draft.gross_rev} onChange={e => set('gross_rev', e.target.value)} placeholder="0.00" className={inputCls} />
          </Field>
        </div>

        {/* Headcounts */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Quantities</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sambos (ppl)">
              <input type="number" min="0" value={draft.sambos_ppl} onChange={e => set('sambos_ppl', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Pieces / Person">
              <input type="number" min="0" step="0.5" value={draft.pieces_per_person} onChange={e => set('pieces_per_person', e.target.value)} placeholder="e.g. 3" className={inputCls} />
            </Field>
            <Field label="Salads">
              <input value={draft.salads} onChange={e => set('salads', e.target.value)} placeholder="e.g. 2 x Large" className={inputCls} />
            </Field>
            <Field label="Breakfast (ppl)">
              <input type="number" min="0" value={draft.breakfast_ppl} onChange={e => set('breakfast_ppl', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Coffee (ppl)">
              <input type="number" min="0" value={draft.coffee_ppl} onChange={e => set('coffee_ppl', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Dietaries */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Dietaries (headcount)</p>
          <div className="grid grid-cols-5 gap-3">
            {DIETARY_FIELDS.map(f => (
              <Field key={f.key} label={f.label}>
                <input type="number" min="0" value={draft[f.key]} onChange={e => set(f.key, e.target.value)} className={inputCls} />
              </Field>
            ))}
          </div>
        </div>

        {/* Menu item breakdown */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Menu Item Breakdown</p>
          <MenuItemsEditor items={draft.items} onChange={v => set('items', v)} />
        </div>

        {/* Notes */}
        <Field label="Notes">
          <textarea
            value={draft.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Dietary nuances, special requests, anything the kitchen needs to know…"
            className={inputCls}
          />
        </Field>

        {/* Admin checkboxes */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Status</p>
          <div className="flex flex-wrap gap-4">
            {CHECKBOX_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-1.5 text-sm text-gray-700 select-none cursor-pointer">
                <input type="checkbox" checked={!!draft[f.key]} onChange={e => set(f.key, e.target.checked)} className="rounded" />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {saving ? 'Saving…' : job ? 'Save Changes' : 'Add Job'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Job card (day list) ──────────────────────────────────────────────────────

function QtyPill({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
      {icon} {label}
    </span>
  );
}

function JobCard({ job, expanded, onToggle, onEdit, onDelete, onToggleFlag }) {
  const typeColor = TYPE_COLORS[job.job_type] || TYPE_COLORS.Other;
  const qtyPills = [];
  if (job.sambos_ppl) qtyPills.push({ key: 'sambos', label: `🥪 ${job.sambos_ppl} ppl${job.pieces_per_person ? ` @ ${job.pieces_per_person}pc` : ''}` });
  if (job.breakfast_ppl) qtyPills.push({ key: 'breakfast', label: `🍳 ${job.breakfast_ppl} ppl` });
  if (job.coffee_ppl) qtyPills.push({ key: 'coffee', label: `☕ ${job.coffee_ppl} ppl` });
  if (job.salads) qtyPills.push({ key: 'salads', label: `🥗 ${job.salads}` });

  const dietaryBadges = DIETARY_FIELDS.filter(f => job[f.key] > 0);
  const itemsTotal = (job.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <div className="w-16 shrink-0 text-xs font-bold text-gray-500 flex items-center gap-1">
          <Clock size={12} className="text-gray-300" /> {job.ready_by || '—'}
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full" style={{ background: typeColor.bg, color: typeColor.fg }}>
          {job.job_type || 'Other'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{job.company || 'Untitled job'}</p>
          {job.contact && <p className="text-xs text-gray-400 truncate">{job.contact}</p>}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end max-w-xs">
          {qtyPills.slice(0, 2).map(p => <QtyPill key={p.key} label={p.label} />)}
        </div>
        {job.confirmed ? (
          <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-green-50 text-green-700">Confirmed</span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-700">Pending</span>
        )}
        {expanded ? <ChevronUp size={16} className="text-gray-300 shrink-0" /> : <ChevronDown size={16} className="text-gray-300 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* For the kitchen */}
          <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--primary) 6%, white)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--primary-dk)' }}>For the Kitchen</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {qtyPills.length > 0 ? qtyPills.map(p => <QtyPill key={p.key} label={p.label} />) : (
                <span className="text-xs text-gray-400">No quantities recorded yet.</span>
              )}
              {dietaryBadges.map(f => (
                <span key={f.key} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ background: f.bg, color: f.color }}>
                  {f.label}: {job[f.key]}
                </span>
              ))}
            </div>

            {job.items && job.items.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden mb-2">
                {job.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-gray-700">{it.name}</span>
                    <span className="font-bold tabular-nums text-gray-900">{it.qty}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-1.5 text-sm bg-gray-50">
                  <span className="font-semibold text-gray-500">Total pieces</span>
                  <span className="font-extrabold tabular-nums" style={{ color: 'var(--primary-dk)' }}>{itemsTotal}</span>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
              {job.address && <div className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400 shrink-0" /> {job.address}</div>}
              {job.delivery_method && <div className="flex items-center gap-1.5"><Truck size={12} className="text-gray-400 shrink-0" /> {job.delivery_method}</div>}
              {job.contact && <div className="flex items-center gap-1.5"><User size={12} className="text-gray-400 shrink-0" /> {job.contact}</div>}
              {job.company && <div className="flex items-center gap-1.5"><Building2 size={12} className="text-gray-400 shrink-0" /> {job.company}</div>}
            </div>

            {job.notes && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-gray-600 bg-white rounded-lg border border-gray-100 px-3 py-2">
                <StickyNote size={12} className="text-gray-400 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">{job.notes}</span>
              </div>
            )}
          </div>

          {/* Admin */}
          <div className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Admin</p>
              {job.gross_rev != null && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600">
                  <DollarSign size={12} /> {Number(job.gross_rev).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mb-3">
              {CHECKBOX_FIELDS.map(f => (
                <label key={f.key} className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
                  <input type="checkbox" checked={!!job[f.key]} onChange={e => onToggleFlag(f.key, e.target.checked)} className="rounded" />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <Edit2 size={12} /> Edit
              </button>
              <button onClick={onDelete} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CateringApp ─────────────────────────────────────────────────────────

export default function CateringApp({ org, user }) {
  const orgId = org?.id;
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const gridDays = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const rangeStart = fmtISO(gridDays[0]);
  const rangeEnd = fmtISO(gridDays[gridDays.length - 1]);

  const loadJobs = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const rows = await db.getCateringJobsRange(orgId, rangeStart, rangeEnd);
      setJobs(rows);
    } catch (err) {
      toast.error('Failed to load catering jobs: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId, rangeStart, rangeEnd]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  function changeMonth(delta) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalMonth(m);
    setCalYear(y);
  }

  function selectDate(dateStr) {
    setSelectedDate(dateStr);
    setExpandedId(null);
    const d = new Date(dateStr + 'T12:00:00');
    if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) {
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  }

  function goToday() {
    selectDate(todayStr());
  }

  function stepDay(n) {
    selectDate(addDays(selectedDate, n));
  }

  const jobCountByDate = useMemo(() => {
    const m = new Map();
    jobs.forEach(j => m.set(j.job_date, (m.get(j.job_date) || 0) + 1));
    return m;
  }, [jobs]);

  const jobsForDay = useMemo(() => jobs.filter(j => j.job_date === selectedDate), [jobs, selectedDate]);

  async function handleDelete(job) {
    if (!window.confirm(`Delete the catering job for "${job.company || 'this job'}"?`)) return;
    try {
      await db.deleteCateringJob(job.id);
      toast.success('Job deleted');
      loadJobs();
    } catch (err) {
      toast.error('Failed to delete job: ' + (err.message || 'unknown error'));
    }
  }

  async function handleToggleFlag(job, key, value) {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, [key]: value } : j));
    try {
      await db.updateCateringJob(job.id, user.id, { [key]: value });
    } catch (err) {
      toast.error('Failed to update: ' + (err.message || 'unknown error'));
      loadJobs();
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      {/* Toolbar */}
      <div className="shrink-0 border-b px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 bg-white flex-wrap" style={{ borderColor: 'var(--top-border)' }}>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepDay(-1)}
            className="p-2.5 rounded-lg transition-colors hover:brightness-95 active:brightness-90"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="text-center min-w-[150px]">
            <div className="text-sm font-bold text-gray-900 leading-tight tracking-tight">{dayLabel(selectedDate)}</div>
            <div className="text-xs text-gray-400">{fmtDateShort(selectedDate)}</div>
          </div>
          <button
            onClick={() => stepDay(1)}
            className="p-2.5 rounded-lg transition-colors hover:brightness-95 active:brightness-90"
            style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
          {selectedDate !== todayStr() && (
            <button onClick={goToday} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors ml-1">
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => { setEditingJob(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={15} /> Add Catering Job
        </button>
      </div>

      {/* Body: calendar + day list */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r p-3 overflow-y-auto" style={{ borderColor: 'var(--top-border)' }}>
          <MiniCalendar
            year={calYear}
            month={calMonth}
            onMonthChange={changeMonth}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            jobCountByDate={jobCountByDate}
          />
        </aside>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : jobsForDay.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm mb-3">No catering jobs on this day.</p>
              <button
                onClick={() => { setEditingJob(null); setShowForm(true); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white"
                style={{ background: 'var(--primary)' }}
              >
                <Plus size={14} /> Add Catering Job
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-w-3xl mx-auto">
              {jobsForDay.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedId === job.id}
                  onToggle={() => setExpandedId(prev => prev === job.id ? null : job.id)}
                  onEdit={() => { setEditingJob(job); setShowForm(true); }}
                  onDelete={() => handleDelete(job)}
                  onToggleFlag={(key, value) => handleToggleFlag(job, key, value)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {showForm && (
        <JobFormModal
          orgId={orgId}
          userId={user?.id}
          date={selectedDate}
          job={editingJob}
          onClose={() => { setShowForm(false); setEditingJob(null); }}
          onSaved={loadJobs}
        />
      )}
    </div>
  );
}
