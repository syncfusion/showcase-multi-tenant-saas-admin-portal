import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SankeyNodesCollectionDirective,
  SankeyNodeDirective,
  SankeyLinksCollectionDirective,
  SankeyLinkDirective,
  SankeyComponent,
  SankeyLegend,
  SankeyTooltip,
  SankeyHighlight,
  Inject,
} from '@syncfusion/ej2-react-charts';
import { chartTheme, palette, type AppTheme } from '../../shared/palette';
import { compactMoney } from '../../shared/format';
import type { PlanRevenueFlow, RevenueFlow } from '../../data/store';

interface SankeyProps {
  data: RevenueFlow;
  plans: PlanRevenueFlow[];
  theme: AppTheme;
}

const NODE_LABELS: Record<string, string> = {
  opening: 'Opening ARR',
  newBusiness: 'New Business ARR',
  expansion: 'Expansion ARR',
  closing: 'Closing ARR',
  contraction: 'Contraction ARR',
  churn: 'Churned ARR',
};

const PLAN_SERIES = [1, 2, 4, 6, 5, 7, 3, 0] as const;

export function SankeyChart({ data, plans, theme }: SankeyProps) {
  const colors = palette(theme);
  const themeName = chartTheme(theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

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

  const chartWidth = useMemo(() => Math.max(width, 0), [width]);
  const labels: Record<string, string> = {
    ...NODE_LABELS,
    ...Object.fromEntries(plans.map(plan => [plan.planId, plan.planName])),
  };
  const amounts: Record<string, number> = {
    opening: data.opening,
    newBusiness: data.newBusiness,
    expansion: data.expansion,
    closing: data.closing,
    contraction: data.contraction,
    churn: data.churn,
    ...Object.fromEntries(plans.map(plan => [plan.planId, plan.opening + plan.newBusiness + plan.expansion])),
  };
  const nodes = [
    data.opening > 0 ? { id: 'opening', color: colors.neutral } : null,
    data.newBusiness > 0 ? { id: 'newBusiness', color: colors.series[0] } : null,
    data.expansion > 0 ? { id: 'expansion', color: colors.success } : null,
    ...plans.map((plan, index) => ({
      id: plan.planId,
      color: colors.series[PLAN_SERIES[index % PLAN_SERIES.length]],
    })),
    data.closing > 0 ? { id: 'closing', color: colors.info } : null,
    data.contraction > 0 ? { id: 'contraction', color: colors.warning } : null,
    data.churn > 0 ? { id: 'churn', color: colors.danger } : null,
  ].filter((node): node is { id: string; color: string } => node !== null);
  const links = plans.flatMap(plan => [
    plan.opening > 0 ? { sourceId: 'opening', targetId: plan.planId, value: plan.opening } : null,
    plan.newBusiness > 0 ? { sourceId: 'newBusiness', targetId: plan.planId, value: plan.newBusiness } : null,
    plan.expansion > 0 ? { sourceId: 'expansion', targetId: plan.planId, value: plan.expansion } : null,
    plan.closing > 0 ? { sourceId: plan.planId, targetId: 'closing', value: plan.closing } : null,
    plan.contraction > 0 ? { sourceId: plan.planId, targetId: 'contraction', value: plan.contraction } : null,
    plan.churn > 0 ? { sourceId: plan.planId, targetId: 'churn', value: plan.churn } : null,
  ]).filter((link): link is { sourceId: string; targetId: string; value: number } => link !== null);
  const hasFlow = links.length > 0;

  return (
    <div className="sankey-container" ref={containerRef}>
      {chartWidth > 300 && hasFlow && (
        <SankeyComponent
          theme={themeName}
          width={`${chartWidth}px`}
          height="420px"
          legendSettings={{ visible: false, enableHighlight: true }}
          margin={{ left: 12, right: 28, top: 16, bottom: 16 }}
          labelSettings={{ visible: true, fontSize: '13px', fontWeight: '600', padding: 8 }}
          nodeStyle={{ padding: 16, width: 18 }}
          linkStyle={{ opacity: 0.6, curvature: 0.55, colorType: 'Source' }}
          tooltip={{ enable: true }}
          labelRendering={(args: { text: string; node?: { id?: string } }) => {
            const id = args.node?.id;
            if (!id) return;
            args.text = `${labels[id] ?? id}  ${compactMoney(amounts[id] ?? 0)}`;
          }}
          tooltipRendering={(args: { text: string; node?: { id?: string }; link?: { sourceId?: string; targetId?: string; value?: number } }) => {
            const equation = `Opening ${compactMoney(data.opening)} + New ${compactMoney(data.newBusiness)} + Expansion ${compactMoney(data.expansion)} − Contraction ${compactMoney(data.contraction)} − Churn ${compactMoney(data.churn)} = Closing ${compactMoney(data.closing)}`;
            const name = (id?: string) => labels[id ?? ''] ?? id ?? '';
            if (args.link) {
              args.text = `${name(args.link.sourceId)} → ${name(args.link.targetId)}<br/>${compactMoney(args.link.value ?? 0)}<br/>${equation}`;
              return;
            }
            const plan = plans.find(row => row.planId === args.node?.id);
            if (plan) {
              args.text = [
                plan.planName,
                `Opening ${compactMoney(plan.opening)}`,
                `New ${compactMoney(plan.newBusiness)}`,
                `Expansion ${compactMoney(plan.expansion)}`,
                `Contraction ${compactMoney(plan.contraction)}`,
                `Churn ${compactMoney(plan.churn)}`,
                `Closing ${compactMoney(plan.closing)}`,
                equation,
              ].join('<br/>');
              return;
            }
            if (args.node?.id) {
              args.text = `${name(args.node.id)}<br/>${compactMoney(amounts[args.node.id] ?? 0)}<br/>${equation}<br/>New business is excluded from NRR.`;
            }
          }}
        >
          <Inject services={[SankeyLegend, SankeyTooltip, SankeyHighlight]} />
          <SankeyNodesCollectionDirective>
            {nodes.map(node => (
              <SankeyNodeDirective key={node.id} id={node.id} label={{ text: labels[node.id] ?? node.id }} color={node.color} />
            ))}
          </SankeyNodesCollectionDirective>
          <SankeyLinksCollectionDirective>
            {links.map(link => (
              <SankeyLinkDirective key={`${link.sourceId}-${link.targetId}`} sourceId={link.sourceId} targetId={link.targetId} value={link.value} />
            ))}
          </SankeyLinksCollectionDirective>
        </SankeyComponent>
      )}
      {chartWidth > 300 && !hasFlow && (
        <div className="dashboard-empty">No revenue movement in this period.</div>
      )}
    </div>
  );
}
