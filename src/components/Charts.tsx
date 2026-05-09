import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

// ─── Revenue Optimisation Curve ──────────────────────────────────────────────
// Shows how expected revenue changes across the candidate price grid,
// with markers for the user's input price and the algorithm's optimal price.

interface RevenueCurveProps {
  priceCurve: { price: number; revenue: number; demand: number }[];
  inputPrice: number;
  optimalPrice: number;
  fitPrice: number;
  retailTariff: number;
}

export function RevenueCurve({ priceCurve, inputPrice, optimalPrice, fitPrice, retailTariff }: RevenueCurveProps) {
  const fmt3 = (v: number) => `${v.toFixed(3)}`;
  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-emerald-600" />Expected revenue</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" />Your price</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-emerald-700" />Optimal</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t border-stone-300" />FiT / Retail</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={priceCurve} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="price"
            tickFormatter={fmt3}
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Listing price ($/kWh)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#a8a29e' }}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'revenue' ? fmtCurrency(value) : `${value.toFixed(2)} kWh`,
              name === 'revenue' ? 'Expected revenue' : 'Expected demand',
            ]}
            labelFormatter={(label: number) => `Price: ${fmt3(label)}/kWh`}
            contentStyle={{ borderRadius: '1rem', border: '1px solid #e7e5e4', fontSize: 12 }}
          />
          <ReferenceLine x={fitPrice} stroke="#d4d0cb" strokeWidth={1} strokeDasharray="3 2" label={{ value: 'FiT', position: 'top', fontSize: 10, fill: '#a8a29e' }} />
          <ReferenceLine x={retailTariff} stroke="#d4d0cb" strokeWidth={1} strokeDasharray="3 2" label={{ value: 'Retail', position: 'top', fontSize: 10, fill: '#a8a29e' }} />
          <ReferenceLine x={inputPrice} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" label={{ value: 'Your price', position: 'top', fontSize: 10, fill: '#b45309' }} />
          <ReferenceLine x={optimalPrice} stroke="#059669" strokeWidth={2} strokeDasharray="4 2" label={{ value: 'Optimal', position: 'top', fontSize: 10, fill: '#065f46' }} />
          <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: '#059669' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Supply vs Demand Timeline ────────────────────────────────────────────────
// Area chart showing hourly supply kWh and demand kWh over the historical window.

interface TimelinePoint {
  label: string;
  supply: number;
  demand: number;
  supplyPrice: number;
  demandBid: number;
}

interface MarketTimelineProps {
  data: TimelinePoint[];
}

export function MarketTimeline({ data }: MarketTimelineProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-emerald-500" />Solar supply (kWh)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-amber-400" />Demand (kWh)</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v.toFixed(0)}`} />
          <Tooltip
            formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name === 'supply' ? 'Solar supply' : 'Demand']}
            labelFormatter={(label: string) => `Hour: ${label}`}
            contentStyle={{ borderRadius: '1rem', border: '1px solid #e7e5e4', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="supply" stroke="#10b981" strokeWidth={2} fill="url(#supplyGrad)" dot={false} />
          <Area type="monotone" dataKey="demand" stroke="#f59e0b" strokeWidth={2} fill="url(#demandGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hourly Demand Pattern ────────────────────────────────────────────────────
// Bar chart showing average demand kWh by hour of day (0–23).

interface HourlyBarProps {
  data: { hour: number; avgDemand: number; avgBid: number }[];
}

export function HourlyDemandPattern({ data }: HourlyBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded bg-amber-400" />Avg demand kWh by hour</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(h: number) => `${h}h`}
            tick={{ fontSize: 10, fill: '#78716c' }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v.toFixed(1)}`} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)} kWh`, 'Avg demand']}
            labelFormatter={(h: number) => `Hour ${h}:00`}
            contentStyle={{ borderRadius: '1rem', border: '1px solid #e7e5e4', fontSize: 12 }}
          />
          <Bar dataKey="avgDemand" fill="#fbbf24" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Supply vs Demand Price Spread (by hour of day) ───────────────────────────
// Dual-line chart overlaying avg supply price and avg demand bid per hour.
// Visually shows the margin the algorithm exploits.

interface PriceSpreadPoint {
  hour: number;
  supplyPrice: number;
  demandBid: number;
}

interface PriceSpreadChartProps {
  data: PriceSpreadPoint[];
}

export function PriceSpreadChart({ data }: PriceSpreadChartProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-emerald-500 rounded" />Avg supply price</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-amber-400 rounded" />Avg demand bid</span>
        <span className="text-stone-400">Gap = room for the optimiser to manoeuvre</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}h`} tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} interval={2} />
          <YAxis tickFormatter={(v: number) => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(3)}/kWh`, name === 'supplyPrice' ? 'Supply price' : 'Demand bid']}
            labelFormatter={(h: number) => `Hour ${h}:00`}
            contentStyle={{ borderRadius: '1rem', border: '1px solid #e7e5e4', fontSize: 12 }}
          />
          <Line type="monotone" dataKey="supplyPrice" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="demandBid" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Supply Surplus Scatter (price vs volume) ─────────────────────────────────
// Scatter plot showing each supply record as a point: x = surplus kWh, y = price.
// Reveals the typical household surplus range and asking-price distribution.

interface SupplyScatterProps {
  data: { kwh: number; price: number }[];
}

export function SupplyScatter({ data }: SupplyScatterProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-emerald-500/70" />Each point = one supply record</span>
        <span className="text-stone-400">x = surplus kWh · y = listing price</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="kwh" name="Surplus" unit=" kWh" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
          <YAxis dataKey="price" name="Price" tickFormatter={(v: number) => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} width={52} />
          <ZAxis range={[18, 18]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value: number, name: string) => [name === 'Surplus' ? `${value.toFixed(2)} kWh` : `$${value.toFixed(3)}/kWh`, name]}
            contentStyle={{ borderRadius: '1rem', border: '1px solid #e7e5e4', fontSize: 12 }}
          />
          <Scatter data={data} fill="#10b981" fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── OLS vs Random Forest Model Comparison ───────────────────────────────────
// Grouped bar chart comparing RMSE and R² between the two models.
// Shows directly why RF is the nonlinear comparison model.

interface ModelComparisonProps {
  olsRmse: number;
  rfRmse: number;
  rfR2: number;
  trainCount: number;
  testCount: number;
}

export function ModelComparisonChart({ olsRmse, rfRmse, rfR2, trainCount, testCount }: ModelComparisonProps) {
  const rmseData = [
    { model: 'OLS', rmse: olsRmse },
    { model: 'Random Forest', rmse: rfRmse },
  ];
  const r2Data = [{ label: 'RF R²', value: rfR2 }];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Test RMSE — lower is better</p>
        <p className="text-[11px] text-stone-400">Trained on {trainCount} records · tested on {testCount}</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={rmseData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barSize={22}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => v.toFixed(3)} tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: '#44403c' }} tickLine={false} axisLine={false} width={90} />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(4)}`, 'RMSE']}
              contentStyle={{ borderRadius: '1rem', border: '1px solid #e7e5e4', fontSize: 12 }}
            />
            <Bar dataKey="rmse" radius={[0, 6, 6, 0]}>
              {rmseData.map((entry, i) => (
                <rect key={i} fill={entry.model === 'Random Forest' ? '#059669' : '#d4d0cb'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Random Forest R² score</p>
        <p className="text-[11px] text-stone-400">1.0 = perfect fit · 0 = no better than mean</p>
        <div className="flex items-end gap-3 pt-4">
          <p className="text-5xl font-semibold tracking-tight text-emerald-800">{rfR2.toFixed(3)}</p>
          <div className="pb-2">
            <p className="text-sm font-medium text-stone-700">RF R²</p>
            <p className="text-xs text-stone-400">vs OLS RMSE {olsRmse.toFixed(3)}</p>
          </div>
        </div>
        <div className="mt-2 h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(1, rfR2)) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-stone-400">RF RMSE {rfRmse.toFixed(3)} vs OLS {olsRmse.toFixed(3)}</p>
      </div>
    </div>
  );
}
