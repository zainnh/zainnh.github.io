(function () {
  const svg = document.getElementById("agent-scene");
  if (!svg) return;

  const $ = (id) => document.getElementById(id);

  const pauseBtn = $("pause-btn");
  const replayBtn = $("replay-btn");
  const cursor = $("ide-cursor");
  const head = $("head");
  const eye = $("eye");
  const motionLines = [1, 2, 3].map((i) => $(`motion-${i}`));

  // Lines of "code" on the monitor: start point, end point, and when they get typed.
  const CODE = [
    { el: $("code-1"), x1: 125, y1: 87.4, x2: 158, y2: 92, from: 0, to: 1000 },
    { el: $("code-2"), x1: 125, y1: 101.4, x2: 170, y2: 105, from: 1150, to: 2500 },
    { el: $("code-3"), x1: 133, y1: 115.5, x2: 163, y2: 116.1, from: 2650, to: 3550 },
    { el: $("code-4"), x1: 133, y1: 129, x2: 152, y2: 128.2, from: 3700, to: 4300 },
  ];
  const TYPE_END = 4300; // last keystroke
  const HOLD_END = 5900; // pause to read it back
  const CYCLE = 6500; // screen clears, start over

  // Arms are redrawn each frame from shoulder -> elbow -> wrist so the hand,
  // forearm, and elbow always stay connected.
  const ARMS = [
    {
      path: $("arm-near-path"),
      hand: $("hand-near"),
      fingers: [1, 2, 3].map((i) => $(`nf-${i}`)),
      shoulder: [326, 134],
      elbow: [312, 176],
      wrist: [252, 158],
      phase: 0,
    },
    {
      path: $("arm-far-path"),
      hand: $("hand-far"),
      fingers: [1, 2, 3].map((i) => $(`ff-${i}`)),
      shoulder: [308, 136],
      elbow: [290, 168],
      wrist: [232, 155],
      phase: 2.4,
    },
  ];

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let rafId = null;
  let paused = false;
  let startTime = null;
  let phaseOffset = 0;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const r = (v) => v.toFixed(2);

  // 1 while typing, eases to 0 while he stops to read the screen.
  function typingIntensity(c) {
    if (c < TYPE_END) return clamp01(c / 200);
    return clamp01(1 - (c - TYPE_END) / 250);
  }

  function drawArms(t, intensity) {
    ARMS.forEach((arm) => {
      const dx = Math.sin(t * 0.0035 + arm.phase) * 2.5 * intensity;
      const dy = Math.sin(t * 0.021 + arm.phase) * 1.3 * intensity;
      const [sx, sy] = arm.shoulder;
      const ex = arm.elbow[0] + dx * 0.25;
      const ey = arm.elbow[1] + dy * 0.3;
      const wx = arm.wrist[0] + dx;
      const wy = arm.wrist[1] + dy;
      arm.path.setAttribute("d", `M ${sx} ${sy} L ${r(ex)} ${r(ey)} L ${r(wx)} ${r(wy)}`);
      arm.hand.setAttribute("transform", `translate(${r(dx)} ${r(dy)})`);
      arm.fingers.forEach((finger, i) => {
        const lift = Math.max(0, Math.sin(t * 0.03 + i * 2.1 + arm.phase)) * 2.6 * intensity;
        finger.setAttribute("transform", `translate(0 ${r(-lift)})`);
      });
    });
  }

  function drawMotionLines(t, intensity) {
    motionLines.forEach((line, i) => {
      const wave = Math.max(0, Math.sin(t * 0.012 - i * 0.9));
      line.setAttribute("opacity", r(wave * 0.9 * intensity));
    });
  }

  function drawHead(t, intensity) {
    const sway = Math.sin(t * 0.0016) * 0.8;
    const nod = Math.sin(t * 0.021) * 0.3 * intensity;
    const lookUp = (1 - intensity) * 2;
    head.setAttribute("transform", `rotate(${r(sway + nod + lookUp)} 310 108)`);
    eye.setAttribute("ry", t % 3800 < 130 ? "0.3" : "1.8");
  }

  function drawCode(t, c) {
    const fade = c > HOLD_END ? 1 - (c - HOLD_END) / (CYCLE - HOLD_END) : 1;
    let tip = CODE[0];
    let tipProgress = 0;

    CODE.forEach((line) => {
      const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
      const steps = Math.max(1, Math.round(length / 3.5));
      const raw = clamp01((c - line.from) / (line.to - line.from));
      const p = Math.floor(raw * steps) / steps; // advance one "character" at a time
      line.el.setAttribute("x2", r(line.x1 + (line.x2 - line.x1) * p));
      line.el.setAttribute("y2", r(line.y1 + (line.y2 - line.y1) * p));
      line.el.setAttribute("opacity", p > 0 ? r(fade) : "0");
      if (c >= line.from) {
        tip = line;
        tipProgress = p;
      }
    });

    const tipX = tip.x1 + (tip.x2 - tip.x1) * tipProgress;
    const tipY = tip.y1 + (tip.y2 - tip.y1) * tipProgress;
    cursor.setAttribute("x", r(tipX + (tipProgress > 0 ? 4 : -1.5)));
    cursor.setAttribute("y", r(tipY - 4));
    const blink = c < TYPE_END ? 1 : Math.floor(t / 420) % 2;
    cursor.setAttribute("opacity", r(blink * fade));
  }

  function frameAt(t) {
    const c = t % CYCLE;
    const intensity = typingIntensity(c);
    drawArms(t, intensity);
    drawMotionLines(t, intensity);
    drawHead(t, intensity);
    drawCode(t, c);
  }

  // Static frame for prefers-reduced-motion: everything typed, hands at rest.
  function showFinalFrame() {
    frameAt(HOLD_END - 1);
    cursor.setAttribute("opacity", "1");
    eye.setAttribute("ry", "1.8");
    motionLines.forEach((line) => line.setAttribute("opacity", "0"));
  }

  function loop(ts) {
    if (!paused) {
      if (startTime === null) startTime = ts - phaseOffset;
      frameAt(ts - startTime);
    }
    rafId = requestAnimationFrame(loop);
  }

  function play() {
    if (rafId) cancelAnimationFrame(rafId);
    if (reducedMotion.matches) {
      showFinalFrame();
      pauseBtn.disabled = true;
      replayBtn.disabled = true;
      return;
    }
    pauseBtn.disabled = false;
    replayBtn.disabled = false;
    paused = false;
    startTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function setPauseLabel() {
    pauseBtn.textContent = paused ? "play" : "pause";
    pauseBtn.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
  }

  pauseBtn.addEventListener("click", () => {
    if (reducedMotion.matches) return;
    if (paused) {
      // Pick up exactly where we stopped instead of jumping ahead.
      paused = false;
      startTime = null;
    } else {
      if (startTime !== null) phaseOffset = performance.now() - startTime;
      paused = true;
    }
    setPauseLabel();
  });

  replayBtn.addEventListener("click", () => {
    phaseOffset = 0;
    paused = false;
    setPauseLabel();
    play();
  });

  reducedMotion.addEventListener("change", play);

  play();
})();
