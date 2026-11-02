import { useEffect, useState } from 'react';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { SkeletonComponent } from '@syncfusion/ej2-react-notifications';
import {
  initStore,
  getDashboardKPIs,
  getRevenueFlow,
  getPlanRevenueFlow,
  getMrrTrend,
  getPeriodOptions,
  DEFAULT_PERIOD_ID,
} from '../../data/store';
import { compactMoney, money, monthLabel, percent } from '../../shared/format';
import { useTheme } from '../../theme/ThemeProvider';
import { KPICards } from './KPICards';
import { SankeyChart } from './SankeyChart';
import { HeatMapChart } from './HeatMapChart';
import { MrrTrendChart } from './MrrTrendChart';
import { AIDrawer } from '../../components/AIDrawer';
import { mockAIService } from '../../ai/AIService';
import './dashboard.css';

export default function Dashboard() {
  const [ready, setReady] = useState(false);
  const { theme } = useTheme();
  const [period, setPeriod] = useState(DEFAULT_PERIOD_ID);

  useEffect(() => {
    initStore();
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="dashboard">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="e-card" style={{ padding: '16px' }}>
              <SkeletonComponent shape="Rectangle" width="28px" height="28px" />
              <div style={{ marginTop: 8 }}>
                <SkeletonComponent width="60%" height="14px" />
                <SkeletonComponent width="80%" height="32px" style={{ marginTop: 8 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="e-card" style={{ padding: '16px', minHeight: '300px' }}>
              <SkeletonComponent width="100%" height="280px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const periods = getPeriodOptions();
  const kpis = getDashboardKPIs(period);
  const revenueFlow = getRevenueFlow(period);
  const planFlow = getPlanRevenueFlow(period);
  const mrrTrend = getMrrTrend(period);
  const latestPoint = mrrTrend.actual[mrrTrend.actual.length - 1];
  const momText = !latestPoint || mrrTrend.latestMom == null
    ? 'MoM unavailable'
    : `MoM ${mrrTrend.latestMom > 0 ? '+' : ''}${percent(mrrTrend.latestMom)}`;
  const mrrSubtitle = latestPoint
    ? `${monthLabel(latestPoint.month)} · ${momText} · Target ${money(mrrTrend.target)} · ${Math.round(mrrTrend.targetRatio * 100)}% of forecast`
    : 'No billing months in this period';
  const periodLabel = periods.find(option => option.id === period)?.text ?? '';
  const net = revenueFlow.closing - revenueFlow.opening;
  const netSign = net > 0 ? '+' : '';
  const netPct = revenueFlow.opening > 0 ? ` · ${percent(net / revenueFlow.opening)}` : '';
  const flowSubtitle = `${periodLabel}. Net ${netSign}${compactMoney(net)}${netPct}. New business is included in closing ARR and excluded from NRR.`;

  return (
    <div className="dashboard">
      <div className="dashboard-controls">
        <DropDownListComponent
          id="dashboard-period"
          dataSource={periods as unknown as { [key: string]: Object }[]}
          fields={{ text: 'text', value: 'id' }}
          value={period}
          change={(e: { value: string }) => { if (e.value) setPeriod(e.value); }}
          placeholder="Select period"
          width="240px"
          popupWidth="280px"
          cssClass="dashboard-period-select"
          htmlAttributes={{ 'aria-label': 'Reporting period' }}
        />
      </div>

      <KPICards kpis={kpis} theme={theme} />

      <div className="dashboard-row">
        <div className="e-card dashboard-card">
          <div className="e-card-header">
            <div className="e-card-header-caption">
              <span className="e-card-header-title">ARR Movement</span>
              <span className="e-card-sub-title">{flowSubtitle}</span>
            </div>
          </div>
          <div className="e-card-content">
            <SankeyChart key={period} data={revenueFlow} plans={planFlow} theme={theme} />
          </div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="e-card dashboard-card">
          <div className="e-card-header">
            <div className="e-card-header-caption">
              <span className="e-card-header-title">Resource Utilization</span>
              <span className="e-card-sub-title">Consumption for the busiest tenants. Low is blue, critical is red.</span>
            </div>
          </div>
          <div className="e-card-content">
            <HeatMapChart theme={theme} />
          </div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="e-card dashboard-card">
          <div className="e-card-header">
            <div className="e-card-header-caption">
              <span className="e-card-header-title">MRR Trends</span>
              <span className="e-card-sub-title">{mrrSubtitle}</span>
            </div>
          </div>
          <div className="e-card-content">
            <MrrTrendChart key={period} trend={mrrTrend} theme={theme} />
          </div>
        </div>
      </div>

      <AIDrawer service={mockAIService} context="dashboard" />
    </div>
  );
}
