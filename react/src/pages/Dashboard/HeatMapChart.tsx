import { useMemo, useState } from 'react';
import { HeatMapComponent, Legend, Tooltip, Adaptor, Inject } from '@syncfusion/ej2-react-heatmap';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { chartTheme, type AppTheme } from '../../shared/palette';
import {
  getUtilizationMatrix,
  type UtilMetric,
  type UtilStat,
  type UtilWindow,
} from '../../data/store';

interface HeatMapProps {
  theme: AppTheme;
}

const METRICS: { id: UtilMetric; text: string }[] = [
  { id: 'cpu', text: 'CPU' },
  { id: 'memory', text: 'Memory' },
  { id: 'storage', text: 'Storage' },
  { id: 'api', text: 'API requests' },
  { id: 'bandwidth', text: 'Bandwidth' },
];

const WINDOWS: { id: UtilWindow; text: string }[] = [
  { id: '24h', text: 'Last 24 hours' },
  { id: '7d', text: 'Last 7 days' },
  { id: '30d', text: 'Last 30 days' },
];

const STATS: { id: UtilStat; text: string }[] = [
  { id: 'average', text: 'Average' },
  { id: 'peak', text: 'Peak' },
];

const BANDS = [
  { startValue: 0, endValue: 40, color: '#3b82f6', minColor: '#3b82f6', maxColor: '#3b82f6', label: 'Low' },
  { startValue: 40, endValue: 70, color: '#eab308', minColor: '#eab308', maxColor: '#eab308', label: 'Moderate' },
  { startValue: 70, endValue: 85, color: '#f97316', minColor: '#f97316', maxColor: '#f97316', label: 'High' },
  { startValue: 85, endValue: 100, color: '#dc2626', minColor: '#dc2626', maxColor: '#dc2626', label: 'Critical' },
];

function bandLabel(value: number): string {
  if (value >= 85) return 'Critical';
  if (value >= 70) return 'High';
  if (value >= 40) return 'Moderate';
  return 'Low';
}

function rawText(metric: UtilMetric, raw: number): string {
  if (metric === 'api') return `${Math.round(raw).toLocaleString('en-US')} /min`;
  if (metric === 'bandwidth') return `${raw.toFixed(2)} Mbps`;
  if (metric === 'storage') return `${raw.toFixed(1)} GB`;
  return `${Math.round(raw)}%`;
}

export function HeatMapChart({ theme }: HeatMapProps) {
  const themeName = chartTheme(theme);
  const [metric, setMetric] = useState<UtilMetric>('storage');
  const [windowId, setWindowId] = useState<UtilWindow>('7d');
  const [stat, setStat] = useState<UtilStat>('peak');

  const matrix = useMemo(
    () => getUtilizationMatrix(metric, windowId, stat),
    [metric, windowId, stat],
  );
  const metricText = METRICS.find(item => item.id === metric)?.text ?? 'CPU';
  const statText = stat === 'peak' ? 'Peak' : 'Average';
  const note = windowId === '24h'
    ? `${statText} ${metricText.toLowerCase()} by hour. One sample per hour, so average and peak match.`
    : `${statText} ${metricText.toLowerCase()} by day, from each tenant's hourly profile.`;

  return (
    <div className="heatmap-panel">
      <div className="heatmap-toolbar">
        <DropDownListComponent
          id="heatmap-metric"
          dataSource={METRICS as unknown as { [key: string]: Object }[]}
          fields={{ text: 'text', value: 'id' }}
          value={metric}
          width="180px"
          popupWidth="200px"
          change={(e: { value?: UtilMetric }) => { if (e.value) setMetric(e.value); }}
          htmlAttributes={{ 'aria-label': 'Utilization metric' }}
        />
        <DropDownListComponent
          id="heatmap-window"
          dataSource={WINDOWS as unknown as { [key: string]: Object }[]}
          fields={{ text: 'text', value: 'id' }}
          value={windowId}
          width="180px"
          popupWidth="200px"
          change={(e: { value?: UtilWindow }) => { if (e.value) setWindowId(e.value); }}
          htmlAttributes={{ 'aria-label': 'Utilization time window' }}
        />
        <DropDownListComponent
          id="heatmap-stat"
          dataSource={STATS as unknown as { [key: string]: Object }[]}
          fields={{ text: 'text', value: 'id' }}
          value={stat}
          width="140px"
          popupWidth="160px"
          change={(e: { value?: UtilStat }) => { if (e.value) setStat(e.value); }}
          htmlAttributes={{ 'aria-label': 'Average or peak' }}
        />
        <span className="heatmap-tz">Times in UTC</span>
      </div>
      <p className="heatmap-note">{note}</p>
      {matrix.yLabels.length === 0 ? (
        <div className="dashboard-empty">No utilization in this period.</div>
      ) : (
        <HeatMapComponent
          key={`${metric}-${windowId}-${stat}`}
          theme={themeName}
          xAxis={{
            labels: matrix.xLabels,
            interval: windowId === '24h' ? 3 : windowId === '30d' ? 5 : 1,
            labelRotation: windowId === '24h' ? 0 : -35,
            labelIntersectAction: 'None',
            title: { text: windowId === '24h' ? 'Hour (UTC)' : 'Date (UTC)' },
          }}
          yAxis={{
            labels: matrix.yLabels,
            maxLabelLength: 22,
          }}
          dataSource={matrix.data}
          paletteSettings={{ type: 'Fixed', palette: BANDS }}
          cellSettings={{
            showLabel: false,
            border: { width: 1, color: theme === 'dark' ? '#1e293b' : '#ffffff' },
          }}
          legendSettings={{
            visible: true,
            position: 'Bottom',
            height: '56px',
            alignment: 'Center',
          }}
          tooltipRender={(args: { content: string[]; xLabel: string; yLabel: string; value: number | unknown }) => {
            const x = matrix.xLabels.indexOf(args.xLabel);
            const y = matrix.yLabels.indexOf(args.yLabel);
            const value = typeof args.value === 'number' ? Math.round(args.value) : 0;
            const raw = x >= 0 && y >= 0 ? (matrix.raw[x]?.[y] ?? value) : value;
            args.content = [
              args.yLabel,
              `${args.xLabel} UTC · ${statText} ${metricText}`,
              `${value}% · ${bandLabel(value)} · ${rawText(metric, raw)}`,
            ];
          }}
          height="520px"
          width="100%"
        >
          <Inject services={[Legend, Tooltip, Adaptor]} />
        </HeatMapComponent>
      )}
    </div>
  );
}
