// Domain types for tenants, plans, billing, support, and usage.

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  planId: string;
  status: 'Active' | 'Trialing' | 'Suspended' | 'Cancelled';
  createdAt: string;
  mrr: number;
  userCount: number;
  storageUsedGB: number;
  apiCallsMonthly: number;
  contactName: string;
  contactEmail: string;
  parentTenantId: string | null;
  databaseStrategy: 'Shared' | 'Dedicated' | 'GeoPartitioned';
}

export interface PlanFeature {
  id: string;
  name: string;
  included: boolean;
  parentId: string | null;
  description: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: number;
  basePrice: number;
  userLimit: number;
  storageLimitGB: number;
  apiLimit: number;
  features: PlanFeature[];
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'Admin' | 'Developer' | 'Viewer' | 'Billing';
  status: 'Active' | 'Invited' | 'Suspended';
  lastActive: string;
  mfaEnabled: boolean;
}

export interface BillingRecord {
  id: string;
  tenantId: string;
  month: string;
  mrr: number;
  apiCalls: number;
  storageGB: number;
  userCount: number;
  overageCharges: number;
}

export interface Ticket {
  id: string;
  tenantId: string;
  subject: string;
  category: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignee: string;
  createdAt: string;
  description: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  month: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  paymentMethod: string;
  paidDate: string | null;
}

export interface OnboardingTask {
  id: string;
  tenantId: string;
  phase: string;
  milestone: string;
  title: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  startDate: string;
  endDate: string;
  progress: number;
  parentId: string | null;
  predecessor: string | null;
}

export interface UtilizationRecord {
  id: string;
  tenantId: string;
  hour: number;
  cpuPercent: number;
  memoryPercent: number;
  apiCallsPerMinute: number;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  action: string;
  resource: string;
  userId: string;
  timestamp: string;
  details: string;
}