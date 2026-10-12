import { useEffect, useRef, useState } from 'react';
import { startGameLoop } from './upstream/gameLoop.ts';
export interface SceneAgent {
  id: string;
  label: string;
  role: string;
  tool: string;
  active: boolean;
  blocked: boolean;
  taskId?: string;
  model: string;
}
const stations: Record<string, [number, number]> = {
  director: [470, 128],
  design: [150, 225],
  web: [320, 335],
  qr: [495, 335],
  mobile: [670, 335],
  research: [150, 335],
  qa: [820, 335],
  review: [820, 225],
  integration: [650, 225],
};
const palettes = ['#237aff', '#31c6db', '#8769e7', '#e5b061', '#51b78c', '#dd859d'];
export function Scene({
  agents,
  onSelect,
  selected,
}: {
  agents: SceneAgent[];
  onSelect: (id: string) => void;
  selected?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    latest = useRef(agents),
    picked = useRef(selected),
    positions = useRef(new Map<string, { x: number; y: number }>());
  const [view, setView] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('morphiq-office-layout') ?? '{"zoom":1,"x":0,"y":0}');
    } catch {
      return { zoom: 1, x: 0, y: 0 };
    }
  });
  const viewRef = useRef(view),
    drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  latest.current = agents;
  picked.current = selected;
  viewRef.current = view;
  useEffect(() => localStorage.setItem('morphiq-office-layout', JSON.stringify(view)), [view]);
  useEffect(() => {
    const canvas = ref.current!;
    let phase = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      c: string,
    ) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const text = (
      ctx: CanvasRenderingContext2D,
      value: string,
      x: number,
      y: number,
      c = '#7d9abd',
      size = 12,
    ) => {
      ctx.font = `${size}px Segoe UI`;
      ctx.fillStyle = c;
      ctx.fillText(value, x, y);
    };
    const stop = startGameLoop(canvas, {
      update: (dt) => {
        if (!reduced.matches) phase += dt;
        const counts: Record<string, number> = {};
        for (const [index, agent] of latest.current.entries()) {
          const slot = counts[agent.role] ?? 0;
          counts[agent.role] = slot + 1;
          const [x, y] = stations[agent.role] ?? stations.web;
          const destination = agent.active
            ? { x: x + slot * 42, y: y + 38 }
            : { x: 110 + index * 62, y: 415 };
          const p =
            positions.current.get(agent.id) ??
            (agent.active ? { x: 480, y: 465 } : { ...destination });
          const speed = reduced.matches ? 1 : Math.min(1, dt * 3);
          p.x += (destination.x - p.x) * speed;
          p.y += (destination.y - p.y) * speed;
          positions.current.set(agent.id, p);
        }
      },
      render: (ctx) => {
        const width = canvas.clientWidth,
          height = canvas.clientHeight,
          dpr = Math.min(2, window.devicePixelRatio || 1);
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const fit = Math.min(width / 960, height / 525) * viewRef.current.zoom;
        ctx.translate(
          (width - 960 * fit) / 2 + viewRef.current.x,
          (height - 525 * fit) / 2 + viewRef.current.y,
        );
        ctx.scale(fit, fit);
        rect(ctx, 24, 44, 912, 460, '#07101b');
        rect(ctx, 24, 44, 912, 15, '#153254');
        rect(ctx, 24, 44, 12, 460, '#102239');
        rect(ctx, 924, 44, 12, 460, '#102239');
        for (let y = 64; y < 500; y += 24)
          for (let x = 40; x < 920; x += 24) {
            ctx.strokeStyle = '#101d2c';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, 24, 24);
          }
        rect(ctx, 372, 61, 208, 141, '#0c203c');
        rect(ctx, 372, 61, 208, 3, '#237aff');
        text(ctx, 'Dirección', 392, 84, '#79b1ff', 13);
        text(ctx, 'Diseño / investigación', 65, 185, '#9cb4d1', 12);
        text(ctx, 'Desarrollo', 235, 290, '#9cb4d1', 12);
        text(ctx, 'QA / revisión', 744, 185, '#9cb4d1', 12);
        text(ctx, 'Integración', 614, 185, '#9cb4d1', 12);
        // Furniture is drawn locally; no external sprite packs are loaded.
        for (const [role, [x, y]] of Object.entries(stations)) {
          rect(ctx, x - 44, y + 2, 91, 41, '#03080d');
          rect(ctx, x - 46, y, 91, 34, '#193149');
          rect(ctx, x - 46, y + 30, 91, 6, '#0e1e2e');
          rect(ctx, x - 32, y + 36, 5, 24, '#18304c');
          rect(ctx, x + 29, y + 36, 5, 24, '#18304c');
          rect(ctx, x - 20, y - 23, 40, 29, '#061323');
          rect(ctx, x - 17, y - 20, 34, 22, '#0c2a58');
          rect(ctx, x - 14, y - 16, 21, 2, '#448bff');
          rect(ctx, x - 14, y - 10, 26, 2, '#2c5482');
          rect(ctx, x - 3, y + 6, 7, 4, '#03080d');
          rect(ctx, x - 17, y + 17, 34, 7, '#0c1827');
          if (role === 'director') text(ctx, 'Opus', x - 15, y - 32, '#66a4ff', 11);
        }
        for (const [x, y] of [
          [70, 94],
          [890, 94],
          [76, 455],
          [890, 455],
        ]) {
          rect(ctx, x - 12, y, 24, 17, '#1e3850');
          rect(ctx, x - 5, y - 26, 10, 28, '#296045');
          rect(ctx, x - 16, y - 15, 14, 9, '#3d8261');
          rect(ctx, x + 2, y - 20, 15, 10, '#3d8261');
        }
        rect(ctx, 350, 446, 220, 27, '#142b48');
        rect(ctx, 350, 442, 220, 10, '#204064');
        text(ctx, 'Morphiq / oficina local', 385, 492, '#4e7195', 13);
        latest.current.forEach((agent, index) => {
          const p = positions.current.get(agent.id);
          if (!p) return;
          const x = Math.round(p.x),
            y = Math.round(p.y),
            color = palettes[index % palettes.length];
          const motion = agent.active && !reduced.matches ? Math.floor(phase * 5) % 2 : 0;
          rect(ctx, x - 12, y + 22, 27, 5, '#02070e');
          rect(ctx, x - 9, y + 11, 7, 13, '#233854');
          rect(ctx, x + 3, y + 11, 7, 13, '#233854');
          rect(ctx, x - 11, y - 3, 23, 17, color);
          rect(ctx, x - 7, y - 17, 15, 15, '#dcae86');
          rect(ctx, x - 8, y - 20, 16, 7, '#252538');
          rect(ctx, x - 4, y - 10, 2, 2, '#263746');
          rect(ctx, x + 3, y - 10, 2, 2, '#263746');
          if (agent.active) {
            rect(ctx, x - 16, y + 3 + motion, 5, 9, color);
            rect(ctx, x + 12, y + 3 - motion, 5, 9, color);
            if (/read|list|Skill/.test(agent.tool)) {
              rect(ctx, x + 12, y - 4, 12, 15, '#c5d5e5');
              rect(ctx, x + 14, y, 8, 2, '#446891');
            } else if (/check/.test(agent.tool)) {
              rect(ctx, x + 14, y - 5, 17, 14, '#3b8966');
              text(ctx, '✓', x + 17, y + 7, '#fff', 11);
            }
          }
          if (picked.current === agent.id) {
            ctx.strokeStyle = '#7bb6ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 22, y - 26, 44, 56);
          }
          rect(
            ctx,
            x - 3,
            y - 32,
            6,
            6,
            agent.blocked ? '#e5ad51' : agent.active ? '#51c8a0' : '#486075',
          );
          let label = agent.label;
          ctx.font = '11px Segoe UI';
          while (label.length > 1 && ctx.measureText(label + '…').width > 54)
            label = label.slice(0, -1);
          if (label !== agent.label) label += '…';
          text(
            ctx,
            label,
            x - ctx.measureText(label).width / 2,
            y + 40,
            agent.active ? '#c9defa' : '#728dab',
            11,
          );
        });
      },
    });
    return stop;
  }, []);
  const pick = (clientX: number, clientY: number) => {
    const canvas = ref.current!,
      r = canvas.getBoundingClientRect(),
      fit = Math.min(r.width / 960, r.height / 525) * view.zoom;
    const x = (clientX - r.left - (r.width - 960 * fit) / 2 - view.x) / fit,
      y = (clientY - r.top - (r.height - 525 * fit) / 2 - view.y) / fit;
    for (const agent of agents) {
      const p = positions.current.get(agent.id);
      if (p && Math.abs(p.x - x) < 28 && Math.abs(p.y - y) < 40) {
        onSelect(agent.id);
        break;
      }
    }
  };
  return (
    <div className="scene-wrap">
      <canvas
        ref={ref}
        aria-label="Oficina animada; usa Vista de lista para navegar los agentes con teclado"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, dx: view.x, dy: view.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const d = drag.current;
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5)
              setView({ ...view, x: d.dx + e.clientX - d.x, y: d.dy + e.clientY - d.y });
          }
        }}
        onPointerUp={(e) => {
          if (
            drag.current &&
            Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 5
          )
            pick(e.clientX, e.clientY);
          drag.current = null;
        }}
      />
      {!agents.length && (
        <div className="scene-empty">
          <span>Sin agentes ejecutándose</span>
          <small>La oficina espera tu próxima misión.</small>
        </div>
      )}
      <div className="scene-controls">
        <button
          aria-label="Alejar oficina"
          onClick={() => setView({ ...view, zoom: Math.max(0.6, view.zoom - 0.2) })}
        >
          −
        </button>
        <button aria-label="Ajustar vista" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
          Ajustar
        </button>
        <button
          aria-label="Acercar oficina"
          onClick={() => setView({ ...view, zoom: Math.min(2, view.zoom + 0.2) })}
        >
          +
        </button>
      </div>
    </div>
  );
}
