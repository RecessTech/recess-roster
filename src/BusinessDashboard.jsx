import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { fetchAllData, parsePeriod } from './sheetsData';
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  BarChart3, RefreshCw, ArrowLeft, Star, Heart,
  Utensils, Truck, AlertCircle, Filter, ChevronDown,
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

// Extract just the week number for clean axis labels: "Q1-2024 M03 W12" -> "W12"
function weekLabel(period) {
  if (!period) return '';
  const m = period.match(/W(\d{1,2})/);
  return m ? `W${m[1]}` : period;
}

// Get a human-readable short label: "Q1-2024 M03 W12" -> "Mar W12"
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortPeriodLabel(period) {
  if (!period) return '';
  const parsed = parsePeriod(period);
  if (!parsed) return weekLabel(period);
  if (parsed.month) return `${MONTH_ABBR[parsed.month]} W${parsed.week}`;
  if (parsed.year) return `W${parsed.week}`;
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

// Apply filter to data array, returns sliced data
function applyFilter(data, filter) {
  if (!data || data.length === 0) return data;

  if (filter.type === 'weeks') {
    return data.slice(-filter.value);
  }

  if (filter.type === 'year') {
    return data.filter(d => {
      const p = parsePeriod(d.period);
      return p?.year === filter.value;
    });
  }

  if (filter.type === 'quarter') {
    // filter.value = "Q1 2024"
    const [q, y] = filter.value.split(' ');
    const qNum = parseInt(q.replace('Q', ''));
    const yNum = parseInt(y);
    return data.filter(d => {
      const p = parsePeriod(d.period);
      return p?.year === yNum && p?.quarter === qNum;
    });
  }

  return data;
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

// --- KPI Card ---
function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'brand' }) {
  const colorMap = {
    brand: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
  };

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
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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

// --- Chart Card wrapper ---
function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-card p-5 animate-fade-in ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-surface-800">{title}</h3>
        {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
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
function RevenueTab({ data, filter }) {
  const f = useCallback((arr) => applyFilter(arr, filter), [filter]);

  const totalRev = useMemo(() => f(data.totalRevenue), [f, data.totalRevenue]);
  const aov = useMemo(() => f(data.aov), [f, data.aov]);
  const dailyCust = useMemo(() => f(data.avgDailyCustomers), [f, data.avgDailyCustomers]);
  const avgDailyRev = useMemo(() => f(data.avgDailyRevenue), [f, data.avgDailyRevenue]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Weekly Revenue" value={fmtDollar(lastVal(totalRev))} trend={trend(totalRev)} subtitle="latest week" icon={DollarSign} color="brand" />
        <KpiCard title="Avg Order Value" value={lastVal(aov) ? `$${lastVal(aov).toFixed(2)}` : '-'} trend={trend(aov)} subtitle="per transaction" icon={ShoppingCart} color="blue" />
        <KpiCard title="Daily Customers" value={lastVal(dailyCust)?.toFixed(0) || '-'} trend={trend(dailyCust)} subtitle="avg per day" icon={Users} color="green" />
        <KpiCard title="Daily Revenue" value={fmtDollar(lastVal(avgDailyRev))} trend={trend(avgDailyRev)} subtitle="in-store avg" icon={BarChart3} color="purple" />
      </div>

      {/* Revenue Trend */}
      <ChartCard title="Total Revenue" subtitle="Weekly revenue over time">
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
            <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
            <Tooltip content={<ChartTooltip formatter={fmtDollar} />} />
            <Area type="monotone" dataKey="value" name="Revenue" stroke={COLORS.primary} fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Breakdown */}
        <ChartCard title="Revenue by Channel" subtitle="In-Store, Delivery, Catering, ClassPass">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(channelData.length / 10) - 1)} />
              <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
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
        <ChartCard title="Average Order Value" subtitle="AOV trend over time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aov.map(d => ({ ...d, period: shortPeriodLabel(d.period) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(aov.length / 10) - 1)} />
              <YAxis domain={['auto', 'auto']} tickFormatter={v => `$${v}`} tick={TICK_STYLE} width={50} />
              <Tooltip content={<ChartTooltip formatter={v => `$${v.toFixed(2)}`} />} />
              <Line type="monotone" dataKey="value" name="AOV" stroke={COLORS.secondary} strokeWidth={2.5} dot={aov.length <= 20 ? { r: 3 } : false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Daily Customers */}
      <ChartCard title="Average Daily Customers" subtitle="Customer count per day by week">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dailyCust.map(d => ({ ...d, period: shortPeriodLabel(d.period) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(dailyCust.length / 12) - 1)} />
            <YAxis tick={TICK_STYLE} width={40} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" name="Customers" fill={COLORS.green} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ===========================
// COSTS TAB
// ===========================
function CostsTab({ data, filter }) {
  const f = useCallback((arr) => applyFilter(arr, filter), [filter]);

  const totalCogs = useMemo(() => f(data.totalCogs), [f, data.totalCogs]);
  const cogsPct = useMemo(() => f(data.cogsPctRevenue), [f, data.cogsPctRevenue]);
  const labourPct = useMemo(() => f(data.labourPctRevenue), [f, data.labourPctRevenue]);

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
        <KpiCard title="Weekly COGS" value={fmtDollar(lastVal(totalCogs))} trend={trend(totalCogs)} subtitle="latest week" icon={Truck} color="brand" />
        <KpiCard title="COGS % Revenue" value={fmtPct(latestCogsPct)} subtitle="of total revenue" icon={ShoppingCart} color="blue" />
        <KpiCard title="Labour % Revenue" value={fmtPct(latestLabourPct)} subtitle="of total revenue" icon={Users} color="green" />
        <KpiCard title="COGS per Unit" value={latestCogsPerUnit ? `$${latestCogsPerUnit.toFixed(2)}` : '-'} subtitle="avg unit cost" icon={Utensils} color="purple" />
      </div>

      {/* Cost Ratios */}
      <ChartCard title="Cost Ratios" subtitle="COGS % and Labour % of revenue over time">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={ratiosData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(ratiosData.length / 12) - 1)} />
            <YAxis tickFormatter={v => `${v}%`} tick={TICK_STYLE} width={45} />
            <Tooltip content={<ChartTooltip formatter={fmtPct} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="COGS %" stroke={COLORS.primary} strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Labour %" stroke={COLORS.secondary} strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Breakdown */}
        <ChartCard title="COGS by Vendor" subtitle="Weekly spend by supplier">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={vendorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(vendorData.length / 10) - 1)} />
              <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
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
      <ChartCard title="Total COGS" subtitle="Weekly cost of goods sold">
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
            <YAxis tickFormatter={fmtCurrency} tick={TICK_STYLE} width={55} />
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
function CustomerTab({ data, filter }) {
  // Customer data uses "W12" format without year — filter by weeks count only
  const f = useCallback((arr) => {
    if (!arr || arr.length === 0) return arr;
    if (filter.type === 'weeks') return arr.slice(-filter.value);
    // For year/quarter filters on customer data (no year info), show last 12 weeks as fallback
    if (filter.type === 'year' || filter.type === 'quarter') return arr.slice(-12);
    return arr;
  }, [filter]);

  const ig = useMemo(() => f(data.instagramFollowers), [f, data.instagramFollowers]);
  const tiktok = useMemo(() => f(data.tiktokFollowers), [f, data.tiktokFollowers]);
  const loyalty = useMemo(() => f(data.loyaltyMembers), [f, data.loyaltyMembers]);
  const reviews = useMemo(() => f(data.googleReviews), [f, data.googleReviews]);

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
      <ChartCard title="Audience Growth" subtitle="Instagram, TikTok & Loyalty members">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={socialData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(socialData.length / 12) - 1)} />
            <YAxis tick={TICK_STYLE} width={50} />
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
        <ChartCard title="Instagram Followers" subtitle="Growth trajectory">
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
              <YAxis tick={TICK_STYLE} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" name="Followers" stroke={COLORS.pink} fill="url(#igGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Google Reviews */}
        <ChartCard title="Google Reviews" subtitle="Review count growth">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reviews.map(d => ({ ...d }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={TICK_STYLE} interval={Math.max(0, Math.floor(reviews.length / 10) - 1)} />
              <YAxis tick={TICK_STYLE} width={40} />
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
// MAIN DASHBOARD
// ===========================
const TABS = [
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'costs', label: 'Costs', icon: Truck },
  { id: 'customer', label: 'Customer', icon: Users },
];

export default function BusinessDashboard({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('revenue');
  const [filter, setFilter] = useState({ type: 'weeks', value: 12 });

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
              <FilterBar filter={filter} setFilter={setFilter} availableFilters={availableFilters} />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'revenue' && <RevenueTab data={data.revenue} filter={filter} />}
        {activeTab === 'costs' && <CostsTab data={data.costs} filter={filter} />}
        {activeTab === 'customer' && <CustomerTab data={data.customer} filter={filter} />}
      </div>
    </div>
  );
}
