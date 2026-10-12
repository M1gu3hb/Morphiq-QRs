import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { TaskInput, type Task, type TaskSpec, type Run, type Event } from '../contracts/index.ts';
import { redact } from './policy.ts';
const now = () => new Date().toISOString();
const unpack = <T>(row: unknown): T | undefined =>
  row ? JSON.parse((row as { body: string }).body) : undefined;
export class Store {
  db: DatabaseSync;
  bus = new EventEmitter();
  constructor(public file: string) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(readFileSync(new URL('./migrations/001-initial.sql', import.meta.url), 'utf8'));
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  createRun(input: Partial<Run> & Pick<Run, 'id' | 'objective' | 'repo' | 'budget' | 'kind'>): Run {
    const existing = this.run(input.id);
    if (existing) return existing;
    const run: Run = {
      status: 'queued',
      createdAt: now(),
      updatedAt: now(),
      directorPasses: 0,
      ...input,
    };
    this.db.prepare('INSERT INTO runs VALUES(?,?)').run(run.id, JSON.stringify(run));
    this.event('run.created', run.id, undefined, { objective: run.objective });
    return run;
  }
  run(id: string) {
    return unpack<Run>(this.db.prepare('SELECT body FROM runs WHERE id=?').get(id));
  }
  runs() {
    return this.db
      .prepare('SELECT body FROM runs ORDER BY rowid DESC LIMIT 200')
      .all()
      .map((r) => unpack<Run>(r)!);
  }
  updateRun(id: string, patch: Partial<Run>) {
    const item = this.run(id);
    if (!item) throw new Error('Misión no encontrada');
    const run = { ...item, ...patch, updatedAt: now() };
    this.db.prepare('UPDATE runs SET body=? WHERE id=?').run(JSON.stringify(run), id);
    this.event('run.updated', id, undefined, { status: run.status, reason: run.reason ?? '' });
    return run;
  }
  createTask(input: TaskSpec): Task {
    const spec = TaskInput.parse(input),
      existing = this.task(spec.id);
    if (existing) {
      if (existing.runId !== spec.runId) throw new Error('ID pertenece a otra misión');
      return existing;
    }
    if (!this.run(spec.runId)) throw new Error('Misión no encontrada');
    if (this.tasks(spec.runId).length >= 40)
      throw new Error('Límite de 40 tareas por misión; agrupa o reduce el alcance');
    for (const dep of spec.dependencies)
      if (dep === spec.id || this.task(dep)?.runId !== spec.runId)
        throw new Error('Dependencia inválida o no creada');
    for (const file of spec.files)
      if (
        !file ||
        file.startsWith('/') ||
        file.includes('..') ||
        file.includes(':') ||
        file.includes('\\') ||
        /^\.git|^secrets|\.env/.test(file)
      )
        throw new Error('Propiedad inválida');
    const task: Task = {
      ...spec,
      status: 'pending',
      attempts: 0,
      model: 'claude-haiku-5-5',
      createdAt: now(),
      updatedAt: now(),
      checks: [],
    };
    this.db
      .prepare('INSERT INTO tasks VALUES(?,?,?)')
      .run(task.id, task.runId, JSON.stringify(task));
    this.event('task.created', task.runId, task.id, { title: task.title, role: task.role });
    return task;
  }
  task(id: string) {
    return unpack<Task>(this.db.prepare('SELECT body FROM tasks WHERE id=?').get(id));
  }
  tasks(runId?: string) {
    return (
      runId
        ? this.db.prepare('SELECT body FROM tasks WHERE run_id=?').all(runId)
        : this.db.prepare('SELECT body FROM tasks').all()
    ).map((r) => unpack<Task>(r)!);
  }
  updateTask(id: string, patch: Partial<Task>) {
    const task = this.task(id);
    if (!task) throw new Error('Tarea no encontrada');
    const next = { ...task, ...patch, updatedAt: now() };
    this.db.prepare('UPDATE tasks SET body=? WHERE id=?').run(JSON.stringify(next), id);
    this.event('task.updated', task.runId, id, {
      status: next.status,
      reason: next.reason ?? '',
      tool: next.tool ?? '',
    });
    return next;
  }
  assign(id: string) {
    const task = this.task(id);
    if (!task) throw new Error('Tarea no encontrada');
    if (task.status === 'pending') return this.updateTask(id, { status: 'ready' });
    return task;
  }
  claim(runId: string, max: number): Task | undefined {
    return this.transaction(() => {
      const run = this.run(runId);
      if (!run || ['paused', 'cancelled', 'blocked', 'done'].includes(run.status)) return;
      const tasks = this.tasks(runId),
        active = this.tasks().filter((t) => t.status === 'running');
      if (active.length >= max) return;
      const done = new Set(
        tasks.filter((t) => ['verified', 'integrated', 'done'].includes(t.status)).map((t) => t.id),
      );
      const overlaps = (a: string, b: string) =>
        a === b || (a.endsWith('/') && b.startsWith(a)) || (b.endsWith('/') && a.startsWith(b));
      const next = tasks.find(
        (t) =>
          t.status === 'ready' &&
          t.dependencies.every((d) => done.has(d)) &&
          !active.some(
            (a) =>
              a.kind === 'work' &&
              t.kind === 'work' &&
              a.files.some((f) => t.files.some((g) => overlaps(f, g))),
          ),
      );
      return next
        ? this.updateTask(next.id, {
            status: 'running',
            attempts: next.attempts + 1,
            ownerPid: process.pid,
            leaseUntil: Date.now() + 30_000,
          })
        : undefined;
    });
  }
  event(type: string, runId?: string, taskId?: string, data: Record<string, unknown> = {}) {
    const body = redact(JSON.stringify(data)),
      at = now();
    const result = this.db
      .prepare('INSERT INTO events(at,type,run_id,task_id,body) VALUES(?,?,?,?,?)')
      .run(at, type, runId ?? null, taskId ?? null, body);
    const event: Event = {
      version: 1,
      id: Number(result.lastInsertRowid),
      at,
      type,
      runId,
      taskId,
      data: JSON.parse(body),
    };
    this.bus.emit('event', event);
    return event;
  }
  events(after = 0, limit = 250) {
    return this.db
      .prepare('SELECT * FROM events WHERE id>? ORDER BY id DESC LIMIT ?')
      .all(after, Math.min(1000, limit))
      .reverse()
      .map((r: any) => ({
        version: 1,
        id: r.id,
        at: r.at,
        type: r.type,
        runId: r.run_id ?? undefined,
        taskId: r.task_id ?? undefined,
        data: JSON.parse(r.body),
      })) as Event[];
  }
  runEvents(id: string) {
    return this.db
      .prepare('SELECT * FROM events WHERE run_id=? ORDER BY id')
      .all(id)
      .map((r: any) => ({
        version: 1,
        id: r.id,
        at: r.at,
        type: r.type,
        runId: r.run_id,
        taskId: r.task_id ?? undefined,
        data: JSON.parse(r.body),
      })) as Event[];
  }
  reserve(
    id: string,
    runId: string,
    amount: number,
    globalBudget: number,
    model = '',
    taskId?: string,
  ): boolean {
    return this.transaction(() => {
      const old = this.db.prepare('SELECT id FROM queries WHERE id=?').get(id);
      if (old) return false;
      const cost = this.cost(),
        local = this.cost(runId),
        run = this.run(runId);
      if (
        !run ||
        amount <= 0 ||
        cost.spent + cost.reserved + amount > globalBudget + 1e-8 ||
        local.spent + local.reserved + amount > run.budget + 1e-8
      )
        return false;
      this.db
        .prepare(
          'INSERT INTO queries(id,run_id,task_id,model,status,reserved,body) VALUES(?,?,?,?,?,?,?)',
        )
        .run(id, runId, taskId ?? null, model, 'running', amount, '{}');
      return true;
    });
  }
  query(id: string) {
    return this.db.prepare('SELECT * FROM queries WHERE id=?').get(id) as any;
  }
  queryMetadata(id: string, data: Record<string, unknown>) {
    const item = this.query(id);
    if (!item) return;
    this.db
      .prepare('UPDATE queries SET body=? WHERE id=?')
      .run(JSON.stringify({ ...JSON.parse(item.body), ...data }), id);
  }
  queries(runId?: string) {
    return runId
      ? this.db.prepare('SELECT * FROM queries WHERE run_id=?').all(runId)
      : this.db.prepare('SELECT * FROM queries').all();
  }
  closeQuery(id: string, unrecordedCost?: number) {
    if (unrecordedCost !== undefined)
      this.db.prepare('UPDATE queries SET cost=? WHERE id=?').run(unrecordedCost, id);
    this.db.prepare("UPDATE queries SET status='closed',reserved=0 WHERE id=?").run(id);
  }
  markIncomplete(id: string) {
    this.db.prepare("UPDATE queries SET status='unreconciled' WHERE id=?").run(id);
  }
  recordAssistant(queryId: string, sessionId: string, messageId: string, usage: unknown) {
    this.db
      .prepare('INSERT OR IGNORE INTO messages VALUES(?,?,?,?)')
      .run(queryId, sessionId, messageId, JSON.stringify(usage));
  }
  messages() {
    return this.db.prepare('SELECT * FROM messages').all();
  }
  recordResult(
    queryId: string,
    sessionId: string,
    epoch: number,
    cost: number,
    modelUsage: unknown,
    extra: unknown = {},
  ) {
    if (!Number.isFinite(cost) || cost < 0) {
      this.markIncomplete(queryId);
      return;
    }
    this.transaction(() => {
      const prior = this.db
        .prepare('SELECT cost FROM totals WHERE session_id=? AND epoch=?')
        .get(sessionId, epoch) as { cost: number } | undefined;
      if (prior && cost + 1e-8 < prior.cost)
        throw new Error('Acumulado menor sin reset explícito: pendiente de reconciliar');
      const delta = Math.max(0, cost - (prior?.cost ?? 0));
      this.db
        .prepare(
          'INSERT INTO totals VALUES(?,?,?,?) ON CONFLICT(session_id,epoch) DO UPDATE SET cost=excluded.cost,body=excluded.body',
        )
        .run(sessionId, epoch, cost, JSON.stringify(modelUsage));
      this.db.prepare('UPDATE queries SET cost=cost+?,session_id=?,body=? WHERE id=?').run(
        delta,
        sessionId,
        JSON.stringify({
          ...JSON.parse(this.query(queryId)?.body ?? '{}'),
          modelUsage,
          ...(extra as object),
        }),
        queryId,
      );
    });
  }
  totals() {
    return this.db
      .prepare('SELECT * FROM totals')
      .all()
      .map((row: any) => ({ ...row, modelUsage: JSON.parse(row.body) }));
  }
  sessionEpoch(session: string) {
    const row = this.db
      .prepare('SELECT MAX(epoch) AS epoch FROM totals WHERE session_id=?')
      .get(session) as { epoch: number | null };
    return row.epoch ?? 0;
  }
  cost(runId?: string): { spent: number; reserved: number; unreconciled: number } {
    const rows = (
      runId
        ? this.db.prepare('SELECT cost,reserved,status FROM queries WHERE run_id=?').all(runId)
        : this.db.prepare('SELECT cost,reserved,status FROM queries').all()
    ) as { cost: number; reserved: number; status: string }[];
    return rows.reduce(
      (a, q) => ({
        spent: a.spent + q.cost,
        reserved: a.reserved + q.reserved,
        unreconciled: a.unreconciled + (q.status === 'unreconciled' ? 1 : 0),
      }),
      { spent: 0, reserved: 0, unreconciled: 0 },
    );
  }
  settings() {
    return (
      unpack<Record<string, unknown>>(
        this.db.prepare("SELECT body FROM settings WHERE id='office'").get(),
      ) ?? {}
    );
  }
  saveSettings(value: Record<string, unknown>) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES('office',?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(JSON.stringify(value));
  }
  recover() {
    for (const task of this.tasks().filter((t) => t.status === 'running'))
      this.updateTask(task.id, {
        status: 'blocked',
        reason: 'Runner interrumpido. Revisa evidencia y procesos antes de reintentar.',
        leaseUntil: undefined,
      });
    for (const run of this.runs().filter((r) =>
      ['running', 'planning', 'queued'].includes(r.status),
    ))
      this.updateRun(run.id, {
        status: 'paused',
        reason: 'Recuperado tras reinicio; requiere retomar explícitamente.',
      });
    this.db.prepare("UPDATE queries SET status='unreconciled' WHERE status='running'").run();
  }
  close() {
    this.db.close();
  }
}
