import { useEffect, useMemo, useState } from 'react';
import { KanbanComponent } from '@syncfusion/ej2-react-kanban';
import {
  ScheduleComponent,
  Day,
  Week,
  Month,
  Agenda,
  Resize,
  Inject as ScheduleInject,
} from '@syncfusion/ej2-react-schedule';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import type { Ticket, Tenant } from '../../data/types';
import { initStore, getTickets, getTenants } from '../../data/store';
import { placeOnTimeline, scenarioNow } from '../../data/clock';
import { LoadingState } from '../../components/LoadingState';
import { AIDrawer } from '../../components/AIDrawer';
import { mockAIService } from '../../ai/AIService';
import './support.css';

const PRIORITY_OPTIONS = ['All', 'Low', 'Medium', 'High', 'Critical'];
const TENANT_FILTER_OPTIONS_LABEL = 'tenant';

const SLA_DAYS: Record<Ticket['priority'], number> = {
  Critical: 3,
  High: 7,
  Medium: 14,
  Low: 30,
};

interface BoardTicket extends Ticket {
  tenantName: string;
  age: number;
  slaLane: 'Low' | 'Medium' | 'Critical' | 'SLA Breach';
}

interface ScheduleEvent {
  Id: number;
  Subject: string;
  Tenant: string;
  EventType: 'Maintenance' | 'Incident' | 'Billing' | 'Upgrade';
  Assignee: string;
  Location: string;
  StartTime: Date;
  EndTime: Date;
  BackgroundColor: string;
  AllDay?: boolean;
}

const EVENT_COLORS: Record<ScheduleEvent['EventType'], string> = {
  Maintenance: '#175cd3',
  Incident: '#b42318',
  Billing: '#0d9488',
  Upgrade: '#a21caf',
};

function buildBoardTickets(tickets: Ticket[], tenants: Tenant[]): BoardTicket[] {
  const name = new Map(tenants.map(t => [t.id, t.name]));
  return tickets
    .map(t => {
      const created = new Date(t.createdAt);
      const age = Math.max(0, Math.floor((scenarioNow().getTime() - created.getTime()) / 86400000));
      const slaDays = SLA_DAYS[t.priority];
      const slaLane: BoardTicket['slaLane'] =
        age > slaDays ? 'SLA Breach'
        : t.priority === 'High' ? 'Critical'
        : t.priority;
      const laneOrder = slaLane === 'Low' ? 0 : slaLane === 'Medium' ? 1 : slaLane === 'Critical' ? 2 : 3;
      return {
        ...t,
        tenantName: name.get(t.tenantId) ?? t.tenantId,
        age,
        slaLane,
        laneOrder,
      };
    });
}

// Kanban card template.
function ticketCard(props: { data?: BoardTicket }) {
  const t = props as BoardTicket;
  if (!t) return null;
  const laneColor =
    t.slaLane === 'SLA Breach' ? 'var(--color-sf-fg-danger-primary)'
    : t.slaLane === 'Critical' ? 'var(--color-sf-fg-danger-primary)'
    : t.slaLane === 'Medium' ? 'var(--color-sf-fg-info-primary)'
    : 'var(--color-sf-fg-secondary)';
  return (
    <div className="kanban-card" style={{ borderLeftColor: laneColor }}>
      <div className="kanban-card__id">{t.id}</div>
      <div className="kanban-card__subject">{t.subject}</div>
      <div className="kanban-card__meta">
        <span className="kanban-card__badge" style={{ color: laneColor }}>{t.slaLane}</span>
        <span>{t.category}</span>
      </div>
      <div className="kanban-card__foot">
        <span>{t.tenantName}</span>
        <span>{t.assignee}</span>
        <span>{t.age}d</span>
      </div>
    </div>
  );
}

function buildScheduleEvents(tenants: Tenant[]): ScheduleEvent[] {
  const t = (id: string) => tenants.find(x => x.id === id)?.name ?? id;
  const events: ScheduleEvent[] = [
    {
      Id: 1, Subject: 'Critical incident: API gateway 503s', Tenant: t('T-001'), EventType: 'Incident',
      Assignee: 'Sarah Kim', Location: 'us-east-1',
      StartTime: placeOnTimeline('2025-09-22T02:30:00Z'), EndTime: placeOnTimeline('2025-09-22T05:30:00Z'),
      BackgroundColor: EVENT_COLORS.Incident,
    },
    {
      Id: 2, Subject: 'Preventative maintenance: DB failover drill', Tenant: 'All tenants', EventType: 'Maintenance',
      Assignee: 'Alex Chen', Location: 'us-east-1',
      StartTime: placeOnTimeline('2025-09-23T22:00:00Z'), EndTime: placeOnTimeline('2025-09-24T01:00:00Z'),
      BackgroundColor: EVENT_COLORS.Maintenance,
    },
    {
      Id: 3, Subject: 'Planned upgrade: Node 20 runtime', Tenant: t('T-006'), EventType: 'Upgrade',
      Assignee: 'Jordan Patel', Location: 'eu-west-1',
      StartTime: placeOnTimeline('2025-09-25T03:00:00Z'), EndTime: placeOnTimeline('2025-09-25T06:00:00Z'),
      BackgroundColor: EVENT_COLORS.Upgrade,
    },
    {
      Id: 4, Subject: 'Billing renewal: Enterprise annual', Tenant: t('T-012'), EventType: 'Billing',
      Assignee: 'Maria Santos', Location: '—', AllDay: true,
      StartTime: placeOnTimeline('2025-09-26T00:00:00Z'), EndTime: placeOnTimeline('2025-09-26T00:00:00Z'),
      BackgroundColor: EVENT_COLORS.Billing,
    },
    {
      Id: 5, Subject: 'Critical incident: data sync lag', Tenant: t('T-019'), EventType: 'Incident',
      Assignee: 'Derek Thompson', Location: 'ap-south-1',
      StartTime: placeOnTimeline('2025-09-27T11:00:00Z'), EndTime: placeOnTimeline('2025-09-27T13:00:00Z'),
      BackgroundColor: EVENT_COLORS.Incident,
    },
    {
      Id: 6, Subject: 'Preventative maintenance: cache flush', Tenant: 'All tenants', EventType: 'Maintenance',
      Assignee: 'Alex Chen', Location: 'us-west-2',
      StartTime: placeOnTimeline('2025-09-28T23:00:00Z'), EndTime: placeOnTimeline('2025-09-29T00:30:00Z'),
      BackgroundColor: EVENT_COLORS.Maintenance,
    },
    {
      Id: 7, Subject: 'Planned upgrade: TLS 1.3 rollout', Tenant: 'All tenants', EventType: 'Upgrade',
      Assignee: 'Jordan Patel', Location: 'global',
      StartTime: placeOnTimeline('2025-09-30T02:00:00Z'), EndTime: placeOnTimeline('2025-09-30T05:00:00Z'),
      BackgroundColor: EVENT_COLORS.Upgrade,
    },
    {
      Id: 8, Subject: 'Billing renewal: Professional monthly', Tenant: t('T-009'), EventType: 'Billing',
      Assignee: 'Maria Santos', Location: '—', AllDay: true,
      StartTime: placeOnTimeline('2025-10-01T00:00:00Z'), EndTime: placeOnTimeline('2025-10-01T00:00:00Z'),
      BackgroundColor: EVENT_COLORS.Billing,
    },
  ];
  return events;
}

const ENGINEERS = ['Sarah Kim', 'Alex Chen', 'Jordan Patel', 'Maria Santos', 'Derek Thompson'];

// Month bars show the subject. Details stay in the tooltip.
function scheduleEventTemplate(props: Partial<ScheduleEvent>) {
  return (
    <div className="schedule-event">
      <div className="schedule-event__title">{props.Subject || 'Event'}</div>
    </div>
  );
}

function onEventRendered(args: { data?: ScheduleEvent; element?: HTMLElement }) {
  const color = args.data?.BackgroundColor;
  if (!color || !args.element) return;
  args.element.style.backgroundColor = color;
  args.element.style.borderColor = color;
  args.element.style.color = '#fff';
}

function scheduleTooltip(props: Partial<ScheduleEvent>) {
  if (!props.Subject) return null;
  return (
    <div className="schedule-tooltip">
      <div className="schedule-tooltip__title">{props.Subject}</div>
      <div>Tenant: {props.Tenant || '—'}</div>
      <div>Assignee: {props.Assignee || '—'}</div>
      <div>Location: {props.Location || '—'}</div>
    </div>
  );
}

export default function Support() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<BoardTicket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [tenantFilter, setTenantFilter] = useState('All');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [nextEventId, setNextEventId] = useState(100);
  const scheduleDate = useMemo(() => scenarioNow(), []);

  useEffect(() => {
    initStore();
    const all = getTenants();
    setTenants(all);
    setTickets(buildBoardTickets(getTickets(), all));
    setEvents(buildScheduleEvents(all));
    setLoading(false);
  }, []);

  const tenantOptions = useMemo(
    () => ['All', ...tenants.map(t => t.name)],
    [tenants],
  );

  const editorTemplate = useMemo(
    () => () => (
      <div style={{ display: 'grid', gap: '10px' }}>
        <div>
          <label htmlFor="sched-title" style={{ display: 'block', fontSize: '13px', marginBottom: 4 }}>Title</label>
          <input id="sched-title" className="e-input e-field" name="Subject" data-name="Subject" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label htmlFor="sched-tenant" style={{ display: 'block', fontSize: '13px', marginBottom: 4 }}>Tenant</label>
            <input id="sched-tenant" className="e-input e-field" name="Tenant" data-name="Tenant" placeholder="All tenants" />
          </div>
          <div>
            <label htmlFor="sched-type" style={{ display: 'block', fontSize: '13px', marginBottom: 4 }}>Event type</label>
            <select id="sched-type" className="e-input e-field" name="EventType" data-name="EventType">
              {Object.keys(EVENT_COLORS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label htmlFor="sched-assignee" style={{ display: 'block', fontSize: '13px', marginBottom: 4 }}>On-call engineer</label>
            <select id="sched-assignee" className="e-input e-field" name="Assignee" data-name="Assignee">
              {ENGINEERS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sched-location" style={{ display: 'block', fontSize: '13px', marginBottom: 4 }}>Region / Location</label>
            <input id="sched-location" className="e-input e-field" name="Location" data-name="Location" placeholder="us-east-1" />
          </div>
        </div>
      </div>
    ),
    [],
  );

  const boardData = useMemo(
    () => tickets.filter(t => {
      if (priorityFilter !== 'All' && t.slaLane !== priorityFilter) return false;
      if (tenantFilter !== 'All' && t.tenantName !== tenantFilter) return false;
      return true;
    }),
    [tickets, priorityFilter, tenantFilter],
  );

  // Create, change, and resize events on the session list.
  function onActionBegin(args: {
    requestType?: string;
    event?: {
      Id?: number; Subject?: string; EventType?: string; Tenant?: string;
      Assignee?: string; Location?: string; StartTime?: Date; EndTime?: Date; AllDay?: boolean;
    };
  }) {
    if (args.requestType === 'eventCreate') {
      const e = args.event;
      if (!e) return;
      setEvents(prev => [...prev, {
        Id: nextEventId,
        Subject: e.Subject || 'Untitled event',
        EventType: (e.EventType as ScheduleEvent['EventType']) || 'Maintenance',
        Tenant: e.Tenant || '—',
        Assignee: e.Assignee || ENGINEERS[0],
        Location: e.Location || '—',
        StartTime: e.StartTime ? new Date(e.StartTime) : new Date(),
        EndTime: e.EndTime ? new Date(e.EndTime) : new Date(),
        AllDay: e.AllDay,
        BackgroundColor: EVENT_COLORS[(e.EventType as ScheduleEvent['EventType']) || 'Maintenance'],
      }]);
      setNextEventId(n => n + 1);
      // Persist the event on the session list.
      args.event = undefined;
      return;
    }
    if (args.requestType === 'eventChange' || args.requestType === 'eventResize') {
      const e = args.event;
      if (!e) return;
      const id = e.Id;
      setEvents(prev => prev.map(ev => (ev.Id === id ? {
        ...ev,
        Subject: e.Subject ?? ev.Subject,
        StartTime: e.StartTime ? new Date(e.StartTime) : ev.StartTime,
        EndTime: e.EndTime ? new Date(e.EndTime) : ev.EndTime,
        AllDay: e.AllDay ?? ev.AllDay,
      } : ev)));
      args.event = undefined;
      return;
    }
    if (args.requestType === 'eventRemove') {
      const ids: number[] = typeof args.event?.Id === 'number' ? [args.event.Id] : [];
      if (ids.length) setEvents(prev => prev.filter(ev => !ids.includes(ev.Id)));
    }
  }

  if (loading) return <LoadingState label="Loading Support Board…" />;

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="app-page-title" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Support</h2>
          <p className="app-page-subtitle" style={{ margin: '4px 0 0', color: 'var(--color-sf-fg-secondary)', fontSize: '13px' }}>
            Open platform-engineering issues and on-call scheduling
          </p>
        </div>
      </div>

      <div className="e-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'nowrap', alignItems: 'center', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto' }}>
          <label htmlFor="support-priority-filter" style={{ fontSize: '13px', color: 'var(--color-sf-fg-secondary)', whiteSpace: 'nowrap' }}>Priority:</label>
          <DropDownListComponent
            id="support-priority-filter"
            dataSource={PRIORITY_OPTIONS}
            value={priorityFilter}
            change={(e: { value: string }) => setPriorityFilter(e.value)}
            width="200px"
            htmlAttributes={{ 'aria-label': 'Filter by priority' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto' }}>
          <label htmlFor="support-tenant-filter" style={{ fontSize: '13px', color: 'var(--color-sf-fg-secondary)', whiteSpace: 'nowrap' }}>Tenant:</label>
          <DropDownListComponent
            id="support-tenant-filter"
            dataSource={tenantOptions}
            value={tenantFilter}
            change={(e: { value: string }) => setTenantFilter(e.value)}
            width="200px"
            htmlAttributes={{ 'aria-label': 'Filter by tenant' }}
          />
        </div>
        <button type="button" className="e-btn e-outline"
          disabled={priorityFilter === 'All' && tenantFilter === 'All'}
          onClick={() => { setPriorityFilter('All'); setTenantFilter('All'); }}>
          Reset
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--color-sf-fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {boardData.length} open issue{boardData.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Kanban: open issues across swimlanes by escalation priority */}
      <div className="e-card" style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>Open Issues Board</h3>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-sf-fg-secondary)' }}>
          Open tickets by workflow stage; swimlanes group by escalation priority (SLA Breach = age past the priority SLA)
        </p>
        <KanbanComponent
          cssClass="support-board"
          dataSource={boardData}
          keyField="status"
          columns={[
            { keyField: 'Open', headerText: 'Open', transitionColumns: ['Open', 'In Progress'] },
            { keyField: 'In Progress', headerText: 'In Progress', transitionColumns: ['Open', 'In Progress', 'Resolved'] },
            { keyField: 'Resolved', headerText: 'Resolved', transitionColumns: ['In Progress', 'Resolved', 'Closed'] },
            { keyField: 'Closed', headerText: 'Closed', transitionColumns: ['Closed'] },
          ]}
          swimlaneSettings={{
            keyField: 'slaLane',
            textField: 'slaLane',
            sortDirection: 'Ascending',
            showItemCount: true,
            showEmptyRow: true,
          }}
          cardSettings={{
            contentField: 'subject',
            headerField: 'id',
            template: ticketCard,
          }}
          cardHeight="auto"
          actionComplete={(e: { requestType?: string; args?: { record?: BoardTicket; toData?: BoardTicket } }) => {
            if (e.requestType === 'cardChanged') {
              const rec = e.args?.record;
              if (rec) {
                const from = rec.status;
                const to = e.args?.toData?.status;
                if (from !== to && to) setTickets(prev => prev.map(t => (t.id === rec.id ? { ...t, status: to } : t)));
              }
            }
          }}
          height="560px"
        >
        </KanbanComponent>
      </div>

      {/* Scheduler: on-call engineers, incidents, maintenance, renewals, upgrades */}
      <div className="e-card" style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>Platform Operations Calendar</h3>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--color-sf-fg-secondary)' }}>
          On-call incident response, maintenance windows, billing renewals and planned upgrades
        </p>
        <ScheduleComponent
          id="support-scheduler"
          cssClass="support-schedule"
          currentView="Month"
          selectedDate={scheduleDate}
          width="100%"
          height="520px"
          workDays={[1, 2, 3, 4, 5, 6]}
          startHour="00:00"
          endHour="23:59"
          eventSettings={{
            dataSource: events,
            enableTooltip: true,
            tooltipTemplate: scheduleTooltip as unknown as string,
            fields: {
              id: 'Id',
              subject: { name: 'Subject' },
              location: { name: 'Location' },
              description: { name: 'Tenant' },
              isAllDay: { name: 'AllDay' },
              startTime: { name: 'StartTime' },
              endTime: { name: 'EndTime' },
            },
            template: scheduleEventTemplate,
          }}
          editorTemplate={editorTemplate}
          eventRendered={onEventRendered}
          actionBegin={onActionBegin}
        >
          <ScheduleInject services={[Day, Week, Month, Agenda, Resize]} />
        </ScheduleComponent>
      </div>

      <AIDrawer service={mockAIService} context="support" />
    </div>
  );
}