import React, { useEffect, useId, useRef, useState } from 'react';
import { BarChart3, PieChart } from 'lucide-react';

export const CHART_COLORS = ['#B28A00', '#334155', '#0F766E', '#7C3AED', '#0369A1', '#B45309', '#BE185D', '#64748B'];

const countFormatter = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
const safeValue = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

function useChartWidth() {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(560);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const updateWidth = () => setWidth(Math.max(220, Math.round(container.getBoundingClientRect().width)));
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return [containerRef, width];
}

function getTicks(maximum, allowDecimals) {
  if (maximum <= 0) return [0, 1];
  const rawStep = allowDecimals ? maximum / 4 : Math.max(1, maximum / 4);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const unit = rawStep / magnitude;
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * magnitude;
  const tickCount = Math.ceil(maximum / step);
  return Array.from({ length: tickCount + 1 }, (_, index) => Number((index * step).toPrecision(12)));
}

function monthLabel(point) {
  const match = /^(\d{4})-(\d{2})$/.exec(point.month || '');
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) {
    const date = new Date(`${point.month}-01T00:00:00Z`);
    return {
      short: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      year: match[1],
      full: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  }
  const label = String(point.label || point.month || 'Period');
  return { short: label, year: '', full: label };
}

function ChartEmptyState({ message, donut = false }) {
  const Icon = donut ? PieChart : BarChart3;
  return (
    <div className="flex min-h-[248px] flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 px-5 text-center">
      <Icon className="h-8 w-8 text-slate-400" aria-hidden="true" />
      <p className="max-w-xs text-xs leading-relaxed text-slate-500">{message}</p>
    </div>
  );
}

function ChartDataTable({ caption, columns, rows }) {
  return (
    <details className="mt-3 min-w-0 border-t border-slate-100 pt-3 text-xs">
      <summary className="w-fit cursor-pointer rounded-sm font-medium text-slate-500 hover:text-slate-900">View chart data</summary>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-[11px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>{columns.map((column, index) => <th key={`${column}-${index}`} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => columnIndex === 0
                  ? <th key={columnIndex} scope="row" className="px-3 py-2 font-medium">{cell}</th>
                  : <td key={columnIndex} className="whitespace-nowrap px-3 py-2 tabular-nums">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function TrendChart({
  data = [],
  series = [],
  title = 'Monthly trends',
  valueFormatter = countFormatter,
  axisFormatter = valueFormatter,
  allowDecimals = false,
  emptyMessage = 'No activity recorded in this period yet.',
}) {
  const chartId = useId();
  const [containerRef, width] = useChartWidth();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const pointRefs = useRef([]);
  const visibleSeries = series.map((item, index) => ({ ...item, color: item.color || CHART_COLORS[index % CHART_COLORS.length] }));
  const maximum = Math.max(0, ...data.flatMap((point) => visibleSeries.map(({ key }) => safeValue(point[key]))));
  const ticks = getTicks(maximum, allowDecimals);
  const scaleMaximum = ticks[ticks.length - 1];
  const height = 248;
  const left = Math.min(100, Math.max(42, ...ticks.map((tick) => String(axisFormatter(tick)).length * 6.2 + 14)));
  const right = 14;
  const top = 20;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const getX = (index) => left + (data.length <= 1 ? plotWidth / 2 : index / (data.length - 1) * plotWidth);
  const getY = (value) => top + plotHeight - safeValue(value) / scaleMaximum * plotHeight;
  const tickCount = Math.min(data.length, Math.max(2, Math.floor(plotWidth / 50)));
  const visibleTicks = new Set(Array.from({ length: tickCount }, (_, index) => tickCount === 1 ? 0 : Math.round(index * (data.length - 1) / (tickCount - 1))));
  const activeIndex = hoveredIndex ?? focusedIndex;
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const tooltipWidth = Math.min(232, width - 20);
  const tooltipLeft = activePoint ? Math.max(8, Math.min(width - tooltipWidth - 8, getX(activeIndex) - tooltipWidth / 2)) : 0;

  const handleKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = Math.min(data.length - 1, index + 1);
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = data.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      pointRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Escape') {
      setFocusedIndex(null);
      setHoveredIndex(null);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setFocusedIndex(index);
    }
  };

  return (
    <div ref={containerRef} className="min-w-0">
      {maximum === 0 ? <ChartEmptyState message={emptyMessage} /> : (
        <>
          <div className="mb-1 flex min-h-6 flex-wrap gap-x-4 gap-y-2" aria-label="Chart legend">
            {visibleSeries.map((item, index) => (
              <span key={item.key} className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke={item.color} strokeWidth="2.5" strokeDasharray={index === 0 ? undefined : `${6 - (index % 3)} 3`} /></svg>
                {item.label}
              </span>
            ))}
          </div>
          <div className="relative" onMouseLeave={() => setHoveredIndex(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block w-full overflow-visible" role="group" aria-labelledby={`${chartId}-title ${chartId}-description`}>
              <title id={`${chartId}-title`}>{title}</title>
              <desc id={`${chartId}-description`}>Monthly line chart. Focus a month to read its values; use the left and right arrow keys to move between months. A data table is available below.</desc>
              <g aria-hidden="true">
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line x1={left} y1={getY(tick)} x2={width - right} y2={getY(tick)} stroke="#E2E8F0" strokeDasharray={tick === 0 ? undefined : '3 4'} />
                    <text x={left - 10} y={getY(tick)} textAnchor="end" dominantBaseline="middle" fill="#64748B" fontSize="11">{axisFormatter(tick)}</text>
                  </g>
                ))}
                {data.map((point, index) => {
                  const label = monthLabel(point);
                  return visibleTicks.has(index) ? (
                    <text key={point.month || index} x={getX(index)} y={height - 25} textAnchor="middle" fill="#64748B" fontSize="11">
                      <tspan x={getX(index)}>{label.short}</tspan>
                      {label.year && <tspan x={getX(index)} dy="14" fontSize="10" fill="#94A3B8">{label.year}</tspan>}
                    </text>
                  ) : null;
                })}
                {activePoint && <line x1={getX(activeIndex)} y1={top} x2={getX(activeIndex)} y2={top + plotHeight} stroke="#94A3B8" strokeDasharray="3 3" />}
                {visibleSeries.map((item, seriesIndex) => (
                  <g key={item.key}>
                    <polyline points={data.map((point, index) => `${getX(index)},${getY(point[item.key])}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={seriesIndex === 0 ? undefined : `${6 - (seriesIndex % 3)} 3`} />
                    {data.map((point, index) => (
                      <circle key={point.month || index} cx={getX(index)} cy={getY(point[item.key])} r={index === activeIndex ? 5 : 3} fill="white" stroke={item.color} strokeWidth={index === activeIndex ? 2.5 : 2} />
                    ))}
                  </g>
                ))}
              </g>
              {data.map((point, index) => {
                const hitLeft = index === 0 ? left - 8 : (getX(index - 1) + getX(index)) / 2;
                const hitRight = index === data.length - 1 ? width - right + 8 : (getX(index) + getX(index + 1)) / 2;
                return (
                  <rect
                    key={point.month || index}
                    ref={(element) => { pointRefs.current[index] = element; }}
                    x={hitLeft} y={top - 8} width={hitRight - hitLeft} height={plotHeight + 16}
                    fill="transparent" rx="3" tabIndex="0" role="button"
                    aria-label={`${monthLabel(point).full}: ${visibleSeries.map((item) => `${item.label} ${valueFormatter(safeValue(point[item.key]))}`).join(', ')}`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onFocus={() => { setHoveredIndex(null); setFocusedIndex(index); }}
                    onBlur={() => setFocusedIndex(null)}
                    onClick={() => setFocusedIndex(index)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  />
                );
              })}
            </svg>
            {activePoint && (
              <div className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] shadow-lg" style={{ left: tooltipLeft, width: tooltipWidth }} aria-hidden="true">
                <p className="mb-2 font-semibold text-slate-900">{monthLabel(activePoint).full}</p>
                <dl className="space-y-1.5">
                  {visibleSeries.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <dt className="flex min-w-0 items-center gap-1.5 text-slate-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums text-slate-900">{valueFormatter(safeValue(activePoint[item.key]))}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Hover or focus a month to see values.</p>
        </>
      )}
      {data.length > 0 && <ChartDataTable caption={`${title} data`} columns={['Month', ...visibleSeries.map((item) => item.label)]} rows={data.map((point) => [monthLabel(point).full, ...visibleSeries.map((item) => valueFormatter(safeValue(point[item.key])))])} />}
    </div>
  );
}

export function DonutChart({ data = [], title = 'Member composition', totalLabel = 'members', emptyMessage = 'No membership data is available yet.' }) {
  const chartId = useId();
  const segments = data.map((item, index) => ({ ...item, value: safeValue(item.value), color: item.color || CHART_COLORS[index % CHART_COLORS.length] })).filter((item) => item.value > 0);
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 79;
  const circumference = 2 * Math.PI * radius;
  const percentFormatter = (value) => {
    const percent = value / total * 100;
    return percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`;
  };
  let cumulative = 0;

  return (
    <div className="min-w-0">
      {total === 0 ? <ChartEmptyState message={emptyMessage} donut /> : (
        <div className="flex min-h-[248px] flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <svg viewBox="0 0 220 220" className="h-44 w-44 shrink-0" role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
            <title id={`${chartId}-title`}>{title}</title>
            <desc id={`${chartId}-description`}>{countFormatter(total)} {totalLabel} across {segments.length} categories. Counts and percentages for every category are listed in the legend and data table.</desc>
            {segments.map((item, index) => {
              const offset = cumulative / total * circumference;
              cumulative += item.value;
              return <circle key={`${item.name}-${index}`} cx="110" cy="110" r={radius} fill="none" stroke={item.color} strokeWidth="31" strokeDasharray={`${item.value / total * circumference} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 110 110)" aria-hidden="true" />;
            })}
            <text x="110" y="108" textAnchor="middle" fill="#0F172A" fontSize={String(countFormatter(total)).length > 7 ? '20' : '30'} fontWeight="800">{countFormatter(total)}</text>
            <text x="110" y="132" textAnchor="middle" fill="#64748B" fontSize="12">{totalLabel}</text>
          </svg>
          <ul className="max-h-60 min-w-0 flex-1 basis-36 space-y-3 overflow-y-auto py-3 pr-2" tabIndex={segments.length > 5 ? 0 : undefined} aria-label={`${title} legend`}>
            {segments.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-start gap-2 text-slate-600"><span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="break-words">{item.name}</span></span>
                <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-900">{countFormatter(item.value)} <span className="ml-1 font-normal text-slate-400">{percentFormatter(item.value)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {total > 0 && <ChartDataTable caption={`${title} data`} columns={['Category', 'Members', 'Share']} rows={segments.map((item) => [item.name, countFormatter(item.value), percentFormatter(item.value)])} />}
    </div>
  );
}
