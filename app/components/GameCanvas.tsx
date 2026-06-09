'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { Application, Graphics, Container, Text, TextStyle, BlurFilter } from 'pixi.js';

// 37-pocket European roulette order
const SEGMENTS = [
  { label: '0',  color: 0x1a8c3a },
  { label: '32', color: 0xb52020 },
  { label: '15', color: 0x111111 },
  { label: '19', color: 0xb52020 },
  { label: '4',  color: 0x111111 },
  { label: '21', color: 0xb52020 },
  { label: '2',  color: 0x111111 },
  { label: '25', color: 0xb52020 },
  { label: '17', color: 0x111111 },
  { label: '34', color: 0xb52020 },
  { label: '6',  color: 0x111111 },
  { label: '27', color: 0xb52020 },
  { label: '13', color: 0x111111 },
  { label: '36', color: 0xb52020 },
  { label: '11', color: 0x111111 },
  { label: '30', color: 0xb52020 },
  { label: '8',  color: 0x111111 },
  { label: '23', color: 0xb52020 },
  { label: '10', color: 0x111111 },
  { label: '5',  color: 0xb52020 },
  { label: '24', color: 0x111111 },
  { label: '16', color: 0xb52020 },
  { label: '33', color: 0x111111 },
  { label: '1',  color: 0xb52020 },
  { label: '20', color: 0x111111 },
  { label: '14', color: 0xb52020 },
  { label: '31', color: 0x111111 },
  { label: '9',  color: 0xb52020 },
  { label: '22', color: 0x111111 },
  { label: '18', color: 0xb52020 },
  { label: '29', color: 0x111111 },
  { label: '7',  color: 0xb52020 },
  { label: '28', color: 0x111111 },
  { label: '12', color: 0xb52020 },
  { label: '35', color: 0x111111 },
  { label: '3',  color: 0xb52020 },
  { label: '26', color: 0x111111 },
];

const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = (Math.PI * 2) / SEG_COUNT;

function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }
function easeInCubic(t: number)  { return t * t * t; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Shortest-path angle interpolation
function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  return a + d * t;
}

export interface GameCanvasHandle {
  spin: (onDone: (result: string) => void) => void;
}

interface Props {
  onFpsUpdate:   (fps: number) => void;
  onObjectCount: (n: number) => void;
  canvasRef:     RefObject<GameCanvasHandle | null>;
}

interface SpinAnim {
  fromRot:         number;
  toRot:           number;
  winIdx:          number;
  startMs:         number;
  durationMs:      number;
  ballTotalAngle:  number;  // total orbital radians (negative = opposite dir)
  ballInitAngle:   number;  // ball angle when spin started
  dropStartAngle:  number | null; // snapped when drop phase begins
  onDone:          (label: string) => void;
}

export default function GameCanvas({ onFpsUpdate, onObjectCount, canvasRef }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let destroyed    = false;
    let initialized  = false;          // true only after app.init() resolves
    let app: Application | null = null;
    let glowTimeout: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      const el = mountRef.current!;
      const W = el.clientWidth  || 520;
      const H = el.clientHeight || 400;

      const a = new Application();
      app = a;

      await a.init({
        width:           W,
        height:          H,
        backgroundColor: 0x080f1c,
        antialias:       true,
        resolution:      Math.min(window.devicePixelRatio || 1, 2),
        autoDensity:     true,
      });

      // If cleanup fired while we were awaiting init(), destroy now that
      // PixiJS internal state is fully set up (safe to call destroy).
      if (destroyed) { try { a.destroy({ removeView: true }); } catch { } return; }

      initialized = true;
      el.appendChild(a.canvas);

      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(cx, cy) * 0.76;

      // ── Outer-track glow (static, behind wheel) ──────────────────────────
      const trackGlow = new Graphics();
      trackGlow.circle(cx, cy, radius + 34);
      trackGlow.fill({ color: 0x3a2a00, alpha: 0.5 });
      trackGlow.filters = [new BlurFilter({ strength: 18 })];
      app.stage.addChild(trackGlow);

      // Ball track ring (thin visible ring showing where ball orbits)
      const trackRing = new Graphics();
      trackRing.circle(cx, cy, radius + 30);
      trackRing.stroke({ color: 0x6a5000, width: 2, alpha: 0.4 });
      app.stage.addChild(trackRing);

      // ── Wheel container ───────────────────────────────────────────────────
      const wheel = new Container();
      wheel.x = cx;
      wheel.y = cy;

      // Outer rim glow
      const rimGlow = new Graphics();
      rimGlow.circle(0, 0, radius + 8);
      rimGlow.fill({ color: 0xc9a227, alpha: 0.12 });
      rimGlow.filters = [new BlurFilter({ strength: 8 })];
      wheel.addChild(rimGlow);

      // Segments
      for (let i = 0; i < SEG_COUNT; i++) {
        const sa = i * SEG_ANGLE - Math.PI / 2;
        const ea = sa + SEG_ANGLE;
        const seg = new Graphics();
        seg.moveTo(0, 0);
        seg.arc(0, 0, radius, sa, ea);
        seg.lineTo(0, 0);
        seg.fill({ color: SEGMENTS[i].color });
        seg.stroke({ color: 0x8a6800, width: 0.7 });
        wheel.addChild(seg);

        // Number label
        const mid = sa + SEG_ANGLE / 2;
        const fs  = radius > 130 ? 8 : 6;
        const lbl = new Text({ text: SEGMENTS[i].label, style: new TextStyle({ fontSize: fs, fill: 0xffffff, fontWeight: 'bold', fontFamily: 'Arial' }) });
        lbl.anchor.set(0.5);
        lbl.x = Math.cos(mid) * radius * 0.82;
        lbl.y = Math.sin(mid) * radius * 0.82;
        lbl.rotation = mid + Math.PI / 2;
        wheel.addChild(lbl);
      }

      // Inner decorative gold rings
      const rings = new Graphics();
      rings.circle(0, 0, radius * 0.88);
      rings.stroke({ color: 0xc9a227, width: 2 });
      rings.circle(0, 0, radius * 0.76);
      rings.stroke({ color: 0x9a7800, width: 1, alpha: 0.6 });
      wheel.addChild(rings);

      // Centre hub: outer disc → dark recess → centre pip
      const hub = new Graphics();
      hub.circle(0, 0, radius * 0.13);
      hub.fill({ color: 0xc9a227 });
      hub.circle(0, 0, radius * 0.09);
      hub.fill({ color: 0x0a0f1e });
      hub.circle(0, 0, radius * 0.05);
      hub.fill({ color: 0xc9a227 });
      wheel.addChild(hub);

      // Outer gold border (double rim)
      const border = new Graphics();
      border.circle(0, 0, radius + 4);
      border.stroke({ color: 0xc9a227, width: 5 });
      border.circle(0, 0, radius + 10);
      border.stroke({ color: 0x6a4a00, width: 2 });
      wheel.addChild(border);

      app.stage.addChild(wheel);

      // ── Pointer (diamond shape at 12 o'clock) ────────────────────────────
      const ptr = new Graphics();
      ptr.moveTo(cx,      cy - radius - 5);
      ptr.lineTo(cx - 9,  cy - radius - 22);
      ptr.lineTo(cx,      cy - radius - 30);
      ptr.lineTo(cx + 9,  cy - radius - 22);
      ptr.closePath();
      ptr.fill({ color: 0xc9a227 });
      ptr.stroke({ color: 0xffffff, width: 1 });
      app.stage.addChild(ptr);

      // ── Ball ─────────────────────────────────────────────────────────────
      const outerTrack  = radius + 30;
      const pocketDepth = radius * 0.89;
      const glowFilter  = new BlurFilter({ strength: 8 });

      const ball = new Graphics();
      const drawBall = (g: Graphics) => {
        g.clear();
        g.circle(0, 0, 5.5);
        g.fill({ color: 0xf0ede8 });
        g.stroke({ color: 0x888880, width: 0.8 });
        // specular highlight
        g.circle(-1.8, -1.8, 2);
        g.fill({ color: 0xffffff, alpha: 0.55 });
      };
      drawBall(ball);
      ball.x = cx;
      ball.y = cy - outerTrack;
      ball.visible = false;
      app.stage.addChild(ball);

      // ── Animation state ───────────────────────────────────────────────────
      let spinAnim: SpinAnim | null = null;
      let ballAngle = -Math.PI / 2; // world angle of ball (tracks between spins)

      // ── Expose handle ─────────────────────────────────────────────────────
      canvasRef.current = {
        spin: (onDone) => {
          if (spinAnim) return;

          // Predetermined winner
          const winIdx = Math.floor(Math.random() * SEG_COUNT);

          // Calculate target wheel rotation so winIdx lands under pointer (top = -π/2)
          const targetRot = -(winIdx * SEG_ANGLE + SEG_ANGLE / 2);
          const currentRot = wheel.rotation;
          let delta = ((targetRot - (currentRot % (Math.PI * 2))) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (delta < 0.5) delta += Math.PI * 2;
          const toRot = currentRot + delta + (7 + Math.floor(Math.random() * 4)) * Math.PI * 2;

          const durationMs = 5000 + Math.random() * 1500;
          // Ball: ~8–11 full counter-clockwise orbits during the 78% orbital phase
          const ballTotalAngle = -(8 + Math.random() * 3) * Math.PI * 2;

          // Remove any glow from previous result
          if (glowTimeout) clearTimeout(glowTimeout);
          ball.filters = [];
          ball.scale.set(1);
          drawBall(ball);

          ball.visible = true;

          spinAnim = {
            fromRot: currentRot,
            toRot,
            winIdx,
            startMs:  performance.now(),
            durationMs,
            ballTotalAngle,
            ballInitAngle: ballAngle,
            dropStartAngle: null,
            onDone,
          };
        },
      };

      // ── Ticker ───────────────────────────────────────────────────────────
      // Capture non-nullable reference so TypeScript knows app is live in the callback
      const liveApp = app;
      liveApp.ticker.add((ticker) => {
        onFpsUpdate(Math.round(liveApp.ticker.FPS));
        onObjectCount(liveApp.stage.children.length);

        if (!spinAnim) {
          // Idle micro-rotation (feels alive)
          wheel.rotation += 0.00018 * ticker.deltaTime;
          return;
        }

        const elapsed = performance.now() - spinAnim.startMs;
        const t       = Math.min(elapsed / spinAnim.durationMs, 1);
        const easedT  = easeOutQuart(t);

        // Wheel
        wheel.rotation = spinAnim.fromRot + (spinAnim.toRot - spinAnim.fromRot) * easedT;

        // Ball orbital phase (0 → 0.78)
        if (t < 0.78) {
          const orbT = t / 0.78;
          // easeOutQuart for angle gives fast-start → slow-stop arc movement
          ballAngle = spinAnim.ballInitAngle + spinAnim.ballTotalAngle * easeOutQuart(orbT);
          ball.x = cx + Math.cos(ballAngle) * outerTrack;
          ball.y = cy + Math.sin(ballAngle) * outerTrack;
        } else {
          // Ball drop phase (0.78 → 1.0): falls inward, snaps to pointer (-π/2)
          if (spinAnim.dropStartAngle === null) {
            spinAnim.dropStartAngle = ballAngle;
          }
          const dropT     = (t - 0.78) / 0.22;
          const dropEased = easeInCubic(dropT);
          const r         = lerp(outerTrack, pocketDepth, dropEased);
          const a         = lerpAngle(spinAnim.dropStartAngle, -Math.PI / 2, dropEased);
          ball.x = cx + Math.cos(a) * r;
          ball.y = cy + Math.sin(a) * r;
        }

        // Spin complete
        if (t >= 1) {
          ball.x = cx + Math.cos(-Math.PI / 2) * pocketDepth;
          ball.y = cy + Math.sin(-Math.PI / 2) * pocketDepth;
          ballAngle = -Math.PI / 2;

          // Settle glow
          ball.filters = [glowFilter];
          ball.scale.set(1.8);
          glowTimeout = setTimeout(() => {
            if (!destroyed) {
              ball.filters = [];
              ball.scale.set(1);
            }
          }, 700);

          const { winIdx, onDone } = spinAnim;
          spinAnim = null;
          onDone(SEGMENTS[winIdx].label);
        }
      });
    };

    init();

    return () => {
      destroyed = true;
      canvasRef.current = null;
      if (glowTimeout) clearTimeout(glowTimeout);
      // Only destroy after init() has fully resolved — calling destroy on an
      // uninitialized PixiJS app crashes because internal hooks aren't set up yet.
      // If init() is still pending it will see destroyed=true and clean up itself.
      if (initialized && app) {
        try { app.destroy({ removeView: true }); } catch { }
      }
    };
  }, [onFpsUpdate, onObjectCount, canvasRef]);

  return <div ref={mountRef} className="w-full h-full" />;
}
