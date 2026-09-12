import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, History as HistoryIcon, Plus, Trash2, Check, ChevronDown, ChevronUp, ChevronRight, EyeOff, Eye,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// Daily Checklists' admin side: edit the per-site opening/closing master
// lists, and browse the history of what staff actually signed off on. The
// checklists themselves are only ever filled in from the public, no-login
// /checklists/<token> page (see PublicChecklistsView.jsx and
// supabase/functions/public-checklists) -- this app never writes a run or
// a run item, only the template those runs are built from.

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

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

// ── Master list tab ─────────────────────────────────────────────────────────

function ItemRow({ item, onSave, onToggleActive, onDelete, onMove, isFirst, isLast }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [details, setDetails] = useState(item.details || '');

  function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Task name can\'t be empty.'); return; }
    onSave(item.id, { name: trimmed, details: details.trim() || null });
    setEditing(false);
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 ${item.active ? '' : 'opacity-50'}`}>
      <div className="flex flex-col gap-0.5 pt-0.5">
        <button onClick={() => onMove(item, -1)} disabled={isFirst} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300">
          <ChevronUp size={14} />
        </button>
        <button onClick={() => onMove(item, 1)} disabled={isLast} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300">
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <input className="input-base" value={name} onChange={e => setName(e.target.value)} placeholder="Task name" autoFocus />
            <textarea className="input-base" value={details} onChange={e => setDetails(e.target.value)} placeholder="Details (optional)" rows={2} />
            <div className="flex gap-2">
              <button onClick={save} className="text-xs font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5">Save</button>
              <button onClick={() => { setEditing(false); setName(item.name); setDetails(item.details || ''); }} className="text-xs font-medium text-gray-500 px-3 py-1.5">Cancel</button>
            </div>
          </div>
        ) : (
          <button className="text-left w-full" onClick={() => setEditing(true)}>
            <div className="text-sm font-medium text-gray-900">{item.name}</div>
            {item.details && <div className="text-xs text-gray-400 mt-0.5">{item.details}</div>}
          </button>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onToggleActive(item)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" title={item.active ? 'Retire this task' : 'Restore this task'}>
            {item.active ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={() => onDelete(item)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete permanently">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function MasterListTab({ org, sites, items, reload }) {
  const [siteId, setSiteId] = useState(sites[0]?.id || null);
  const [type, setType] = useState('opening');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  useEffect(() => { if (!siteId && sites[0]) setSiteId(sites[0].id); }, [sites, siteId]);

  const filtered = useMemo(() => {
    return items
      .filter(i => i.site_id === siteId && i.type === type && (showRetired || i.active))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [items, siteId, type, showRetired]);

  async function handleSave(itemId, updates) {
    try {
      await db.updateChecklistItem(itemId, updates);
      toast.success('Saved');
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not save');
    }
  }

  async function handleToggleActive(item) {
    try {
      await db.updateChecklistItem(item.id, { active: !item.active });
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not update');
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}" permanently? This can't be undone.`)) return;
    try {
      await db.deleteChecklistItem(item.id);
      toast.success('Deleted');
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not delete');
    }
  }

  async function handleMove(item, dir) {
    const sameList = items
      .filter(i => i.site_id === siteId && i.type === type)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameList.findIndex(i => i.id === item.id);
    const swapWith = sameList[idx + dir];
    if (!swapWith) return;
    try {
      await Promise.all([
        db.updateChecklistItem(item.id, { sort_order: swapWith.sort_order }),
        db.updateChecklistItem(swapWith.id, { sort_order: item.sort_order }),
      ]);
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not reorder');
    }
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const maxSort = Math.max(-1, ...items.filter(i => i.site_id === siteId && i.type === type).map(i => i.sort_order));
    try {
      await db.createChecklistItem(org.id, { siteId, type, name: trimmed, details: newDetails.trim() || null, sortOrder: maxSort + 1 });
      setNewName('');
      setNewDetails('');
      setAdding(false);
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not add task');
    }
  }

  if (sites.length === 0) {
    return <EmptyState Icon={ClipboardList} title="No sites yet" hint="Add a production site in R-Prod first." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {sites.map(s => (
            <button key={s.id} onClick={() => setSiteId(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${siteId === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {['opening', 'closing'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowRetired(v => !v)} className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-700">
          {showRetired ? 'Hide retired' : 'Show retired'}
        </button>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 && !adding ? (
          <EmptyState Icon={ClipboardList} title="No tasks yet" hint="Add the first task below." />
        ) : (
          filtered.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              onSave={handleSave}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onMove={handleMove}
              isFirst={idx === 0}
              isLast={idx === filtered.length - 1}
            />
          ))
        )}
      </div>

      {adding ? (
        <div className="card p-4 space-y-2">
          <input className="input-base" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Task name" autoFocus />
          <textarea className="input-base" value={newDetails} onChange={e => setNewDetails(e.target.value)} placeholder="Details (optional)" rows={2} />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="text-xs font-semibold text-white bg-gray-900 rounded-lg px-3 py-1.5">Add task</button>
            <button onClick={() => { setAdding(false); setNewName(''); setNewDetails(''); }} className="text-xs font-medium text-gray-500 px-3 py-1.5">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <Plus size={14} /> Add task
        </button>
      )}
    </div>
  );
}

// ── History tab ──────────────────────────────────────────────────────────────

function RunRow({ run, siteName }) {
  const [expanded, setExpanded] = useState(false);
  const [runItems, setRunItems] = useState(null);

  async function toggle() {
    if (!expanded && runItems === null) {
      try {
        const rows = await db.getChecklistRunItems(run.id);
        setRunItems(rows);
      } catch (e) {
        toast.error(e.message || 'Could not load this checklist');
        return;
      }
    }
    setExpanded(v => !v);
  }

  const checkedCount = runItems?.filter(i => i.checked).length ?? null;

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/70">
        {expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">
            {siteName} · <span className="capitalize">{run.type}</span> · {formatDate(run.run_date)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {run.signed_off_at
              ? `Signed off by ${run.signed_off_by_name} at ${formatTime(run.signed_off_at)}`
              : 'Not signed off'}
            {checkedCount !== null && ` · ${checkedCount} of ${runItems.length} done`}
          </div>
        </div>
      </button>
      {expanded && runItems && (
        <div className="px-4 pb-4 pl-11 space-y-2">
          {run.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 mb-2">
              <span className="font-semibold">Handoff note: </span>{run.notes}
            </div>
          )}
          {runItems.map(item => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 ${item.checked ? 'bg-gray-900 text-white' : 'border border-gray-300'}`}>
                {item.checked && <Check size={10} />}
              </span>
              <span className={item.checked ? 'text-gray-700' : 'text-gray-400'}>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ sites, runs }) {
  const [siteId, setSiteId] = useState('all');
  const siteById = useMemo(() => new Map(sites.map(s => [s.id, s.name])), [sites]);

  const filtered = useMemo(() => {
    return runs.filter(r => siteId === 'all' || r.site_id === siteId);
  }, [runs, siteId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setSiteId('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${siteId === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          All sites
        </button>
        {sites.map(s => (
          <button key={s.id} onClick={() => setSiteId(s.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${siteId === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState Icon={HistoryIcon} title="No checklists recorded yet" hint="Runs appear here once someone completes one from the staff link." />
        ) : (
          filtered.map(run => <RunRow key={run.id} run={run} siteName={siteById.get(run.site_id) || 'Unknown site'} />)
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function ChecklistsApp({ org }) {
  const [tab, setTab] = useState('items'); // 'items' | 'history'
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [siteRows, itemRows, runRows] = await Promise.all([
        db.getProductionSites(org.id),
        db.getChecklistItems(org.id),
        db.getChecklistRuns(org.id),
      ]);
      setSites(siteRows.filter(s => s.active));
      setItems(itemRows);
      setRuns(runRows);
    } catch (e) {
      toast.error(e.message || 'Could not load checklists');
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-4 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={18} /> Daily Checklists
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Opening & closing procedures, filled in from the staff link.</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('items')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Master List
          </button>
          <button onClick={() => setTab('history')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            History
          </button>
        </div>
      </div>

      {tab === 'items' ? (
        <MasterListTab org={org} sites={sites} items={items} reload={load} />
      ) : (
        <HistoryTab sites={sites} runs={runs} />
      )}
    </div>
  );
}
