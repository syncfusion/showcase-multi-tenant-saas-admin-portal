import type {
  Tenant, SubscriptionPlan, User, BillingRecord,
  Ticket, Invoice, OnboardingTask, UtilizationRecord, AuditEntry,
} from '../data/types';
import { monthLabel } from '../shared/format';
import {
  BILLING_ANCHOR,
  INVOICE_ANCHOR,
  TENANT_CREATED_ANCHOR,
  TIMELINE_ANCHOR,
  USER_ACTIVITY_ANCHOR,
  dayDelta,
  localTodayUtc,
  monthDelta,
  shiftIsoByDays,
  shiftIsoByMonths,
  shiftMonthKey,
} from './clock';

import tenantsJson from './fixtures/tenants.json';
import plansJson from './fixtures/plans.json';
import usersJson from './fixtures/users.json';
import billingJson from './fixtures/billing.json';
import ticketsJson from './fixtures/tickets.json';
import invoicesJson from './fixtures/invoices.json';
import onboardingJson from './fixtures/onboarding.json';
import utilizationJson from './fixtures/utilization.json';

// Session store — loads fixtures once, holds derived data
let initialized = false;

const state = {
  tenants: [] as Tenant[],
  plans: [] as SubscriptionPlan[],
  users: [] as User[],
  billing: [] as BillingRecord[],
  tickets: [] as Ticket[],
  invoices: [] as Invoice[],
  onboarding: [] as OnboardingTask[],
  utilization: [] as UtilizationRecord[],
  audit: [] as AuditEntry[],
};

export function initStore(now = new Date()): void {
  if (initialized) return;
  const billingMonthsShift = monthDelta(BILLING_ANCHOR.year, BILLING_ANCHOR.month, now);
  const invoiceMonthsShift = monthDelta(INVOICE_ANCHOR.year, INVOICE_ANCHOR.month, now);
  const tenantMonthsShift = monthDelta(TENANT_CREATED_ANCHOR.year, TENANT_CREATED_ANCHOR.month, now);
  const timelineDays = dayDelta(TIMELINE_ANCHOR, now);
  const activityDays = dayDelta(USER_ACTIVITY_ANCHOR, now);

  state.tenants = (tenantsJson as Tenant[]).map(tenant => ({
    ...tenant,
    createdAt: shiftIsoByMonths(tenant.createdAt, tenantMonthsShift),
  }));
  state.plans = plansJson as SubscriptionPlan[];
  state.users = (usersJson as User[]).map(user => ({
    ...user,
    lastActive: shiftIsoByDays(user.lastActive, activityDays),
  }));
  state.billing = (billingJson as BillingRecord[]).map(row => ({
    ...row,
    month: shiftMonthKey(row.month, billingMonthsShift),
  }));
  state.tickets = (ticketsJson as Ticket[]).map(ticket => ({
    ...ticket,
    createdAt: shiftIsoByDays(ticket.createdAt, timelineDays),
  }));
  state.invoices = (invoicesJson as Invoice[]).map(invoice => ({
    ...invoice,
    month: shiftMonthKey(invoice.month, invoiceMonthsShift),
    paidDate: invoice.paidDate ? shiftIsoByMonths(invoice.paidDate, invoiceMonthsShift) : null,
  }));
  state.onboarding = (onboardingJson as OnboardingTask[]).map(task => ({
    ...task,
    startDate: shiftIsoByDays(task.startDate, timelineDays),
    endDate: shiftIsoByDays(task.endDate, timelineDays),
  }));
  state.utilization = utilizationJson as UtilizationRecord[];
  initialized = true;
}

export function getTenants(): Tenant[] { return state.tenants; }
export function getPlans(): SubscriptionPlan[] { return state.plans; }
export function getUsers(): User[] { return state.users; }
export function getBilling(): BillingRecord[] { return state.billing; }
export function getTickets(): Ticket[] { return state.tickets; }
export function getInvoices(): Invoice[] { return state.invoices; }
export function getOnboarding(): OnboardingTask[] { return state.onboarding; }
export function getUtilization(): UtilizationRecord[] { return state.utilization; }
export function getAudit(): AuditEntry[] { return state.audit; }

export interface PeriodOption {
  id: string;
  text: string;
  months: string[];
}

export interface DashboardKpis {
  totalARR: number;
  activeTenants: number;
  paying: number;
  trialing: number;
  suspended: number;
  totalUsers: number;
  nrr: number;
  expansion: number;
  contraction: number;
  churn: number;
}

export interface RevenueFlow {
  opening: number;
  newBusiness: number;
  expansion: number;
  contraction: number;
  churn: number;
  closing: number;
}

export interface PlanRevenueFlow {
  planId: string;
  planName: string;
  opening: number;
  newBusiness: number;
  expansion: number;
  contraction: number;
  churn: number;
  closing: number;
}

export type UtilMetric = 'cpu' | 'memory' | 'storage' | 'api' | 'bandwidth';
export type UtilWindow = '24h' | '7d' | '30d';
export type UtilStat = 'average' | 'peak';

export interface HeatMatrix {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
  raw: number[][];
  metric: UtilMetric;
  stat: UtilStat;
  window: UtilWindow;
}

export const DEFAULT_PERIOD_ID = 'ytd';

function billingMonths(): string[] {
  return [...new Set(state.billing.map(b => b.month))].sort();
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function quarterName(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `Q${Math.ceil(m / 3)} ${year}`;
}

function sliceMonths(all: string[], start: string, end: string): string[] {
  return all.filter(month => month >= start && month <= end);
}

export function getPeriodOptions(): PeriodOption[] {
  const all = billingMonths();
  if (!all.length) return [];
  const latest = all[all.length - 1];
  const latestMonthNum = Number(latest.slice(5, 7));
  const currentStart = shiftMonth(latest, -((latestMonthNum - 1) % 3));
  const lastEnd = shiftMonth(currentStart, -1);
  const lastStart = shiftMonth(lastEnd, -2);
  const year = latest.slice(0, 4);
  const options: PeriodOption[] = [
    { id: 'latest', text: `Latest month (${monthLabel(latest)})`, months: [latest] },
    { id: 'cq', text: `Current quarter (${quarterName(latest)})`, months: sliceMonths(all, currentStart, latest) },
    { id: 'lq', text: `Last quarter (${quarterName(lastStart)})`, months: sliceMonths(all, lastStart, lastEnd) },
  ];
  options.push(
    { id: 'ytd', text: `Year to date (${year})`, months: sliceMonths(all, `${year}-01`, latest) },
    { id: 'l12m', text: 'Last 12 months', months: sliceMonths(all, shiftMonth(latest, -11), latest) },
  );
  return options.filter(option => option.months.length > 0);
}

function resolveMonths(periodId: string): string[] {
  const options = getPeriodOptions();
  return (options.find(option => option.id === periodId) ?? options.find(option => option.id === DEFAULT_PERIOD_ID) ?? options[0])?.months ?? [];
}

function mrrByTenant(month: string | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!month) return map;
  for (const row of state.billing) {
    if (row.month !== month) continue;
    map.set(row.tenantId, (map.get(row.tenantId) ?? 0) + row.mrr);
  }
  return map;
}

function movementWindow(periodId: string): { startMonth: string | null; endMonth: string | null } {
  const all = billingMonths();
  const window = resolveMonths(periodId);
  if (!window.length) return { startMonth: null, endMonth: null };
  const endMonth = window[window.length - 1];
  const startIdx = all.indexOf(window[0]);
  const startMonth = startIdx > 0 ? all[startIdx - 1] : window.length > 1 ? window[0] : null;
  return { startMonth, endMonth };
}

interface PlanBucket {
  opening: number;
  newBusiness: number;
  expansion: number;
  contraction: number;
  churn: number;
}

function classifyMovement(periodId: string): RevenueFlow & { nrr: number; plans: PlanRevenueFlow[] } {
  const { startMonth, endMonth } = movementWindow(periodId);
  const start = mrrByTenant(startMonth);
  const end = mrrByTenant(endMonth);
  let opening = 0;
  let newBusiness = 0;
  let expansion = 0;
  let contraction = 0;
  let churn = 0;
  const planOf = new Map(state.tenants.map(tenant => [tenant.id, tenant.planId]));
  const buckets = new Map<string, PlanBucket>();
  const add = (tenantId: string, field: keyof PlanBucket, amount: number) => {
    const planId = planOf.get(tenantId) ?? 'unassigned';
    const bucket = buckets.get(planId) ?? { opening: 0, newBusiness: 0, expansion: 0, contraction: 0, churn: 0 };
    bucket[field] += amount;
    buckets.set(planId, bucket);
  };
  const ids = new Set([...start.keys(), ...end.keys()]);
  for (const id of ids) {
    const from = start.get(id) ?? 0;
    const to = end.get(id) ?? 0;
    if (from === 0 && to > 0) {
      newBusiness += to;
      add(id, 'newBusiness', to);
      continue;
    }
    if (from <= 0) continue;
    opening += from;
    add(id, 'opening', from);
    if (to > from) {
      expansion += to - from;
      add(id, 'expansion', to - from);
    } else if (to === 0) {
      churn += from;
      add(id, 'churn', from);
    } else if (to < from) {
      contraction += from - to;
      add(id, 'contraction', from - to);
    }
  }
  opening = Math.round(opening);
  newBusiness = Math.round(newBusiness);
  expansion = Math.round(expansion);
  contraction = Math.round(contraction);
  churn = Math.round(churn);
  const closing = opening + newBusiness + expansion - contraction - churn;
  const cohortEnd = opening - contraction - churn + expansion;
  const nameOf = new Map(state.plans.map(plan => [plan.id, plan.name]));
  const tierOf = new Map(state.plans.map(plan => [plan.id, plan.tier]));
  const plans = [...buckets.entries()]
    .map(([planId, bucket]) => {
      const planOpening = Math.round(bucket.opening);
      const planNew = Math.round(bucket.newBusiness);
      const planExpansion = Math.round(bucket.expansion);
      const planContraction = Math.round(bucket.contraction);
      const planChurn = Math.round(bucket.churn);
      return {
        planId,
        planName: nameOf.get(planId) ?? 'Unassigned',
        opening: planOpening,
        newBusiness: planNew,
        expansion: planExpansion,
        contraction: planContraction,
        churn: planChurn,
        closing: planOpening + planNew + planExpansion - planContraction - planChurn,
      };
    })
    .filter(plan => plan.opening + plan.newBusiness + plan.expansion + plan.contraction + plan.churn > 0)
    .sort((a, b) => (tierOf.get(a.planId) ?? 99) - (tierOf.get(b.planId) ?? 99));
  return {
    opening,
    newBusiness,
    expansion,
    contraction,
    churn,
    closing,
    nrr: opening > 0 ? cohortEnd / opening : 1,
    plans,
  };
}

export function getDashboardKPIs(periodId = DEFAULT_PERIOD_ID): DashboardKpis {
  const months = resolveMonths(periodId);
  const endMonth = months[months.length - 1];
  const totalARR = state.billing
    .filter(row => row.month === endMonth)
    .reduce((sum, row) => sum + row.mrr, 0);
  const flow = classifyMovement(periodId);
  return {
    totalARR,
    activeTenants: state.tenants.filter(tenant => tenant.status !== 'Cancelled').length,
    paying: state.tenants.filter(tenant => tenant.status === 'Active').length,
    trialing: state.tenants.filter(tenant => tenant.status === 'Trialing').length,
    suspended: state.tenants.filter(tenant => tenant.status === 'Suspended').length,
    totalUsers: state.tenants.reduce((sum, tenant) => sum + tenant.userCount, 0),
    nrr: flow.nrr,
    expansion: flow.expansion,
    contraction: flow.contraction,
    churn: flow.churn,
  };
}

export function getRevenueFlow(periodId = DEFAULT_PERIOD_ID): RevenueFlow {
  const flow = classifyMovement(periodId);
  return {
    opening: flow.opening,
    newBusiness: flow.newBusiness,
    expansion: flow.expansion,
    contraction: flow.contraction,
    churn: flow.churn,
    closing: flow.closing,
  };
}

export function getPlanRevenueFlow(periodId = DEFAULT_PERIOD_ID): PlanRevenueFlow[] {
  return classifyMovement(periodId).plans;
}

export const MRR_TARGET = 1_500_000;

export interface MrrPoint {
  date: Date;
  month: string;
  mrr: number;
  mom: number | null;
  yoy: number | null;
}

export interface MrrForecastPoint {
  date: Date;
  month: string;
  mrr: number;
}

export interface MrrTrend {
  actual: MrrPoint[];
  forecast: MrrForecastPoint[];
  latestMom: number | null;
  target: number;
  targetRatio: number;
}

function monthTotals(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of state.billing) totals.set(row.month, (totals.get(row.month) ?? 0) + row.mrr);
  return totals;
}

function monthDate(month: string): Date {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
}

function growthRate(totals: Map<string, number>, month: string, delta: number): number | null {
  const previousMonth = shiftMonth(month, delta);
  if (!totals.has(month) || !totals.has(previousMonth)) return null;
  const previous = totals.get(previousMonth) ?? 0;
  if (previous === 0) return null;
  return ((totals.get(month) ?? 0) - previous) / previous;
}

export function getMrrTrend(periodId = DEFAULT_PERIOD_ID): MrrTrend {
  const totals = monthTotals();
  const all = billingMonths();
  const latest = all[all.length - 1];
  const window = resolveMonths(periodId);
  const actual: MrrPoint[] = window.map(month => ({
    date: monthDate(month),
    month,
    mrr: totals.get(month) ?? 0,
    mom: growthRate(totals, month, -1),
    yoy: growthRate(totals, month, -12),
  }));

  const forecast: MrrForecastPoint[] = [];
  if (latest && window.includes(latest) && actual.length > 0) {
    const rates: number[] = [];
    for (let offset = 0; offset < 3; offset += 1) {
      const rate = growthRate(totals, shiftMonth(latest, -offset), -1);
      if (rate !== null) rates.push(rate);
    }
    const rate = rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : 0;
    const last = actual[actual.length - 1];
    forecast.push({ date: last.date, month: last.month, mrr: last.mrr });
    let value = last.mrr;
    for (let step = 1; step <= 3; step += 1) {
      value = Math.round(value * (1 + rate));
      const month = shiftMonth(latest, step);
      forecast.push({ date: monthDate(month), month, mrr: value });
    }
  }

  const ending = actual.length ? actual[actual.length - 1].mrr : 0;
  return {
    actual,
    forecast,
    latestMom: actual.length ? actual[actual.length - 1].mom : null,
    target: MRR_TARGET,
    targetRatio: MRR_TARGET > 0 ? ending / MRR_TARGET : 0,
  };
}

const API_CAP_PER_MINUTE = 500;
const BANDWIDTH_REFERENCE_MBPS = 100;
const BYTES_PER_CALL = 8 * 1024;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function dayScale(tenantId: string, dayIndex: number): number {
  let hash = dayIndex * 17;
  for (let i = 0; i < tenantId.length; i += 1) hash = (Math.imul(hash, 33) + tenantId.charCodeAt(i)) >>> 0;
  return 0.82 + 0.18 * Math.sin((hash % 360) * Math.PI / 180);
}

interface HourProfile {
  cpu: number[];
  memory: number[];
  api: number[];
}

function hourProfiles(): Map<string, HourProfile> {
  const map = new Map<string, HourProfile>();
  for (const row of state.utilization) {
    if (row.hour < 0 || row.hour > 23) continue;
    let profile = map.get(row.tenantId);
    if (!profile) {
      profile = { cpu: Array(24).fill(0), memory: Array(24).fill(0), api: Array(24).fill(0) };
      map.set(row.tenantId, profile);
    }
    profile.cpu[row.hour] = row.cpuPercent;
    profile.memory[row.hour] = row.memoryPercent;
    profile.api[row.hour] = row.apiCallsPerMinute;
  }
  return map;
}

function storageBase(tenant: Tenant): number {
  const limit = state.plans.find(plan => plan.id === tenant.planId)?.storageLimitGB ?? 0;
  if (limit <= 0) return 0;
  return clampPercent((tenant.storageUsedGB / limit) * 100);
}

function sampleAt(metric: UtilMetric, tenant: Tenant, profile: HourProfile, hour: number, scale: number): { percent: number; raw: number } {
  const cpu = profile.cpu[hour] * scale;
  const memory = profile.memory[hour] * scale;
  const api = profile.api[hour] * scale;
  if (metric === 'cpu') return { percent: clampPercent(cpu), raw: cpu };
  if (metric === 'memory') return { percent: clampPercent(memory), raw: memory };
  if (metric === 'storage') {
    const shape = 0.85 + 0.3 * (Math.min(profile.cpu[hour], 100) / 100);
    return {
      percent: clampPercent(storageBase(tenant) * shape * scale),
      raw: tenant.storageUsedGB * shape * scale,
    };
  }
  if (metric === 'api') return { percent: clampPercent((api / API_CAP_PER_MINUTE) * 100), raw: api };
  const mbps = (api * BYTES_PER_CALL * 8) / 60 / 1_000_000;
  return { percent: clampPercent((mbps / BANDWIDTH_REFERENCE_MBPS) * 100), raw: mbps };
}

function windowDays(windowId: UtilWindow): number {
  if (windowId === '7d') return 7;
  if (windowId === '30d') return 30;
  return 1;
}

export function getUtilizationMatrix(
  metric: UtilMetric = 'cpu',
  windowId: UtilWindow = '24h',
  stat: UtilStat = 'average',
): HeatMatrix {
  const profiles = hourProfiles();
  const days = windowDays(windowId);
  const tenants = state.tenants.filter(tenant => profiles.has(tenant.id));
  const scored = tenants.map(tenant => {
    const profile = profiles.get(tenant.id)!;
    let peak = 0;
    for (let day = 0; day < days; day += 1) {
      const scale = days === 1 ? 1 : dayScale(tenant.id, day);
      for (let hour = 0; hour < 24; hour += 1) {
        peak = Math.max(peak, sampleAt(metric, tenant, profile, hour, scale).percent);
      }
    }
    return { tenant, peak };
  }).sort((a, b) => b.peak - a.peak).slice(0, 12);

  const yLabels = scored.map(row => row.tenant.name);
  const xLabels: string[] = [];
  const data: number[][] = [];
  const raw: number[][] = [];

  if (windowId === '24h') {
    for (let hour = 0; hour < 24; hour += 1) {
      xLabels.push(hourLabel(hour));
      const percents: number[] = [];
      const raws: number[] = [];
      for (const row of scored) {
        const sample = sampleAt(metric, row.tenant, profiles.get(row.tenant.id)!, hour, 1);
        percents.push(Math.round(sample.percent));
        raws.push(sample.raw);
      }
      data.push(percents);
      raw.push(raws);
    }
  } else {
    const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const end = localTodayUtc();
    for (let day = 0; day < days; day += 1) {
      const date = new Date(end - (days - 1 - day) * 86_400_000);
      xLabels.push(dayFormat.format(date));
      const percents: number[] = [];
      const raws: number[] = [];
      for (const row of scored) {
        const profile = profiles.get(row.tenant.id)!;
        const scale = dayScale(row.tenant.id, day);
        const samples = Array.from({ length: 24 }, (_, hour) => sampleAt(metric, row.tenant, profile, hour, scale));
        const chosen = stat === 'peak'
          ? samples.reduce((best, sample) => sample.percent > best.percent ? sample : best)
          : {
              percent: samples.reduce((sum, sample) => sum + sample.percent, 0) / samples.length,
              raw: samples.reduce((sum, sample) => sum + sample.raw, 0) / samples.length,
            };
        percents.push(Math.round(chosen.percent));
        raws.push(chosen.raw);
      }
      data.push(percents);
      raw.push(raws);
    }
  }

  return { data, xLabels, yLabels, raw, metric, stat, window: windowId };
}

function hourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  const hr = hour % 12;
  return `${hr} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function addTenant(tenant: Tenant): void {
  state.tenants.push(tenant);
}

export function updateTenant(id: string, updates: Partial<Tenant>): void {
  const idx = state.tenants.findIndex(t => t.id === id);
  if (idx !== -1) Object.assign(state.tenants[idx], updates);
}

export function deleteTenant(id: string): void {
  const node = state.tenants.find(tenant => tenant.id === id);
  const parentId = node?.parentTenantId ?? null;
  for (const tenant of state.tenants) {
    if (tenant.parentTenantId === id) tenant.parentTenantId = parentId;
  }
  state.tenants = state.tenants.filter(tenant => tenant.id !== id);
}

export function nextInvoiceId(): string {
  const max = state.invoices.reduce((highest, invoice) => {
    const value = Number(invoice.id.replace(/\D/g, ''));
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `INV-${String(max + 1).padStart(3, '0')}`;
}

export function addInvoice(invoice: Invoice): void {
  state.invoices.push(invoice);
}

export function updateOnboarding(id: string, updates: Partial<OnboardingTask>): void {
  const task = state.onboarding.find(row => row.id === id);
  if (task) Object.assign(task, updates);
}