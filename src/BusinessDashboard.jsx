import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { fetchAllData } from './sheetsData';
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
  BarChart3, RefreshCw, ArrowLeft, Instagram, Star, Heart,
  Utensils, Truck, AlertCircle,
} from 'lucide-react';

const COLORS = {
  primary: '#f97316',
  primaryLight: '#fb923c',
  secondary: '#3b82f6',
  secondaryLight: '#60a5fa',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  amber: '#f59e0b',
  teal: '#14b8a6',
  slate: '#64748b',
};

const CHART_COLORS = [COLORS.primary, COLORS.secondary, COLORS.green, COLORS.purple, COLORS.pink, COLORS.amber];

// Shorten period labels like "Q1-2024 W12" -> "W12"
function shortLabel(period) {
  if (!period) return '';
  // Try to get the last segment (week or month)
  const parts = period.trim().split(/\s+/);
  if (parts.length >= 3) return parts.slice(1).join(' ');
  if (parts.length === 2) return parts[1];
  return period;
}

// Take every Nth item to avoid overcrowding
function downsample(arr, maxPoints = 26) {
  if (!arr || arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
}

function formatCurrency(val) {
  if (val == null) return '-';
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function formatPct(val) {
  if (val == null) return '-';
  return `${val.toFixed(1)}%`;
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

// Custom tooltip
function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 text-white text-xs rounded-lg px-3 py-2 shadow-elevated">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-surface-300">{entry.name}:</span>
          <span className="font-semibold">{formatter ? formatter(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// --- REVENUE TAB ---
function RevenueTab({ data }) {
  const revenueChart = useMemo(() => downsample(data.totalRevenue), [data.totalRevenue]);
  const aovChart = useMemo(() => downsample(data.aov), [data.aov]);
  const customersChart = useMemo(() => downsample(data.avgDailyCustomers), [data.avgDailyCustomers]);

  // Combine revenue streams for stacked chart
  const revenueBreakdown = useMemo(() => {
    const inStore = data.inStoreRevenue || [];
    const uber = data.uberEatsRevenue || [];
    const catering = data.cateringRevenue || [];
    const combined = [];
    const len = Math.max(inStore.length, uber.length, catering.length);
    for (let i = 0; i < len; i++) {
      combined.push({
        period: shortLabel(inStore[i]?.period || uber[i]?.period || catering[i]?.period),
        'In-Store': inStore[i]?.value || 0,
        'Delivery': uber[i]?.value || 0,
        'Catering': catering[i]?.value || 0,
      });
    }
    return downsample(combined);
  }, [data.inStoreRevenue, data.uberEatsRevenue, data.cateringRevenue]);

  // Latest KPIs
  const latestRevenue = data.totalRevenue[data.totalRevenue.length - 1]?.value;
  const prevRevenue = data.totalRevenue[data.totalRevenue.length - 2]?.value;
  const revenueTrend = prevRevenue ? ((latestRevenue - prevRevenue) / prevRevenue) * 100 : null;

  const latestAov = data.aov[data.aov.length - 1]?.value;
  const prevAov = data.aov[data.aov.length - 2]?.value;
  const aovTrend = prevAov ? ((latestAov - prevAov) / prevAov) * 100 : null;

  const latestCustomers = data.avgDailyCustomers[data.avgDailyCustomers.length - 1]?.value;
  const prevCustomers = data.avgDailyCustomers[data.avgDailyCustomers.length - 2]?.value;
  const custTrend = prevCustomers ? ((latestCustomers - prevCustomers) / prevCustomers) * 100 : null;

  const latestWeekly = data.avgWeeklyRevenue[data.avgWeeklyRevenue.length - 1]?.value;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Weekly Revenue" value={formatCurrency(latestWeekly)} trend={revenueTrend} subtitle="latest week" icon={DollarSign} color="brand" />
        <KpiCard title="Avg Order Value" value={latestAov ? `$${latestAov.toFixed(2)}` : '-'} trend={aovTrend} subtitle="per transaction" icon={ShoppingCart} color="blue" />
        <KpiCard title="Daily Customers" value={latestCustomers?.toFixed(0) || '-'} trend={custTrend} subtitle="avg per day" icon={Users} color="green" />
        <KpiCard title="Total Revenue" value={formatCurrency(latestRevenue)} subtitle="latest period" icon={BarChart3} color="purple" />
      </div>

      {/* Revenue Trend */}
      <ChartCard title="Revenue Trend" subtitle="Total weekly revenue over time">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={revenueChart.map(d => ({ ...d, period: shortLabel(d.period) }))}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
            <Area type="monotone" dataKey="value" name="Revenue" stroke={COLORS.primary} fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <ChartCard title="Revenue by Channel" subtitle="In-Store vs Delivery vs Catering">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
              <Legend />
              <Bar dataKey="In-Store" stackId="a" fill={COLORS.primary} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Delivery" stackId="a" fill={COLORS.secondary} />
              <Bar dataKey="Catering" stackId="a" fill={COLORS.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* AOV Trend */}
        <ChartCard title="Average Order Value" subtitle="AOV trend over time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aovChart.map(d => ({ ...d, period: shortLabel(d.period) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis domain={['auto', 'auto']} tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip formatter={v => `$${v.toFixed(2)}`} />} />
              <Line type="monotone" dataKey="value" name="AOV" stroke={COLORS.secondary} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Daily Customers */}
      <ChartCard title="Average Daily Customers" subtitle="Customer count trend">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={customersChart.map(d => ({ ...d, period: shortLabel(d.period) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Daily Customers" fill={COLORS.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// --- COSTS TAB ---
function CostsTab({ data }) {
  const cogsChart = useMemo(() => downsample(data.totalCogs), [data.totalCogs]);
  const cogsPctChart = useMemo(() => downsample(data.cogsPctRevenue), [data.cogsPctRevenue]);
  const labourPctChart = useMemo(() => downsample(data.labourPctRevenue), [data.labourPctRevenue]);

  // Vendor breakdown stacked
  const vendorBreakdown = useMemo(() => {
    const fb = data.foodbyus || [];
    const om = data.ordermentum || [];
    const sm = data.supermarket || [];
    const ds = data.directSupply || [];
    const len = Math.max(fb.length, om.length, sm.length, ds.length);
    const combined = [];
    for (let i = 0; i < len; i++) {
      combined.push({
        period: shortLabel(fb[i]?.period || om[i]?.period || sm[i]?.period || ds[i]?.period),
        Foodbyus: fb[i]?.value || 0,
        Ordermentum: om[i]?.value || 0,
        Supermarket: sm[i]?.value || 0,
        'Direct Supply': ds[i]?.value || 0,
      });
    }
    return downsample(combined);
  }, [data.foodbyus, data.ordermentum, data.supermarket, data.directSupply]);

  // Combined COGS% + Labour% chart
  const combinedPct = useMemo(() => {
    const cogs = data.cogsPctRevenue || [];
    const labour = data.labourPctRevenue || [];
    const len = Math.max(cogs.length, labour.length);
    const combined = [];
    for (let i = 0; i < len; i++) {
      combined.push({
        period: shortLabel(cogs[i]?.period || labour[i]?.period),
        'COGS %': cogs[i]?.value || null,
        'Labour %': labour[i]?.value || null,
      });
    }
    return downsample(combined, 30);
  }, [data.cogsPctRevenue, data.labourPctRevenue]);

  // Vendor total pie chart
  const vendorTotals = useMemo(() => {
    const sum = (arr) => (arr || []).reduce((s, d) => s + (d.value || 0), 0);
    return [
      { name: 'Foodbyus', value: sum(data.foodbyus) },
      { name: 'Ordermentum', value: sum(data.ordermentum) },
      { name: 'Supermarket', value: sum(data.supermarket) },
      { name: 'Direct Supply', value: sum(data.directSupply) },
    ].filter(d => d.value > 0);
  }, [data.foodbyus, data.ordermentum, data.supermarket, data.directSupply]);

  const latestCogs = data.totalCogs[data.totalCogs.length - 1]?.value;
  const latestCogsPct = data.cogsPctRevenue[data.cogsPctRevenue.length - 1]?.value;
  const latestLabourPct = data.labourPctRevenue[data.labourPctRevenue.length - 1]?.value;
  const latestCogsPerUnit = data.cogsPerUnit[data.cogsPerUnit.length - 1]?.value;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Weekly COGS" value={formatCurrency(latestCogs)} subtitle="latest week" icon={Truck} color="brand" />
        <KpiCard title="COGS % Revenue" value={formatPct(latestCogsPct)} subtitle="of revenue" icon={ShoppingCart} color="blue" />
        <KpiCard title="Labour % Revenue" value={formatPct(latestLabourPct)} subtitle="of revenue" icon={Users} color="green" />
        <KpiCard title="COGS per Unit" value={latestCogsPerUnit ? `$${latestCogsPerUnit.toFixed(2)}` : '-'} subtitle="avg cost" icon={Utensils} color="purple" />
      </div>

      {/* COGS% + Labour% trend */}
      <ChartCard title="Cost Ratios" subtitle="COGS % and Labour % of revenue over time">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={combinedPct}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip formatter={formatPct} />} />
            <Legend />
            <Line type="monotone" dataKey="COGS %" stroke={COLORS.primary} strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="Labour %" stroke={COLORS.secondary} strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Breakdown */}
        <ChartCard title="COGS by Vendor" subtitle="Weekly spend by supplier">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={vendorBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
              <Legend />
              <Bar dataKey="Foodbyus" stackId="a" fill={COLORS.primary} />
              <Bar dataKey="Ordermentum" stackId="a" fill={COLORS.secondary} />
              <Bar dataKey="Supermarket" stackId="a" fill={COLORS.green} />
              <Bar dataKey="Direct Supply" stackId="a" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Vendor Pie */}
        <ChartCard title="Vendor Share" subtitle="Total COGS distribution by supplier">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={vendorTotals}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {vendorTotals.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatCurrency} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Total COGS Trend */}
      <ChartCard title="Total COGS" subtitle="Weekly total cost of goods sold">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={cogsChart.map(d => ({ ...d, period: shortLabel(d.period) }))}>
            <defs>
              <linearGradient id="cogsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
            <Area type="monotone" dataKey="value" name="Total COGS" stroke={COLORS.red} fill="url(#cogsGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// --- CUSTOMER TAB ---
function CustomerTab({ data }) {
  const igChart = useMemo(() => downsample(data.instagramFollowers), [data.instagramFollowers]);
  const tiktokChart = useMemo(() => downsample(data.tiktokFollowers), [data.tiktokFollowers]);
  const loyaltyChart = useMemo(() => downsample(data.loyaltyMembers), [data.loyaltyMembers]);
  const reviewsChart = useMemo(() => downsample(data.googleReviews), [data.googleReviews]);

  // Combined social chart
  const socialCombined = useMemo(() => {
    const ig = data.instagramFollowers || [];
    const tt = data.tiktokFollowers || [];
    const loyalty = data.loyaltyMembers || [];
    const len = Math.max(ig.length, tt.length, loyalty.length);
    const combined = [];
    for (let i = 0; i < len; i++) {
      combined.push({
        period: shortLabel(ig[i]?.period || tt[i]?.period || loyalty[i]?.period),
        Instagram: ig[i]?.value || 0,
        TikTok: tt[i]?.value || 0,
        Loyalty: loyalty[i]?.value || 0,
      });
    }
    return downsample(combined, 30);
  }, [data.instagramFollowers, data.tiktokFollowers, data.loyaltyMembers]);

  const latestIg = data.instagramFollowers[data.instagramFollowers.length - 1]?.value;
  const latestTiktok = data.tiktokFollowers[data.tiktokFollowers.length - 1]?.value;
  const latestLoyalty = data.loyaltyMembers[data.loyaltyMembers.length - 1]?.value;
  const latestReviews = data.googleReviews[data.googleReviews.length - 1]?.value;
  const latestRating = data.googleRating[data.googleRating.length - 1]?.value;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Instagram" value={latestIg?.toLocaleString() || '-'} subtitle="followers" icon={Instagram} color="pink" />
        <KpiCard title="TikTok" value={latestTiktok?.toLocaleString() || '-'} subtitle="followers" icon={Heart} color="purple" />
        <KpiCard title="Loyalty Members" value={latestLoyalty?.toLocaleString() || '-'} subtitle="total members" icon={Users} color="brand" />
        <KpiCard title="Google Reviews" value={latestReviews?.toLocaleString() || '-'} subtitle="total reviews" icon={Star} color="blue" />
        <KpiCard title="Google Rating" value={latestRating?.toFixed(1) || '-'} subtitle="out of 5.0" icon={Star} color="green" />
      </div>

      {/* Combined Social Growth */}
      <ChartCard title="Audience Growth" subtitle="Instagram, TikTok & Loyalty members over time">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={socialCombined}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
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
            <AreaChart data={igChart.map(d => ({ ...d, period: shortLabel(d.period) }))}>
              <defs>
                <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.pink} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.pink} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" name="Followers" stroke={COLORS.pink} fill="url(#igGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Google Reviews Growth */}
        <ChartCard title="Google Reviews" subtitle="Review count growth">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reviewsChart.map(d => ({ ...d, period: shortLabel(d.period) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Reviews" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// --- MAIN DASHBOARD ---
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
                <p className="text-xs text-surface-400">It's Recess - Analytics Hub</p>
              </div>
            </div>
            <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-100 rounded-lg transition-colors" title="Refresh data">
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
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
        {activeTab === 'revenue' && <RevenueTab data={data.revenue} />}
        {activeTab === 'costs' && <CostsTab data={data.costs} />}
        {activeTab === 'customer' && <CustomerTab data={data.customer} />}
      </div>
    </div>
  );
}
