import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, X, Loader2, Search, ChevronRight, FlaskConical, Sandwich,
} from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return `$${Number(n).toFixed(2)}`;
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${(Number(n) * 100).toFixed(1)}%`;
}
function fmtQty(n) {
  const num = Number(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// Builds a memoized resolver that costs a component (recursively, through
// nesting) or a single line (SKU or component), with a cycle guard so a
// mistaken circular reference degrades to "unknown cost" instead of hanging.
function useCostResolver(skus, components, componentLines) {
  return useMemo(() => {
    const skuById = new Map(skus.map(s => [s.id, s]));
    const componentById = new Map(components.map(c => [c.id, c]));
    const linesByComponent = new Map();
    componentLines.forEach(l => {
      if (!linesByComponent.has(l.component_id)) linesByComponent.set(l.component_id, []);
      linesByComponent.get(l.component_id).push(l);
    });

    const cache = new Map();
    function componentUnitCost(componentId, visiting = new Set()) {
      if (cache.has(componentId)) return cache.get(componentId);
      if (visiting.has(componentId)) return null;
      const component = componentById.get(componentId);
      if (!component) return null;
      visiting.add(componentId);
      const lines = linesByComponent.get(componentId) || [];
      let batchCost = 0;
      let unresolved = false;
      lines.forEach(line => {
        const qty = Number(line.qty) || 0;
        let unitCost = null;
        if (line.stock_item_id) unitCost = skuById.get(line.stock_item_id)?.cost_per_uom ?? null;
        else if (line.sub_component_id) unitCost = componentUnitCost(line.sub_component_id, visiting);
        if (unitCost == null) { unresolved = true; return; }
        batchCost += qty * unitCost;
      });
      visiting.delete(componentId);
      const yieldQty = Number(component.batch_yield) || 0;
      const result = (unresolved || yieldQty <= 0) ? null : batchCost / yieldQty;
      cache.set(componentId, result);
      return result;
    }

    // Works for both component lines (sub_component_id) and menu item lines (component_id)
    function lineUnitCost(line) {
      if (line.stock_item_id) return skuById.get(line.stock_item_id)?.cost_per_uom ?? null;
      const subId = line.sub_component_id ?? line.component_id;
      if (subId) return componentUnitCost(subId);
      return null;
    }

    function lineName(line) {
      if (line.stock_item_id) return skuById.get(line.stock_item_id)?.name ?? 'Unknown SKU';
      const subId = line.sub_component_id ?? line.component_id;
      return componentById.get(subId)?.name ?? 'Unknown component';
    }

    function lineUom(line) {
      if (line.stock_item_id) return skuById.get(line.stock_item_id)?.uom ?? '';
      const subId = line.sub_component_id ?? line.component_id;
      return componentById.get(subId)?.uom ?? '';
    }

    return { skuById, componentById, componentUnitCost, lineUnitCost, lineName, lineUom };
  }, [skus, components, componentLines]);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// Searchable SKU-or-component combobox for adding an ingredient line.
function IngredientPicker({ skus, components, excludeComponentId, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const skuMatches = skus
    .filter(s => s.active !== false && s.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);
  const componentMatches = components
    .filter(c => c.id !== excludeComponentId && c.active !== false && c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);

  return (
    <Modal title="Add Ingredient" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search SKUs & components…"
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-3">
          {componentMatches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Components</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
                {componentMatches.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onPick({ kind: 'component', id: c.id })}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-400">{c.uom}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {skuMatches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">SKUs</p>
              <div className="bg-gray-50 rounded-xl overflow-hidden divide-y divide-gray-100">
                {skuMatches.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onPick({ kind: 'sku', id: s.id })}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.uom}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {skuMatches.length === 0 && componentMatches.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No matches.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// One ingredient-line row, shared by the Component and Menu Item builders.
function LineRow({ line, resolver, onQtyChange, onDelete }) {
  const [draft, setDraft] = useState(String(line.qty));
  useEffect(() => { setDraft(String(line.qty)); }, [line.qty]);
  const unitCost = resolver.lineUnitCost(line);
  const lineCost = unitCost == null ? null : unitCost * (Number(line.qty) || 0);

  function commit() {
    const n = parseFloat(draft);
    onQtyChange(isNaN(n) || n < 0 ? 0 : n);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{resolver.lineName(line)}</p>
        {unitCost == null && <p className="text-xs text-amber-600">cost unknown</p>}
      </div>
      <input
        type="number"
        min="0"
        step="any"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
      />
      <span className="text-xs text-gray-400 w-8">{resolver.lineUom(line)}</span>
      <span className="text-sm font-semibold text-gray-600 w-16 text-right tabular-nums">{fmtMoney(lineCost)}</span>
      <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Component builder ────────────────────────────────────────────────────────

function ComponentBuilderModal({ component, skus, components, componentLines, resolver, orgId, onClose, onRefresh }) {
  const [name, setName] = useState(component.name);
  const [type, setType] = useState(component.type);
  const [uom, setUom] = useState(component.uom);
  const [batchYield, setBatchYield] = useState(String(component.batch_yield));
  const [savingMeta, setSavingMeta] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const lines = componentLines.filter(l => l.component_id === component.id);
  const unitCost = resolver.componentUnitCost(component.id);
  const batchCost = unitCost == null ? null : unitCost * (Number(batchYield) || 0);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await db.updateRecipeComponent(component.id, {
        name: name.trim() || component.name,
        type,
        uom: uom.trim() || 'g',
        batch_yield: parseFloat(batchYield) || 0,
      });
      onRefresh();
    } catch (err) {
      toast.error('Failed to save: ' + (err.message || 'unknown error'));
    } finally {
      setSavingMeta(false);
    }
  }

  async function handlePick({ kind, id }) {
    setShowPicker(false);
    try {
      await db.createRecipeComponentLine(orgId, {
        component_id: component.id,
        stock_item_id: kind === 'sku' ? id : null,
        sub_component_id: kind === 'component' ? id : null,
        qty: 0,
        sort_order: lines.length,
      });
      onRefresh();
    } catch (err) {
      toast.error('Failed to add ingredient: ' + (err.message || 'unknown error'));
    }
  }

  async function handleQtyChange(line, qty) {
    try {
      await db.updateRecipeComponentLine(line.id, { qty });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update quantity: ' + (err.message || 'unknown error'));
    }
  }

  async function handleDeleteLine(line) {
    try {
      await db.deleteRecipeComponentLine(line.id);
      onRefresh();
    } catch (err) {
      toast.error('Failed to remove ingredient: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <Modal title={component.name || 'New Component'} subtitle="Component recipe" onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} onBlur={saveMeta}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
            <select value={type} onChange={e => { setType(e.target.value); setTimeout(saveMeta, 0); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
              <option value="recipe">Recipe</option>
              <option value="prep">Prep / Yield</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unit</label>
            <input value={uom} onChange={e => setUom(e.target.value)} onBlur={saveMeta} placeholder="g"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Batch Yield ({uom || 'g'})</label>
            <input type="number" min="0" step="any" value={batchYield} onChange={e => setBatchYield(e.target.value)} onBlur={saveMeta}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          </div>
        </div>

        <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">Batch Cost</p>
            <p className="text-lg font-extrabold text-purple-700">{fmtMoney(batchCost)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">Unit Cost</p>
            <p className="text-lg font-extrabold text-purple-700">{unitCost == null ? '—' : `${fmtMoney(unitCost)} / ${uom || 'g'}`}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingredients</p>
            <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700">
              <Plus size={13} /> Add Ingredient
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">No ingredients yet.</p>
          ) : (
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {lines.map(line => (
                <LineRow key={line.id} line={line} resolver={resolver}
                  onQtyChange={q => handleQtyChange(line, q)}
                  onDelete={() => handleDeleteLine(line)} />
              ))}
            </div>
          )}
        </div>
        {savingMeta && <p className="text-xs text-gray-400">Saving…</p>}
      </div>

      {showPicker && (
        <IngredientPicker
          skus={skus}
          components={components}
          excludeComponentId={component.id}
          onPick={handlePick}
          onClose={() => setShowPicker(false)}
        />
      )}
    </Modal>
  );
}

// ── Menu item recipe builder ─────────────────────────────────────────────────

function MenuItemBuilderModal({ item, skus, components, menuItemLines, resolver, orgId, onClose, onRefresh }) {
  const [sellPrice, setSellPrice] = useState(String(item.sell_price ?? ''));
  const [showPicker, setShowPicker] = useState(false);

  const lines = menuItemLines.filter(l => l.item_id === item.id);
  const cogs = lines.reduce((sum, l) => {
    const c = resolver.lineUnitCost(l);
    return c == null ? sum : sum + c * (Number(l.qty) || 0);
  }, 0);
  const hasUnknown = lines.some(l => resolver.lineUnitCost(l) == null);
  const price = parseFloat(sellPrice) || 0;
  const gp = price - cogs;
  const margin = price > 0 ? gp / price : null;

  async function savePrice() {
    try {
      await db.updateProductionItem(item.id, { sell_price: sellPrice === '' ? null : parseFloat(sellPrice) });
      onRefresh();
    } catch (err) {
      toast.error('Failed to save price: ' + (err.message || 'unknown error'));
    }
  }

  async function toggleNeedsPlanning() {
    try {
      await db.updateProductionItem(item.id, { needs_prod_planning: item.needs_prod_planning === false });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update: ' + (err.message || 'unknown error'));
    }
  }

  async function handlePick({ kind, id }) {
    setShowPicker(false);
    try {
      await db.createRecipeMenuItemLine(orgId, {
        item_id: item.id,
        stock_item_id: kind === 'sku' ? id : null,
        component_id: kind === 'component' ? id : null,
        qty: 0,
        sort_order: lines.length,
      });
      onRefresh();
    } catch (err) {
      toast.error('Failed to add ingredient: ' + (err.message || 'unknown error'));
    }
  }

  async function handleQtyChange(line, qty) {
    try {
      await db.updateRecipeMenuItemLine(line.id, { qty });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update quantity: ' + (err.message || 'unknown error'));
    }
  }

  async function handleDeleteLine(line) {
    try {
      await db.deleteRecipeMenuItemLine(line.id);
      onRefresh();
    } catch (err) {
      toast.error('Failed to remove ingredient: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <Modal title={item.name} subtitle="Menu recipe" onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sell Price</label>
          <input type="number" min="0" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} onBlur={savePrice}
            placeholder="0.00"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
        </div>

        <label className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={item.needs_prod_planning !== false}
            onChange={toggleNeedsPlanning}
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400 cursor-pointer"
          />
          <span className="text-sm text-gray-700">Needs planning in R-Prod</span>
          <span className="text-xs text-gray-400 ml-auto">off = made to order / shelf stock</span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">COGS</p>
            <p className="text-base font-extrabold text-purple-700">{hasUnknown ? '≥ ' : ''}{fmtMoney(cogs)}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Gross Profit</p>
            <p className="text-base font-extrabold text-gray-700">{fmtMoney(gp)}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Margin</p>
            <p className="text-base font-extrabold text-gray-700">{fmtPct(margin)}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingredients</p>
            <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700">
              <Plus size={13} /> Add Ingredient
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">No ingredients yet.</p>
          ) : (
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {lines.map(line => (
                <LineRow key={line.id} line={line} resolver={resolver}
                  onQtyChange={q => handleQtyChange(line, q)}
                  onDelete={() => handleDeleteLine(line)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showPicker && (
        <IngredientPicker
          skus={skus}
          components={components}
          onPick={handlePick}
          onClose={() => setShowPicker(false)}
        />
      )}
    </Modal>
  );
}

// ── Components tab ───────────────────────────────────────────────────────────

function ComponentsTab({ orgId, skus, components, componentLines, resolver, onRefresh }) {
  const [showBuilder, setShowBuilder] = useState(null); // component object, or 'new'

  async function handleCreate() {
    try {
      const created = await db.createRecipeComponent(orgId, { name: 'New Component', type: 'recipe', uom: 'g', batch_yield: 0 });
      onRefresh();
      setShowBuilder(created);
    } catch (err) {
      toast.error('Failed to create component: ' + (err.message || 'unknown error'));
    }
  }

  async function handleDelete(component, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${component.name}"? Anything using it in a recipe will lose that ingredient line.`)) return;
    try {
      await db.deleteRecipeComponent(component.id);
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{components.length} component{components.length !== 1 ? 's' : ''}</p>
        <button onClick={handleCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors">
          <Plus size={14} /> Add Component
        </button>
      </div>

      {components.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FlaskConical size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No components yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {components.map(c => {
            const unitCost = resolver.componentUnitCost(c.id);
            return (
              <button key={c.id} onClick={() => setShowBuilder(c)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors text-left">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${c.type === 'prep' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                  {c.type === 'prep' ? 'Prep' : 'Recipe'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">Yield {fmtQty(c.batch_yield)} {c.uom}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 tabular-nums">{unitCost == null ? '—' : `${fmtMoney(unitCost)}/${c.uom}`}</span>
                <button onClick={e => handleDelete(c, e)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={13} />
                </button>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>
      )}

      {showBuilder && (
        <ComponentBuilderModal
          component={showBuilder}
          skus={skus}
          components={components}
          componentLines={componentLines}
          resolver={resolver}
          orgId={orgId}
          onClose={() => setShowBuilder(null)}
          onRefresh={() => { onRefresh(); setShowBuilder(prev => components.find(c => c.id === prev?.id) || prev); }}
        />
      )}
    </div>
  );
}

// ── Menu Recipes tab (doubles as the COGS overview) ─────────────────────────

function MenuRecipesTab({ orgId, skus, components, menuItems, menuItemLines, resolver, onRefresh }) {
  const [showBuilder, setShowBuilder] = useState(null);

  const rows = menuItems.map(item => {
    const lines = menuItemLines.filter(l => l.item_id === item.id);
    const cogs = lines.reduce((sum, l) => {
      const c = resolver.lineUnitCost(l);
      return c == null ? sum : sum + c * (Number(l.qty) || 0);
    }, 0);
    const hasLines = lines.length > 0;
    const price = Number(item.sell_price) || 0;
    const gp = price - cogs;
    const margin = price > 0 ? gp / price : null;
    return { item, cogs: hasLines ? cogs : null, price, gp, margin };
  });

  async function togglePlanning(item, e) {
    e.stopPropagation();
    try {
      await db.updateProductionItem(item.id, { needs_prod_planning: item.needs_prod_planning === false });
      onRefresh();
    } catch (err) {
      toast.error('Failed to update: ' + (err.message || 'unknown error'));
    }
  }

  const grouped = useMemo(() => {
    const groups = new Map();
    rows.forEach(r => {
      const cat = r.item.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(r);
    });
    return [...groups.entries()];
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const avgMargin = useMemo(() => {
    const withMargin = rows.filter(r => r.margin != null);
    if (withMargin.length === 0) return null;
    return withMargin.reduce((s, r) => s + r.margin, 0) / withMargin.length;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{menuItems.length} menu item{menuItems.length !== 1 ? 's' : ''}</p>
        {avgMargin != null && <p className="text-xs text-gray-400">Avg. margin <span className="font-semibold text-gray-600">{fmtPct(avgMargin)}</span></p>}
      </div>

      {menuItems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Sandwich size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No menu items yet — add them in R-Prod first.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">COGS</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">GP</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide" title="Whether this item is planned in R-Prod (batch-prepped) vs made to order / shelf stock">R-Prod</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([cat, catRows]) => (
                <React.Fragment key={cat}>
                  <tr>
                    <td colSpan={7} className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-white">{cat}</td>
                  </tr>
                  {catRows.map(({ item, cogs, price, gp, margin }) => (
                    <tr key={item.id} onClick={() => setShowBuilder(item)} className="border-b border-gray-50 hover:bg-purple-50/40 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtMoney(cogs)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{item.sell_price == null ? <span className="text-gray-300">—</span> : fmtMoney(price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{cogs == null || item.sell_price == null ? <span className="text-gray-300">—</span> : fmtMoney(gp)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-purple-700">{fmtPct(margin)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={item.needs_prod_planning !== false}
                          onChange={e => togglePlanning(item, e)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right"><ChevronRight size={15} className="text-gray-300 inline" /></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBuilder && (
        <MenuItemBuilderModal
          item={showBuilder}
          skus={skus}
          components={components}
          menuItemLines={menuItemLines}
          resolver={resolver}
          orgId={orgId}
          onClose={() => setShowBuilder(null)}
          onRefresh={() => { onRefresh(); setShowBuilder(prev => menuItems.find(i => i.id === prev?.id) || prev); }}
        />
      )}
    </div>
  );
}

// ── Main RecipesApp ──────────────────────────────────────────────────────────

export default function RecipesApp({ org }) {
  const orgId = org?.id;
  const [activeTab, setActiveTab] = useState('menu'); // 'components' | 'menu'
  const [skus, setSkus] = useState([]);
  const [components, setComponents] = useState([]);
  const [componentLines, setComponentLines] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuItemLines, setMenuItemLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [sk, comp, compLines, items, itemLines] = await Promise.all([
        db.getStockItems(orgId),
        db.getRecipeComponents(orgId),
        db.getRecipeComponentLines(orgId),
        db.getProductionItems(orgId),
        db.getRecipeMenuItemLines(orgId),
      ]);
      setSkus(sk);
      setComponents(comp);
      setComponentLines(compLines);
      setMenuItems(items.filter(i => i.active !== false));
      setMenuItemLines(itemLines);
    } catch (err) {
      toast.error('Failed to load recipes: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const resolver = useCostResolver(skus, components, componentLines);

  const TABS = [
    { id: 'components', label: 'Components' },
    { id: 'menu', label: 'Menu Recipes' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">R-Recipe</h2>
        <p className="text-sm text-gray-400 mt-0.5">Components and menu recipes, with live COGS &amp; margin. SKU pricing lives in R-Stock.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'components' && (
        <ComponentsTab orgId={orgId} skus={skus} components={components} componentLines={componentLines} resolver={resolver} onRefresh={load} />
      )}
      {activeTab === 'menu' && (
        <MenuRecipesTab orgId={orgId} skus={skus} components={components} menuItems={menuItems} menuItemLines={menuItemLines} resolver={resolver} onRefresh={load} />
      )}
    </div>
  );
}
