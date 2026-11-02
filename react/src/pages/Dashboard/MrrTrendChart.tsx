import { useEffect, useRef, useState } from 'react';
import {
  ChartComponent,
  SeriesCollectionDirective,
  SeriesDirective,
  Inject,
  AreaSeries,
  LineSeries,
  DateTime,
  Legend,
  Tooltip,
} from '@syncfusion/ej2-react-charts';
import type { IAxisLabelRenderEventArgs, ISharedTooltipRenderEventArgs } from '@syncfusion/ej2-charts';
import { chartTheme, palette, type AppTheme } from '../../shared/palette';
import { money, monthLabel, percent } from '../../shared/format';
import type { MrrForecastPoint, MrrPoint, MrrTrend } from '../../data/store';

interface MrrTrendChartProps {
  trend: MrrTrend;
  theme: AppTheme;
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function growthText(ratio: number): string {
  const body = percent(ratio);
  return ratio > 0 ? `+${body}` : body;
}

function actualTooltip(point: MrrPoint): string {
  const mom = point.mom == null ? 'MoM unavailable' : `MoM ${growthText(point.mom)}`;
  const yoy = point.yoy == null ? 'No prior-year month' : `YoY ${growthText(point.yoy)}`;
  return `${monthLabel(point.month)} · ${money(point.mrr)} · ${mom} · ${yoy}`;
}

function forecastTooltip(point: MrrForecastPoint): string {
  return `Forecast · ${money(point.mrr)}`;
}

export function MrrTrendChart({ trend, theme }: MrrTrendChartProps) {
  const colors = palette(theme);
  const themeName = chartTheme(theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const brand = colors.series[0];
  const forecastColor = colors.series[1];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      setWidth(prev => (prev === next ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onAxisLabelRender = (args: IAxisLabelRenderEventArgs) => {
    if (args.axis.name === 'primaryYAxis' && Number.isFinite(args.value)) args.text = money(args.value);
  };

  const onSharedTooltip = (args: ISharedTooltipRenderEventArgs) => {
    const lines = (args.data ?? []).map(item => {
      const row = item.rawData as MrrPoint;
      return item.seriesName === 'Forecast' ? forecastTooltip(row) : actualTooltip(row);
    });
    if (lines.length) args.text = lines;
    const header = (args.data?.[0]?.rawData as MrrPoint | undefined)?.month;
    if (header) args.headerText = monthLabel(header);
  };

  if (!trend.actual.length) {
    return <div className="mrr-trend mrr-trend--empty">No billing months in this period.</div>;
  }

  const axisStart = new Date(trend.actual[0].date.getTime());
  const axisEndSource = trend.forecast.at(-1) ?? trend.actual[trend.actual.length - 1];
  const axisEnd = new Date(axisEndSource.date.getTime());

  return (
    <div className="mrr-trend" ref={containerRef}>
      {width > 0 && (
        <ChartComponent
          id="mrr-trend-chart"
          theme={themeName}
          width={`${width}px`}
          height="360px"
          chartArea={{ border: { width: 0 } }}
          margin={{ left: 8, right: 28, top: 8, bottom: 8 }}
          background="transparent"
          primaryXAxis={{
            valueType: 'DateTime',
            intervalType: 'Months',
            interval: 1,
            labelFormat: 'MMM yyyy',
            edgeLabelPlacement: 'Shift',
            labelIntersectAction: 'Rotate45',
            labelRotation: -45,
            enableTrim: false,
            rangePadding: 'None',
            minimum: axisStart,
            maximum: axisEnd,
            majorGridLines: { width: 0 },
          }}
          primaryYAxis={{
            title: 'MRR',
            labelFormat: 'c0',
            majorGridLines: { color: 'var(--color-sf-border-primary)', width: 0.5 },
          }}
          axisLabelRender={onAxisLabelRender}
          tooltip={{ enable: true, shared: true, showNearestPoint: false }}
          sharedTooltipRender={onSharedTooltip}
          legendSettings={{ visible: true, position: 'Bottom' }}
        >
          <Inject services={[AreaSeries, LineSeries, DateTime, Legend, Tooltip]} />
          <SeriesCollectionDirective>
            <SeriesDirective
              dataSource={trend.actual}
              xName="date"
              yName="mrr"
              name="Actual"
              type="Area"
              fill={withAlpha(brand, 0.2)}
              border={{ width: 2, color: brand }}
              marker={{
                visible: true,
                width: 8,
                height: 8,
                fill: brand,
                border: { width: 2, color: brand },
              }}
            />
            {trend.forecast.length > 0 && (
              <SeriesDirective
                dataSource={trend.forecast}
                xName="date"
                yName="mrr"
                name="Forecast"
                type="Line"
                width={2}
                dashArray="6,4"
                fill={forecastColor}
                marker={{
                  visible: true,
                  width: 7,
                  height: 7,
                  fill: forecastColor,
                  border: { width: 2, color: forecastColor },
                }}
              />
            )}
          </SeriesCollectionDirective>
        </ChartComponent>
      )}
    </div>
  );
}
