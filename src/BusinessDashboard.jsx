import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { fetchAllData, parsePeriod } from './sheetsData';
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  BarChart3, RefreshCw, ArrowLeft, Star, Heart,
  Utensils, Truck, AlertCircle, Filter, ChevronDown, SlidersHorizontal, LayoutGrid,
  Calendar, FileText,
} from 'lucide-react';

// --- CONSTANTS ---
const COLORS = {
  primary: '#f97316',
  secondary: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  amber: '#f59e0b',
  teal: '#14b8a6',
};

const CHART_COLORS = [COLORS.primary, COLORS.secondary, COLORS.green, COLORS.purple, COLORS.pink, COLORS.amber];

// --- PERIOD HELPERS ---

// Format period for axis labels: "Q1-2024 M03 W12" -> "W12 '24", "Q1-2024 W12" -> "W12 '24"
function shortPeriodLabel(period) {
  if (!period) return '';
  const parsed = parsePeriod(period);
  if (!parsed) {
    // Fallback: try to extract just Wxx
    const m = period.match(/W(\d{1,2})/);
    return m ? `W${m[1]}` : period;
  }
  if (parsed.year) return `W${parsed.week} '${String(parsed.year).slice(2)}`;
  return `W${parsed.week}`;
}

// Build available years/quarters from data
function getAvailableFilters(dataArrays) {
  const years = new Set();
  const quarters = new Set();
  for (const arr of dataArrays) {
    for (const d of arr) {
      const p = parsePeriod(d.period);
      if (p?.year) {
        years.add(p.year);
        quarters.add(`Q${p.quarter} ${p.year}`);
      }
    }
  }
  return {
    years: [...years].sort(),
    quarters: [...quarters].sort(),
  };
}

// Extract the week number from any period string
function getWeekNum(period) {
  const m = period?.match(/W(\d{1,2})/);
  return m ? parseInt(m[1]) : null;
}

// Get all unique week numbers present in multiple data arrays
function getAllWeekNumbers(dataArrays) {
  const weeks = new Set();
  for (const arr of dataArrays) {
    for (const d of arr) {
      const w = getWeekNum(d.period);
      if (w != null) weeks.add(w);
    }
  }
  return [...weeks].sort((a, b) => a - b);
}

// Apply filter + week exclusions to data array
function applyFilter(data, filter, excludedWeeks) {
  if (!data || data.length === 0) return data;

  let result = data;

  if (filter.type === 'weeks') {
    result = result.slice(-filter.value);
  } else if (filter.type === 'year') {
    result = result.filter(d => {
      const p = parsePeriod(d.period);
      return p?.year === filter.value;
    });
  } else if (filter.type === 'quarter') {
    const [q, y] = filter.value.split(' ');
    const qNum = parseInt(q.replace('Q', ''));
    const yNum = parseInt(y);
    result = result.filter(d => {
      const p = parsePeriod(d.period);
      return p?.year === yNum && p?.quarter === qNum;
    });
  }

  // Apply week exclusions
  if (excludedWeeks && excludedWeeks.size > 0) {
    result = result.filter(d => {
      const w = getWeekNum(d.period);
      return w == null || !excludedWeeks.has(w);
    });
  }

  return result;
}

// --- FORMATTERS ---
function fmtCurrency(val) {
  if (val == null) return '-';
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function fmtDollar(val) {
  if (val == null) return '-';
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(val) {
  if (val == null) return '-';
  return `${val.toFixed(1)}%`;
}

// --- FILTER DROPDOWN ---
function FilterBar({ filter, setFilter, availableFilters }) {
  const [open, setOpen] = useState(false);

  const filterLabel = useMemo(() => {
    if (filter.type === 'weeks') return `Last ${filter.value} weeks`;
    if (filter.type === 'year') return `${filter.value}`;
    if (filter.type === 'quarter') return filter.value;
    return 'All time';
  }, [filter]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors shadow-soft"
      >
        <Filter size={14} className="text-surface-400" />
        <span className="text-surface-700">{filterLabel}</span>
        <ChevronDown size={14} className={`text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg shadow-elevated border border-surface-200 py-1 w-52 max-h-72 overflow-y-auto">
            <div className="px-3 py-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Time Range</div>
            {[12, 26, 52].map(n => (
              <button key={n} onClick={() => { setFilter({ type: 'weeks', value: n }); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${filter.type === 'weeks' && filter.value === n ? 'text-brand-600 font-semibold bg-orange-50' : 'text-surface-700'}`}>
                Last {n} weeks
              </button>
            ))}
            <button onClick={() => { setFilter({ type: 'all' }); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${filter.type === 'all' ? 'text-brand-600 font-semibold bg-orange-50' : 'text-surface-700'}`}>
              All time
            </button>

            {availableFilters.years.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider mt-1 border-t border-surface-100">By Year</div>
                {availableFilters.years.map(y => (
                  <button key={y} onClick={() => { setFilter({ type: 'year', value: y }); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${filter.type === 'year' && filter.value === y ? 'text-brand-600 font-semibold bg-orange-50' : 'text-surface-700'}`}>
                    {y}
                  </button>
                ))}
              </>
            )}

            {availableFilters.quarters.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider mt-1 border-t border-surface-100">By Quarter</div>
                {availableFilters.quarters.map(q => (
                  <button key={q} onClick={() => { setFilter({ type: 'quarter', value: q }); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 ${filter.type === 'quarter' && filter.value === q ? 'text-brand-600 font-semibold bg-orange-50' : 'text-surface-700'}`}>
                    {q}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// --- WEEK EXCLUSION BAR ---
function WeekExclusionBar({ excludedWeeks, setExcludedWeeks, allWeekNumbers }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = (w) => {
    setExcludedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const presets = [
    { label: 'Holidays (W52, W1)', weeks: [52, 1] },
  ];

  const applyPreset = (weeks) => {
    setExcludedWeeks(prev => {
      const next = new Set(prev);
      const allPresent = weeks.every(w => next.has(w));
      if (allPresent) {
        weeks.forEach(w => next.delete(w));
      } else {
        weeks.forEach(w => next.add(w));
      }
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-card p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-surface-700">Exclude Weeks</h3>
          {excludedWeeks.size > 0 && (
            <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
              {excludedWeeks.size} excluded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Presets */}
          {presets.map((preset, i) => {
            const allActive = preset.weeks.every(w => excludedWeeks.has(w));
            return (
              <button
                key={i}
                onClick={() => applyPreset(preset.weeks)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  allActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {allActive ? 'Include' : 'Exclude'} {preset.label}
              </button>
            );
          })}
          {excludedWeeks.size > 0 && (
            <button
              onClick={() => setExcludedWeeks(new Set())}
              className="text-xs px-2.5 py-1 rounded-lg font-medium text-surface-500 hover:bg-surface-100 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-2.5 py-1 rounded-lg font-medium text-surface-500 hover:bg-surface-100 transition-colors"
          >
            {expanded ? 'Collapse' : 'All weeks'}
          </button>
        </div>
      </div>

      {/* Active exclusions shown as chips */}
      {excludedWeeks.size > 0 && !expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[...excludedWeeks].sort((a, b) => a - b).map(w => (
            <button
              key={w}
              onClick={() => toggle(w)}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              W{w}
              <span className="text-red-400 ml-0.5">&times;</span>
            </button>
          ))}
        </div>
      )}

      {/* Expanded: show all weeks as toggleable pills */}
      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {allWeekNumbers.map(w => {
            const isExcluded = excludedWeeks.has(w);
            return (
              <button
                key={w}
                onClick={() => toggle(w)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  isExcluded
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 line-through'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                W{w}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- KPI Card ---
function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'brand', invertTrend = false }) {
  const colorMap = {
    brand: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  // For cost metrics, going up is bad (red), going down is good (green)
  const trendIsGood = trend != null ? (invertTrend ? trend < 0 : trend >= 0) : null;

  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex items-start gap-4 animate-fade-in">
      <div className={`p-3 rounded-lg ${colorMap[color] || colorMap.brand}`}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-500 font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-surface-800 mt-0.5">{value}</p>
        {(subtitle || trend != null) && (
          <div className="flex items-center gap-1.5 mt-1">
            {trend != null && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendIsGood ? 'text-green-600' : 'text-red-500'}`}>
                {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {subtitle && <span className="text-xs text-surface-400">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Y-Axis range hook ---
function useAxisRange(defaultMin = '', defaultMax = '') {
  const [min, setMin] = useState(defaultMin);
  const [max, setMax] = useState(defaultMax);
  const domain = useMemo(() => {
    const lo = min !== '' ? parseFloat(min) : 'auto';
    const hi = max !== '' ? parseFloat(max) : 'auto';
    return [lo, hi];
  }, [min, max]);
  return { min, max, setMin, setMax, domain };
}

// --- Y-Axis controls inline ---
function AxisControls({ axis }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className={`p-1 rounded transition-colors ${open || axis.min !== '' || axis.max !== '' ? 'text-brand-600 bg-orange-50' : 'text-surface-400 hover:text-surface-600'}`}
        title="Adjust Y-axis range"
      >
        <SlidersHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg shadow-elevated border border-surface-200 p-3 w-48">
            <p className="text-xs font-semibold text-surface-500 mb-2">Y-Axis Range</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-surface-400 block mb-0.5">Min</label>
                <input
                  type="number"
                  value={axis.min}
                  onChange={e => axis.setMin(e.target.value)}
                  placeholder="auto"
                  className="w-full text-xs px-2 py-1.5 border border-surface-200 rounded-md focus:outline-none focus:border-brand-400"
                />
              </div>
              <span className="text-surface-300 mt-3">–</span>
              <div className="flex-1">
                <label className="text-[10px] text-surface-400 block mb-0.5">Max</label>
                <input
                  type="number"
                  value={axis.max}
                  onChange={e => axis.setMax(e.target.value)}
                  placeholder="auto"
                  className="w-full text-xs px-2 py-1.5 border border-surface-200 rounded-md focus:outline-none focus:border-brand-400"
                />
              </div>
            </div>
            {(axis.min !== '' || axis.max !== '') && (
              <button
                onClick={() => { axis.setMin(''); axis.setMax(''); }}
                className="text-xs text-surface-500 hover:text-surface-700 mt-2"
              >
                Reset to auto
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// --- Chart Card wrapper ---
function ChartCard({ title, subtitle, children, className = '', axis }) {
  return (
    <div className={`bg-white rounded-xl shadow-card p-5 animate-fade-in ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-surface-800">{title}</h3>
          {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
        </div>
        {axis && <AxisControls axis={axis} />}
      </div>
      {children}
    </div>
  );
}

// Shared tooltip
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 text-white text-xs rounded-lg px-3 py-2 shadow-elevated">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          <span className="text-surface-300">{entry.name}:</span>
          <span className="font-semibold">{formatter ? formatter(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// Shared axis tick styling
const TICK_STYLE = { fontSize: 11, fill: '#64748b' };

// Compute WoW trend %
function trend(arr) {
  if (!arr || arr.length < 2) return null;
  const cur = arr[arr.length - 1]?.value;
  const prev = arr[arr.length - 2]?.value;
  if (!prev || !cur) return null;
  return ((cur - prev) / prev) * 100;
}

function lastVal(arr) {
  return arr?.[arr.length - 1]?.value ?? null;
}

// ===========================
// REVENUE TAB
// ===========================
function RevenueTab({ data, filter, excludedWeeks }) {
  const f = useCallback((arr) => applyFilter(arr, filter, excludedWeeks), [filter, excludedWeeks]);

  const totalRev = useMemo(() => f(data.totalRevenue), [f, data.totalRevenue]);
  const aov = useMemo(() => f(data.aov), [f, data.aov]);
  const dailyCust = useMemo(() => f(data.avgDailyCustomers), [f, data.avgDailyCustomers]);
  const avgDailyRev = useMemo(() => f(data.avgDailyRevenue), [f, data.avgDailyRevenue]);

  const revAxis = useAxisRange();
  const channelAxis = useAxisRange();
  const aovAxis = useAxisRange();
  const custAxis = useAxisRange();
  const mixAxis = useAxisRange();

  const revenuePerHour = useMemo(() => f(data.avgRevenuePerHour), [f, data.avgRevenuePerHour]);

  // Product mix (food/drinks/snacks %)
  const productMixData = useMemo(() => {
    const food = f(data.foodPct);
    const drinks = f(data.drinksPct);
    const snacks = f(data.snacksPct);
    const len = Math.max(food.length, drinks.length, snacks.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push({
        period: shortPeriodLabel(food[i]?.period || drinks[i]?.period || snacks[i]?.period),
        Food: food[i]?.value ?? null,
        Drinks: drinks[i]?.value ?? null,
        Snacks: snacks[i]?.value ?? null,
      });
    }
    return result;
  }, [f, data.foodPct, data.drinksPct, data.snacksPct]);

  const latestMix = productMixData[productMixData.length - 1];
  const pieMixData = latestMix ? [
    { name: 'Food', value: latestMix.Food || 0 },
    { name: 'Drinks', value: latestMix.Drinks || 0 },
    { name: 'Snacks', value: latestMix.Snacks || 0 },
  ].filter(d => d.value > 0) : [];

  // Stacked channel breakdown
  const channelData = useMemo(() => {
    const inStore = f(data.inStoreRevenue);
    const delivery = f(data.uberEatsRevenue);
    const catering = f(data.cateringRevenue);
    const classpass = f(data.classpassRevenue);
    const len = Math.max(inStore.length, delivery.length, catering.length, classpass.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push({
        period: shortPeriodLabel(inStore[i]?.period || delivery[i]?.period || catering[i]?.period || classpass[i]?.period),
        'In-Store': inStore[i]?.value || 0,
        'Delivery': delivery[i]?.value || 0,
        'Catering': catering[i]?.value || 0,
        'ClassPass/TGTG': classpass[i]?.value || 0,
      });
    }
    return result;
  }, [f, data.inStoreRevenue, data.uberEatsRevenue, data.cateringRevenue, data.classpassRevenue]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Weekly Revenue" value={fmtDollar(lastVal(totalRev))} trend={trend(totalRev)} subtitle="latest week" icon={DollarSign} color="brand" />
        <KpiCard title="Avg Order Value" value={lastVal(aov) ? `$${lastVal(aov).toFixed(2)}` : '-'} trend={trend(aov)} subtitle="per transaction" icon={ShoppingCart} color="blue" />
        <KpiCard title="Daily Customers" value={lastVal(dailyCust)?.toFixed(0) || '-'} trend={trend(dailyCust)} subtitle="avg per day" icon={Users} color="green" />
        <KpiCard title="Daily Revenue" value={fmtDollar(lastVal(avgDailyRev))} trend={trend(avgDailyRev)} subtitle="in-store avg" icon={BarChart3} color="purple" />
        <KpiCard title="Revenue / Hour" value={fmtDollar(lastVal(revenuePerHour))} trend={trend(revenuePerHour)} subtitle="trading hour avg" icon={Calendar} color="amber" />
      </div>

      {/* Revenue Trend */}
      <ChartCard title="Total Revenue" subtitle="Weekly revenue over time" axis={revAxis}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={totalRev.map(d => ({ ...d, period: shortPeriodLabel(d.period) }))}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(totalRev.length / 12) - 1)} />
            <YAxis domain={revAxis.domain} tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
            <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
            <Area type="monotone" dataKey="value" name="Revenue" stroke={COLORS.primary} fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Breakdown */}
        <ChartCard title="Revenue by Channel" subtitle="In-Store, Delivery, Catering, ClassPass" axis={channelAxis}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(channelData.length / 10) - 1)} />
              <YAxis domain={channelAxis.domain} tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
              <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="In-Store" stackId="a" fill={COLORS.primary} />
              <Bar dataKey="Delivery" stackId="a" fill={COLORS.secondary} />
              <Bar dataKey="Catering" stackId="a" fill={COLORS.green} />
              <Bar dataKey="ClassPass/TGTG" stackId="a" fill={COLORS.purple} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* AOV Trend */}
        <ChartCard title="Average Order Value" subtitle="AOV trend over time" axis={aovAxis}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aov.map(d => ({ ...d, period: shortPeriodLabel(d.period) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(aov.length / 10) - 1)} />
              <YAxis domain={aovAxis.domain} tickFormatter={v => `$${v}`} tick={TICK_STYLE} width={50} />
              <Tooltip content={<ChartTooltip formatter={v => `$${v.toFixed(2)}`} />} />
              <Line type="monotone" dataKey="value" name="AOV" stroke={COLORS.secondary} strokeWidth={2.5} dot={aov.length <= 20 ? { r: 3 } : false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Daily Customers */}
      <ChartCard title="Average Daily Customers" subtitle="Customer count per day by week" axis={custAxis}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dailyCust.map(d => ({ ...d, period: shortPeriodLabel(d.period) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(dailyCust.length / 12) - 1)} />
            <YAxis domain={custAxis.domain} tick={TICK_STYLE} width={40} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" name="Customers" fill={COLORS.green} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Product Mix */}
      {productMixData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Product Mix Trend" subtitle="Food / Drinks / Snacks share of revenue" className="lg:col-span-2" axis={mixAxis}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={productMixData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(productMixData.length / 10) - 1)} />
                <YAxis domain={mixAxis.domain} tickFormatter={v => `${v}%`} tick={TICK_STYLE} width={45} />
                <Tooltip content={<ChartTooltip formatter={fmtPct} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Food" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.15} strokeWidth={2} dot={false} connectNulls />
                <Area type="monotone" dataKey="Drinks" stroke={COLORS.secondary} fill={COLORS.secondary} fillOpacity={0.15} strokeWidth={2} dot={false} connectNulls />
                <Area type="monotone" dataKey="Snacks" stroke={COLORS.amber} fill={COLORS.amber} fillOpacity={0.15} strokeWidth={2} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Latest Mix" subtitle="Revenue share this week">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieMixData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {pieMixData.map((_, i) => (
                    <Cell key={i} fill={[COLORS.primary, COLORS.secondary, COLORS.amber][i % 3]} />
                  ))}
                </Pie>
                <Tooltip formatter={fmtPct} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===========================
// COSTS TAB
// ===========================
function CostsTab({ data, filter, excludedWeeks }) {
  const f = useCallback((arr) => applyFilter(arr, filter, excludedWeeks), [filter, excludedWeeks]);

  const totalCogs = useMemo(() => f(data.totalCogs), [f, data.totalCogs]);
  const cogsPct = useMemo(() => f(data.cogsPctRevenue), [f, data.cogsPctRevenue]);
  const labourPct = useMemo(() => f(data.labourPctRevenue), [f, data.labourPctRevenue]);

  const ratiosAxis = useAxisRange();
  const vendorAxis = useAxisRange();
  const cogsAxis = useAxisRange();

  // Combined ratios chart
  const ratiosData = useMemo(() => {
    const cogs = f(data.cogsPctRevenue);
    const labour = f(data.labourPctRevenue);
    const len = Math.max(cogs.length, labour.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push({
        period: shortPeriodLabel(cogs[i]?.period || labour[i]?.period),
        'COGS %': cogs[i]?.value ?? null,
        'Labour %': labour[i]?.value ?? null,
      });
    }
    return result;
  }, [f, data.cogsPctRevenue, data.labourPctRevenue]);

  // Vendor stacked
  const vendorData = useMemo(() => {
    const fb = f(data.foodbyus);
    const om = f(data.ordermentum);
    const sm = f(data.supermarket);
    const ds = f(data.directSupply);
    const len = Math.max(fb.length, om.length, sm.length, ds.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push({
        period: shortPeriodLabel(fb[i]?.period || om[i]?.period || sm[i]?.period || ds[i]?.period),
        Foodbyus: fb[i]?.value || 0,
        Ordermentum: om[i]?.value || 0,
        Supermarket: sm[i]?.value || 0,
        'Direct Supply': ds[i]?.value || 0,
      });
    }
    return result;
  }, [f, data.foodbyus, data.ordermentum, data.supermarket, data.directSupply]);

  // Vendor pie totals
  const vendorTotals = useMemo(() => {
    const sum = (arr) => f(arr).reduce((s, d) => s + (d.value || 0), 0);
    return [
      { name: 'Foodbyus', value: sum(data.foodbyus) },
      { name: 'Ordermentum', value: sum(data.ordermentum) },
      { name: 'Supermarket', value: sum(data.supermarket) },
      { name: 'Direct Supply', value: sum(data.directSupply) },
    ].filter(d => d.value > 0);
  }, [f, data.foodbyus, data.ordermentum, data.supermarket, data.directSupply]);

  const latestCogsPct = lastVal(cogsPct);
  const latestLabourPct = lastVal(labourPct);
  const latestCogsPerUnit = lastVal(f(data.cogsPerUnit));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Weekly COGS" value={fmtDollar(lastVal(totalCogs))} trend={trend(totalCogs)} subtitle="latest week" icon={Truck} color="brand" invertTrend />
        <KpiCard title="COGS % Revenue" value={fmtPct(latestCogsPct)} trend={trend(cogsPct)} subtitle="of total revenue" icon={ShoppingCart} color="blue" invertTrend />
        <KpiCard title="Labour % Revenue" value={fmtPct(latestLabourPct)} trend={trend(labourPct)} subtitle="of total revenue" icon={Users} color="green" invertTrend />
        <KpiCard title="COGS per Unit" value={latestCogsPerUnit ? `$${latestCogsPerUnit.toFixed(2)}` : '-'} trend={trend(f(data.cogsPerUnit))} subtitle="avg unit cost" icon={Utensils} color="purple" invertTrend />
      </div>

      {/* Cost Ratios */}
      <ChartCard title="Cost Ratios" subtitle="COGS % and Labour % of revenue over time" axis={ratiosAxis}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={ratiosData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(ratiosData.length / 12) - 1)} />
            <YAxis domain={ratiosAxis.domain} tickFormatter={v => `${v}%`} tick={TICK_STYLE} width={45} />
            <Tooltip content={<ChartTooltip formatter={fmtPct} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="COGS %" stroke={COLORS.primary} strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Labour %" stroke={COLORS.secondary} strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Breakdown */}
        <ChartCard title="COGS by Vendor" subtitle="Weekly spend by supplier" axis={vendorAxis}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={vendorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(vendorData.length / 10) - 1)} />
              <YAxis domain={vendorAxis.domain} tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
              <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Foodbyus" stackId="a" fill={COLORS.primary} />
              <Bar dataKey="Ordermentum" stackId="a" fill={COLORS.secondary} />
              <Bar dataKey="Supermarket" stackId="a" fill={COLORS.green} />
              <Bar dataKey="Direct Supply" stackId="a" fill={COLORS.purple} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Vendor Pie */}
        <ChartCard title="Vendor Share" subtitle="COGS distribution by supplier">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={vendorTotals}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
              >
                {vendorTotals.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={fmtDollar} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Total COGS Trend */}
      <ChartCard title="Total COGS" subtitle="Weekly cost of goods sold" axis={cogsAxis}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={totalCogs.map(d => ({ ...d, period: shortPeriodLabel(d.period) }))}>
            <defs>
              <linearGradient id="cogsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(totalCogs.length / 12) - 1)} />
            <YAxis domain={cogsAxis.domain} tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
            <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
            <Area type="monotone" dataKey="value" name="Total COGS" stroke={COLORS.red} fill="url(#cogsGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ===========================
// CUSTOMER TAB
// ===========================
function CustomerTab({ data, filter, excludedWeeks }) {
  // Customer data uses "W12" format without year — filter by weeks count only
  const f = useCallback((arr) => {
    if (!arr || arr.length === 0) return arr;
    let result = arr;
    if (filter.type === 'weeks') result = result.slice(-filter.value);
    else if (filter.type === 'year' || filter.type === 'quarter') result = result.slice(-12);
    // Apply week exclusions
    if (excludedWeeks && excludedWeeks.size > 0) {
      result = result.filter(d => {
        const w = getWeekNum(d.period);
        return w == null || !excludedWeeks.has(w);
      });
    }
    return result;
  }, [filter, excludedWeeks]);

  const ig = useMemo(() => f(data.instagramFollowers), [f, data.instagramFollowers]);
  const tiktok = useMemo(() => f(data.tiktokFollowers), [f, data.tiktokFollowers]);
  const loyalty = useMemo(() => f(data.loyaltyMembers), [f, data.loyaltyMembers]);
  const reviews = useMemo(() => f(data.googleReviews), [f, data.googleReviews]);

  const socialAxis = useAxisRange();
  const igAxis = useAxisRange();
  const reviewsAxis = useAxisRange();

  // Combined social growth
  const socialData = useMemo(() => {
    const len = Math.max(ig.length, tiktok.length, loyalty.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push({
        period: ig[i]?.period || tiktok[i]?.period || loyalty[i]?.period || '',
        Instagram: ig[i]?.value || 0,
        TikTok: tiktok[i]?.value || 0,
        Loyalty: loyalty[i]?.value || 0,
      });
    }
    return result;
  }, [ig, tiktok, loyalty]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Instagram" value={lastVal(ig)?.toLocaleString() || '-'} subtitle="followers" icon={Heart} color="pink" />
        <KpiCard title="TikTok" value={lastVal(tiktok)?.toLocaleString() || '-'} subtitle="followers" icon={Heart} color="purple" />
        <KpiCard title="Loyalty" value={lastVal(loyalty)?.toLocaleString() || '-'} subtitle="members" icon={Users} color="brand" />
        <KpiCard title="Google Reviews" value={lastVal(reviews)?.toLocaleString() || '-'} subtitle="total" icon={Star} color="blue" />
        <KpiCard title="Google Rating" value={lastVal(f(data.googleRating))?.toFixed(1) || '-'} subtitle="out of 5.0" icon={Star} color="green" />
      </div>

      {/* Combined Growth */}
      <ChartCard title="Audience Growth" subtitle="Instagram, TikTok & Loyalty members" axis={socialAxis}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={socialData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(socialData.length / 12) - 1)} />
            <YAxis domain={socialAxis.domain} tick={TICK_STYLE} width={50} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Instagram" stroke={COLORS.pink} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="TikTok" stroke={COLORS.purple} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Loyalty" stroke={COLORS.primary} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instagram Growth */}
        <ChartCard title="Instagram Followers" subtitle="Growth trajectory" axis={igAxis}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={ig.map(d => ({ ...d }))}>
              <defs>
                <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.pink} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.pink} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(ig.length / 10) - 1)} />
              <YAxis domain={igAxis.domain} tick={TICK_STYLE} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" name="Followers" stroke={COLORS.pink} fill="url(#igGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Google Reviews */}
        <ChartCard title="Google Reviews" subtitle="Review count growth" axis={reviewsAxis}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reviews.map(d => ({ ...d }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(reviews.length / 10) - 1)} />
              <YAxis domain={reviewsAxis.domain} tick={TICK_STYLE} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Reviews" fill={COLORS.secondary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ===========================
// QUARTERLY OVERVIEW TAB
// ===========================

// Aggregate weekly data into quarterly sums/averages
function aggregateQuarterly(weeklyData, mode = 'sum') {
  const buckets = {};
  for (const d of weeklyData) {
    const p = parsePeriod(d.period);
    if (!p?.year || !p?.quarter) continue;
    const key = `Q${p.quarter} ${p.year}`;
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0, last: null };
    buckets[key].sum += d.value;
    buckets[key].count += 1;
    buckets[key].last = d.value;
  }
  // Sort chronologically
  const sorted = Object.entries(buckets).sort((a, b) => {
    const [aq, ay] = [parseInt(a[0][1]), parseInt(a[0].split(' ')[1])];
    const [bq, by] = [parseInt(b[0][1]), parseInt(b[0].split(' ')[1])];
    return ay !== by ? ay - by : aq - bq;
  });
  return sorted.map(([key, v]) => ({
    quarter: key,
    value: mode === 'sum' ? v.sum : mode === 'avg' ? v.sum / v.count : v.last,
  }));
}

// Compute QoQ growth for each entry
function withQoQ(data) {
  return data.map((d, i) => ({
    ...d,
    qoq: i > 0 && data[i - 1].value ? ((d.value - data[i - 1].value) / data[i - 1].value) * 100 : null,
  }));
}

function QoQBadge({ value, invertTrend = false }) {
  if (value == null) return <span className="text-xs text-surface-300">—</span>;
  const pos = value >= 0;
  const isGood = invertTrend ? !pos : pos;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isGood ? 'text-green-600' : 'text-red-500'}`}>
      {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pos ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function OverviewTab({ data }) {
  // Revenue metrics - sum per quarter
  const qRevenue = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.totalRevenue, 'sum')), [data.revenue.totalRevenue]);
  const qInStore = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.inStoreRevenue, 'sum')), [data.revenue.inStoreRevenue]);
  const qDelivery = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.uberEatsRevenue, 'sum')), [data.revenue.uberEatsRevenue]);
  const qCatering = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.cateringRevenue, 'sum')), [data.revenue.cateringRevenue]);

  // Average per quarter
  const qAov = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.aov, 'avg')), [data.revenue.aov]);
  const qDailyCustomers = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.avgDailyCustomers, 'avg')), [data.revenue.avgDailyCustomers]);
  const qDailyRevenue = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.avgDailyRevenue, 'avg')), [data.revenue.avgDailyRevenue]);
  const qRevenuePerHour = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.avgRevenuePerHour, 'avg')), [data.revenue.avgRevenuePerHour]);

  // Costs - sum per quarter
  const qCogs = useMemo(() => withQoQ(aggregateQuarterly(data.costs.totalCogs, 'sum')), [data.costs.totalCogs]);
  const qLabour = useMemo(() => withQoQ(aggregateQuarterly(data.costs.totalLabour, 'sum')), [data.costs.totalLabour]);
  const qUnitsSold = useMemo(() => withQoQ(aggregateQuarterly(data.costs.unitsSold, 'sum')), [data.costs.unitsSold]);
  // Derived ratios — computed from quarterly totals, not averaged from weekly %s
  const qCogsPct = useMemo(() => withQoQ(qCogs.map((d, i) => ({
    quarter: d.quarter,
    value: qRevenue[i]?.value > 0 ? (d.value / qRevenue[i].value) * 100 : 0,
  }))), [qCogs, qRevenue]);
  const qLabourPct = useMemo(() => withQoQ(qLabour.map((d, i) => ({
    quarter: d.quarter,
    value: qRevenue[i]?.value > 0 ? (d.value / qRevenue[i].value) * 100 : 0,
  }))), [qLabour, qRevenue]);
  const qCogsPerUnit = useMemo(() => withQoQ(qCogs.map((d, i) => ({
    quarter: d.quarter,
    value: qUnitsSold[i]?.value > 0 ? d.value / qUnitsSold[i].value : 0,
  }))), [qCogs, qUnitsSold]);

  // Gross profit = revenue - cogs
  const qGrossProfit = useMemo(() => {
    return withQoQ(qRevenue.map((r, i) => ({
      quarter: r.quarter,
      value: r.value - (qCogs[i]?.value || 0),
    })));
  }, [qRevenue, qCogs]);

  // Gross margin = gross profit / revenue * 100
  const qGrossMargin = useMemo(() => {
    return withQoQ(qRevenue.map((r, i) => ({
      quarter: r.quarter,
      value: r.value > 0 ? ((r.value - (qCogs[i]?.value || 0)) / r.value) * 100 : 0,
    })));
  }, [qRevenue, qCogs]);

  // Contribution margin = gross profit - labour
  const qContribMargin = useMemo(() => {
    return withQoQ(qGrossProfit.map((r, i) => ({
      quarter: r.quarter,
      value: r.value - (qLabour[i]?.value || 0),
    })));
  }, [qGrossProfit, qLabour]);

  const qContribMarginPct = useMemo(() => {
    return withQoQ(qRevenue.map((r, i) => ({
      quarter: r.quarter,
      value: r.value > 0 ? (qContribMargin[i]?.value / r.value) * 100 : 0,
    })));
  }, [qRevenue, qContribMargin]);

  // Quarters list
  const quarters = qRevenue.map(d => d.quarter);

  // Combined chart data for stacked revenue bar + line overlays
  const chartData = useMemo(() => {
    return quarters.map((q, i) => ({
      quarter: q,
      'In-Store': qInStore[i]?.value || 0,
      'Delivery': qDelivery[i]?.value || 0,
      'Catering': qCatering[i]?.value || 0,
      'Gross Profit': qGrossProfit[i]?.value || 0,
    }));
  }, [quarters, qInStore, qDelivery, qCatering, qGrossProfit]);

  const ratioChartData = useMemo(() => {
    return quarters.map((q, i) => ({
      quarter: q,
      'COGS %': qCogsPct[i]?.value || 0,
      'Labour %': qLabourPct[i]?.value || 0,
      'Gross Margin %': qGrossMargin[i]?.value || 0,
      'Contrib. Margin %': qContribMarginPct[i]?.value || 0,
    }));
  }, [quarters, qCogsPct, qLabourPct, qGrossMargin, qContribMarginPct]);

  // Table row helper
  const MetricRow = ({ label, data: rowData, format = 'currency', className = '', invertTrend = false }) => (
    <tr className={`border-b border-surface-100 hover:bg-surface-50 transition-colors ${className}`}>
      <td className="py-3 pr-4 text-sm font-medium text-surface-700 whitespace-nowrap sticky left-0 bg-white">{label}</td>
      {rowData.map((d, i) => (
        <td key={i} className="py-3 px-3 text-right">
          <div className="text-sm font-semibold text-surface-800">
            {format === 'currency' ? fmtDollar(d.value) :
             format === 'pct' ? fmtPct(d.value) :
             format === 'dollar2' ? (d.value != null ? `$${d.value.toFixed(2)}` : '-') :
             format === 'number' ? (d.value != null ? d.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-') :
             format === 'decimal1' ? (d.value != null ? d.value.toFixed(1) : '-') :
             d.value}
          </div>
          <QoQBadge value={d.qoq} invertTrend={invertTrend} />
        </td>
      ))}
    </tr>
  );

  const SectionHeader = ({ children }) => (
    <tr>
      <td colSpan={quarters.length + 1} className="pt-5 pb-2 sticky left-0">
        <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">{children}</span>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* Key headline KPIs - latest quarter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Quarterly Revenue"
          value={fmtDollar(qRevenue[qRevenue.length - 1]?.value)}
          trend={qRevenue[qRevenue.length - 1]?.qoq}
          subtitle={qRevenue[qRevenue.length - 1]?.quarter}
          icon={DollarSign} color="brand"
        />
        <KpiCard
          title="Gross Margin"
          value={fmtPct(qGrossMargin[qGrossMargin.length - 1]?.value)}
          trend={qGrossMargin[qGrossMargin.length - 1]?.qoq}
          subtitle={qGrossMargin[qGrossMargin.length - 1]?.quarter}
          icon={BarChart3} color="green"
        />
        <KpiCard
          title="Avg Order Value"
          value={qAov[qAov.length - 1]?.value ? `$${qAov[qAov.length - 1].value.toFixed(2)}` : '-'}
          trend={qAov[qAov.length - 1]?.qoq}
          subtitle={qAov[qAov.length - 1]?.quarter}
          icon={ShoppingCart} color="blue"
        />
        <KpiCard
          title="Daily Customers"
          value={qDailyCustomers[qDailyCustomers.length - 1]?.value?.toFixed(0) || '-'}
          trend={qDailyCustomers[qDailyCustomers.length - 1]?.qoq}
          subtitle={qDailyCustomers[qDailyCustomers.length - 1]?.quarter}
          icon={Users} color="purple"
        />
      </div>

      {/* Revenue + Profit chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Quarterly Revenue by Channel" subtitle="Stacked revenue breakdown">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="quarter" tick={TICK_STYLE} />
              <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
              <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="In-Store" stackId="a" fill={COLORS.primary} />
              <Bar dataKey="Delivery" stackId="a" fill={COLORS.secondary} />
              <Bar dataKey="Catering" stackId="a" fill={COLORS.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost Ratios & Gross Margin" subtitle="Quarterly averages">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={ratioChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="quarter" tick={TICK_STYLE} />
              <YAxis tickFormatter={v => `${v}%`} tick={TICK_STYLE} width={45} />
              <Tooltip content={<ChartTooltip formatter={fmtPct} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Gross Margin %" stroke={COLORS.green} strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Contrib. Margin %" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 4 }} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="COGS %" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Labour %" stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Full quarterly table */}
      <div className="bg-white rounded-xl shadow-card animate-fade-in">
        <div className="p-5 border-b border-surface-100">
          <h3 className="text-base font-semibold text-surface-800">Quarterly Performance</h3>
          <p className="text-xs text-surface-400 mt-0.5">All key metrics with quarter-over-quarter growth</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-3 pr-4 text-xs font-semibold text-surface-500 uppercase tracking-wider sticky left-0 bg-white">Metric</th>
                {quarters.map(q => (
                  <th key={q} className="py-3 px-3 text-right text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">{q}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SectionHeader>Revenue</SectionHeader>
              <MetricRow label="Total Revenue" data={qRevenue} />
              <MetricRow label="In-Store" data={qInStore} />
              <MetricRow label="Delivery" data={qDelivery} />
              <MetricRow label="Catering / B2B" data={qCatering} />

              <SectionHeader>Profitability</SectionHeader>
              <MetricRow label="Total COGS" data={qCogs} invertTrend />
              <MetricRow label="Gross Profit" data={qGrossProfit} />
              <MetricRow label="Gross Margin %" data={qGrossMargin} format="pct" />
              <MetricRow label="Total Labour" data={qLabour} invertTrend />
              <MetricRow label="Contribution Margin" data={qContribMargin} />
              <MetricRow label="Contrib. Margin %" data={qContribMarginPct} format="pct" />

              <SectionHeader>Unit Economics</SectionHeader>
              <MetricRow label="Avg Order Value" data={qAov} format="dollar2" />
              <MetricRow label="Avg Daily Customers" data={qDailyCustomers} format="decimal1" />
              <MetricRow label="Avg Daily Revenue" data={qDailyRevenue} />
              <MetricRow label="Revenue per Hour" data={qRevenuePerHour} />
              <MetricRow label="Units Sold" data={qUnitsSold} format="number" />
              <MetricRow label="COGS per Unit" data={qCogsPerUnit} format="dollar2" />

              <SectionHeader>Cost Ratios</SectionHeader>
              <MetricRow label="COGS % of Revenue" data={qCogsPct} format="pct" invertTrend />
              <MetricRow label="Labour % of Revenue" data={qLabourPct} format="pct" invertTrend />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================
// WEEKLY VIEW TAB
// ===========================
function WeeklyTab({ data, filter, excludedWeeks }) {
  const f = useCallback((arr) => applyFilter(arr, filter, excludedWeeks), [filter, excludedWeeks]);

  const weeklyRows = useMemo(() => {
    const map = {};

    const add = (arr, key) => {
      for (const d of f(arr)) {
        const p = parsePeriod(d.period);
        if (!p) continue;
        const mapKey = p.year
          ? `${p.year}-${String(p.week).padStart(2, '0')}`
          : `0000-${String(p.week).padStart(2, '0')}`;
        if (!map[mapKey]) map[mapKey] = { period: d.period, year: p.year, week: p.week, quarter: p.quarter ? `Q${p.quarter} ${p.year}` : '' };
        map[mapKey][key] = d.value;
      }
    };

    add(data.revenue.totalRevenue, 'revenue');
    add(data.revenue.aov, 'aov');
    add(data.revenue.avgDailyCustomers, 'dailyCustomers');
    add(data.revenue.avgDailyRevenue, 'dailyRevenue');
    add(data.revenue.avgRevenuePerHour, 'revenuePerHour');
    add(data.revenue.tradingHours, 'tradingHours');
    add(data.costs.totalCogs, 'cogs');
    add(data.costs.cogsPctRevenue, 'cogsPct');
    add(data.costs.totalLabour, 'labour');
    add(data.costs.labourPctRevenue, 'labourPct');
    add(data.costs.unitsSold, 'unitsSold');
    add(data.costs.cogsPerUnit, 'cogsPerUnit');

    const sorted = Object.values(map)
      .filter(r => r.year)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.week - a.week);

    return sorted.map((row, i) => {
      const prev = sorted[i + 1];
      const wow = prev?.revenue && row.revenue ? ((row.revenue - prev.revenue) / prev.revenue) * 100 : null;
      const grossProfit = row.revenue != null && row.cogs != null ? row.revenue - row.cogs : null;
      const grossMargin = row.revenue && grossProfit != null ? (grossProfit / row.revenue) * 100 : null;
      const contribMargin = grossProfit != null && row.labour != null ? grossProfit - row.labour : null;
      const contribMarginPct = row.revenue && contribMargin != null ? (contribMargin / row.revenue) * 100 : null;
      return { ...row, wow, grossProfit, grossMargin, contribMargin, contribMarginPct };
    });
  }, [f, data]);

  const latestRow = weeklyRows[0];

  // Summary KPI cards from latest week
  const kpis = latestRow ? [
    { title: 'Revenue', value: fmtDollar(latestRow.revenue), sub: shortPeriodLabel(latestRow.period), color: 'brand', icon: DollarSign, trend: latestRow.wow },
    { title: 'Gross Profit', value: fmtDollar(latestRow.grossProfit), sub: `${fmtPct(latestRow.grossMargin)} margin`, color: 'green', icon: BarChart3 },
    { title: 'Contrib. Margin', value: fmtDollar(latestRow.contribMargin), sub: `${fmtPct(latestRow.contribMarginPct)} of revenue`, color: 'teal', icon: TrendingUp },
    { title: 'COGS %', value: fmtPct(latestRow.cogsPct), sub: 'of revenue', color: 'red', icon: Truck, invertTrend: true },
    { title: 'AOV', value: latestRow.aov ? `$${latestRow.aov.toFixed(2)}` : '-', sub: 'per transaction', color: 'blue', icon: ShoppingCart },
    { title: 'Daily Customers', value: latestRow.dailyCustomers?.toFixed(1) || '-', sub: 'avg per day', color: 'purple', icon: Users },
  ] : [];

  return (
    <div className="space-y-6">
      {latestRow && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((k, i) => (
            <KpiCard key={i} title={k.title} value={k.value} subtitle={k.sub} icon={k.icon} color={k.color} trend={k.trend} invertTrend={k.invertTrend} />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card animate-fade-in overflow-hidden">
        <div className="p-5 border-b border-surface-100">
          <h3 className="text-base font-semibold text-surface-800">Weekly Performance</h3>
          <p className="text-xs text-surface-400 mt-0.5">All key metrics by week — newest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                {[
                  'Period', 'Quarter', 'Revenue', 'WoW', 'COGS', 'COGS %',
                  'Gross Profit', 'Margin %', 'Labour', 'Labour %',
                  'Contrib. Margin', 'CM %', 'AOV', 'Daily Cust.', 'Rev/Hr', 'Units'
                ].map(h => (
                  <th key={h} className={`py-3 px-3 font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap ${h === 'Period' || h === 'Quarter' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklyRows.map((row, i) => {
                const wowColor = row.wow == null ? '' : row.wow >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold';
                const cogsPctColor = row.cogsPct == null ? '' : row.cogsPct > 35 ? 'text-red-500' : row.cogsPct < 28 ? 'text-green-600' : 'text-surface-800';
                const marginColor = row.grossMargin == null ? '' : row.grossMargin > 70 ? 'text-green-600' : row.grossMargin < 60 ? 'text-red-500' : 'text-surface-800';
                const cmColor = row.contribMarginPct == null ? '' : row.contribMarginPct > 30 ? 'text-green-600' : row.contribMarginPct < 15 ? 'text-red-500' : 'text-surface-800';
                return (
                  <tr key={i} className="border-b border-surface-100 hover:bg-surface-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-surface-700 whitespace-nowrap">{shortPeriodLabel(row.period)}</td>
                    <td className="py-2.5 px-3 text-surface-400 whitespace-nowrap">{row.quarter}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-surface-800">{fmtDollar(row.revenue)}</td>
                    <td className={`py-2.5 px-3 text-right whitespace-nowrap ${wowColor}`}>
                      {row.wow != null ? `${row.wow >= 0 ? '+' : ''}${row.wow.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{fmtDollar(row.cogs)}</td>
                    <td className={`py-2.5 px-3 text-right ${cogsPctColor}`}>{fmtPct(row.cogsPct)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-surface-800">{fmtDollar(row.grossProfit)}</td>
                    <td className={`py-2.5 px-3 text-right ${marginColor}`}>{fmtPct(row.grossMargin)}</td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{fmtDollar(row.labour)}</td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{fmtPct(row.labourPct)}</td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${cmColor}`}>{fmtDollar(row.contribMargin)}</td>
                    <td className={`py-2.5 px-3 text-right ${cmColor}`}>{fmtPct(row.contribMarginPct)}</td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{row.aov ? `$${row.aov.toFixed(2)}` : '—'}</td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{row.dailyCustomers?.toFixed(1) || '—'}</td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{fmtDollar(row.revenuePerHour)}</td>
                    <td className="py-2.5 px-3 text-right text-surface-700">{row.unitsSold != null ? row.unitsSold.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================
// P&L TAB
// ===========================
function PnLTab({ data }) {
  // Quarterly aggregates
  const qRevenue = useMemo(() => withQoQ(aggregateQuarterly(data.revenue.totalRevenue, 'sum')), [data.revenue.totalRevenue]);
  const qCogs = useMemo(() => withQoQ(aggregateQuarterly(data.costs.totalCogs, 'sum')), [data.costs.totalCogs]);
  const qLabour = useMemo(() => withQoQ(aggregateQuarterly(data.costs.totalLabour, 'sum')), [data.costs.totalLabour]);

  const quarters = qRevenue.map(d => d.quarter);

  const qGrossProfit = useMemo(() => withQoQ(qRevenue.map((r, i) => ({
    quarter: r.quarter,
    value: r.value - (qCogs[i]?.value || 0),
  }))), [qRevenue, qCogs]);

  const qContribMargin = useMemo(() => withQoQ(qGrossProfit.map((r, i) => ({
    quarter: r.quarter,
    value: r.value - (qLabour[i]?.value || 0),
  }))), [qGrossProfit, qLabour]);

  const qGrossMarginPct = useMemo(() => qRevenue.map((r, i) => ({
    quarter: r.quarter,
    value: r.value > 0 ? (qGrossProfit[i]?.value / r.value) * 100 : 0,
  })), [qRevenue, qGrossProfit]);

  const qContribMarginPct = useMemo(() => qRevenue.map((r, i) => ({
    quarter: r.quarter,
    value: r.value > 0 ? (qContribMargin[i]?.value / r.value) * 100 : 0,
  })), [qRevenue, qContribMargin]);

  // Derived from quarterly totals, not averaged from weekly %s
  const qCogsPct = useMemo(() => withQoQ(qCogs.map((d, i) => ({
    quarter: d.quarter,
    value: qRevenue[i]?.value > 0 ? (d.value / qRevenue[i].value) * 100 : 0,
  }))), [qCogs, qRevenue]);
  const qLabourPct = useMemo(() => withQoQ(qLabour.map((d, i) => ({
    quarter: d.quarter,
    value: qRevenue[i]?.value > 0 ? (d.value / qRevenue[i].value) * 100 : 0,
  }))), [qLabour, qRevenue]);

  const latestIdx = quarters.length - 1;
  const latestQ = quarters[latestIdx] || '';

  // Waterfall chart for latest quarter
  const waterfallData = useMemo(() => {
    if (latestIdx < 0) return [];
    const rev = qRevenue[latestIdx]?.value || 0;
    const cogs = qCogs[latestIdx]?.value || 0;
    const gp = qGrossProfit[latestIdx]?.value || 0;
    const labour = qLabour[latestIdx]?.value || 0;
    const cm = qContribMargin[latestIdx]?.value || 0;
    return [
      { name: 'Revenue', value: rev, fill: COLORS.green },
      { name: 'Less: COGS', value: -cogs, fill: COLORS.red },
      { name: 'Gross Profit', value: gp, fill: COLORS.teal, isSubtotal: true },
      { name: 'Less: Labour', value: -labour, fill: COLORS.amber },
      { name: 'Contrib. Margin', value: cm, fill: COLORS.primary, isSubtotal: true },
    ];
  }, [latestIdx, qRevenue, qCogs, qGrossProfit, qLabour, qContribMargin]);

  // Margin trend chart
  const marginTrendData = useMemo(() => quarters.map((q, i) => ({
    quarter: q,
    'Gross Margin %': qGrossMarginPct[i]?.value || 0,
    'Contrib. Margin %': qContribMarginPct[i]?.value || 0,
    'COGS %': qCogsPct[i]?.value || 0,
    'Labour %': qLabourPct[i]?.value || 0,
  })), [quarters, qGrossMarginPct, qContribMarginPct, qCogsPct, qLabourPct]);

  // Latest KPIs
  const latestRev = qRevenue[latestIdx]?.value;
  const latestGP = qGrossProfit[latestIdx]?.value;
  const latestCM = qContribMargin[latestIdx]?.value;
  const latestGMPct = qGrossMarginPct[latestIdx]?.value;
  const latestCMPct = qContribMarginPct[latestIdx]?.value;

  // P&L table rows
  const PnLRow = ({ label, data: rowData, format = 'currency', indent = false, bold = false, invertTrend = false, className = '' }) => (
    <tr className={`border-b border-surface-100 hover:bg-surface-50 transition-colors ${className}`}>
      <td className={`py-3 pr-4 text-sm whitespace-nowrap sticky left-0 bg-white ${bold ? 'font-bold text-surface-800' : 'font-medium text-surface-600'} ${indent ? 'pl-6' : ''}`}>{label}</td>
      {rowData.map((d, i) => (
        <td key={i} className="py-3 px-3 text-right">
          <div className={`text-sm ${bold ? 'font-bold text-surface-800' : 'font-semibold text-surface-700'}`}>
            {format === 'currency' ? fmtDollar(d.value) : format === 'pct' ? fmtPct(d.value) : d.value}
          </div>
          <QoQBadge value={d.qoq} invertTrend={invertTrend} />
        </td>
      ))}
    </tr>
  );

  const SeparatorRow = ({ label }) => (
    <tr>
      <td colSpan={quarters.length + 1} className="pt-4 pb-1 sticky left-0">
        <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">{label}</span>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* KPI headline cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Quarterly Revenue" value={fmtDollar(latestRev)} trend={qRevenue[latestIdx]?.qoq} subtitle={latestQ} icon={DollarSign} color="brand" />
        <KpiCard title="Gross Profit" value={fmtDollar(latestGP)} trend={qGrossProfit[latestIdx]?.qoq} subtitle={latestQ} icon={BarChart3} color="green" />
        <KpiCard title="Gross Margin" value={fmtPct(latestGMPct)} subtitle="revenue minus COGS" icon={TrendingUp} color="teal" />
        <KpiCard title="Contrib. Margin" value={fmtDollar(latestCM)} trend={qContribMargin[latestIdx]?.qoq} subtitle={latestQ} icon={FileText} color="purple" />
        <KpiCard title="CM %" value={fmtPct(latestCMPct)} subtitle="after COGS & labour" icon={TrendingUp} color="blue" />
      </div>

      {/* Waterfall + Margin Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={`P&L Waterfall — ${latestQ}`} subtitle="Revenue → Gross Profit → Contribution Margin">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={waterfallData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ ...TICK_STYLE, fontSize: 10 }} />
              <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={60} />
              <Tooltip formatter={(v) => fmtDollar(Math.abs(v))} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Margin Trends" subtitle="Gross & Contribution Margin % by quarter">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={marginTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="quarter" tick={TICK_STYLE} />
              <YAxis tickFormatter={v => `${v}%`} tick={TICK_STYLE} width={45} />
              <Tooltip content={<ChartTooltip formatter={fmtPct} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Gross Margin %" stroke={COLORS.green} strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Contrib. Margin %" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 4 }} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="COGS %" stroke={COLORS.red} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Labour %" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Quarterly Revenue stacked bar */}
      <ChartCard title="Quarterly Revenue vs Costs" subtitle="Revenue, COGS and Labour by quarter">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={quarters.map((q, i) => ({
            quarter: q,
            Revenue: qRevenue[i]?.value || 0,
            COGS: qCogs[i]?.value || 0,
            Labour: qLabour[i]?.value || 0,
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="quarter" tick={TICK_STYLE} />
            <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={60} />
            <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Revenue" fill={COLORS.green} radius={[3, 3, 0, 0]} />
            <Bar dataKey="COGS" fill={COLORS.red} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Labour" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Full P&L Table */}
      <div className="bg-white rounded-xl shadow-card animate-fade-in">
        <div className="p-5 border-b border-surface-100">
          <h3 className="text-base font-semibold text-surface-800">Quarterly P&L Statement</h3>
          <p className="text-xs text-surface-400 mt-0.5">Income statement with quarter-over-quarter growth</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-3 pr-4 text-xs font-semibold text-surface-500 uppercase tracking-wider sticky left-0 bg-white">Line Item</th>
                {quarters.map(q => (
                  <th key={q} className="py-3 px-3 text-right text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">{q}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SeparatorRow label="Revenue" />
              <PnLRow label="Total Revenue" data={qRevenue} bold />

              <SeparatorRow label="Cost of Goods Sold" />
              <PnLRow label="Total COGS" data={qCogs} indent invertTrend />
              <PnLRow label="COGS % of Revenue" data={qCogsPct} format="pct" indent invertTrend />

              <SeparatorRow label="Gross Profit" />
              <PnLRow label="Gross Profit" data={qGrossProfit} bold />
              <PnLRow label="Gross Margin %" data={qGrossMarginPct.map((d, i) => ({ ...d, qoq: qGrossProfit[i]?.qoq ?? null }))} format="pct" indent />

              <SeparatorRow label="Labour" />
              <PnLRow label="Total Labour" data={qLabour} indent invertTrend />
              <PnLRow label="Labour % of Revenue" data={qLabourPct} format="pct" indent invertTrend />

              <SeparatorRow label="Contribution Margin" />
              <PnLRow label="Contribution Margin" data={qContribMargin} bold />
              <PnLRow label="Contribution Margin %" data={qContribMarginPct.map((d, i) => ({ ...d, qoq: qContribMargin[i]?.qoq ?? null }))} format="pct" indent />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================
// MAIN DASHBOARD
// ===========================
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'weekly', label: 'Weekly', icon: Calendar },
  { id: 'pnl', label: 'P&L', icon: FileText },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'costs', label: 'Costs', icon: Truck },
  { id: 'customer', label: 'Customer', icon: Users },
];

export default function BusinessDashboard({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState({ type: 'weeks', value: 12 });
  const [excludedWeeks, setExcludedWeeks] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllData();
      setData(result);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute available filter options from loaded data
  const availableFilters = useMemo(() => {
    if (!data) return { years: [], quarters: [] };
    return getAvailableFilters([
      data.revenue.totalRevenue,
      data.costs.totalCogs,
    ]);
  }, [data]);

  // All unique week numbers for the exclusion picker
  const allWeekNumbers = useMemo(() => {
    if (!data) return [];
    return getAllWeekNumbers([
      data.revenue.totalRevenue,
      data.costs.totalCogs,
    ]);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-500 mx-auto mb-4" />
          <p className="text-surface-500 font-medium">Loading dashboard data...</p>
          <p className="text-surface-400 text-sm mt-1">Fetching from Google Sheets</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-card p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={40} />
          <h2 className="text-lg font-semibold text-surface-800 mb-2">Failed to load data</h2>
          <p className="text-surface-500 text-sm mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium text-sm">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {onBack && (
                <button onClick={onBack} className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
                  <ArrowLeft size={20} className="text-surface-600" />
                </button>
              )}
              <div>
                <h1 className="text-lg font-bold text-surface-800">Business Dashboard</h1>
                <p className="text-xs text-surface-400">It's Recess — Analytics Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!['overview', 'pnl'].includes(activeTab) && <FilterBar filter={filter} setFilter={setFilter} availableFilters={availableFilters} />}
              <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 rounded-lg transition-colors" title="Refresh data">
                <RefreshCw size={16} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {!['overview', 'pnl'].includes(activeTab) && (
          <WeekExclusionBar
            excludedWeeks={excludedWeeks}
            setExcludedWeeks={setExcludedWeeks}
            allWeekNumbers={allWeekNumbers}
          />
        )}
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'weekly' && <WeeklyTab data={data} filter={filter} excludedWeeks={excludedWeeks} />}
        {activeTab === 'pnl' && <PnLTab data={data} />}
        {activeTab === 'revenue' && <RevenueTab data={data.revenue} filter={filter} excludedWeeks={excludedWeeks} />}
        {activeTab === 'costs' && <CostsTab data={data.costs} filter={filter} excludedWeeks={excludedWeeks} />}
        {activeTab === 'customer' && <CustomerTab data={data.customer} filter={filter} excludedWeeks={excludedWeeks} />}
      </div>
    </div>
  );
}
