import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, Layers } from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';
import { findGuide, ExplodedDiagram, DIAGRAM_STYLES } from './buildGuides';

export default function BuildsApp({ org }) {
  const orgId = org?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const all = await db.getProductionItems(orgId);
      const relevant = all.filter(i => i.active !== false && (i.category === 'Sandwiches' || i.category === 'Toasties'));
      setItems(relevant);
      setSelectedId(prev => (prev && relevant.some(i => i.id === prev)) ? prev : (relevant[0]?.id ?? null));
    } catch (err) {
      toast.error('Failed to load menu items: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    const groups = new Map();
    filtered.forEach(i => {
      const cat = i.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(i);
    });
    return [...groups.entries()];
  }, [filtered]);

  const selectedItem = items.find(i => i.id === selectedId);
  const guide = selectedItem ? findGuide(selectedItem.name) : null;

  useEffect(() => { setActiveIndex(null); }, [selectedId]);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <style>{DIAGRAM_STYLES}</style>

      <div className="shrink-0 border-b px-4 py-2.5 flex items-center gap-3 bg-white" style={{ borderColor: 'var(--top-border)' }}>
        <Layers size={16} style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-semibold text-gray-700">Sandwich &amp; Toastie Build Guides</span>
        <span className="text-xs text-gray-400">— assembly reference for the line</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r bg-white overflow-y-auto" style={{ borderColor: 'var(--top-border)' }}>
          <div className="p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="px-2 pb-3">
              {grouped.map(([cat, its]) => (
                <div key={cat} className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{cat}</p>
                  {its.map(it => {
                    const hasGuide = !!findGuide(it.name);
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
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : 'bg-gray-300'}`} title="No build guide yet" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!loading && filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No items match.</p>
              )}
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!selectedItem ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Select an item to view its build guide.</div>
          ) : !guide ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Layers size={28} className="text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No build guide yet for {selectedItem.name}</p>
              <p className="text-xs text-gray-400 max-w-xs">This item hasn't been added to the build guide baseline. It's likely a special or limited-time item.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{selectedItem.name}</h1>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}>
                  {guide.category}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-2">Hover a layer, or a step below, to spotlight it.</p>

              <div className="bg-white rounded-2xl border border-gray-100 py-4 px-3">
                <ExplodedDiagram guide={guide} activeIndex={activeIndex} onHover={setActiveIndex} tint="var(--primary-dk)" maxWidth={500} />
              </div>

              <div className="mt-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50 border-b border-gray-100">
                  Stack Order — Top to Base
                </div>
                <div className="divide-y divide-gray-50">
                  {guide.layers.map((l, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                      className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${activeIndex === i ? 'bg-gray-50' : ''}`}
                    >
                      <span className="w-11 shrink-0 text-[10px] font-bold uppercase tracking-wide" style={{ color: l.edge === 'top' ? 'var(--primary-dk)' : l.edge === 'base' ? 'var(--primary-dk)' : '#D1D5DB' }}>
                        {l.edge === 'top' ? 'TOP' : l.edge === 'base' ? 'BASE' : '↑'}
                      </span>
                      <span className="flex-1 font-medium text-gray-800">{l.name}</span>
                      <span className="text-gray-400 text-xs">{l.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
