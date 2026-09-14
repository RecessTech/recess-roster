import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Loader2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  fetchTopline, sortedDates, latestEntry, wowDelta, toChartRows, findMetric,
  fmtWeekLabel, fmtMoney, fmtNumber, fmtPct, formatMetricValue,
} from './toplineData';

// Categorical palette (validated: adjacent-pair CVD Delta E >= 8, normal-vision
// >= 15, both light-mode gates) -- used for anything with 2+ series. Single-
// series charts use the module's own accent (var(--primary)) instead, so a
// lone trend line still reads as "this module's colour", not just "series 1".
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
const AXIS_COLOR = '#898781';
const GRID_COLOR = '#e1e0d9';

// ── Small shared pieces ──────────────────────────────────────────────────────

function StatTile({ label, value, delta }) {
  return (
    <div className="metric-card min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums truncate">{value}</p>
      {delta != null && (
        <p className="text-[11px] font-semibold mt-1 flex items-center gap-0.5" style={{ color: delta >= 0 ? '#0ca30c' : '#d03b3b' }}>
          {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />} {fmtPct(Math.abs(delta))} WoW
        </p>
      )}
    </div>
  );
}

function Sparkline({ series, color }) {
  const dates = sortedDates(series).slice(-16);
  if (dates.length < 2) return <div style={{ width: 90, height: 28 }} />;
  const data = dates.map(d => ({ date: d, value: series[d] }));
  return (
    <div style={{ width: 90, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricRow({ m, idx }) {
  const latest = latestEntry(m.series);
  const delta = wowDelta(m.series);
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
      <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{m.metric}</p>
      <Sparkline series={m.series} color="var(--primary)" />
      <div className="text-right w-24 shrink-0">
        <p className="text-sm font-semibold text-gray-700 tabular-nums">{latest ? formatMetricValue(latest.value, m.metric) : '—'}</p>
        {delta != null && (
          <p className="text-[11px] font-semibold tabular-nums" style={{ color: delta >= 0 ? '#0ca30c' : '#d03b3b' }}>{delta >= 0 ? '+' : ''}{fmtPct(delta)}</p>
        )}
      </div>
    </div>
  );
}

function MetricGroupList({ groups, defaultOpenCount = 2 }) {
  const [collapsed, setCollapsed] = useState(() => new Set(groups.slice(defaultOpenCount).map(g => g.section)));
  function toggle(section) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }
  if (!groups.length) return <div className="card p-8 text-center text-sm text-gray-400">Nothing to show yet.</div>;
  return (
    <div className="space-y-2">
      {groups.map(({ section, metrics }) => {
        const label = section || 'Summary';
        const isCollapsed = collapsed.has(section);
        return (
          <div key={section || '_summary'} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggle(section)}
              aria-expanded={!isCollapsed}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:brightness-[0.98] transition-[filter]"
              style={{ background: 'color-mix(in srgb, var(--primary) 5%, white)' }}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
                {label}
              </span>
              <span className="text-xs font-semibold text-gray-400">{metrics.length} metric{metrics.length !== 1 ? 's' : ''}</span>
            </button>
            {!isCollapsed && (
              <div className="divide-y divide-gray-50 border-t border-gray-100">
                {metrics.map((m, i) => <MetricRow key={m.metric} m={m} idx={i} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart() {
  return <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data yet</div>;
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mb-2">{subtitle}</p>}
      {children}
    </div>
  );
}

function TrendChart({ rows, dataKeys, colors, money, percent }) {
  if (!rows.length) return <EmptyChart />;
  const yFmt = v => (percent ? fmtPct(v) : money ? fmtMoney(v, { compact: true }) : fmtNumber(v));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={yFmt} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={money ? 56 : 40} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {dataKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function StackedBarChart({ rows, dataKeys, colors, money }) {
  if (!rows.length) return <EmptyChart />;
  const yFmt = v => (money ? fmtMoney(v, { compact: true }) : fmtNumber(v));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtWeekLabel} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={yFmt} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={money ? 56 : 40} />
        <Tooltip labelFormatter={fmtWeekLabel} formatter={v => yFmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID_COLOR}` }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {dataKeys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={i === dataKeys.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({ topline }) {
  const totalRevenueM = findMetric(topline.revenue, 'Revenue', 'Revenue - Total');
  const aovM = findMetric(topline.revenue, 'Customer', 'AOV');
  const customersM = findMetric(topline.revenue, 'Customer', 'Customers');
  const opProfitM = findMetric(topline.budget, '', 'Operating Profit $');
  const opProfitPctM = findMetric(topline.budget, '', 'Operating Profit %');

  const revenueChart = totalRevenueM ? toChartRows([{ name: 'Revenue', series: totalRevenueM.series }]).slice(-26) : [];
  const customerChart = customersM ? toChartRows([{ name: 'Customers', series: customersM.series }]).slice(-26) : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Revenue (last wk)" value={totalRevenueM ? fmtMoney(latestEntry(totalRevenueM.series)?.value, { compact: true }) : '—'} delta={totalRevenueM && wowDelta(totalRevenueM.series)} />
        <StatTile label="AOV" value={aovM ? fmtMoney(latestEntry(aovM.series)?.value) : '—'} delta={aovM && wowDelta(aovM.series)} />
        <StatTile label="Customers" value={customersM ? fmtNumber(latestEntry(customersM.series)?.value) : '—'} delta={customersM && wowDelta(customersM.series)} />
        <StatTile label="Operating Profit" value={opProfitM ? fmtMoney(latestEntry(opProfitM.series)?.value, { compact: true }) : '—'} delta={opProfitM && wowDelta(opProfitM.series)} />
        <StatTile label="Operating Margin" value={opProfitPctM ? fmtPct(latestEntry(opProfitPctM.series)?.value) : '—'} delta={opProfitPctM && wowDelta(opProfitPctM.series)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue" subtitle="Weekly total, last 26 weeks">
          <TrendChart rows={revenueChart} dataKeys={['Revenue']} colors={['var(--primary)']} money />
        </ChartCard>
        <ChartCard title="Customers" subtitle="Weekly total, last 26 weeks">
          <TrendChart rows={customerChart} dataKeys={['Customers']} colors={['var(--primary)']} />
        </ChartCard>
      </div>
    </div>
  );
}

const REVENUE_CHANNELS = [
  { key: 'Revenue - In-Store', label: 'In-Store' },
  { key: 'Revenue - UberEats / DD / Hey You', label: '3rd Party Apps' },
  { key: 'Revenue - Catering / B2B', label: 'Catering / B2B' },
  { key: 'Revenue - Classpass / TGTG', label: 'Classpass / TGTG' },
  { key: 'Revenue - Vending', label: 'Vending' },
];
const REVENUE_CATEGORIES = ['Food', 'Drinks', 'Snacks', 'Merch'];

function RevenueTab({ topline }) {
  const revGroup = topline.revenue;
  const channelSeries = REVENUE_CHANNELS
    .map(c => {
      const m = findMetric(revGroup, 'Revenue', c.key);
      return m ? { name: c.label, series: m.series } : null;
    })
    .filter(Boolean);
  const channelRows = toChartRows(channelSeries).slice(-26);

  const categorySeries = REVENUE_CATEGORIES
    .map(name => {
      const m = findMetric(revGroup, 'Category Rev.', name);
      return m ? { name, series: m.series } : null;
    })
    .filter(Boolean);
  const categoryRows = toChartRows(categorySeries).slice(-26);

  const totalM = findMetric(revGroup, 'Revenue', 'Revenue - Total');
  const inStoreM = findMetric(revGroup, 'Revenue', 'Revenue - In-Store');
  const thirdPartyM = findMetric(revGroup, 'Revenue', 'Revenue - UberEats / DD / Hey You');
  const b2bM = findMetric(revGroup, 'Revenue', 'Revenue - Catering / B2B');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Revenue" value={totalM ? fmtMoney(latestEntry(totalM.series)?.value, { compact: true }) : '—'} delta={totalM && wowDelta(totalM.series)} />
        <StatTile label="In-Store" value={inStoreM ? fmtMoney(latestEntry(inStoreM.series)?.value, { compact: true }) : '—'} delta={inStoreM && wowDelta(inStoreM.series)} />
        <StatTile label="3rd Party Apps" value={thirdPartyM ? fmtMoney(latestEntry(thirdPartyM.series)?.value, { compact: true }) : '—'} delta={thirdPartyM && wowDelta(thirdPartyM.series)} />
        <StatTile label="Catering / B2B" value={b2bM ? fmtMoney(latestEntry(b2bM.series)?.value, { compact: true }) : '—'} delta={b2bM && wowDelta(b2bM.series)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue by Channel" subtitle="Weekly, last 26 weeks">
          <TrendChart rows={channelRows} dataKeys={REVENUE_CHANNELS.map(c => c.label)} colors={CATEGORICAL} money />
        </ChartCard>
        <ChartCard title="Revenue by Category" subtitle="Food / Drinks / Snacks / Merch, last 26 weeks">
          <StackedBarChart rows={categoryRows} dataKeys={REVENUE_CATEGORIES} colors={CATEGORICAL} money />
        </ChartCard>
      </div>
      <MetricGroupList groups={revGroup} defaultOpenCount={2} />
    </div>
  );
}

const COGS_SUPPLIERS = ['Foodbyus', 'Ordermentum', 'Supermarket', 'Direct Supply'];

function CostsTab({ topline }) {
  const costsGroup = topline.costs;
  const cogsTotal = findMetric(costsGroup, 'COGS Spend', 'Total');
  const cogsPct = findMetric(costsGroup, 'Average COGS', 'COGS % of Revenue');
  const labourPct = findMetric(costsGroup, 'Labour', 'Labour % Of Revenue');
  const totalLabour = findMetric(costsGroup, 'Labour', 'Total Labour Cost');

  const supplierSeries = COGS_SUPPLIERS
    .map(s => {
      const m = findMetric(costsGroup, 'COGS Spend', s);
      return m ? { name: s, series: m.series } : null;
    })
    .filter(Boolean);
  const supplierRows = toChartRows(supplierSeries).slice(-26);

  const ratioSeries = [
    cogsPct && { name: 'COGS % of Revenue', series: cogsPct.series },
    labourPct && { name: 'Labour % of Revenue', series: labourPct.series },
  ].filter(Boolean);
  const ratioRows = toChartRows(ratioSeries).slice(-26);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="COGS (last wk)" value={cogsTotal ? fmtMoney(latestEntry(cogsTotal.series)?.value, { compact: true }) : '—'} delta={cogsTotal && wowDelta(cogsTotal.series)} />
        <StatTile label="COGS % of Revenue" value={cogsPct ? fmtPct(latestEntry(cogsPct.series)?.value) : '—'} delta={cogsPct && wowDelta(cogsPct.series)} />
        <StatTile label="Total Labour Cost" value={totalLabour ? fmtMoney(latestEntry(totalLabour.series)?.value, { compact: true }) : '—'} delta={totalLabour && wowDelta(totalLabour.series)} />
        <StatTile label="Labour % of Revenue" value={labourPct ? fmtPct(latestEntry(labourPct.series)?.value) : '—'} delta={labourPct && wowDelta(labourPct.series)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="COGS by Supplier" subtitle="Weekly spend, last 26 weeks">
          <StackedBarChart rows={supplierRows} dataKeys={COGS_SUPPLIERS} colors={CATEGORICAL} money />
        </ChartCard>
        <ChartCard title="COGS % & Labour % of Revenue" subtitle="Last 26 weeks">
          <TrendChart rows={ratioRows} dataKeys={ratioSeries.map(s => s.name)} colors={[CATEGORICAL[1], CATEGORICAL[5]]} percent />
        </ChartCard>
      </div>
      <MetricGroupList groups={costsGroup} defaultOpenCount={2} />
    </div>
  );
}

function CustomerTab({ topline }) {
  const custGroup = topline.customer;
  const ig = findMetric(custGroup, 'Engagement', 'Instagram Followers');
  const fb = findMetric(custGroup, 'Engagement', 'Facebook Page Likes');
  const tiktok = findMetric(custGroup, 'Engagement', 'TikTok Followers');
  const loyalty = findMetric(custGroup, 'Engagement', 'Loyalty Members');
  const reviews = findMetric(custGroup, 'Customer Sentiment', 'Google Reviews');
  const rating = findMetric(custGroup, 'Customer Sentiment', 'Average Google Rating');

  const followerSeries = [
    ig && { name: 'Instagram', series: ig.series },
    fb && { name: 'Facebook', series: fb.series },
    tiktok && { name: 'TikTok', series: tiktok.series },
  ].filter(Boolean);
  const followerRows = toChartRows(followerSeries).slice(-26);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Instagram" value={ig ? fmtNumber(latestEntry(ig.series)?.value) : '—'} delta={ig && wowDelta(ig.series)} />
        <StatTile label="Facebook" value={fb ? fmtNumber(latestEntry(fb.series)?.value) : '—'} delta={fb && wowDelta(fb.series)} />
        <StatTile label="TikTok" value={tiktok ? fmtNumber(latestEntry(tiktok.series)?.value) : '—'} delta={tiktok && wowDelta(tiktok.series)} />
        <StatTile label="Loyalty Members" value={loyalty ? fmtNumber(latestEntry(loyalty.series)?.value) : '—'} delta={loyalty && wowDelta(loyalty.series)} />
        <StatTile label="Google Rating" value={rating ? fmtNumber(latestEntry(rating.series)?.value, { decimals: 1 }) : '—'} delta={rating && wowDelta(rating.series)} />
        <StatTile label="Google Reviews" value={reviews ? fmtNumber(latestEntry(reviews.series)?.value) : '—'} delta={reviews && wowDelta(reviews.series)} />
      </div>
      <ChartCard title="Social Followers" subtitle="Last 26 weeks">
        <TrendChart rows={followerRows} dataKeys={followerSeries.map(s => s.name)} colors={CATEGORICAL} />
      </ChartCard>
      <MetricGroupList groups={custGroup} defaultOpenCount={2} />
    </div>
  );
}

const PNL_SUMMARY_METRICS = ['Gross Revenue', 'Net Revenue', 'PC1 Total', 'PC1 Margin', 'Operating Profit $', 'Operating Profit %'];
const PNL_TREND_METRICS = ['Gross Revenue', 'Net Revenue', 'Operating Profit $'];

function PnlTab({ topline }) {
  const budgetGroup = topline.budget;
  const stats = PNL_SUMMARY_METRICS.map(name => findMetric(budgetGroup, '', name)).filter(Boolean);
  const trendSeries = PNL_TREND_METRICS
    .map(name => {
      const m = findMetric(budgetGroup, '', name);
      return m ? { name, series: m.series } : null;
    })
    .filter(Boolean);
  const trendRows = toChartRows(trendSeries).slice(-26);

  const categoryGroups = budgetGroup.filter(g => g.section !== '');
  const summaryGroup = budgetGroup.find(g => g.section === '');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(m => (
          <StatTile key={m.metric} label={m.metric} value={formatMetricValue(latestEntry(m.series)?.value, m.metric)} delta={wowDelta(m.series)} />
        ))}
      </div>
      <ChartCard title="Gross Revenue, Net Revenue & Operating Profit" subtitle="Weekly, last 26 weeks">
        <TrendChart rows={trendRows} dataKeys={trendSeries.map(s => s.name)} colors={CATEGORICAL} money />
      </ChartCard>
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">P&L Line Items</h3>
        <MetricGroupList groups={categoryGroups} defaultOpenCount={0} />
      </div>
      {summaryGroup && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2">Summary & Ratios</h3>
          <MetricGroupList groups={[summaryGroup]} defaultOpenCount={0} />
        </div>
      )}
    </div>
  );
}

// ── Top level ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'costs', label: 'Costs' },
  { id: 'customer', label: 'Customer' },
  { id: 'pnl', label: 'P&L' },
];

export default function ToplineApp({ org }) {
  const orgId = org?.id;
  const [topline, setTopline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await fetchTopline(orgId);
      setTopline(data);
    } catch (err) {
      toast.error('Failed to load R-Topline data: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!topline) {
    return (
      <div className="h-full overflow-auto p-6 max-w-5xl mx-auto" style={{ background: 'var(--app-bg)' }}>
        <div className="card p-8 text-center text-sm text-gray-400">Couldn't load R-Topline data.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--app-bg)' }}>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={20} style={{ color: 'var(--primary)' }} /> R-Topline
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Revenue, costs & P&L — every KPI from the analytics sheet, natively in R-Shift</p>
        </div>

        <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap"
              style={activeTab === tab.id ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : { borderColor: 'transparent', color: '#6b7280' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab topline={topline} />}
        {activeTab === 'revenue' && <RevenueTab topline={topline} />}
        {activeTab === 'costs' && <CostsTab topline={topline} />}
        {activeTab === 'customer' && <CustomerTab topline={topline} />}
        {activeTab === 'pnl' && <PnlTab topline={topline} />}
      </div>
    </div>
  );
}
