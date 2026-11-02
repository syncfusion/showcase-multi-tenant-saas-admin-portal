// Sample AI. Answers are computed from the in-memory store, not a live model.
import type { SubscriptionPlan, Ticket } from '../data/types';
import { nextQuarterLabel, scenarioNow } from '../data/clock';
import {
  initStore,
  getTenants,
  getPlans,
  getBilling,
  getTickets,
  getInvoices,
  getDashboardKPIs,
  getRevenueFlow,
  getMrrTrend,
  getPeriodOptions,
  getUtilizationMatrix,
  DEFAULT_PERIOD_ID,
} from '../data/store';
import { count, money, monthLabel, percent } from '../shared/format';

export interface AIRequest {
  prompt: string;
  context?: string;
}

export interface AIResponse {
  text: string;
  source: 'mock';
}

export interface AIService {
  send(request: AIRequest): Promise<AIResponse>;
  getSuggestions(context: string): string[];
}

const SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    'Detect revenue anomalies',
    'Summarize infrastructure load imbalances',
    'Forecast next quarter',
    'Explain the revenue Sankey diagram',
  ],
  tenants: [
    'Identify churn risk tenants',
    'Suggest plan upgrades',
    'Analyze usage anomalies',
  ],
  support: [
    'Summarize open tickets',
    'Suggest ticket prioritization',
    'Draft response for ticket',
  ],
  subscriptions: [
    'Predict upcoming contract renewals at churn risk',
    'Identify tenants primed for account expansion',
    'Analyze consumption curves',
  ],
};

const SLA_DAYS: Record<Ticket['priority'], number> = {
  Critical: 3,
  High: 7,
  Medium: 14,
  Low: 30,
};

const PRIORITY_RANK: Record<Ticket['priority'], number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function heading(title: string, body: string): string {
  return `**${title}**\n\n${body}`;
}

function bullets(lines: string[]): string {
  if (!lines.length) return 'None in the current data.';
  return lines.map(line => `- ${line}`).join('\n');
}

function tenantName(id: string): string {
  return getTenants().find(tenant => tenant.id === id)?.name ?? id;
}

function sortedMonths(): string[] {
  return [...new Set(getBilling().map(row => row.month))].sort();
}

function byTenant(month: string, field: 'mrr' | 'apiCalls' | 'storageGB' | 'userCount'): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of getBilling()) {
    if (row.month !== month) continue;
    map.set(row.tenantId, (map.get(row.tenantId) ?? 0) + row[field]);
  }
  return map;
}

interface Change {
  id: string;
  before: number;
  value: number;
  ratio: number;
}

function monthChanges(field: 'mrr' | 'apiCalls'): { latest?: string; previous?: string; rows: Change[] } {
  const months = sortedMonths();
  const latest = months[months.length - 1];
  const previous = months[months.length - 2];
  if (!latest || !previous) return { latest, previous, rows: [] };
  const end = byTenant(latest, field);
  const start = byTenant(previous, field);
  const rows: Change[] = [];
  for (const [id, value] of end) {
    const before = start.get(id);
    if (before == null || before === 0) continue;
    rows.push({ id, before, value, ratio: (value - before) / before });
  }
  return { latest, previous, rows };
}

function peaks(metric: 'cpu' | 'memory'): { name: string; peak: number }[] {
  const matrix = getUtilizationMatrix(metric, '24h', 'peak');
  return matrix.yLabels.map((name, index) => {
    let peak = 0;
    for (const row of matrix.data) peak = Math.max(peak, row[index] ?? 0);
    return { name, peak };
  }).sort((a, b) => b.peak - a.peak);
}

function limitRatio(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 1 : 0;
  return used / limit;
}

function nextPlan(plan: SubscriptionPlan): SubscriptionPlan | undefined {
  return getPlans()
    .filter(candidate => candidate.tier > plan.tier)
    .sort((a, b) => a.tier - b.tier)[0];
}

function pressureLines(): string[] {
  const lines: string[] = [];
  for (const tenant of getTenants()) {
    const plan = getPlans().find(item => item.id === tenant.planId);
    if (!plan || tenant.status === 'Cancelled') continue;
    const user = limitRatio(tenant.userCount, plan.userLimit);
    const storage = limitRatio(tenant.storageUsedGB, plan.storageLimitGB);
    const api = limitRatio(tenant.apiCallsMonthly, plan.apiLimit);
    const hottest = Math.max(user, storage, api);
    if (hottest < 0.8) continue;
    const part = user === hottest ? 'users' : storage === hottest ? 'storage' : 'API calls';
    const higher = nextPlan(plan);
    const step = higher ? ` Next tier is ${higher.name}.` : ' Already on the top tier.';
    lines.push(`**${tenant.name}** on ${plan.name}: ${part} at ${percent(hottest, 0)}.${step}`);
  }
  return lines.sort().slice(0, 5);
}

function ageDays(createdAt: string): number {
  return Math.max(0, Math.floor((scenarioNow().getTime() - new Date(createdAt).getTime()) / 86_400_000));
}

function openTickets(): Ticket[] {
  return getTickets().filter(ticket => ticket.status === 'Open' || ticket.status === 'In Progress');
}

function dashboardAnomalies(): string {
  const mrr = monthChanges('mrr');
  const api = monthChanges('apiCalls');
  const span = mrr.latest && mrr.previous ? `${monthLabel(mrr.previous)} to ${monthLabel(mrr.latest)}` : 'the latest two billing months';
  const drops = mrr.rows.filter(row => row.ratio < -0.01).sort((a, b) => a.ratio - b.ratio).slice(0, 3);
  const spikes = api.rows.filter(row => row.ratio > 0.25).sort((a, b) => b.ratio - a.ratio).slice(0, 3);
  const dropText = drops.length
    ? drops.map(row => `**${tenantName(row.id)}**: MRR ${percent(row.ratio)} (${money(row.before)} to ${money(row.value)}).`).join('\n')
    : 'No tenant lost more than 1% of MRR.';
  const spikeText = spikes.length
    ? spikes.map(row => `**${tenantName(row.id)}**: API calls ${percent(row.ratio)} (${count(row.before)} to ${count(row.value)}).`).join('\n')
    : 'No tenant grew API calls by more than 25%.';
  return heading('Revenue anomalies', `Compared ${span}.\n\nMRR declines:\n${dropText}\n\nAPI spikes:\n${spikeText}`);
}

function dashboardLoad(): string {
  const cpu = peaks('cpu').filter(row => row.peak >= 80).slice(0, 3);
  const memory = peaks('memory').filter(row => row.peak >= 80).slice(0, 3);
  const cpuText = cpu.length
    ? cpu.map(row => `**${row.name}** peaked at ${row.peak}% CPU.`).join('\n')
    : `No tenant peaked at 80% CPU. Highest is **${peaks('cpu')[0]?.name ?? 'n/a'}** at ${peaks('cpu')[0]?.peak ?? 0}%.`;
  const memoryText = memory.length
    ? memory.map(row => `**${row.name}** peaked at ${row.peak}% memory.`).join('\n')
    : `No tenant peaked at 80% memory. Highest is **${peaks('memory')[0]?.name ?? 'n/a'}** at ${peaks('memory')[0]?.peak ?? 0}%.`;
  return heading('Infrastructure load', `Peak hour in the last 24 hours.\n\nCPU:\n${cpuText}\n\nMemory:\n${memoryText}`);
}

function dashboardForecast(): string {
  const trend = getMrrTrend();
  const quarter = nextQuarterLabel();
  const latest = trend.actual[trend.actual.length - 1];
  if (!latest) return heading(`${quarter} revenue forecast`, 'No billing months are available to forecast.');
  const mom = latest.mom == null ? 'no prior month' : `month-over-month ${percent(latest.mom)}`;
  const forward = trend.forecast.slice(1);
  const lines = forward.length
    ? forward.map(point => `${monthLabel(point.month)}: ${money(point.mrr)}`).join('\n')
    : 'Not enough history to project the next three months.';
  return heading(`${quarter} revenue forecast`, `${monthLabel(latest.month)} MRR is ${money(latest.mrr)} (${mom}).\n\nProjected from the recent growth rate:\n${lines}`);
}

function dashboardSankey(): string {
  const flow = getRevenueFlow();
  const period = getPeriodOptions().find(option => option.id === DEFAULT_PERIOD_ID)?.text ?? 'Current quarter';
  return heading('Revenue flow', `${period}.\n\n- Opening ${money(flow.opening)}\n- New business ${money(flow.newBusiness)}\n- Expansion ${money(flow.expansion)}\n- Contraction ${money(flow.contraction)}\n- Churn ${money(flow.churn)}\n- Closing ${money(flow.closing)}`);
}

function tenantChurn(): string {
  const flagged = getTenants().filter(tenant => tenant.status === 'Suspended' || tenant.status === 'Cancelled');
  const statusLines = flagged
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 5)
    .map(tenant => `**${tenant.name}** is ${tenant.status} at ${money(tenant.mrr)} MRR.`);
  const drops = monthChanges('mrr').rows.filter(row => row.ratio < 0).sort((a, b) => a.ratio - b.ratio).slice(0, 5);
  const dropLines = drops.map(row => `**${tenantName(row.id)}** MRR ${percent(row.ratio)} to ${money(row.value)}.`);
  return heading('Churn risk', `Suspended or cancelled:\n${bullets(statusLines)}\n\nMRR down versus the prior month:\n${bullets(dropLines)}`);
}

function tenantUpgrades(): string {
  const lines = pressureLines();
  return heading('Plan upgrades', lines.length
    ? `Tenants at 80% or more of a plan limit:\n${bullets(lines)}`
    : 'No active tenant is at 80% of its user, storage, or API limit.');
}

function tenantUsage(): string {
  const top = peaks('cpu').slice(0, 5);
  return heading('Usage anomalies', top.length
    ? `Highest CPU peaks in the last 24 hours:\n${bullets(top.map(row => `**${row.name}** ${row.peak}% CPU.`))}`
    : 'No utilization samples are loaded.');
}

function supportSummary(): string {
  const tickets = openTickets();
  const byStatus = (status: Ticket['status']) => tickets.filter(ticket => ticket.status === status).length;
  const byPriority = (priority: Ticket['priority']) => tickets.filter(ticket => ticket.priority === priority).length;
  const oldest = tickets.slice().sort((a, b) => ageDays(b.createdAt) - ageDays(a.createdAt))[0];
  const oldestLine = oldest
    ? `Oldest open item is **${oldest.id}** (${oldest.priority}, ${ageDays(oldest.createdAt)} days): ${oldest.subject} — ${tenantName(oldest.tenantId)}.`
    : 'The queue has no open tickets.';
  return heading('Open tickets', `${tickets.length} open or in progress (${byStatus('Open')} open, ${byStatus('In Progress')} in progress).\n\nPriority: ${byPriority('Critical')} Critical, ${byPriority('High')} High, ${byPriority('Medium')} Medium, ${byPriority('Low')} Low.\n\n${oldestLine}`);
}

function supportPriority(): string {
  const ranked = openTickets()
    .map(ticket => {
      const age = ageDays(ticket.createdAt);
      const breach = age > SLA_DAYS[ticket.priority];
      return { ticket, age, breach };
    })
    .sort((a, b) => Number(b.breach) - Number(a.breach) || PRIORITY_RANK[a.ticket.priority] - PRIORITY_RANK[b.ticket.priority] || b.age - a.age)
    .slice(0, 5);
  const lines = ranked.map((row, index) => {
    const flag = row.breach ? 'SLA breach' : 'inside SLA';
    return `${index + 1}. **${row.ticket.id}** ${row.ticket.priority}, ${flag}, ${row.age} days — ${tenantName(row.ticket.tenantId)}: ${row.ticket.subject}`;
  });
  return heading('Suggested order', lines.length ? bullets(lines) : 'No open tickets to order.');
}

function supportDraft(): string {
  const open = openTickets();
  const urgent = open.filter(ticket => ticket.priority === 'Critical' || ticket.priority === 'High');
  const pool = (urgent.length ? urgent : open).slice().sort((a, b) => ageDays(b.createdAt) - ageDays(a.createdAt));
  const ticket = pool[0];
  if (!ticket) return heading('Draft reply', 'There is no open ticket to answer.');
  const name = tenantName(ticket.tenantId);
  return heading(`Draft reply for ${ticket.id}`, `Hello ${name} team,\n\nWe are working on "${ticket.subject}" (${ticket.priority}, open ${ageDays(ticket.createdAt)} days). ${ticket.description}\n\n${ticket.assignee} is assigned and will send the next update on this thread.\n\nSupport`);
}

function renewalRisk(): string {
  const invoices = getInvoices()
    .filter(invoice => invoice.status === 'Pending' || invoice.status === 'Overdue')
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, 5);
  const invoiceLines = invoices.map(invoice => `**${invoice.id}** ${tenantName(invoice.tenantId)} ${monthLabel(invoice.month)} ${money(invoice.amount)} ${invoice.status}.`);
  const drops = monthChanges('mrr').rows.filter(row => row.ratio < 0).sort((a, b) => a.ratio - b.ratio).slice(0, 5);
  const dropLines = drops.map(row => `**${tenantName(row.id)}** MRR ${percent(row.ratio)} to ${money(row.value)}.`);
  return heading('Renewals at risk', `Pending or overdue invoices:\n${bullets(invoiceLines)}\n\nFalling MRR:\n${bullets(dropLines)}`);
}

function expansion(): string {
  const rising = monthChanges('mrr').rows.filter(row => row.ratio > 0.01).sort((a, b) => b.ratio - a.ratio).slice(0, 5);
  const riseLines = rising.map(row => `**${tenantName(row.id)}** MRR ${percent(row.ratio)} to ${money(row.value)}.`);
  const limits = pressureLines();
  return heading('Expansion candidates', `Rising MRR:\n${bullets(riseLines)}\n\nNear a plan limit:\n${bullets(limits)}`);
}

function consumption(): string {
  const months = sortedMonths().slice(-3);
  if (!months.length) return heading('Consumption', 'No billing months are loaded.');
  const lines = months.map(month => {
    const rows = getBilling().filter(row => row.month === month);
    const api = rows.reduce((sum, row) => sum + row.apiCalls, 0);
    const storage = rows.reduce((sum, row) => sum + row.storageGB, 0);
    const users = rows.reduce((sum, row) => sum + row.userCount, 0);
    return `${monthLabel(month)}: ${count(api)} API calls, ${count(storage)} GB storage, ${count(users)} users.`;
  });
  return heading('Consumption', `Platform totals for the last ${months.length} billing months:\n${bullets(lines)}`);
}

function pageSummary(context: string): string {
  if (context === 'dashboard') {
    const kpis = getDashboardKPIs();
    const latest = sortedMonths().at(-1);
    return heading('Dashboard', `${latest ? monthLabel(latest) : 'Latest'} MRR is ${money(kpis.totalARR)}. ${kpis.paying} paying tenants, ${kpis.trialing} trialing, ${kpis.suspended} suspended. NRR is ${percent(kpis.nrr)}.`);
  }
  if (context === 'tenants') {
    const tenants = getTenants();
    const countOf = (status: string) => tenants.filter(tenant => tenant.status === status).length;
    return heading('Tenants', `${tenants.length} tenants: ${countOf('Active')} active, ${countOf('Trialing')} trialing, ${countOf('Suspended')} suspended, ${countOf('Cancelled')} cancelled.`);
  }
  if (context === 'support') return supportSummary();
  if (context === 'subscriptions') {
    const pending = getInvoices().filter(invoice => invoice.status === 'Pending' || invoice.status === 'Overdue').length;
    const latest = sortedMonths().at(-1);
    return heading('Subscriptions', `${pending} invoices are pending or overdue. ${latest ? `Latest billing month is ${monthLabel(latest)}.` : ''}`);
  }
  return heading('Assistant', 'Open a page and choose a suggested prompt for an answer from the current data.');
}

const ANSWERS: Record<string, Record<string, () => string>> = {
  dashboard: {
    'detect revenue anomalies': dashboardAnomalies,
    'summarize infrastructure load imbalances': dashboardLoad,
    'forecast next quarter': dashboardForecast,
    'explain the revenue sankey diagram': dashboardSankey,
  },
  tenants: {
    'identify churn risk tenants': tenantChurn,
    'suggest plan upgrades': tenantUpgrades,
    'analyze usage anomalies': tenantUsage,
  },
  support: {
    'summarize open tickets': supportSummary,
    'suggest ticket prioritization': supportPriority,
    'draft response for ticket': supportDraft,
  },
  subscriptions: {
    'predict upcoming contract renewals at churn risk': renewalRisk,
    'identify tenants primed for account expansion': expansion,
    'analyze consumption curves': consumption,
  },
};

function answerFor(prompt: string, context: string): string {
  const key = norm(prompt);
  const page = ANSWERS[context];
  if (page) {
    for (const [suggestion, respond] of Object.entries(page)) {
      if (key === suggestion || key.includes(suggestion)) return respond();
    }
  }
  return pageSummary(context);
}

export const mockAIService: AIService = {
  async send(request: AIRequest): Promise<AIResponse> {
    await new Promise(resolve => setTimeout(resolve, 400));
    initStore();
    const text = answerFor(request.prompt ?? '', request.context ?? '');
    return { text, source: 'mock' };
  },

  getSuggestions(context: string): string[] {
    return SUGGESTIONS[context] ?? ['Analyze the current data', 'Summarize key metrics'];
  },
};
