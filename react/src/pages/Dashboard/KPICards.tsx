import { TrendingUp, TrendingDown, Minus, Building2, Users, DollarSign, Percent, type LucideIcon } from 'lucide-react';
import { compactMoney, count, percent } from '../../shared/format';
import { palette, type AppTheme, type Tone } from '../../shared/palette';
import type { DashboardKpis } from '../../data/store';

interface KPICardsProps {
  kpis: DashboardKpis;
  theme: AppTheme;
}

interface CardModel {
  title: string;
  value: string;
  icon: LucideIcon;
  trendIcon: LucideIcon;
  trendLabel: string;
  tone: Tone;
}

export function KPICards({ kpis, theme }: KPICardsProps) {
  const p = palette(theme);
  const arrTarget = 1_500_000;
  const arrRatio = arrTarget > 0 ? kpis.totalARR / arrTarget : 0;
  const arrTone: Tone = arrRatio >= 1 ? 'success' : arrRatio >= 0.9 ? 'warning' : 'danger';
  const nrrTone: Tone = kpis.nrr >= 1 ? 'success' : kpis.nrr >= 0.9 ? 'warning' : 'danger';

  const cards: CardModel[] = [
    {
      title: 'Total ARR',
      value: compactMoney(kpis.totalARR),
      icon: DollarSign,
      trendIcon: arrRatio >= 1 ? TrendingUp : arrRatio >= 0.9 ? Minus : TrendingDown,
      trendLabel: `${Math.round(arrRatio * 100)}% of forecast`,
      tone: arrTone,
    },
    {
      title: 'Active Tenants',
      value: count(kpis.activeTenants),
      icon: Building2,
      trendIcon: Minus,
      trendLabel: `${count(kpis.paying)} paying · ${count(kpis.trialing)} trial · ${count(kpis.suspended)} suspended`,
      tone: 'info',
    },
    {
      title: 'Total Users',
      value: count(kpis.totalUsers),
      icon: Users,
      trendIcon: Minus,
      trendLabel: 'Across all tenants',
      tone: 'info',
    },
    {
      title: 'Net revenue retention',
      value: percent(kpis.nrr),
      icon: Percent,
      trendIcon: kpis.nrr >= 1 ? TrendingUp : kpis.nrr >= 0.9 ? Minus : TrendingDown,
      trendLabel: kpis.expansion === 0 && kpis.contraction + kpis.churn === 0
        ? 'No expansion or churn'
        : `${compactMoney(kpis.expansion)} expansion · ${compactMoney(kpis.contraction + kpis.churn)} contraction and churn`,
      tone: nrrTone,
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map(card => {
        const CIcon = card.icon;
        const TIcon = card.trendIcon;
        const color = p[card.tone];
        return (
          <div key={card.title} className="e-card kpi-card">
            <div className="e-card-content">
              <div className="kpi-card__body">
                <div className="kpi-card__header">
                  <span className="kpi-card__title">{card.title}</span>
                  <span className="kpi-card__icon" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
                    <CIcon size={16} strokeWidth={2} aria-hidden="true" />
                  </span>
                </div>
                <div className="kpi-card__value" style={{ color }}>{card.value}</div>
                <div className="kpi-card__trend" style={{ color }}>
                  <TIcon size={14} aria-hidden="true" />
                  <span>{card.trendLabel}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
