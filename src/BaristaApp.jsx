import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, Coffee, Plus, Trash2, ChevronUp, ChevronDown, Pencil, History } from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// Ingredients are never authored here -- they're always read live from
// R-Recipe's recipe_menu_item_lines, so a recipe change never leaves a
// guide's ingredient list out of sync. This only resolves a line's
// display name/uom for that read-only summary; no costing involved.
function lineDisplay(line, skuById, componentById) {
  if (line.stock_item_id) {
    const sku = skuById.get(line.stock_item_id);
    return { name: sku?.name ?? 'Unknown SKU', uom: sku?.uom ?? '' };
  }
  const component = componentById.get(line.component_id);
  return { name: component?.name ?? 'Unknown component', uom: component?.uom ?? '' };
}

function fmtQty(n) {
  const num = Number(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export default function BaristaApp({ org, user }) {
  const orgId = org?.id;
  const [items, setItems] = useState([]);
  const [skus, setSkus] = useState([]);
  const [components, setComponents] = useState([]);
  const [menuItemLines, setMenuItemLines] = useState([]);
  const [guides, setGuides] = useState([]);
  const [stepsByGuide, setStepsByGuide] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draftSteps, setDraftSteps] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [allItems, skuList, componentList, lines, guideList] = await Promise.all([
        db.getProductionItems(orgId),
        db.getStockItems(orgId),
        db.getRecipeComponents(orgId),
        db.getRecipeMenuItemLines(orgId),
        db.getDrinkGuides(orgId),
      ]);
      const relevant = allItems.filter(i => i.active !== false && i.category === 'Coffee & Tea');
      const steps = await db.getDrinkGuideSteps(orgId, guideList.map(g => g.id));
      const byGuide = new Map();
      steps.forEach(s => {
        if (!byGuide.has(s.guide_id)) byGuide.set(s.guide_id, []);
        byGuide.get(s.guide_id).push(s);
      });

      setItems(relevant);
      setSkus(skuList);
      setComponents(componentList);
      setMenuItemLines(lines);
      setGuides(guideList);
      setStepsByGuide(byGuide);
      setSelectedId(prev => (prev && relevant.some(i => i.id === prev)) ? prev : (relevant[0]?.id ?? null));
    } catch (err) {
      toast.error('Failed to load drinks: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setEditing(false); }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const skuById = useMemo(() => new Map(skus.map(s => [s.id, s])), [skus]);
  const componentById = useMemo(() => new Map(components.map(c => [c.id, c])), [components]);

  const selectedItem = items.find(i => i.id === selectedId);
  const guide = selectedItem ? guides.find(g => g.production_item_id === selectedItem.id) : null;
  const steps = guide ? (stepsByGuide.get(guide.id) || []) : [];
  const ingredientLines = selectedItem
    ? menuItemLines.filter(l => l.item_id === selectedItem.id && !l.is_packaging)
    : [];

  function startEditing() {
    setDraftSteps(steps.length ? steps.map(s => s.instruction_text) : ['']);
    setEditing(true);
  }

  function updateDraftStep(i, text) {
    setDraftSteps(prev => prev.map((s, idx) => idx === i ? text : s));
  }
  function addDraftStep() {
    setDraftSteps(prev => [...prev, '']);
  }
  function removeDraftStep(i) {
    setDraftSteps(prev => prev.filter((_, idx) => idx !== i));
  }
  function moveDraftStep(i, dir) {
    setDraftSteps(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function saveGuide() {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await db.saveDrinkGuide(orgId, {
        productionItemId: selectedItem.id,
        steps: draftSteps,
        previousGuideId: guide?.id ?? null,
        previousVersion: guide?.version ?? 0,
        userId: user?.id,
      });
      toast.success('Guide saved');
      setEditing(false);
      await load();
    } catch (err) {
      toast.error('Failed to save guide: ' + (err.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="shrink-0 border-b px-4 py-2.5 flex items-center gap-3 bg-white" style={{ borderColor: 'var(--top-border)' }}>
        <Coffee size={16} style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-semibold text-gray-700">Drinks Guide</span>
        <span className="text-xs text-gray-400">— step-by-step reference for Coffee &amp; Tea, built on top of R-Recipe</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r bg-white overflow-y-auto" style={{ borderColor: 'var(--top-border)' }}>
          <div className="p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search drinks…"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="px-2 pb-3">
              {filtered.map(it => {
                const hasGuide = guides.some(g => g.production_item_id === it.id);
                const isSelected = selectedId === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${isSelected ? 'text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                    style={isSelected ? { background: 'var(--primary)' } : {}}
                  >
                    <span className="flex-1 truncate">{it.name}</span>
                    {!hasGuide && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : 'bg-gray-300'}`} title="No guide yet" />
                    )}
                  </button>
                );
              })}
              {!loading && filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No drinks match.</p>
              )}
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!selectedItem ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Select a drink to view its guide.</div>
          ) : (
            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{selectedItem.name}</h1>
                {!editing && (
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    <Pencil size={13} /> {guide ? 'Edit Guide' : 'Add Guide'}
                  </button>
                )}
              </div>
              {guide && (
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                  <History size={11} /> Version {guide.version}
                </p>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredients (from R-Recipe)</p>
                {ingredientLines.length === 0 ? (
                  <p className="text-sm text-gray-400">No ingredients set up in R-Recipe yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {ingredientLines.map(l => {
                      const { name, uom } = lineDisplay(l, skuById, componentById);
                      return (
                        <li key={l.id} className="flex items-baseline justify-between text-sm">
                          <span className="text-gray-700">{name}</span>
                          <span className="text-gray-400">{fmtQty(l.qty)} {uom}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Method</p>

                {editing ? (
                  <div className="space-y-2">
                    {draftSteps.map((text, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-sm font-bold text-gray-300 pt-2 w-4 shrink-0">{i + 1}.</span>
                        <textarea
                          value={text}
                          onChange={e => updateDraftStep(i, e.target.value)}
                          rows={1}
                          placeholder="e.g. Steam milk to 55°C"
                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                        />
                        <div className="flex flex-col shrink-0">
                          <button onClick={() => moveDraftStep(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                            <ChevronUp size={14} />
                          </button>
                          <button onClick={() => moveDraftStep(i, 1)} disabled={i === draftSteps.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30">
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <button onClick={() => removeDraftStep(i)} className="text-gray-300 hover:text-red-500 shrink-0 pt-2">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={addDraftStep} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 mt-1">
                      <Plus size={13} /> Add Step
                    </button>

                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                      <button
                        onClick={saveGuide}
                        disabled={saving}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
                        style={{ background: 'var(--primary)' }}
                      >
                        {saving ? 'Saving…' : 'Save Guide'}
                      </button>
                      <button onClick={() => setEditing(false)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : steps.length === 0 ? (
                  <p className="text-sm text-gray-400">No guide yet for {selectedItem.name}.</p>
                ) : (
                  <ol className="space-y-2">
                    {steps.map(s => (
                      <li key={s.id} className="flex gap-2 text-sm">
                        <span className="font-bold" style={{ color: 'var(--primary-dk)' }}>{s.step_number}.</span>
                        <span className="text-gray-700">{s.instruction_text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
