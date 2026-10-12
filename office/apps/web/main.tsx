import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Run, Task, Event } from '../../packages/contracts/index.ts';
import { Scene, type SceneAgent } from '../../packages/office-scene/Scene.tsx';
import './styles.css';
interface Snapshot {
  api: { ok: boolean; error?: string; models: string[] };
  github: { login: string; verified: boolean };
  config: {
    director: string;
    worker: string;
    maxWorkers: number;
    totalBudget: number;
    productWrite: boolean;
    paths: Record<string, string>;
  };
  settings: Record<string, any>;
  cost: { spent: number; reserved: number; unreconciled: number };
  runs: Run[];
  tasks: Task[];
  events: Event[];
  queries: any[];
  totals: any[];
  system: {
    node: string;
    freeMemory: number;
    totalMemory: number;
    active: number;
    cpuCount: number;
    cpuPercent: number;
    apiLimits: string;
  };
}
const money = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
const labels: Record<string, string> = {
  pending: 'Pendiente',
  ready: 'En cola',
  running: 'Trabajando',
  review: 'En revisión',
  verified: 'Verificada',
  integrated: 'Integrada',
  done: 'Terminada',
  blocked: 'Bloqueada',
  failed: 'Falló',
  cancelled: 'Cancelada',
  queued: 'En cola',
  planning: 'Dirigiendo',
  paused: 'Pausada',
};
function App() {
  const [state, setState] = useState<Snapshot>(),
    [connected, setConnected] = useState(false),
    [tab, setTab] = useState(() => {
      const view = new URLSearchParams(location.search).get('view');
      return ['Oficina', 'Tareas', 'Costes', 'Configuración'].includes(view ?? '')
        ? view!
        : 'Oficina';
    }),
    [list, setList] = useState(false),
    [runId, setRunId] = useState(''),
    [selected, setSelected] = useState(''),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState('all');
  const [objective, setObjective] = useState(''),
    [budget, setBudget] = useState('2'),
    [max, setMax] = useState('4'),
    [balance, setBalance] = useState(''),
    [expiry, setExpiry] = useState(''),
    [budgetAlert, setBudgetAlert] = useState('80'),
    [retention, setRetention] = useState('250'),
    [context, setContext] = useState('');
  const token = useRef(''),
    refreshTimer = useRef<number | undefined>(undefined);
  const refresh = async () => {
    try {
      const response = await fetch('/api/state');
      if (!response.ok) throw new Error('Runner no disponible');
      const data = await response.json();
      setState(data);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };
  useEffect(() => {
    void fetch('/api/session')
      .then((r) => r.json())
      .then((r) => {
        token.current = r.token;
      });
    void refresh();
    const sse = new EventSource('/api/events');
    sse.onmessage = () => {
      if (refreshTimer.current === undefined)
        refreshTimer.current = window.setTimeout(() => {
          refreshTimer.current = undefined;
          void refresh();
        }, 300);
    };
    sse.onerror = () => setConnected(false);
    sse.onopen = () => {
      setConnected(true);
      void refresh();
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      sse.close();
      window.clearInterval(timer);
      window.clearTimeout(refreshTimer.current);
    };
  }, []);
  useEffect(() => {
    if (state) {
      setMax(String(state.config.maxWorkers));
      setBalance(state.settings.manualBalance == null ? '' : String(state.settings.manualBalance));
      setExpiry(state.settings.creditExpiry ?? '');
      setBudgetAlert(String(state.settings.budgetAlertPercent ?? 80));
      setRetention(String(state.settings.retention ?? 250));
    }
  }, [
    state?.config.maxWorkers,
    state?.settings.manualBalance,
    state?.settings.creditExpiry,
    state?.settings.budgetAlertPercent,
    state?.settings.retention,
  ]);
  async function action(endpoint: string, data: unknown = {}, success = 'Acción completada') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-office-token': token.current },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNotice(success);
      await refresh();
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return (
      <main className="loading">
        <img src="/qr-icon.png" width="48" alt="" />
        <h1>Morphiq Oficina</h1>
        <p>Conectando con el runner local…</p>
        <button onClick={() => void refresh()}>Reintentar conexión</button>
      </main>
    );
  const current = state.runs.find((r) => r.id === (runId || state.runs[0]?.id)),
    tasks = state.tasks.filter((t) => !current || t.runId === current.id);
  const queries = state.queries.filter((q) => !current || q.run_id === current.id);
  const agents: SceneAgent[] = queries.slice(-12).map((q) => {
    const task = state.tasks.find((t) => t.id === q.task_id),
      live = q.status === 'running';
    const lastTool = state.events
      .filter((e) => e.taskId === q.task_id && e.type === 'agent.tool')
      .at(-1);
    return {
      id: q.id,
      label: task?.title ?? 'Director',
      role: task?.role ?? 'director',
      tool: task?.tool ?? String(lastTool?.data.name ?? ''),
      active: live,
      blocked: q.status === 'unreconciled' || task?.status === 'blocked',
      taskId: task?.id,
      model: q.model,
    };
  });
  const agent = agents.find((a) => a.id === selected),
    task = state.tasks.find((t) => t.id === (agent?.taskId ?? selected));
  const inspectedQuery = state.queries.find((q) => q.id === (agent?.id ?? task?.queryId));
  const inspectedUsage = inspectedQuery ? JSON.parse(inspectedQuery.body) : undefined;
  const lastActivity = state.events
    .filter((e) => (task ? e.taskId === task.id : e.data.agentId === agent?.id))
    .at(-1);
  const models = state.totals.reduce((out: Record<string, number>, row: any) => {
    for (const [model, use] of Object.entries(row.modelUsage) as [string, any][])
      out[model] = (out[model] ?? 0) + (use.costUSD ?? 0);
    return out;
  }, {});
  const days = state.queries.reduce((out: Record<string, number>, q: any) => {
    const run = state.runs.find((r) => r.id === q.run_id);
    if (run) {
      const day = new Date(run.createdAt).toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
      });
      out[day] = (out[day] ?? 0) + q.cost;
    }
    return out;
  }, {});
  const totals = state.totals.reduce(
    (a, t) => {
      for (const use of Object.values(t.modelUsage) as any[]) {
        a.input += use.inputTokens ?? 0;
        a.output += use.outputTokens ?? 0;
        a.cache += (use.cacheReadInputTokens ?? 0) + (use.cacheCreationInputTokens ?? 0);
      }
      return a;
    },
    { input: 0, output: 0, cache: 0 },
  );
  const missionCost = current ? queries.reduce((sum, q) => sum + q.cost, 0) : 0;
  const visibleTasks = tasks.filter((t) => filter === 'all' || t.status === filter);
  const newMission = async () => {
    const result = await action(
      '/api/runs',
      {
        objective,
        budget: Number(budget),
        kind: 'analysis',
        idempotencyKey: 'mission-' + crypto.randomUUID(),
      },
      'Misión encolada',
    );
    if (result) {
      setRunId(result.id);
      setObjective('');
    }
  };
  const taskRows = (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Tarea / dependencias</th>
            <th>Perfil</th>
            <th>Estado</th>
            <th>Evidencia</th>
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((t) => (
            <tr key={t.id}>
              <td>
                <button
                  className="text-button"
                  onClick={() => {
                    setSelected(t.id);
                    setContext('');
                  }}
                >
                  {t.title}
                </button>
                <small>
                  {t.dependencies.length
                    ? 'Depende de ' + t.dependencies.join(', ')
                    : 'Sin dependencias'}
                </small>
              </td>
              <td>
                {t.role}
                <small>{t.model}</small>
              </td>
              <td>
                <span className={'badge ' + t.status}>{labels[t.status]}</span>
                {t.reason && <small className="reason">{t.reason}</small>}
              </td>
              <td>
                {t.checks.length} comprobaciones
                <small>{t.commit?.slice(0, 8) ?? 'Sin commit'}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length && (
        <div className="empty">
          Todavía no hay tareas. El director las creará al ejecutar una misión.
        </div>
      )}
    </div>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/qr-icon.png" alt="QR azul de Morphiq" />
          <div>
            Morphiq<small>Oficina de agentes</small>
          </div>
        </div>
        <nav aria-label="Panel principal">
          {['Oficina', 'Tareas', 'Costes', 'Configuración'].map((item, i) => (
            <button
              key={item}
              className={tab === item ? 'nav-active' : ''}
              onClick={() => setTab(item)}
            >
              <span aria-hidden="true">{['▦', '☷', '◈', '⚙'][i]}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-project">
          <small>Proyecto conectado</small>
          <strong>Morphiq QRs</strong>
          <span>{state?.settings.authorizedProductRunId ? 'main / misión autorizada' : 'main / solo lectura'}</span>
          <a href="https://morphiqqr.vercel.app/" target="_blank" rel="noreferrer">
            Abrir estudio ↗
          </a>
        </div>
        <div className="sidebar-bottom">
          <span className={'dot ' + (connected ? 'live' : '')} />
          {connected ? 'Runner conectado' : 'Runner desconectado'}
          <small>127.0.0.1 · Windows local</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Morphiq QRs <span>/</span> {tab}
          </span>
          <div className="top-status">
            <span className="badge">{state.config.director}</span>
            <span>
              {state.system.active} procesos · máx. {state.config.maxWorkers} Haiku
            </span>
            <strong>
              {money(
                Math.max(0, state.config.totalBudget - state.cost.spent - state.cost.reserved),
              )}
            </strong>
          </div>
          <button
            className="global-cancel"
            disabled={
              busy || !state.runs.some((run) => !['done', 'cancelled'].includes(run.status))
            }
            onClick={() =>
              void action(
                '/api/cancel-all',
                {},
                'Cancelación global solicitada; se conserva la evidencia y el uso pendiente',
              )
            }
          >
            Cancelar todo
          </button>
        </header>
        <main>
          <div className="page-title">
            <div>
              <h1>{tab === 'Oficina' ? 'Oficina de agentes' : tab}</h1>
              <p>
                {tab === 'Oficina'
                  ? 'Una misión, un equipo y evidencia de cada paso.'
                  : tab === 'Costes'
                    ? 'Tokens reportados y estimaciones del runtime.'
                    : tab === 'Tareas'
                      ? 'Propiedad, dependencias y revisión de cada resultado.'
                      : 'Rutas locales, límites y conexión de la oficina.'}
              </p>
            </div>
            <span className={'connection ' + (state.api.ok ? 'available' : 'warning')}>
              {state.api.ok ? 'Anthropic disponible' : (state.api.error ?? 'API sin configurar')}
            </span>
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {(state.cost.spent / state.config.totalBudget) * 100 >=
            Number(state.settings.budgetAlertPercent ?? 80) && (
            <div role="alert" className="alert">
              Se alcanzó la alerta de presupuesto ({state.settings.budgetAlertPercent ?? 80}%).
              Gasto estimado: {money(state.cost.spent)}. Las reservas en vuelo se mantienen visibles
              en Costes.
            </div>
          )}
          <div role="status" className={notice ? 'notice' : 'sr-only'}>
            {notice}
          </div>
          {tab === 'Oficina' && (
            <>
              <section className="mission-box">
                <div className="mission-heading">
                  <span className="mission-icon">⌘</span>
                  <div>
                    <h2>Nueva misión</h2>
                    <p>El QR permanece en lectura en esta etapa.</p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void newMission();
                  }}
                >
                  <label className="sr-only" htmlFor="objective">
                    Objetivo de la misión
                  </label>
                  <textarea
                    id="objective"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="Describe qué debe investigar o comprobar el equipo…"
                    required
                    minLength={4}
                    maxLength={8000}
                  />
                  <div className="mission-actions">
                    <label>
                      Presupuesto de misión (USD)
                      <input
                        type="number"
                        min=".5"
                        max="100"
                        step=".1"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                      />
                    </label>
                    <span>Opus dirige · Haiku ejecuta</span>
                    <button className="primary" disabled={busy || !state.api.ok}>
                      Ejecutar misión <span aria-hidden="true">▶</span>
                    </button>
                  </div>
                </form>
              </section>
              <section className="office-panel">
                <div className="section-toolbar">
                  <div>
                    <h2>La oficina</h2>
                    <span>
                      {agents.filter((a) => a.active).length
                        ? 'Actividad del runtime en directo'
                        : 'En espera de una misión'}
                    </span>
                  </div>
                  <div className="toolbar-buttons">
                    <button className={!list ? 'selected' : ''} onClick={() => setList(false)}>
                      Vista de oficina
                    </button>
                    <button className={list ? 'selected' : ''} onClick={() => setList(true)}>
                      Vista de lista
                    </button>
                  </div>
                </div>
                {list ? (
                  <div className="agent-list">
                    <h3>Instancias reales</h3>
                    {agents.length ? (
                      agents.map((a) => (
                        <button key={a.id} onClick={() => setSelected(a.id)}>
                          <span className={'dot ' + (a.active ? 'live' : '')} />
                          <strong>{a.label}</strong>
                          <span>{a.model}</span>
                          <span>
                            {a.active
                              ? a.tool || 'En ejecución'
                              : a.blocked
                                ? 'Pendiente de reconciliar'
                                : 'Finalizada'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p>Sin agentes ejecutándose</p>
                    )}
                  </div>
                ) : (
                  <Scene
                    agents={agents}
                    selected={selected}
                    onSelect={(id) => {
                      setSelected(id);
                      setContext('');
                    }}
                  />
                )}
                <div className="scene-footer">
                  <span>
                    <i className="dot live" /> En ejecución
                  </span>
                  <span>
                    <i className="dot amber" /> Requiere atención
                  </span>
                  <span>Actividad basada en eventos del SDK</span>
                </div>
              </section>
            </>
          )}
          {(tab === 'Oficina' || tab === 'Tareas') && (
            <section className="tasks-panel">
              <div className="section-toolbar">
                <div>
                  <h2>{current ? 'Misión actual' : 'Tablero de tareas'}</h2>
                  {current && <span>{current.objective}</span>}
                </div>
                <select
                  aria-label="Seleccionar misión"
                  value={current?.id ?? ''}
                  onChange={(e) => setRunId(e.target.value)}
                >
                  <option value="">Sin misión</option>
                  {state.runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {labels[r.status]}
                    </option>
                  ))}
                </select>
              </div>
              {current && (
                <div className="run-controls">
                  <span className={'badge ' + current.status}>{labels[current.status]}</span>
                  <span>
                    {money(missionCost)} / {money(current.budget)}
                  </span>
                  <div className="spacer" />
                  <button
                    disabled={busy || !['running', 'planning', 'queued'].includes(current.status)}
                    onClick={() =>
                      void action(`/api/runs/${current.id}/pause`, {}, 'Misión pausada')
                    }
                  >
                    Pausar
                  </button>
                  <button
                    disabled={busy || !['paused', 'blocked'].includes(current.status)}
                    onClick={() =>
                      void action(`/api/runs/${current.id}/resume`, {}, 'Misión retomada')
                    }
                  >
                    Retomar
                  </button>
                  <button
                    disabled={busy || ['done', 'cancelled'].includes(current.status)}
                    onClick={() =>
                      void action(`/api/runs/${current.id}/cancel`, {}, 'Cancelación solicitada')
                    }
                  >
                    Cancelar
                  </button>
                  <a className="button" href={`/api/runs/${current.id}/export`}>
                    Exportar JSON
                  </a>
                  <a className="button" href={`/api/runs/${current.id}/export?format=csv`}>
                    CSV
                  </a>
                </div>
              )}
              {current?.reason && <p className="run-reason">{current.reason}</p>}
              {current?.status === 'blocked' && (
                <form
                  className="director-context"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      `/api/runs/${current.id}/context`,
                      { context },
                      'Contexto enviado al director',
                    );
                  }}
                >
                  <label>
                    Contexto para el director
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      required
                      minLength={5}
                    />
                  </label>
                  <button disabled={busy}>Enviar contexto y retomar</button>
                </form>
              )}
              <div className="filters">
                {['all', 'running', 'review', 'blocked', 'done'].map((f) => (
                  <button
                    className={filter === f ? 'active' : ''}
                    key={f}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'Todas' : labels[f]}
                  </button>
                ))}
              </div>
              {taskRows}
            </section>
          )}
          {tab === 'Costes' && (
            <>
              <section className="cost-summary">
                <div>
                  <span>Gasto estimado de la oficina</span>
                  <strong>{money(state.cost.spent)}</strong>
                  <small>Estimación SDK; no representa la factura.</small>
                </div>
                <div>
                  <span>Reservado en vuelo</span>
                  <strong>{money(state.cost.reserved)}</strong>
                  <small>{state.cost.unreconciled} queries pendientes de reconciliar</small>
                </div>
                <div>
                  <span>Tokens reportados</span>
                  <strong>
                    {(totals.input + totals.output + totals.cache).toLocaleString('es-MX')}
                  </strong>
                  <small>
                    {totals.input.toLocaleString()} entrada / {totals.output.toLocaleString()}{' '}
                    salida / {totals.cache.toLocaleString()} cache
                  </small>
                </div>
              </section>
              <section className="panel">
                <h2>Por modelo y día de misión</h2>
                <div className="cost-groups">
                  <dl>
                    {Object.entries(models).map(([model, cost]) => (
                      <div key={model}>
                        <dt>{model}</dt>
                        <dd>{money(Number(cost))}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl>
                    {Object.entries(days).map(([day, cost]) => (
                      <div key={day}>
                        <dt>Misiones iniciadas el {day}</dt>
                        <dd>{money(Number(cost))}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
              <section className="panel">
                <h2>Ledger por query y sesión</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Modelo / query</th>
                        <th>Misión / sesión</th>
                        <th>Estimación USD</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.queries.map((q) => (
                        <tr key={q.id}>
                          <td>
                            {q.model}
                            <small>{q.id}</small>
                          </td>
                          <td>
                            {q.run_id}
                            <small>{q.session_id ?? 'Sesión pendiente'}</small>
                          </td>
                          <td>{money(q.cost)}</td>
                          <td>
                            {q.status === 'unreconciled'
                              ? 'Pendiente de reconciliar'
                              : q.status === 'running'
                                ? 'Provisional'
                                : 'Cerrado'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!state.queries.length && <p>Sin llamadas API realizadas.</p>}
                <p className="muted">
                  Director y trabajadores se contabilizan como queries independientes. Resultados
                  acumulativos se incrementan sin duplicar.
                </p>
              </section>
              <section className="panel">
                <h2>Créditos de Anthropic</h2>
                <p>
                  {state.settings.manualBalance == null
                    ? 'Saldo oficial sin informar'
                    : `Saldo informado manualmente: ${money(state.settings.manualBalance)}`}
                  {state.settings.creditExpiry
                    ? ' · Vencimiento: ' + state.settings.creditExpiry
                    : ''}
                </p>
                <a href="https://platform.claude.com/" target="_blank" rel="noreferrer">
                  Consultar Console ↗
                </a>
                <p className="muted">
                  Configura un spend limit del workspace en la Console. Reservas y maxBudgetUsd son
                  límites estimados; las llamadas en vuelo pueden cerrar después de cancelar.
                </p>
              </section>
            </>
          )}
          {tab === 'Configuración' && (
            <div className="settings-layout">
              <section className="panel">
                <h2>Límites de ejecución</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      '/api/settings',
                      {
                        maxWorkers: Number(max),
                        manualBalance: balance === '' ? null : Number(balance),
                        creditExpiry: expiry || null,
                        budgetAlertPercent: Number(budgetAlert),
                        retention: Number(retention),
                      },
                      'Configuración guardada',
                    );
                  }}
                >
                  <label>
                    Trabajadores simultáneos
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={max}
                      onChange={(e) => setMax(e.target.value)}
                    />
                  </label>
                  <label>
                    Avisar al consumir presupuesto (%)
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={budgetAlert}
                      onChange={(e) => setBudgetAlert(e.target.value)}
                    />
                  </label>
                  <label>
                    Eventos en ventana de historial
                    <input
                      type="number"
                      min="50"
                      max="1000"
                      value={retention}
                      onChange={(e) => setRetention(e.target.value)}
                    />
                  </label>
                  <label>
                    Saldo informado desde Console (USD)
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      placeholder="Sin informar"
                    />
                  </label>
                  <label>
                    Vencimiento de créditos
                    <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                  </label>
                  <button className="primary" disabled={busy}>
                    Guardar configuración
                  </button>
                </form>
                <p className="muted">
                  Máximo global {money(state.config.totalBudget)}. No se ejecutan misiones al abrir
                  la página.
                </p>
              </section>
              <section className="panel">
                <h2>Conexión y recursos</h2>
                <dl>
                  <dt>Director</dt>
                  <dd>{state.config.director}</dd>
                  <dt>Trabajadores</dt>
                  <dd>{state.config.worker}</dd>
                  <dt>GitHub</dt>
                  <dd>
                    {state.github.login}{' '}
                    {state.github.verified ? '· sesión verificada' : '· pendiente'}
                  </dd>
                  <dt>Node</dt>
                  <dd>{state.system.node}</dd>
                  <dt>Memoria libre</dt>
                  <dd>
                    {(state.system.freeMemory / 2 ** 30).toFixed(1)} /{' '}
                    {(state.system.totalMemory / 2 ** 30).toFixed(1)} GB
                  </dd>
                  <dt>CPU disponibles</dt>
                  <dd>{state.system.cpuCount}</dd>
                  <dt>Uso de CPU del equipo</dt>
                  <dd>{state.system.cpuPercent ?? 0}% (muestra de 3 s)</dd>
                </dl>
                <p className="muted">{state.system.apiLimits}</p>
                <button
                  disabled={busy}
                  onClick={() => void action('/api/verify', {}, 'Conexión comprobada')}
                >
                  Comprobar API y modelos
                </button>
              </section>
              <section className="panel paths">
                <h2>Rutas resueltas</h2>
                <dl>
                  {Object.entries(state.config.paths).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {state.queries
                .filter((q) => q.status === 'unreconciled')
                .map((q) => (
                  <section className="panel" key={q.id}>
                    <h2>Reconciliar query interrumpida</h2>
                    <p>
                      {q.id} · {q.model}
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void action(
                          '/api/reconcile',
                          { queryId: q.id, cost: Number(data.get('cost')) },
                          'Uso reconciliado con importe manual',
                        );
                      }}
                    >
                      <label>
                        Coste confirmado en Console (USD)
                        <input
                          name="cost"
                          type="number"
                          min="0"
                          max="100"
                          step=".000001"
                          required
                        />
                      </label>
                      <button disabled={busy}>Registrar importe y liberar reserva</button>
                    </form>
                  </section>
                ))}
            </div>
          )}
          {(tab === 'Oficina' || tab === 'Tareas') && (
            <section className="timeline panel">
              <div className="section-toolbar">
                <h2>Actividad verificable</h2>
                <span>Últimos {Math.min(40, state.events.length)} eventos</span>
              </div>
              {state.events
                .slice(-40)
                .reverse()
                .map((e) => (
                  <div className="event" key={e.id}>
                    <time>{new Date(e.at).toLocaleTimeString('es-MX')}</time>
                    <span className="event-type">{e.type}</span>
                    <span>
                      {String(
                        e.data.name ??
                          e.data.decision ??
                          e.data.text ??
                          e.data.reason ??
                          e.data.title ??
                          e.taskId ??
                          '',
                      ).slice(0, 220)}
                    </span>
                  </div>
                ))}
              {!state.events.length && <p>Sin eventos todavía.</p>}
            </section>
          )}
        </main>
      </div>
      {(agent || task) && (
        <aside className="inspector" aria-label="Inspector de agente y tarea">
          <div className="inspector-heading">
            <h2>Inspector</h2>
            <button aria-label="Cerrar inspector" onClick={() => setSelected('')}>
              ×
            </button>
          </div>
          <h3>{task?.title ?? agent?.label}</h3>
          <span className="badge">{task?.model ?? agent?.model}</span>
          <dl>
            <dt>Rol</dt>
            <dd>{task?.role ?? 'director'}</dd>
            <dt>Instancia</dt>
            <dd>{agent?.id ?? task?.queryId ?? 'Pendiente'}</dd>
            <dt>Estado</dt>
            <dd>{task ? labels[task.status] : agent?.active ? 'En ejecución' : 'Finalizada'}</dd>
            <dt>Skill</dt>
            <dd>{task?.skill ?? 'morphiq-director'}</dd>
            <dt>Herramienta</dt>
            <dd>{task?.tool ?? agent?.tool ?? 'Sin herramienta en vuelo'}</dd>
            <dt>Sesión</dt>
            <dd>{task?.sessionId ?? inspectedQuery?.session_id ?? 'Consulta el ledger'}</dd>
            <dt>Duración de query</dt>
            <dd>
              {inspectedUsage?.durationMs == null
                ? 'En curso'
                : (inspectedUsage.durationMs / 1000).toFixed(1) + ' s'}
            </dd>
            <dt>Tiempo API reportado (sesión acumulada)</dt>
            <dd>
              {inspectedUsage?.apiMs == null
                ? 'Pendiente'
                : (inspectedUsage.apiMs / 1000).toFixed(1) + ' s'}
            </dd>
            <dt>Gasto estimado de query</dt>
            <dd>{inspectedQuery ? money(inspectedQuery.cost) : 'Sin llamadas'}</dd>
            <dt>Tokens reportados (sesión acumulada)</dt>
            <dd>
              {inspectedUsage?.usage
                ? `${inspectedUsage.usage.input_tokens ?? 0} entrada · ${inspectedUsage.usage.output_tokens ?? 0} salida · ${inspectedUsage.usage.cache_read_input_tokens ?? 0} lectura cache · ${inspectedUsage.usage.cache_creation_input_tokens ?? 0} escritura cache`
                : 'Provisionales; pendiente del resultado'}
            </dd>
            {task && (
              <>
                <dt>Creada / actualizada</dt>
                <dd>
                  {new Date(task.createdAt).toLocaleString('es-MX')} /{' '}
                  {new Date(task.updatedAt).toLocaleString('es-MX')}
                </dd>
              </>
            )}
            <dt>Último evento</dt>
            <dd>
              {lastActivity
                ? lastActivity.type + ' · ' + new Date(lastActivity.at).toLocaleTimeString('es-MX')
                : 'Sin eventos'}
            </dd>
            <dt>Base / commit</dt>
            <dd>
              {task?.base?.slice(0, 10) ?? '—'} / {task?.commit?.slice(0, 10) ?? '—'}
            </dd>
          </dl>
          {task?.reason && <p className="alert">{task.reason}</p>}
          {task && (
            <>
              <h4>Aceptación</h4>
              <ul>
                {task.acceptance.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              <h4>Informe</h4>
              <p>{task.report?.summary ?? 'Sin informe todavía.'}</p>
              {task.report?.concerns.map((c, i) => (
                <p key={i}>{c}</p>
              ))}
              <h4>Comprobaciones</h4>
              {task.checks.map((c) => (
                <details key={c.id}>
                  <summary>
                    {c.command} · {c.exitCode === 0 ? 'pasó' : 'falló'} ·{' '}
                    {(c.durationMs / 1000).toFixed(1)} s
                  </summary>
                  <pre>{c.output}</pre>
                </details>
              ))}
              <h4>Diff</h4>
              <pre>{task.diff ?? 'Sin cambios registrados'}</pre>
              {['blocked', 'failed'].includes(task.status) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(`/api/tasks/${task.id}/retry`, { context }, 'Tarea reencolada');
                  }}
                >
                  <label>
                    Contexto para reintentar
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      minLength={5}
                      required
                    />
                  </label>
                  <button disabled={busy}>Reintentar tarea</button>
                </form>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
