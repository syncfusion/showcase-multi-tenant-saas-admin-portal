import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GanttComponent,
  TaskFieldsModel,
  EventMarkersDirective,
  EventMarkerDirective,
  ColumnsDirective as GanttColumnsDirective,
  ColumnDirective as GanttColumnDirective,
  EditDialogFieldsDirective,
  EditDialogFieldDirective,
  Toolbar as GanttToolbar,
  DayMarkers,
  Selection as GanttSelection,
  Edit as GanttEdit,
  Inject as GanttInject,
} from '@syncfusion/ej2-react-gantt';
import {
  GridComponent,
  ColumnsDirective,
  ColumnDirective,
  Page,
  Sort,
  Filter,
  Toolbar as GridToolbar,
  Selection,
  Inject as GridInject,
} from '@syncfusion/ej2-react-grids';
import { TabComponent, TabItemsDirective, TabItemDirective } from '@syncfusion/ej2-react-navigations';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import { NumericTextBoxComponent } from '@syncfusion/ej2-react-inputs';
import { DatePickerComponent } from '@syncfusion/ej2-react-calendars';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { DialogComponent } from '@syncfusion/ej2-react-popups';
import { ToastComponent } from '@syncfusion/ej2-react-notifications';
import { enableRipple } from '@syncfusion/ej2-base';
import type { Invoice, OnboardingTask, Tenant } from '../../data/types';
import {
  initStore,
  getTenants,
  getPlans,
  getInvoices,
  getOnboarding,
  addInvoice,
  nextInvoiceId,
  updateOnboarding,
  updateTenant,
} from '../../data/store';
import { scenarioNow } from '../../data/clock';
import { money, monthLabel, dateLabel, DATE_FORMAT } from '../../shared/format';
import { palette } from '../../shared/palette';
import { AIDrawer } from '../../components/AIDrawer';
import { mockAIService } from '../../ai/AIService';
import { LoadingState } from '../../components/LoadingState';
import { useTheme } from '../../theme/ThemeProvider';
import './subscriptions.css';

enableRipple(true);

const PAGE_OPTIONS = { pageSize: 10, pageSizes: [5, 10, 25, 50] };
const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed'];
const PAYMENT_METHODS = ['ACH Transfer', 'Credit Card', 'Wire Transfer'];
const INVOICE_STATUSES = [
  { text: 'Payment completed', value: 'Paid' },
  { text: 'Pending', value: 'Pending' },
  { text: 'Overdue', value: 'Overdue' },
];
const STATUS_EDIT = { params: { dataSource: TASK_STATUSES } };
const PROGRESS_EDIT = { params: { min: 0, max: 100, decimals: 0, format: 'n0' } };

interface GanttTask {
  TaskID: string;
  TaskName: string;
  StartDate: Date;
  EndDate: Date;
  Duration: number;
  Progress: number;
  status: string;
  tenantName: string;
  phase: string;
  isMilestone: boolean;
  isSummary?: boolean;
  Predecessor?: string;
  dependsOn?: string;
  subtasks?: GanttTask[];
}

interface GanttAction {
  requestType?: string;
  cancel?: boolean;
  rowData?: { TaskID?: string; taskData?: GanttTask };
  data?: { TaskID?: string; taskData?: GanttTask };
  modifiedTaskData?: GanttTask[];
}

function isoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
  return undefined;
}

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function invoiceStatusTemplate(props: { status?: string }) {
  const status = props.status ?? '';
  const label = status === 'Paid' ? 'Payment completed' : status || '—';
  const tone = status === 'Paid' ? 'success' : status === 'Pending' ? 'warning' : status === 'Overdue' ? 'danger' : 'neutral';
  return <span className={`invoice-badge invoice-badge--${tone}`}>{label}</span>;
}

function paymentMethodTemplate(props: { paymentMethod?: string }) {
  const method = props.paymentMethod ?? '';
  const tone = method === 'Credit Card' ? 'card' : method === 'Wire Transfer' ? 'wire' : method === 'ACH Transfer' ? 'ach' : 'neutral';
  return <span className={`pay-badge pay-badge--${tone}`}>{method || '—'}</span>;
}

function rightLabelTemplate(props: Partial<GanttTask>) {
  if (!props.TaskName) return <span />;
  const program = String(props.TaskID ?? '').startsWith('tenant-');
  if (program || props.isMilestone) {
    return <span className="gantt-right-label">{props.status || (props.isMilestone ? 'Milestone' : 'Program')}</span>;
  }
  return <span className="gantt-right-label">{props.status} · {props.Progress ?? 0}%</span>;
}

function ganttTooltip(props: Partial<GanttTask>) {
  if (!props.TaskName) return null;
  return (
    <div className="gantt-tooltip">
      <div className="gantt-tooltip__title">{props.TaskName}</div>
      {props.tenantName ? <div>Tenant: {props.tenantName}</div> : null}
      {props.phase ? <div>Phase: {props.phase}</div> : null}
      {props.status ? <div>Status: {props.status}</div> : null}
      {props.dependsOn ? <div>Depends on: {props.dependsOn}</div> : null}
      {props.Progress !== undefined ? <div>Progress: {props.Progress}%</div> : null}
      {props.StartDate && props.EndDate ? (
        <div>{dateLabel(props.StartDate)} – {dateLabel(props.EndDate)}</div>
      ) : null}
      {props.isMilestone ? <div>Milestone</div> : null}
    </div>
  );
}

function taskIdOf(args: GanttAction): string {
  return String(args.rowData?.taskData?.TaskID ?? args.rowData?.TaskID ?? args.data?.taskData?.TaskID ?? args.data?.TaskID ?? '');
}

function taskDataOf(args: GanttAction): GanttTask | undefined {
  return args.data?.taskData ?? args.rowData?.taskData;
}

export default function Subscriptions() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingTask[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [draftTenant, setDraftTenant] = useState('');
  const [draftPlan, setDraftPlan] = useState('');
  const [draftMrr, setDraftMrr] = useState<number | null>(0);
  const [draftMonth, setDraftMonth] = useState<Date | null>(null);
  const [draftStatus, setDraftStatus] = useState<'Paid' | 'Pending' | 'Overdue'>('Pending');
  const [draftMethod, setDraftMethod] = useState(PAYMENT_METHODS[0]);
  const { theme } = useTheme();
  const ganttRef = useRef<GanttComponent | null>(null);
  const toastRef = useRef<ToastComponent | null>(null);
  const fittedKey = useRef('');
  const ganttToday = useMemo(() => scenarioNow(), []);

  useEffect(() => {
    initStore();
    setTenants(getTenants());
    setInvoices(getInvoices());
    setOnboarding(getOnboarding());
    setLoading(false);
  }, []);

  const plans = useMemo(() => getPlans(), [tenants]);

  const totalMRR = tenants.reduce((sum, tenant) => sum + tenant.mrr, 0);
  const pendingCount = invoices.filter(invoice => invoice.status === 'Pending' || invoice.status === 'Overdue').length;

  const invoiceMonths = useMemo(() => [...new Set(invoices.map(invoice => invoice.month))].sort(), [invoices]);
  const minMonth = invoiceMonths[0] ? new Date(`${invoiceMonths[0]}-01T00:00:00`) : undefined;
  const maxMonth = invoiceMonths.length ? new Date(`${invoiceMonths[invoiceMonths.length - 1]}-01T00:00:00`) : undefined;

  const invoiceRows = useMemo(() => {
    const names = new Map(tenants.map(tenant => [tenant.id, tenant.name]));
    return [...invoices]
      .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : a.id < b.id ? -1 : 1))
      .map(invoice => ({
        ...invoice,
        monthLabel: monthLabel(invoice.month),
        tenantName: names.get(invoice.tenantId) ?? invoice.tenantId,
      }));
  }, [invoices, tenants]);

  const ganttData = useMemo((): GanttTask[] => {
    const names = new Map(tenants.map(tenant => [tenant.id, tenant.name]));
    const milestoneById = new Map(onboarding.map(task => [task.id, task.milestone]));
    const byId = new Map(onboarding.map(task => [task.id, task]));
    const roots: GanttTask[] = [];
    const dependsOnLabel = (predecessor: string | null): string => {
      if (!predecessor) return '';
      return predecessor.split(',').map(part => {
        const type = part.slice(-2);
        const known = type === 'FS' || type === 'SS' || type === 'FF' || type === 'SF';
        const id = known ? part.slice(0, -2) : part;
        return `${milestoneById.get(id) ?? id} ${known ? type : 'FS'}`;
      }).join(', ');
    };
    const toTask = (task: OnboardingTask): GanttTask => {
      const start = new Date(`${task.startDate}T00:00:00Z`);
      const milestone = /go-live/i.test(task.milestone) || task.startDate === task.endDate;
      const end = milestone ? start : new Date(`${task.endDate}T00:00:00Z`);
      const duration = milestone ? 0 : Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
      const dependsOn = dependsOnLabel(task.predecessor);
      return {
        TaskID: task.id,
        TaskName: task.parentId ? `${task.milestone}: ${task.title}` : task.phase,
        StartDate: start,
        EndDate: end,
        Duration: duration,
        Progress: task.progress,
        status: task.status,
        tenantName: names.get(task.tenantId) ?? task.tenantId,
        phase: task.phase,
        isMilestone: milestone,
        isSummary: task.parentId == null,
        Predecessor: task.predecessor ?? '',
        dependsOn,
      };
    };

    for (const tenantId of [...new Set(onboarding.map(task => task.tenantId))]) {
      const tasks = onboarding.filter(task => task.tenantId === tenantId).map(toTask);
      const parent: GanttTask = {
        TaskID: `tenant-${tenantId}`,
        TaskName: names.get(tenantId) ?? tenantId,
        StartDate: new Date(Math.min(...tasks.map(task => task.StartDate.getTime()))),
        EndDate: new Date(Math.max(...tasks.map(task => task.EndDate.getTime()))),
        Duration: 0,
        Progress: Math.round(tasks.reduce((sum, task) => sum + task.Progress, 0) / Math.max(tasks.length, 1)),
        status: '',
        tenantName: names.get(tenantId) ?? tenantId,
        phase: 'Onboarding Program',
        isMilestone: false,
        isSummary: true,
        subtasks: [],
      };
      for (const task of tasks) {
        const source = byId.get(task.TaskID);
        const parentTask = source?.parentId ? tasks.find(item => item.TaskID === source.parentId) : undefined;
        const bucket = parentTask ? (parentTask.subtasks = parentTask.subtasks ?? []) : parent.subtasks!;
        bucket.push(task);
      }
      if (parent.subtasks?.length) roots.push(parent);
    }
    return roots;
  }, [onboarding, tenants]);

  const taskFields: TaskFieldsModel = {
    id: 'TaskID',
    name: 'TaskName',
    startDate: 'StartDate',
    endDate: 'EndDate',
    duration: 'Duration',
    progress: 'Progress',
    milestone: 'isMilestone',
    dependency: 'Predecessor',
    child: 'subtasks',
  };

  const spanKey = ganttData.map(task => `${task.TaskID}:${task.StartDate.getTime()}:${task.EndDate.getTime()}`).join('|');

  function onQueryTaskbar(args: { data?: { taskData?: GanttTask }; taskbarBgColor?: string; progressBarBgColor?: string; milestoneColor?: string }) {
    const task = args.data?.taskData;
    if (!task) return;
    const colors = palette(theme);
    if (String(task.TaskID).startsWith('tenant-') || task.isSummary) {
      args.taskbarBgColor = colors.series[3];
      args.progressBarBgColor = colors.series[0];
      return;
    }
    if (task.isMilestone) {
      args.milestoneColor = task.status === 'Completed' ? colors.success : colors.warning;
      return;
    }
    if (task.status === 'Completed') {
      args.taskbarBgColor = colors.success;
      args.progressBarBgColor = colors.success;
    } else if (task.status === 'In Progress') {
      args.taskbarBgColor = colors.info;
      args.progressBarBgColor = colors.series[0];
    } else {
      args.taskbarBgColor = colors.neutral;
      args.progressBarBgColor = colors.series[4];
    }
  }

  function onGanttBegin(args: GanttAction) {
    if ((args.requestType === 'beforeOpenEditDialog' || args.requestType === 'beginEdit') && taskIdOf(args).startsWith('tenant-')) {
      args.cancel = true;
      return;
    }
    if (args.requestType === 'beforeSave') {
      const task = taskDataOf(args);
      if (task && (task.isMilestone || /go-live/i.test(task.TaskName))) {
        task.isMilestone = true;
        task.Duration = 0;
        task.EndDate = task.StartDate;
      }
    }
  }

  function onGanttComplete(args: GanttAction) {
    if (args.requestType !== 'save') return;
    const tasks = args.modifiedTaskData?.length ? args.modifiedTaskData : taskDataOf(args) ? [taskDataOf(args)!] : [];
    let changed = false;
    for (const task of tasks) {
      if (!task?.TaskID || task.TaskID.startsWith('tenant-') || task.isSummary) continue;
      if (getOnboarding().some(row => row.id === task.TaskID && row.parentId == null)) continue;
      const milestone = Boolean(task.isMilestone) || /go-live/i.test(task.TaskName);
      const start = isoDate(task.StartDate);
      const end = milestone ? start : isoDate(task.EndDate);
      const rawName = task.TaskName ?? '';
      const title = rawName.includes(': ') ? rawName.split(': ').slice(1).join(': ') : rawName;
      const status = TASK_STATUSES.includes(task.status) ? task.status as OnboardingTask['status'] : undefined;
      const progress = Number(task.Progress);
      updateOnboarding(task.TaskID, {
        ...(title ? { title } : {}),
        ...(status ? { status } : {}),
        ...(Number.isFinite(progress) ? { progress: Math.max(0, Math.min(100, progress)) } : {}),
        ...(start ? { startDate: start } : {}),
        ...(end ? { endDate: end } : {}),
        ...(typeof task.Predecessor === 'string' ? { predecessor: task.Predecessor || null } : {}),
      });
      changed = true;
    }
    if (changed) {
      fittedKey.current = '';
      setOnboarding([...getOnboarding()]);
      toastRef.current?.show({ title: 'Task updated', content: 'Onboarding schedule saved', cssClass: 'e-toast-success', timeOut: 2500 });
    }
  }

  function openInvoice() {
    const tenant = tenants[0];
    setDraftTenant(tenant?.id ?? '');
    setDraftPlan(tenant?.planId ?? plans[0]?.id ?? '');
    setDraftMrr(tenant?.mrr ?? 0);
    setDraftMonth(maxMonth ?? new Date());
    setDraftStatus('Pending');
    setDraftMethod(PAYMENT_METHODS[0]);
    setInvoiceOpen(true);
  }

  function saveInvoice() {
    if (!draftTenant || !draftPlan || !draftMonth || draftMrr === null) return;
    const month = monthKey(draftMonth);
    const amount = Math.max(0, Math.round(draftMrr));
    addInvoice({
      id: nextInvoiceId(),
      tenantId: draftTenant,
      month,
      amount,
      status: draftStatus,
      paymentMethod: draftMethod,
      paidDate: draftStatus === 'Paid' ? `${month}-15` : null,
    });
    updateTenant(draftTenant, { planId: draftPlan, mrr: amount });
    setInvoices([...getInvoices()]);
    setTenants([...getTenants()]);
    setInvoiceOpen(false);
    const tenantName = tenants.find(tenant => tenant.id === draftTenant)?.name ?? draftTenant;
    toastRef.current?.show({ title: 'Invoice added', content: `${tenantName} · ${monthLabel(month)}`, cssClass: 'e-toast-success', timeOut: 3000 });
  }

  const tenantOptions = tenants.map(tenant => ({ text: tenant.name, value: tenant.id }));
  const planOptions = plans.map(plan => ({ text: plan.name, value: plan.id }));

  function chartPaneReady(element: HTMLElement): boolean {
    const pane = element.querySelector('.e-gantt-chart-pane');
    if (!pane || pane.getBoundingClientRect().width < 40) return false;
    const bars = element.querySelectorAll('.e-gantt-chart-pane .e-gantt-child-taskbar-inner-div, .e-gantt-chart-pane .e-gantt-parent-taskbar-inner-div, .e-gantt-chart-pane .e-gantt-milestone');
    return [...bars].some(bar => {
      const box = bar.getBoundingClientRect();
      return box.width > 1 && box.height > 1;
    });
  }

  function restoreOnboardingChart() {
    const gantt = ganttRef.current;
    const element = gantt?.element;
    if (!gantt || !element || element.clientWidth === 0) return;
    if (chartPaneReady(element)) return;
    fittedKey.current = '';
    gantt.refresh();
  }

  useEffect(() => {
    if (loading || tabIndex !== 0) return;
    const first = window.setTimeout(restoreOnboardingChart, 80);
    const second = window.setTimeout(restoreOnboardingChart, 320);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [tabIndex, loading, invoiceOpen]);

  const onboardingTab = () => (
    <div className="e-card subscriptions-gantt-card">
      <div className="e-card-header">
        <div className="e-card-header-caption">
          <span className="e-card-header-title">Onboarding & Renewals</span>
          <span className="e-card-sub-title">Each phase has three to five tasks, linked to the work they follow. Parent programs stay read-only.</span>
        </div>
      </div>
      <div className="e-card-content">
        <GanttComponent
          id="subscriptions-gantt"
          ref={ganttRef}
          dataSource={ganttData}
          taskFields={taskFields}
          treeColumnIndex={1}
          allowParentDependency={true}
          height="560px"
          width="100%"
          dateFormat={DATE_FORMAT}
          allowSorting
          allowSelection
          highlightWeekends
          includeWeekend
          workWeek={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']}
          dayWorkingTime={[{ from: 0, to: 24 }] as never}
          timelineSettings={{
            timelineViewMode: 'Month',
            topTier: { unit: 'Month', format: 'MMM yyyy' },
            bottomTier: { unit: 'Week', format: 'dd MMM' },
          }}
          labelSettings={{ leftLabel: 'TaskName', rightLabel: rightLabelTemplate as unknown as string }}
          tooltipSettings={{ showTooltip: true, taskbar: ganttTooltip as unknown as string }}
          editSettings={{ allowEditing: true, allowAdding: false, allowDeleting: false, allowTaskbarEditing: false, mode: 'Dialog' }}
          toolbar={['Edit', 'ExpandAll', 'CollapseAll', 'ZoomIn', 'ZoomOut', 'ZoomToFit']}
          splitterSettings={{ position: '38%' }}
          gridLines="Both"
          queryTaskbarInfo={onQueryTaskbar}
          actionBegin={onGanttBegin}
          actionComplete={onGanttComplete}
          dataBound={() => {
            const host = ganttRef.current?.element;
            if (!host || host.clientWidth === 0) {
              fittedKey.current = '';
              return;
            }
            if (fittedKey.current === spanKey) return;
            fittedKey.current = spanKey;
            ganttRef.current?.fitToProject();
          }}
          className={`gantt-theme--${theme}`}
        >
          <GanttInject services={[GanttToolbar, DayMarkers, GanttSelection, GanttEdit]} />
          <EditDialogFieldsDirective>
            <EditDialogFieldDirective type="General" headerText="General" />
          </EditDialogFieldsDirective>
          <EventMarkersDirective>
            <EventMarkerDirective day={ganttToday} label="Today" cssClass="gantt-today-marker" />
          </EventMarkersDirective>
          <GanttColumnsDirective>
            <GanttColumnDirective field="TaskID" isPrimaryKey visible={false} width="80" />
            <GanttColumnDirective field="TaskName" headerText="Task" width="240" editType="stringedit" />
            <GanttColumnDirective field="dependsOn" headerText="Depends on" width="180" allowEditing={false} />
            <GanttColumnDirective field="phase" headerText="Phase" width="140" allowEditing={false} />
            <GanttColumnDirective field="status" headerText="Status" width="130" editType="dropdownedit" edit={STATUS_EDIT} />
            <GanttColumnDirective field="StartDate" headerText="Start" width="120" format={DATE_FORMAT} editType="datepickeredit" />
            <GanttColumnDirective field="EndDate" headerText="End" width="120" format={DATE_FORMAT} editType="datepickeredit" />
            <GanttColumnDirective field="Progress" headerText="Progress" width="110" editType="numericedit" edit={PROGRESS_EDIT} />
            <GanttColumnDirective field="isMilestone" headerText="Milestone" width="110" displayAsCheckBox editType="booleanedit" />
          </GanttColumnsDirective>
        </GanttComponent>
      </div>
    </div>
  );

  const invoicesTab = () => (
    <div className="e-card subscriptions-grid-card">
      <div className="e-card-header subscriptions-card-header">
        <div className="e-card-header-caption">
          <span className="e-card-header-title">Invoices & Payments</span>
          <span className="e-card-sub-title">Billing runs, payment status, and method</span>
        </div>
        <ButtonComponent cssClass="e-primary" onClick={openInvoice}>Add Invoice</ButtonComponent>
      </div>
      <div className="e-card-content">
        <GridComponent
          id="subscriptions-invoices-grid"
          dataSource={invoiceRows}
          allowPaging
          allowSorting
          allowFiltering
          pageSettings={PAGE_OPTIONS}
          toolbar={['Search']}
          height="auto"
          gridLines="Both"
          created={() => {
            const input = document.getElementById('subscriptions-invoices-grid')?.querySelector<HTMLInputElement>('.e-searchbox input');
            input?.setAttribute('aria-label', 'Search invoices');
          }}
        >
          <GridInject services={[Page, Sort, Filter, GridToolbar, Selection]} />
          <ColumnsDirective>
            <ColumnDirective field="id" headerText="Invoice" width="110" />
            <ColumnDirective field="tenantName" headerText="Tenant" width="180" />
            <ColumnDirective field="monthLabel" headerText="Billing Month" width="130" />
            <ColumnDirective field="amount" headerText="Amount" width="120" textAlign="Right" format="C0" />
            <ColumnDirective field="status" headerText="Status" width="170" template={invoiceStatusTemplate} />
            <ColumnDirective field="paymentMethod" headerText="Payment Method" width="160" template={paymentMethodTemplate} />
            <ColumnDirective field="paidDate" headerText="Paid Date" width="120" type="date" format={DATE_FORMAT} />
          </ColumnsDirective>
        </GridComponent>
      </div>
    </div>
  );

  if (loading) return <LoadingState label="Loading Subscriptions…" />;

  return (
    <div className="subscriptions-page" data-theme={theme}>
      <div className="subscriptions-header">
        <div>
          <h2 className="app-page-title" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Subscriptions</h2>
          <p className="app-page-subtitle" style={{ margin: '4px 0 0', color: 'var(--color-sf-fg-secondary)', fontSize: '13px' }}>
            Total MRR: {money(totalMRR)} · {pendingCount} invoice{pendingCount !== 1 ? 's' : ''} pending or overdue
          </p>
        </div>
      </div>

      <TabComponent
        heightAdjustMode="None"
        cssClass="subscriptions-tabs"
        selectedItem={tabIndex}
        selected={(args: { selectedIndex?: number }) => setTabIndex(args.selectedIndex ?? 0)}
      >
        <TabItemsDirective>
          <TabItemDirective header={{ text: 'Onboarding & Renewals' }} />
          <TabItemDirective header={{ text: 'Invoices & Payments' }} />
        </TabItemsDirective>
      </TabComponent>
      <div className="subscriptions-panel" hidden={tabIndex !== 0}>{onboardingTab()}</div>
      <div className="subscriptions-panel" hidden={tabIndex !== 1}>{invoicesTab()}</div>

      {document.getElementById('root')
        ? createPortal(<div id="subscriptions-dialog-host" className="app-dialog-host" />, document.getElementById('root')!)
        : null}
      <DialogComponent
        target="#subscriptions-dialog-host"
        visible={invoiceOpen}
        header="Add Invoice"
        width="520px"
        isModal
        showCloseIcon
        close={() => setInvoiceOpen(false)}
      >
        <div className="invoice-form">
          <DropDownListComponent
            id="invoice-tenant"
            dataSource={tenantOptions}
            fields={{ text: 'text', value: 'value' }}
            value={draftTenant}
            placeholder="Tenant"
            floatLabelType="Auto"
            popupHeight="280px"
            change={(e: { value?: string }) => {
              if (!e.value) return;
              const tenant = tenants.find(row => row.id === e.value);
              setDraftTenant(e.value);
              if (tenant) {
                setDraftPlan(tenant.planId);
                setDraftMrr(tenant.mrr);
              }
            }}
          />
          <DropDownListComponent
            id="invoice-plan"
            dataSource={planOptions}
            fields={{ text: 'text', value: 'value' }}
            value={draftPlan}
            placeholder="Plan"
            floatLabelType="Auto"
            change={(e: { value?: string }) => { if (e.value) setDraftPlan(e.value); }}
          />
          <NumericTextBoxComponent
            id="invoice-mrr"
            value={draftMrr ?? 0}
            min={0}
            format="c0"
            placeholder="MRR"
            floatLabelType="Auto"
            change={(e: { value?: number | null }) => setDraftMrr(e.value ?? 0)}
          />
          <DatePickerComponent
            id="invoice-month"
            value={draftMonth ?? undefined}
            start="Year"
            depth="Year"
            format="MMM yyyy"
            min={minMonth}
            max={maxMonth}
            placeholder="Billing month"
            floatLabelType="Auto"
            change={(e: { value?: Date | null }) => setDraftMonth(e.value ?? null)}
          />
          <DropDownListComponent
            id="invoice-status"
            dataSource={INVOICE_STATUSES}
            fields={{ text: 'text', value: 'value' }}
            value={draftStatus}
            placeholder="Invoice status"
            floatLabelType="Auto"
            change={(e: { value?: 'Paid' | 'Pending' | 'Overdue' }) => { if (e.value) setDraftStatus(e.value); }}
          />
          <DropDownListComponent
            id="invoice-method"
            dataSource={PAYMENT_METHODS}
            value={draftMethod}
            placeholder="Payment method"
            floatLabelType="Auto"
            change={(e: { value?: string }) => { if (e.value) setDraftMethod(e.value); }}
          />
          <div className="invoice-form__actions">
            <ButtonComponent cssClass="e-outline" onClick={() => setInvoiceOpen(false)}>Cancel</ButtonComponent>
            <ButtonComponent cssClass="e-primary" disabled={!draftTenant || !draftPlan || !draftMonth} onClick={saveInvoice}>Save</ButtonComponent>
          </div>
        </div>
      </DialogComponent>

      <ToastComponent ref={toastRef} position={{ X: 'Right', Y: 'Bottom' }} />
      <AIDrawer service={mockAIService} context="subscriptions" />
    </div>
  );
}
