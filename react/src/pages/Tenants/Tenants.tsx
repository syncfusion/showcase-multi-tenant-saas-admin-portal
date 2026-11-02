import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TreeGridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Sort,
  Filter,
  Toolbar,
  Edit,
  Selection,
  Inject,
} from '@syncfusion/ej2-react-treegrid';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import { TextBoxComponent } from '@syncfusion/ej2-react-inputs';
import { ButtonComponent, RadioButtonComponent } from '@syncfusion/ej2-react-buttons';
import { StepperComponent, StepsDirective, StepDirective } from '@syncfusion/ej2-react-navigations';
import { ToastComponent } from '@syncfusion/ej2-react-notifications';
import type { Tenant, SubscriptionPlan } from '../../data/types';
import { initStore, getTenants, getPlans, addTenant, updateTenant, deleteTenant } from '../../data/store';
import { isoDate } from '../../data/clock';
import { count, money } from '../../shared/format';
import { LoadingState } from '../../components/LoadingState';
import { AIDrawer } from '../../components/AIDrawer';
import { mockAIService } from '../../ai/AIService';
import './tenants.css';

const PAGE_OPTIONS = { pageSize: 20, pageSizes: [10, 20, 40] };
const STATUS_OPTIONS = ['All', 'Active', 'Trialing', 'Suspended', 'Cancelled'];
const PLAN_FILTER_OPTIONS = ['All', 'Starter', 'Professional', 'Business', 'Enterprise'];
const DATABASE_OPTIONS: { label: string; value: Tenant['databaseStrategy'] }[] = [
  { label: 'Shared', value: 'Shared' },
  { label: 'Dedicated', value: 'Dedicated' },
  { label: 'Geo-partitioned', value: 'GeoPartitioned' },
];

function tenantStatusTemplate(props: { status?: string }) {
  const colors: Record<string, string> = {
    Active: 'var(--color-sf-fg-success-primary)',
    Trialing: 'var(--color-sf-fg-info-primary)',
    Suspended: 'var(--color-sf-fg-warning-primary)',
    Cancelled: 'var(--color-sf-fg-danger-primary)',
  };
  const bgColors: Record<string, string> = {
    Active: 'var(--color-sf-bg-success-primary)',
    Trialing: 'var(--color-sf-bg-info-primary)',
    Suspended: 'var(--color-sf-bg-warning-primary)',
    Cancelled: 'var(--color-sf-bg-danger-primary)',
  };
  const status = props.status ?? '';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
      color: colors[status] || 'var(--color-sf-fg-secondary)',
      background: bgColors[status] || 'var(--color-sf-bg-neutral-primary)',
    }}>
      {status}
    </span>
  );
}

function databaseLabel(value: string): string {
  if (value === 'GeoPartitioned') return 'Geo-partitioned';
  return value;
}

type TenantLevel = 'Enterprise' | 'Subsidiary' | 'Department';

interface TreeTenant {
  id: string;
  name: string;
  tier: TenantLevel;
  enterprise: string;
  subsidiary: string;
  planName: string;
  status: Tenant['status'];
  mrr: number;
  userCount: number;
  database: string;
  children?: TreeTenant[];
}

interface TenantForm {
  name: string;
  domain: string;
  contactName: string;
  contactEmail: string;
  planId: string;
  databaseStrategy: Tenant['databaseStrategy'];
}

const EMPTY_FORM: TenantForm = {
  name: '',
  domain: '',
  contactName: '',
  contactEmail: '',
  planId: '',
  databaseStrategy: 'Shared',
};

function buildTree(tenants: Tenant[], plans: SubscriptionPlan[]): TreeTenant[] {
  const planName = new Map(plans.map(plan => [plan.id, plan.name]));
  const byId = new Map(tenants.map(tenant => [tenant.id, tenant]));
  const nodes = new Map<string, TreeTenant>();

  const rootOf = (tenant: Tenant): Tenant => {
    let current = tenant;
    const seen = new Set<string>();
    while (current.parentTenantId && byId.has(current.parentTenantId) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parentTenantId)!;
    }
    return current;
  };

  const levelOf = (tenant: Tenant): TenantLevel => {
    if (!tenant.parentTenantId || !byId.has(tenant.parentTenantId)) return 'Enterprise';
    const parent = byId.get(tenant.parentTenantId)!;
    if (!parent.parentTenantId || !byId.has(parent.parentTenantId)) return 'Subsidiary';
    return 'Department';
  };

  for (const tenant of tenants) {
    const level = levelOf(tenant);
    const enterprise = rootOf(tenant).name;
    const parent = tenant.parentTenantId ? byId.get(tenant.parentTenantId) : undefined;
    const subsidiary = level === 'Enterprise' ? '—' : level === 'Subsidiary' ? tenant.name : (parent?.name ?? '—');
    nodes.set(tenant.id, {
      id: tenant.id,
      name: tenant.name,
      enterprise,
      subsidiary,
      planName: planName.get(tenant.planId) ?? 'Unknown',
      status: tenant.status,
      mrr: tenant.mrr,
      userCount: tenant.userCount,
      database: databaseLabel(tenant.databaseStrategy),
      tier: level,
    });
  }

  const roots: TreeTenant[] = [];
  for (const tenant of tenants) {
    const node = nodes.get(tenant.id)!;
    const parent = tenant.parentTenantId ? nodes.get(tenant.parentTenantId) : undefined;
    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function nodeMatches(node: TreeTenant, status: string, plan: string): boolean {
  if (status !== 'All' && node.status !== status) return false;
  if (plan !== 'All' && node.planName !== plan) return false;
  return true;
}

function filterTree(nodes: TreeTenant[], status: string, plan: string): TreeTenant[] {
  if (status === 'All' && plan === 'All') return nodes;
  const next: TreeTenant[] = [];
  for (const node of nodes) {
    const children = node.children ? filterTree(node.children, status, plan) : [];
    if (nodeMatches(node, status, plan) || children.length) {
      const copy: TreeTenant = { ...node };
      if (children.length) copy.children = children;
      else delete copy.children;
      next.push(copy);
    }
  }
  return next;
}

function countNodes(nodes: TreeTenant[]): number {
  return nodes.reduce((total, node) => total + 1 + (node.children ? countNodes(node.children) : 0), 0);
}

function nextTenantId(tenants: Tenant[]): string {
  const max = tenants.reduce((highest, tenant) => {
    const value = Number(tenant.id.replace(/\D/g, ''));
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `T-${String(max + 1).padStart(3, '0')}`;
}

function infoComplete(form: TenantForm): boolean {
  return Boolean(
    form.name.trim() && form.domain.trim() && form.contactName.trim() && form.contactEmail.trim(),
  );
}

export default function Tenants() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TenantForm>({ ...EMPTY_FORM });
  const [step, setStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [infoAttempted, setInfoAttempted] = useState(false);
  const treeRef = useRef<TreeGridComponent | null>(null);
  const toastRef = useRef<ToastComponent | null>(null);
  const stepperRef = useRef<StepperComponent | null>(null);
  const formRef = useRef(form);
  const expandKey = useRef('');
  formRef.current = form;

  const treeData = useMemo(() => {
    const tree = buildTree(tenants, plans);
    return filterTree(tree, statusFilter, planFilter);
  }, [tenants, plans, statusFilter, planFilter]);

  useEffect(() => {
    initStore();
    setTenants(getTenants());
    setPlans(getPlans());
    setLoading(false);
  }, []);

  const visibleCount = countNodes(treeData);
  const atDefaults = statusFilter === 'All' && planFilter === 'All';
  const selectedPlan = plans.find(plan => plan.id === form.planId) ?? plans[0];
  const includedFeatures = selectedPlan?.features.filter(feature => feature.included) ?? [];
  const deleteTarget = tenants.find(tenant => tenant.id === deleteId);

  function refresh() {
    setTenants([...getTenants()]);
  }

  useEffect(() => {
    if (!dialogOpen) return;
    const timer = window.setTimeout(() => stepperRef.current?.refreshProgressbar(), 50);
    return () => window.clearTimeout(timer);
  }, [dialogOpen, step]);

  function openAdd() {
    setEditingId(null);
    setStep(0);
    setInfoAttempted(false);
    setForm({ ...EMPTY_FORM, planId: plans[0]?.id ?? '' });
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const tenant = getTenants().find(row => row.id === id);
    if (!tenant) return;
    setEditingId(id);
    setStep(0);
    setInfoAttempted(false);
    setForm({
      name: tenant.name,
      domain: tenant.domain,
      contactName: tenant.contactName,
      contactEmail: tenant.contactEmail,
      planId: tenant.planId,
      databaseStrategy: tenant.databaseStrategy,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setStep(0);
    setInfoAttempted(false);
  }

  function saveForm() {
    if (!infoComplete(form)) {
      setStep(0);
      setInfoAttempted(true);
      return;
    }
    const planId = form.planId || plans[0]?.id || 'plan-starter';
    if (editingId) {
      const current = getTenants().find(tenant => tenant.id === editingId);
      updateTenant(editingId, {
        name: form.name.trim(),
        domain: form.domain.trim(),
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        planId,
        databaseStrategy: form.databaseStrategy,
        status: current?.status,
        mrr: current?.mrr,
        userCount: current?.userCount,
      });
      toastRef.current?.show({ title: 'Tenant updated', content: form.name.trim(), cssClass: 'e-toast-success', timeOut: 3000 });
    } else {
      addTenant({
        id: nextTenantId(getTenants()),
        name: form.name.trim(),
        domain: form.domain.trim(),
        planId,
        status: 'Trialing',
        createdAt: isoDate(),
        mrr: 0,
        userCount: 0,
        storageUsedGB: 0,
        apiCallsMonthly: 0,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        parentTenantId: null,
        databaseStrategy: form.databaseStrategy,
      });
      toastRef.current?.show({ title: 'Tenant created', content: form.name.trim(), cssClass: 'e-toast-success', timeOut: 3000 });
    }
    closeDialog();
    expandKey.current = '';
    refresh();
  }

  function confirmDelete() {
    if (!deleteId) return;
    const name = deleteTarget?.name ?? deleteId;
    deleteTenant(deleteId);
    setDeleteId(null);
    expandKey.current = '';
    refresh();
    toastRef.current?.show({ title: 'Tenant deleted', content: name, cssClass: 'e-toast-success', timeOut: 3000 });
  }

  function onActionBegin(args: { requestType?: string; cancel?: boolean; rowData?: TreeTenant; data?: TreeTenant | TreeTenant[] }) {
    const record = Array.isArray(args.data) ? args.data[0] : args.data;
    const row = args.rowData ?? record;
    if (args.requestType === 'add') {
      args.cancel = true;
      openAdd();
    } else if (args.requestType === 'beginEdit') {
      args.cancel = true;
      if (row?.id) openEdit(row.id);
    } else if (args.requestType === 'delete') {
      args.cancel = true;
      if (row?.id) setDeleteId(row.id);
    }
  }

  function onToolbarClick(args: { item?: { id?: string }; cancel?: boolean }) {
    const id = args.item?.id ?? '';
    if (id.endsWith('_add')) {
      args.cancel = true;
      openAdd();
    } else if (id.endsWith('_edit')) {
      args.cancel = true;
      const selected = treeRef.current?.getSelectedRecords()?.[0] as TreeTenant | undefined;
      if (selected?.id) openEdit(selected.id);
    } else if (id.endsWith('_delete')) {
      args.cancel = true;
      const selected = treeRef.current?.getSelectedRecords()?.[0] as TreeTenant | undefined;
      if (selected?.id) setDeleteId(selected.id);
    }
  }

  function onStepChanging(args: { activeStep?: number; previousStep?: number; cancel?: boolean }) {
    const destination = args.activeStep ?? 0;
    const origin = args.previousStep ?? 0;
    if (destination > origin && origin === 0 && !infoComplete(formRef.current)) {
      args.cancel = true;
      setInfoAttempted(true);
    }
  }

  function goNext() {
    if (step === 0 && !infoComplete(form)) {
      setInfoAttempted(true);
      return;
    }
    setStep(current => Math.min(current + 1, 2));
  }

  function fieldState(value: string): '' | 'e-error' {
    return infoAttempted && !value.trim() ? 'e-error' : '';
  }

  if (loading) return <LoadingState label="Loading Tenants…" />;

  return (
    <div className="tenant-page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="app-page-title" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Tenants</h2>
          <p className="app-page-subtitle" style={{ margin: '4px 0 0', color: 'var(--color-sf-fg-secondary)', fontSize: '13px' }}>
            Enterprise, subsidiary, and department hierarchy
          </p>
        </div>
        <ButtonComponent cssClass="e-primary" onClick={openAdd}>New Tenant</ButtonComponent>
      </div>

      <div className="e-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'row', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="tenant-plan-filter" style={{ fontSize: '13px', color: 'var(--color-sf-fg-secondary)' }}>Plan</label>
          <DropDownListComponent
            id="tenant-plan-filter"
            dataSource={PLAN_FILTER_OPTIONS}
            value={planFilter}
            change={(e: { value: string }) => setPlanFilter(e.value)}
            width="200px"
            htmlAttributes={{ 'aria-label': 'Filter by plan' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label htmlFor="tenant-status-filter" style={{ fontSize: '13px', color: 'var(--color-sf-fg-secondary)' }}>Status</label>
          <DropDownListComponent
            id="tenant-status-filter"
            dataSource={STATUS_OPTIONS}
            value={statusFilter}
            change={(e: { value: string }) => setStatusFilter(e.value)}
            width="200px"
            htmlAttributes={{ 'aria-label': 'Filter by status' }}
          />
        </div>
        <ButtonComponent cssClass="e-outline" disabled={atDefaults} onClick={() => { setStatusFilter('All'); setPlanFilter('All'); }}>
          Reset
        </ButtonComponent>
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--color-sf-fg-secondary)' }}>
          {count(visibleCount)} of {count(tenants.length)} tenants · {money(tenants.reduce((sum, tenant) => sum + tenant.mrr, 0))} MRR
        </div>
      </div>

      <div className="e-card" style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>Tenant Hierarchy</h3>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-sf-fg-secondary)' }}>
          Enterprise accounts, regional subsidiaries, and the departments billed on those subsidiaries
        </p>
        <TreeGridComponent
          id="tenant-treegrid"
          ref={treeRef}
          className="tenant-tree"
          dataSource={treeData}
          childMapping="children"
          treeColumnIndex={1}
          allowPaging
          allowSorting
          allowFiltering
          filterSettings={{type: 'Excel'}}
          pageSettings={PAGE_OPTIONS}
          toolbar={['Add', 'Edit', 'Delete', 'Search']}
          editSettings={{ allowAdding: true, allowEditing: true, allowDeleting: true, mode: 'Dialog' }}
          selectionSettings={{ type: 'Single', mode: 'Row' }}
          height="auto"
          gridLines="Both"
          actionBegin={onActionBegin}
          toolbarClick={onToolbarClick}
          rowDataBound={(args: { data?: TreeTenant; row?: HTMLElement }) => {
            if (args.data?.tier === 'Enterprise') args.row?.classList.add('tenant-row--enterprise');
          }}
          dataBound={() => {
            const key = `${statusFilter}|${planFilter}|${tenants.length}|${visibleCount}`;
            if (expandKey.current === key) return;
            expandKey.current = key;
            treeRef.current?.expandAll();
          }}
          created={() => {
            const input = document.getElementById('tenant-treegrid')?.querySelector<HTMLInputElement>('.e-searchbox input');
            input?.setAttribute('aria-label', 'Search tenants');
          }}
        >
          <Inject services={[Page, Sort, Filter, Toolbar, Edit, Selection]} />
          <ColumnsDirective>
            <ColumnDirective field="id" isPrimaryKey visible={false} />
            <ColumnDirective field="name" headerText="Name" width="220" />
            <ColumnDirective field="tier" headerText="Level" width="120" />
            <ColumnDirective field="enterprise" headerText="Enterprise" width="180" />
            <ColumnDirective field="subsidiary" headerText="Subsidiary" width="200" />
            <ColumnDirective field="planName" headerText="Plan" width="140" />
            <ColumnDirective field="status" headerText="Status" width="120" textAlign="Center" template={tenantStatusTemplate} />
            <ColumnDirective field="mrr" headerText="MRR" width="110" textAlign="Right" format="C0" />
            <ColumnDirective field="userCount" headerText="Users" width="90" textAlign="Right" format="N0" />
            <ColumnDirective field="database" headerText="Database" width="140" />
          </ColumnsDirective>
        </TreeGridComponent>
      </div>

      {document.getElementById('root')
        ? createPortal(<div id="tenant-dialog-host" className="app-dialog-host" />, document.getElementById('root')!)
        : null}
      <DialogComponent
        target="#tenant-dialog-host"
        visible={dialogOpen}
        header={editingId ? 'Edit Tenant' : 'New Tenant'}
        width="640px"
        isModal
        showCloseIcon
        close={closeDialog}
        open={() => stepperRef.current?.refreshProgressbar()}
      >
        <div className="tenant-dialog">
          <StepperComponent
            ref={stepperRef}
            key={`${editingId ?? 'new'}-${dialogOpen ? 'open' : 'closed'}`}
            linear
            labelPosition="End"
            activeStep={step}
            stepChanging={onStepChanging}
            stepChanged={(args: { activeStep?: number }) => setStep(args.activeStep ?? 0)}
            created={() => stepperRef.current?.refreshProgressbar()}
            cssClass="tenant-dialog__stepper"
          >
            <StepsDirective>
              <StepDirective iconCss="e-icons e-people" label="Tenant info" />
              <StepDirective iconCss="e-icons e-description" label="Plan" />
              <StepDirective iconCss="e-icons e-settings" label="Database isolation" />
            </StepsDirective>
          </StepperComponent>

          {step === 0 && (
            <div className="tenant-dialog__fields">
              <TextBoxComponent
                id="tenant-company"
                placeholder="Company name"
                floatLabelType="Auto"
                value={form.name}
                cssClass={fieldState(form.name)}
                input={(e: { value?: string }) => setForm(current => ({ ...current, name: e.value ?? '' }))}
              />
              <TextBoxComponent
                id="tenant-domain"
                placeholder="Domain"
                floatLabelType="Auto"
                value={form.domain}
                cssClass={fieldState(form.domain)}
                input={(e: { value?: string }) => setForm(current => ({ ...current, domain: e.value ?? '' }))}
              />
              <div className="tenant-dialog__split">
                <TextBoxComponent
                  id="tenant-contact"
                  placeholder="Contact name"
                  floatLabelType="Auto"
                  value={form.contactName}
                  cssClass={fieldState(form.contactName)}
                  input={(e: { value?: string }) => setForm(current => ({ ...current, contactName: e.value ?? '' }))}
                />
                <TextBoxComponent
                  id="tenant-email"
                  placeholder="Contact email"
                  floatLabelType="Auto"
                  value={form.contactEmail}
                  cssClass={fieldState(form.contactEmail)}
                  input={(e: { value?: string }) => setForm(current => ({ ...current, contactEmail: e.value ?? '' }))}
                />
              </div>
              {infoAttempted && !infoComplete(form) && (
                <p className="tenant-dialog__error" role="alert">
                  Enter company name, domain, contact name, and contact email before continuing.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="tenant-dialog__fields">
              <DropDownListComponent
                id="tenant-plan"
                dataSource={plans.map(plan => ({ text: plan.name, value: plan.id }))}
                fields={{ text: 'text', value: 'value' }}
                value={form.planId}
                placeholder="Plan"
                floatLabelType="Auto"
                change={(e: { value?: string }) => { if (e.value) setForm(current => ({ ...current, planId: e.value as string })); }}
              />
              <div className="e-card tenant-plan-summary">
                <div className="e-card-header">
                  <div className="e-card-header-caption">
                    <span className="e-card-header-title">{selectedPlan?.name ?? 'Plan'} includes</span>
                  </div>
                </div>
                <div className="e-card-content">
                  <ul>
                    {includedFeatures.map(feature => <li key={feature.id}>{feature.name}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="tenant-dialog__radios">
              {DATABASE_OPTIONS.map(option => (
                <RadioButtonComponent
                  key={option.value}
                  label={option.label}
                  name="tenant-database"
                  value={option.value}
                  checked={form.databaseStrategy === option.value}
                  change={() => setForm(current => ({ ...current, databaseStrategy: option.value }))}
                />
              ))}
            </div>
          )}

          <div className="tenant-dialog__actions">
            <ButtonComponent cssClass="e-outline" onClick={closeDialog}>Cancel</ButtonComponent>
            {step > 0 && <ButtonComponent cssClass="e-outline" onClick={() => setStep(current => current - 1)}>Back</ButtonComponent>}
            {step < 2 && (
              <ButtonComponent cssClass="e-primary" onClick={goNext}>
                Next
              </ButtonComponent>
            )}
            {step === 2 && <ButtonComponent cssClass="e-primary" onClick={saveForm}>Save</ButtonComponent>}
          </div>
        </div>
      </DialogComponent>

      <DialogComponent
        target="#tenant-dialog-host"
        visible={Boolean(deleteId)}
        header="Delete tenant"
        width="440px"
        isModal
        showCloseIcon
        close={() => setDeleteId(null)}
      >
        <p className="tenant-delete-copy">
          Delete {deleteTarget?.name ?? 'this tenant'}? Departments and subsidiaries under it move up to the parent account.
        </p>
        <div className="tenant-dialog__actions">
          <ButtonComponent cssClass="e-outline" onClick={() => setDeleteId(null)}>Cancel</ButtonComponent>
          <ButtonComponent cssClass="e-danger" onClick={confirmDelete}>Delete</ButtonComponent>
        </div>
      </DialogComponent>

      <ToastComponent ref={toastRef} position={{ X: 'Right', Y: 'Bottom' }} />
      <AIDrawer service={mockAIService} context="tenants" />
    </div>
  );
}
