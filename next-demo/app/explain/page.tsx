import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Technical Explanation — Royal Roulette',
  description: 'Interview prep: every technical decision explained',
};

// ── Shared typography helpers ────────────────────────────────────────────────

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-bold text-yellow-400 mb-2">{children}</h1>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-white mt-14 mb-4 pb-2 border-b border-white/10 scroll-mt-6">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-yellow-300 mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/70 leading-relaxed mb-3">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/10 text-yellow-200 text-xs rounded px-1.5 py-0.5 font-mono">
      {children}
    </code>
  );
}

function Block({ children }: { children: string }) {
  return (
    <pre className="bg-[#0a0f1e] border border-white/10 rounded-xl p-4 text-xs text-green-300 font-mono overflow-x-auto leading-relaxed mb-4 whitespace-pre">
      {children}
    </pre>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-xl px-4 py-3 text-yellow-200/80 text-sm leading-relaxed mb-4">
      <span className="font-bold text-yellow-400">Interview tip · </span>{children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-500/8 border border-blue-400/20 rounded-xl px-4 py-3 text-blue-200/80 text-sm leading-relaxed mb-4">
      {children}
    </div>
  );
}

const TOC = [
  { id: 'overview',     label: '1. Project Overview' },
  { id: 'stack',        label: '2. Tech Stack Decisions' },
  { id: 'structure',    label: '3. File Structure' },
  { id: 'pixi',         label: '4. How PixiJS Works' },
  { id: 'boundary',     label: '5. React ↔ PixiJS Boundary' },
  { id: 'animation',    label: '6. Spin & Ball Animation Math' },
  { id: 'statemachine', label: '7. Game State Machine' },
  { id: 'v8',           label: '8. PixiJS v8 API Changes' },
  { id: 'strictmode',   label: '9. StrictMode Race Condition' },
  { id: 'performance',  label: '10. Performance Design' },
  { id: 'qa',           label: '11. Interview Q&A' },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function ExplainPage() {
  return (
    <div className="min-h-screen bg-[#060e1a] text-white">
      <div className="max-w-3xl mx-auto px-5 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="text-yellow-500 text-sm font-mono mb-2 uppercase tracking-widest">Interview Prep</div>
          <H1>Technical Deep-Dive</H1>
          <P>
            Every decision in this project explained — from PixiJS fundamentals to the
            React/PixiJS boundary, animation math, state machines, and PixiJS v8 gotchas.
            Read this before your interview.
          </P>
          <div className="flex gap-3 mt-4">
            <a href="/" className="text-xs text-white/40 hover:text-white border border-white/15 hover:border-white/30 rounded-full px-3 py-1 transition-colors">
              ← Back to game
            </a>
            <span className="text-xs text-white/20 flex items-center">localhost:3000/explain</span>
          </div>
        </div>

        {/* Table of contents */}
        <div className="bg-[#0a1628] border border-white/10 rounded-2xl p-5 mb-12">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Contents</p>
          <ol className="space-y-1">
            {TOC.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`} className="text-sm text-white/60 hover:text-yellow-400 transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* ── 1. Overview ── */}
        <H2 id="overview">1. Project Overview</H2>
        <P>
          This is a roulette game UI prototype built to demonstrate frontend graphics rendering
          skills for the <strong className="text-white">Evolution Frontend Engineer — Graphics &amp; Rendering</strong> role.
          It is not a gambling product — there is no backend, no real money, and no casino licence.
          It is a technical demo of how real-time canvas animation integrates with a React product UI.
        </P>
        <P>
          The two things Evolution cares about most are: (1) smooth animations at 60 fps on
          low-end devices, and (2) understanding how to compose a React UI on top of a live
          rendering surface without the two systems fighting each other. This project demonstrates both.
        </P>
        <Note>
          When asked &ldquo;why did you build this?&rdquo; — say: &ldquo;I wanted to prove I understand
          the environment before the interview, not after. Real-time canvas rendering is different from
          typical React work, and I wanted hands-on experience with the actual tools the team uses.&rdquo;
        </Note>

        {/* ── 2. Stack ── */}
        <H2 id="stack">2. Tech Stack Decisions</H2>

        <H3>Next.js 15 (App Router)</H3>
        <P>
          Next.js is the industry-standard React framework. The App Router is the modern approach
          (replaces Pages Router). Server components render on the server; client components
          (marked <Code>&apos;use client&apos;</Code>) run in the browser. The canvas must run
          client-side — PixiJS needs <Code>window</Code> and <Code>document</Code> — so all
          graphics components are client components.
        </P>
        <Note>
          The <Code>dynamic(() =&gt; import(&apos;./GameCanvas&apos;), &#123; ssr: false &#125;)</Code> wrapper
          in <Code>page.tsx</Code> prevents Next.js from trying to server-render the canvas component,
          which would crash because PixiJS accesses browser APIs at module load time.
        </Note>

        <H3>PixiJS v8</H3>
        <P>
          PixiJS is a 2D WebGL/WebGPU rendering engine. It is the industry standard for browser-based
          game UIs — Evolution Gaming, NetEnt, and most HTML5 casino studios use it or something built
          on top of it. It gives you a GPU-accelerated scene graph, a built-in animation ticker, a
          rich Graphics drawing API, and text rendering — all without you writing a single line of GLSL.
        </P>
        <P>
          Why not plain Canvas 2D? Canvas 2D is CPU-rendered. At 60 fps with many objects it starts
          dropping frames. PixiJS batches all draw calls into as few GPU commands as possible —
          this is what lets games stay at 60 fps even on mid-range mobile GPUs.
        </P>
        <P>
          Why not Three.js? Three.js is for 3D. Its overhead for a flat 2D roulette wheel is
          unnecessary. PixiJS is leaner and its API is designed for exactly this use case.
        </P>

        <H3>TypeScript</H3>
        <P>
          All PixiJS v8 types are bundled. TypeScript catches API misuse at compile time —
          e.g. calling <Code>graphics.addChild()</Code> (v8 removed this) would be a type error.
          For a graphics-heavy codebase where PixiJS objects are passed around, types are essential.
        </P>

        <H3>Tailwind CSS v4</H3>
        <P>
          The game UI overlay (buttons, balance, history) is plain HTML styled with Tailwind.
          This keeps the React side lightweight — no CSS-in-JS overhead, no runtime style computation.
          The canvas handles all the animated graphics; Tailwind handles all the static UI chrome.
        </P>

        {/* ── 3. Structure ── */}
        <H2 id="structure">3. File Structure</H2>
        <Block>{`app/
├── page.tsx              ← React shell (game state, betting UI, layout)
├── layout.tsx            ← HTML head, metadata, font loading
├── globals.css           ← Tailwind import + body reset
├── explain/
│   └── page.tsx          ← This page (you are here)
└── components/
    ├── GameCanvas.tsx    ← PixiJS canvas (wheel, ball, animation loop)
    ├── PerformancePanel.tsx  ← FPS / object-count overlay
    └── HelpModal.tsx     ← Instructions modal`}</Block>

        <P>
          The critical separation: <Code>GameCanvas.tsx</Code> owns everything animated.
          <Code>page.tsx</Code> owns all React state. They communicate through a single
          imperative ref handle (<Code>canvasRef</Code>) — one direction only: React calls
          into the canvas, not the other way.
        </P>

        {/* ── 4. PixiJS ── */}
        <H2 id="pixi">4. How PixiJS Works</H2>

        <H3>The Application</H3>
        <P>
          The entry point to PixiJS. It owns the WebGL context, the canvas element, the scene
          graph root (stage), and the animation ticker.
        </P>
        <Block>{`const app = new Application();
await app.init({
  width:           520,
  height:          400,
  backgroundColor: 0x080f1c,   // hex colour as a number
  antialias:       true,        // smooth edges (costs a little GPU)
  resolution:      devicePixelRatio, // HiDPI / Retina support
  autoDensity:     true,        // scales CSS size to match resolution
});

document.body.appendChild(app.canvas); // <canvas> element`}</Block>
        <Callout>
          <strong>v8 change:</strong> init is now async because WebGPU adapter detection is async.
          In v7 the constructor was synchronous. Always <Code>await app.init()</Code> before
          touching <Code>app.stage</Code> or <Code>app.ticker</Code>.
        </Callout>

        <H3>The Scene Graph</H3>
        <P>
          PixiJS uses a tree of objects — exactly like the DOM. The root is <Code>app.stage</Code>.
          You add children to it. Transforms (position, rotation, scale) are inherited by children.
          When you rotate the <Code>wheel</Code> Container, all 37 segments and labels inside it
          rotate together automatically.
        </P>
        <Block>{`app.stage                    (Container — root, always exists)
 └── wheel                  (Container — rotates as one unit)
      ├── rimGlow            (Graphics — soft gold glow ring)
      ├── seg0..seg36        (Graphics × 37 — coloured segments)
      ├── lbl0..lbl36        (Text × 37 — pocket numbers)
      ├── rings              (Graphics — inner gold decoration rings)
      ├── hub                (Graphics — centre brass hub)
      └── border             (Graphics — outer double rim)
 └── ball                   (Graphics — white sphere, position updated each frame)
 └── ptr                    (Graphics — gold diamond pointer at top)`}</Block>

        <H3>The Graphics API</H3>
        <P>
          <Code>Graphics</Code> is PixiJS&apos;s immediate-mode drawing API. You describe shapes
          and call <Code>fill()</Code> or <Code>stroke()</Code> to commit them. In v8, each
          commit clears the current path and starts a new one — allowing multiple shapes
          on one Graphics object.
        </P>
        <Block>{`const seg = new Graphics();

// Draw a pie-slice (one roulette segment)
seg.moveTo(0, 0);
seg.arc(0, 0, radius, startAngle, endAngle);  // arc from centre
seg.lineTo(0, 0);                              // close back to centre
seg.fill({ color: 0xb52020 });                // red fill — commits path
seg.stroke({ color: 0x8a6800, width: 0.7 }); // gold border`}</Block>

        <H3>The Ticker (animation loop)</H3>
        <P>
          The Ticker wraps <Code>requestAnimationFrame</Code>. Every callback registered with
          <Code>app.ticker.add()</Code> runs once per frame. The callback receives a
          <Code>ticker</Code> object with a crucial property: <Code>deltaTime</Code>.
        </P>
        <Block>{`app.ticker.add((ticker) => {
  // ticker.deltaTime: ratio of actual frame duration to ideal (1/60s)
  // At 60 fps → deltaTime ≈ 1.0
  // At 30 fps → deltaTime ≈ 2.0  (frame took twice as long)
  // At 120fps → deltaTime ≈ 0.5

  // Always multiply motion by deltaTime — frame-rate independent
  wheel.rotation += 0.002 * ticker.deltaTime;

  // FPS is available on the ticker itself
  const fps = Math.round(app.ticker.FPS);
});`}</Block>
        <Note>
          &ldquo;What is delta time?&rdquo; is a common interview question. Answer: it normalizes
          animation speed across different frame rates. Without it, a game running at 30 fps
          would animate at half speed compared to 60 fps.
        </Note>

        <H3>Filters</H3>
        <P>
          Filters are GPU post-processing effects applied to a display object. We use
          <Code>BlurFilter</Code> for two purposes: the outer track glow (large blur on a
          gold circle), and the ball settle flash (brief blur on the ball when it lands).
        </P>
        <Block>{`const glowRing = new Graphics();
glowRing.circle(0, 0, radius + 34);
glowRing.fill({ color: 0x3a2a00, alpha: 0.5 });
glowRing.filters = [new BlurFilter({ strength: 18 })]; // GPU Gaussian blur

// On ball settle:
ball.filters = [new BlurFilter({ strength: 8 })];
ball.scale.set(1.8);
setTimeout(() => { ball.filters = []; ball.scale.set(1); }, 700);`}</Block>

        {/* ── 5. Boundary ── */}
        <H2 id="boundary">5. The React ↔ PixiJS Boundary</H2>
        <P>
          This is the most technically important part of the project — and the most common
          interview question area.
        </P>

        <H3>The problem</H3>
        <P>
          React&apos;s job is to own the DOM and re-render when state changes. PixiJS&apos;s job is
          to own a <Code>&lt;canvas&gt;</Code> element and draw 60 frames per second. If you put
          PixiJS animation state into React state, React would re-render 60 times per second —
          obliterating your frame budget. If React tried to manage the canvas DOM node, it would
          conflict with PixiJS&apos;s WebGL context.
        </P>

        <H3>The solution: isolate PixiJS in useEffect</H3>
        <Block>{`export default function GameCanvas({ canvasRef, onFpsUpdate }) {
  const mountRef = useRef(null);   // points to a plain <div>

  useEffect(() => {
    // 1. Runs AFTER first paint (browser has the DOM)
    const init = async () => {
      const app = new Application();
      await app.init({ width: mountRef.current.clientWidth, ... });

      // 2. Append canvas into the div — React never touches this div's children
      mountRef.current.appendChild(app.canvas);

      // 3. All animation lives in the ticker — zero React involvement
      app.ticker.add((ticker) => {
        wheel.rotation += 0.002 * ticker.deltaTime;
      });
    };

    init();

    // 4. Cleanup on unmount — destroy PixiJS, release GPU memory
    return () => { app.destroy({ removeView: true }); };
  }, []); // empty array = run once, never re-run

  return <div ref={mountRef} className="w-full h-full" />;
}`}</Block>
        <P>
          The <Code>&lt;div ref=&#123;mountRef&#125;&gt;</Code> is a stable DOM anchor.
          React creates it once and never modifies it again. PixiJS appends its canvas
          inside it — completely outside React&apos;s reconciler.
        </P>

        <H3>Imperative control via ref handle</H3>
        <P>
          The parent component needs to trigger a spin when the user clicks. We cannot
          do this with props (props changes re-run the effect). Instead we expose an
          imperative handle through a ref:
        </P>
        <Block>{`// Inside useEffect, after init():
canvasRef.current = {
  spin: (onDone) => {
    // Directly mutates closure state — no React involved
    spinAnim = { winIdx, fromRot, toRot, startMs, onDone };
  },
};

// Cleanup:
return () => { canvasRef.current = null; };`}</Block>
        <Block>{`// In page.tsx:
const canvasHandle = useRef(null);
// ...
<button onClick={() => canvasHandle.current?.spin(handleResult)}>SPIN</button>`}</Block>
        <Note>
          This is the &ldquo;escape hatch&rdquo; pattern from the React docs. Refs let you store
          mutable values that don&apos;t trigger re-renders, and they let you call imperative
          methods on external systems (PixiJS, D3, video players, etc.).
        </Note>

        <H3>Why closures don&apos;t go stale here</H3>
        <P>
          Animation state like <Code>ballAngle</Code>, <Code>spinAnim</Code>, and
          <Code>wheelContainer.rotation</Code> lives in the <Code>useEffect</Code> closure
          as plain <Code>let</Code> variables — not React state. The ticker callback and
          the <Code>spin()</Code> function both live in the same closure scope, so they
          always read the current values. No stale closure problem.
        </P>
        <P>
          If <Code>ballAngle</Code> were React state (<Code>const [ballAngle, setBallAngle] = useState(0)</Code>),
          the <Code>spin()</Code> function would capture the value at the time it was created
          (the initial render) and never see updates. This is the classic stale closure bug.
          Moving animation state out of React entirely sidesteps the problem entirely.
        </P>

        {/* ── 6. Animation ── */}
        <H2 id="animation">6. Spin &amp; Ball Animation Math</H2>

        <H3>Time-based animation with performance.now()</H3>
        <P>
          Instead of counting frames, we record the spin start time and compute normalized
          progress <Code>t</Code> from elapsed milliseconds. This makes the animation
          frame-rate independent at the design level — not just approximately via deltaTime.
        </P>
        <Block>{`const startMs = performance.now();
const durationMs = 5000 + Math.random() * 1500; // 5–6.5 seconds

// In the ticker (every frame):
const elapsed = performance.now() - startMs;
const t = Math.min(elapsed / durationMs, 1);  // 0 → 1 clamped`}</Block>

        <H3>Easing functions</H3>
        <P>
          Easing functions map linear time (0→1) to a curved output (0→1). They are the
          difference between animation that looks mechanical and animation that feels physical.
        </P>
        <Block>{`// easeOutQuart: starts fast, ends slow (like friction / deceleration)
// Slope at t=0 is 4 (fast). Slope at t=1 is 0 (stopped).
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

// easeInCubic: starts slow, ends fast (like gravity / falling)
// Slope at t=0 is 0 (still). Slope at t=1 is 3 (fast).
function easeInCubic(t)  { return t * t * t; }

// Standard linear interpolation
function lerp(a, b, t) { return a + (b - a) * t; }

// Angle lerp — takes the shortest arc (handles 359°→5° correctly)
function lerpAngle(a, b, t) {
  let d = ((b - a) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
  if (d > Math.PI) d -= Math.PI * 2; // flip to shorter direction
  return a + d * t;
}`}</Block>

        <H3>Predetermined outcome (the right technique)</H3>
        <P>
          We do NOT spin and then detect which segment is under the pointer. We pick the
          winner first, then animate the wheel to land on it. This is standard in all
          commercial slot and roulette demos — it guarantees the result is always clean.
        </P>
        <Block>{`// 1. Pick a random winner
const winIdx = Math.floor(Math.random() * 37);

// 2. Calculate what wheel rotation puts winIdx under the pointer
//    Segment i's midpoint is at: -π/2 + i*SEG_ANGLE + SEG_ANGLE/2 (at rotation 0)
//    We need it at: -π/2 (top = pointer)
//    So wheel needs to be at: -(i * SEG_ANGLE + SEG_ANGLE/2)
const targetRot = -(winIdx * SEG_ANGLE + SEG_ANGLE / 2);

// 3. Compute the delta from current rotation, normalized to [0, 2π]
const currentRot = wheel.rotation;
let delta = ((targetRot - (currentRot % (Math.PI*2))) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
if (delta < 0.5) delta += Math.PI * 2; // ensure at least a partial turn

// 4. Add drama rotations (7-10 full spins)
const toRot = currentRot + delta + (7 + Math.random()*3) * Math.PI * 2;

// 5. Animate with easeOutQuart
wheel.rotation = fromRot + (toRot - fromRot) * easeOutQuart(t);`}</Block>

        <H3>Ball orbital phase (0 → 78% of spin time)</H3>
        <P>
          The ball orbits the outer track in the opposite direction to the wheel. We use
          easeOutQuart on the total angle — giving the ball a fast initial speed that
          decelerates to a stop, mimicking friction on a real roulette bowl.
        </P>
        <Block>{`// 8–11 counter-clockwise full orbits
const totalBallAngle = -(8 + Math.random() * 3) * Math.PI * 2;

// At progress t (0 → 1 within orbital phase):
const orbT = Math.min(t / 0.78, 1);
ballAngle = ballInitAngle + totalBallAngle * easeOutQuart(orbT);

// Convert angle to canvas position
ball.x = cx + Math.cos(ballAngle) * outerTrack;
ball.y = cy + Math.sin(ballAngle) * outerTrack;`}</Block>

        <H3>Ball drop phase (78% → 100% of spin time)</H3>
        <P>
          Once the ball has slowed down (at 78%), it &ldquo;loses centrifugal force&rdquo; and
          falls inward. We use easeInCubic (accelerating) for the radius and angle —
          gravity pulls it faster as it drops.
        </P>
        <Block>{`const dropT = (t - 0.78) / 0.22;          // normalize to 0→1
const dropEased = easeInCubic(dropT);

// Radius: outerTrack → pocketDepth (radius * 0.89)
const r = lerp(outerTrack, pocketDepth, dropEased);

// Angle: wherever ball was → -π/2 (top, where winner will be)
// lerpAngle handles the shortest-path wrap-around
const a = lerpAngle(dropStartAngle, -Math.PI / 2, dropEased);

ball.x = cx + Math.cos(a) * r;
ball.y = cy + Math.sin(a) * r;`}</Block>
        <Note>
          Why does the ball always land at angle -π/2 (top)? Because we engineered the wheel
          to stop with the winning segment at the top. The ball and the wheel arrive at the
          same position independently — creating the illusion that the ball physically fell
          into the correct pocket.
        </Note>

        {/* ── 7. State machine ── */}
        <H2 id="statemachine">7. Game State Machine</H2>
        <P>
          Game phase is tracked as a discriminated union string. This pattern — modeling a
          workflow as explicit named states — is common in game UI development and avoids
          impossible combinations (e.g. you cannot be both spinning and accepting bets).
        </P>
        <Block>{`type Phase = 'betting' | 'no-more-bets' | 'spinning' | 'result';

// Transition diagram:
//
// 'betting'
//    │  user clicks SPIN
//    ▼
// 'no-more-bets'  ──── 700ms ────▶  'spinning'
//                                        │  ball settles
//                                        ▼
//                                    'result'  ──── 3200ms ────▶  'betting'`}</Block>
        <Block>{`const handleSpin = () => {
  const snappedColor = betColor; // capture before state update
  setBalance(b => b - bet);
  setPhase('no-more-bets');       // show "NO MORE BETS" overlay

  setTimeout(() => {
    setPhase('spinning');
    // Tell the canvas to start — passes a callback for the result
    canvasHandle.current?.spin((num) => handleSpinDone(num, snappedColor));
  }, 700);
};

const handleSpinDone = (num, color) => {
  // ... compute win, update history, set result
  setPhase('result');
  setTimeout(() => setPhase('betting'), 3200);
};`}</Block>
        <P>
          The <Code>snappedColor</Code> capture is important: we grab <Code>betColor</Code>
          before calling <Code>setPhase()</Code> (which schedules a re-render). By the time
          <Code>handleSpinDone</Code> is called 5+ seconds later, the user may have changed
          their bet color. The snapped value ensures we evaluate the win against what they
          actually bet on.
        </P>
        <Note>
          The &ldquo;No More Bets&rdquo; phase is not just cosmetic — it matches the real Evolution
          game flow. In live casino games there is a window after the croupier launches the
          ball when bets are still accepted, then a &ldquo;no more bets&rdquo; call. Mirroring
          this shows you understand the product domain, not just the code.
        </Note>

        {/* ── 8. v8 changes ── */}
        <H2 id="v8">8. PixiJS v8 API Changes</H2>
        <P>
          PixiJS v8 was a major rewrite (released 2024). Key differences from v7:
        </P>

        <H3>Async init</H3>
        <Block>{`// v7 — synchronous constructor
const app = new PIXI.Application({ width: 800, height: 600 });

// v8 — async init (WebGPU adapter detection is async)
const app = new Application();
await app.init({ width: 800, height: 600 });`}</Block>

        <H3>No addChild on Graphics</H3>
        <Block>{`// v7 — worked (Graphics extended Container)
const parent = new Graphics();
parent.addChild(otherGraphics); // OK

// v8 — Graphics is a leaf node, not a Container
const container = new Container();
container.addChild(graphics1);  // correct
container.addChild(graphics2);  // correct

// Or: draw multiple shapes on one Graphics object
const g = new Graphics();
g.circle(0, 0, 50); g.fill({ color: 0xff0000 }); // shape 1
g.circle(0, 0, 30); g.stroke({ color: 0xffffff }); // shape 2 on same object`}</Block>

        <H3>Text constructor</H3>
        <Block>{`// v7
const t = new PIXI.Text('Hello', { fontSize: 12, fill: 0xffffff });

// v8
const t = new Text({
  text: 'Hello',
  style: new TextStyle({ fontSize: 12, fill: 0xffffff, fontWeight: 'bold' }),
});`}</Block>

        <H3>BlurFilter constructor</H3>
        <Block>{`// v7
new PIXI.filters.BlurFilter(12); // positional args

// v8
new BlurFilter({ strength: 12 }); // options object`}</Block>

        <H3>destroy() options</H3>
        <Block>{`// v7
app.destroy(true); // boolean = removeView

// v8 — preferred (boolean still works but is confusing)
app.destroy({ removeView: true });`}</Block>

        {/* ── 9. StrictMode ── */}
        <H2 id="strictmode">9. The React StrictMode Race Condition</H2>
        <P>
          This was the runtime error shown in the browser: <Code>this._cancelResize is not a function</Code>.
          Understanding it well is a strong interview signal.
        </P>

        <H3>What StrictMode does</H3>
        <P>
          In React 18+ development mode, StrictMode intentionally runs every effect twice:
          mount → cleanup → mount. This is to help you catch side effects that aren&apos;t
          properly cleaned up. It only happens in dev mode, not production.
        </P>

        <H3>The sequence that caused the crash</H3>
        <Block>{`// First mount — init() is called and awaits app.init()
const a = new Application();
app = a;                          // app now points to a partially-constructed object
await a.init({ ... });            // ← takes ~200ms

// React StrictMode fires cleanup WHILE awaiting:
return () => {
  destroyed = true;
  app.destroy(true);              // ← CRASH: app exists but _cancelResize isn't set yet
                                  //   because init() hasn't resolved`}</Block>

        <H3>The fix: initialized flag</H3>
        <Block>{`let initialized = false;

const init = async () => {
  const a = new Application();
  app = a;
  await a.init({ ... });           // await resolves here

  if (destroyed) {
    // Cleanup already fired — safe to destroy NOW that init() is done
    try { a.destroy({ removeView: true }); } catch { }
    return;
  }

  initialized = true;             // ← set ONLY after full successful init
  el.appendChild(a.canvas);
  // ... rest of setup
};

return () => {
  destroyed = true;
  if (initialized && app) {       // only destroy a fully-initialized app
    try { app.destroy({ removeView: true }); } catch { }
  }
  // If not initialized: init() will see destroyed=true and handle it
};`}</Block>
        <Note>
          This pattern applies to any async initialization inside a useEffect. Whenever you
          <Code>await</Code> something inside an effect, ask: &ldquo;what if the cleanup fires
          before this resolves?&rdquo; The <Code>initialized</Code> flag is the standard answer.
        </Note>

        {/* ── 10. Performance ── */}
        <H2 id="performance">10. Performance Design</H2>

        <H3>Zero React re-renders during animation</H3>
        <P>
          During a 5-second spin at 60 fps, the PixiJS ticker fires 300 times. React state
          updates: 0. The only React state changes are on spin start (balance, phase)
          and spin end (result, history). Between those, React is completely idle.
        </P>
        <P>
          React&apos;s reconciler typically takes 2–5 ms when it runs. At 60 fps, your frame
          budget is 16.7 ms. If React ran every frame, it would consume 12–30% of that
          budget for no visual change — wasted work that competes with your GPU calls.
        </P>

        <H3>Geometry is built once, not redrawn</H3>
        <P>
          The wheel&apos;s 37 segments and labels are drawn into GPU-resident geometry once
          at startup. During animation, only the <Code>wheel.rotation</Code> property
          changes — PixiJS sends the updated transform matrix to the GPU, not the full
          geometry. This is O(1) per frame for the wheel, regardless of how complex it is.
        </P>

        <H3>The ball is a single Graphics object updated in-place</H3>
        <P>
          We create one <Code>Graphics</Code> circle at startup and update
          <Code>ball.x</Code> / <Code>ball.y</Code> each frame. We only call
          <Code>ball.clear()</Code> + redraw when toggling the glow on settle.
          Redrawing geometry every frame is expensive — updating a position is free.
        </P>

        <H3>FPS counter</H3>
        <P>
          <Code>app.ticker.FPS</Code> is a running average that PixiJS maintains internally.
          We sample it in the ticker and call <Code>onFpsUpdate</Code> which sets React state
          once per frame. This is fine because it&apos;s a cheap single-number update that
          React can batch. The PerformancePanel is the interviewer&apos;s signal that you
          think about frame budgets proactively.
        </P>

        <H3>What I would improve for production</H3>
        <P>
          The following were omitted from the demo for scope, but are the correct next steps:
        </P>
        <ul className="list-disc list-inside text-white/70 space-y-2 mb-4 ml-2">
          <li><strong className="text-white">Object pooling</strong> — pre-allocate particle/chip Graphics objects and recycle them instead of creating/destroying, to eliminate garbage collection spikes mid-animation.</li>
          <li><strong className="text-white">WebGL shader for glow</strong> — the BlurFilter runs a multi-pass Gaussian blur on the GPU. A custom GLSL fragment shader for the glow would be a single pass, faster on mobile GPUs.</li>
          <li><strong className="text-white">Chrome DevTools flame chart profiling</strong> — the Performance tab shows exactly which functions consume frame time. You can verify that JS work fits in the 16 ms budget and identify if you are GPU-bound or CPU-bound.</li>
          <li><strong className="text-white">ResizeObserver for responsive canvas</strong> — currently the canvas size is set once at mount. A ResizeObserver would redraw the wheel at the correct size on viewport change.</li>
          <li><strong className="text-white">Sprite atlas</strong> — if the number labels were sprites (pre-rendered to a texture atlas) instead of Text objects, rendering would be faster because fewer draw calls are needed.</li>
        </ul>

        {/* ── 11. Q&A ── */}
        <H2 id="qa">11. Interview Q&amp;A</H2>

        {[
          {
            q: 'What is requestAnimationFrame and why does it matter?',
            a: "requestAnimationFrame (rAF) is a browser API that schedules a callback to run just before the next screen repaint. Unlike setInterval, it synchronises with the display refresh rate (60/120/144 Hz), pauses when the tab is hidden (saving CPU/battery), and gives the browser control over frame timing. PixiJS's Ticker wraps rAF — you don't call it directly, but that's what's running under the hood.",
          },
          {
            q: 'What is the difference between WebGL and Canvas 2D?',
            a: "Canvas 2D is a CPU-rendered API — every draw call is processed on the CPU and copied to the framebuffer. WebGL is GPU-rendered — draw calls compile to GPU commands (shaders) that run in massively parallel hardware. For a scene with many objects updating 60×/second, WebGL is significantly faster. PixiJS uses WebGL (or WebGPU in v8) automatically.",
          },
          {
            q: 'What is a scene graph?',
            a: "A scene graph is a tree where each node is a renderable object. Parent transforms (position, rotation, scale) are inherited by children. In PixiJS, when you rotate the wheel Container, all 37 segment Graphics and 37 Text labels rotate automatically. Without a scene graph you would have to manually compute each object's world transform every frame.",
          },
          {
            q: "Why didn't you use React state for the animation?",
            a: "React state triggers a re-render on every change. At 60 fps that would be 60 re-renders per second — each invoking the reconciler, diffing the virtual DOM, and committing updates. The frame budget is 16.7 ms. React's reconciler takes 2–5 ms. That's 12–30% of the budget consumed for no visual change, competing with the actual GPU work. Animation state lives in the useEffect closure as plain variables, mutated directly by the ticker. React is only involved at spin-start and spin-end.",
          },
          {
            q: 'How do you ensure the ball lands on the correct pocket?',
            a: "Predetermined outcome. We pick the winning segment randomly at spin-start, then calculate the exact wheel rotation needed to place that segment under the pointer when the easing function reaches t=1. The ball animation is engineered to arrive at angle -π/2 (the pointer position) at the same moment. The two movements converge on the same point, creating the appearance that the ball physically fell into the pocket.",
          },
          {
            q: 'What is delta time and why do you use it?',
            a: "Delta time is the ratio of the actual frame duration to the ideal frame duration (1/60s). At 60 fps it's ~1.0; at 30 fps it's ~2.0. By multiplying all motion by delta time, the animation runs at the same perceived speed regardless of frame rate. Without it, users on slower devices would see slower-moving wheels — or users on 120 Hz displays would see double-speed wheels.",
          },
          {
            q: 'What is the React StrictMode double-invoke and how did you handle it?',
            a: "In dev mode, React 18+ intentionally mounts → unmounts → remounts every component to catch side effects. This caused our cleanup (destroy()) to fire while await app.init() was still pending — PixiJS crashed because internal state like _cancelResize hadn't been set up yet. Fix: an 'initialized' flag that is set only after init() resolves. The cleanup skips destroy() if not initialized; init() checks 'destroyed' after awaiting and self-destructs if cleanup already fired. This is the general pattern for any async init inside a useEffect.",
          },
          {
            q: 'How would you profile this for a performance regression?',
            a: "Chrome DevTools Performance tab: record a spin, look at the flame chart. Each frame should show a thin rAF → PixiJS Ticker bar with room to spare in the 16 ms budget. If JS bars are tall, find the hottest function. If 'Rendering' or 'GPU' rows are full, you're GPU-bound and need to reduce draw calls or shader complexity. PixiJS also has an official DevTools browser extension that shows scene graph, draw call count, and texture memory.",
          },
          {
            q: 'What is the difference between easeOutQuart and easeInCubic?',
            a: "easeOutQuart (1-(1-t)^4) has a steep initial slope and flattens to zero — fast start, gradual stop. Used for the wheel deceleration and ball orbital slowdown (simulating friction). easeInCubic (t^3) has zero initial slope and steepens — slow start, fast finish. Used for the ball's inward drop (simulating gravity — it accelerates as it falls).",
          },
          {
            q: "Why PixiJS and not Three.js or raw WebGL?",
            a: "Three.js is a 3D engine with overhead that's unnecessary for a 2D roulette wheel. Raw WebGL would require writing GLSL shaders, managing buffers, and building a scene graph from scratch — weeks of work for no end-user benefit. PixiJS is purpose-built for 2D: it has a polished scene graph, built-in batching, text rendering, and a Graphics API that maps naturally to the shapes we need. It's also what Evolution and most HTML5 game studios actually use.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="mb-6 bg-[#0a1628] rounded-xl border border-white/8 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/8 bg-black/20">
              <p className="text-yellow-300 font-semibold text-sm">{q}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-white/65 text-sm leading-relaxed">{a}</p>
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="text-white/20 text-xs">Game UI prototype · no real money · React + PixiJS v8</p>
          <a href="/" className="mt-3 inline-block text-yellow-500/60 hover:text-yellow-400 text-xs transition-colors">
            ← Back to the game
          </a>
        </div>

      </div>
    </div>
  );
}
