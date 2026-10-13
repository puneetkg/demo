/**
 * Funnel: an app's sales funnel as a marble run. Four ramps zigzag down a
 * backboard, one per stage: visit, install, sign-up, trial. Marbles (users)
 * roll down them; at the end of each ramp most carry on to the next, and the
 * rest roll off the front lip into a long catch tray, where they pile up for
 * the lap. The few that clear every ramp drop into the cup at the foot: paid.
 * Which marbles fall is decided per lap from each stage's pass rate.
 *
 * The run never stops. Hovering springs the clock's rate down to the slider's
 * value, so a marble can be followed; the ramp nearest the pointer slides
 * forward off the board on the lift curve, carrying its marbles, and takes the
 * bright edge with them; its stage and pass rate go to the read-out. At rest the cup is lit: it is where the funnel ends.
 *
 * Picking measures the pointer against the ramps' resting centre lines, never
 * against a ramp's slide or a marble, so a marble rolling past cannot change the choice.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, open, poly, prism, proj, r2, reducedMotion, ringAt, rings,
  rrect, run, spring, stepS, tdone, tset, tval, tween, disposer, mk, place, pointer, put, register, solid,
} = HL;

const BL = 150, BH = 112, RW = 12, RT = 2.5, R = 3.4, NM = 11, LAP = 6, SPEED = 0.55;
const NAME = ["visit", "install", "sign-up", "trial", "paid"], PASS = [0.45, 0.6, 0.55, 0.4];
/** Each ramp: x where marbles start, x where they leave, and the ramp's height at each. */
const RAMP = [[15, 135, 100, 88], [135, 15, 76, 64], [15, 135, 52, 40], [135, 15, 28, 16]];
const CUP = [-6, 8], CR = 8, CH = 11, PULL = 14;

const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
const at = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));
const rnd = (j, lap, k) => { const s = Math.sin(j * 127.1 + lap * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
const zr = (k, x) => { const [xs, xe, zs, ze] = RAMP[k]; return lerp(zs, ze, (x - xs) / (xe - xs)); };

/** An open vessel of height h: `far` is painted before the marbles, `near` (its front wall) after them. */
function vessel(P, front, outer, inner, h) {
  const far = [[poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, h)))), "sil"], [poly(ringAt(P, inner, h)), "nf"]];
  const iF = LR(ringAt(P, run(inner, front), h)), oT = LR(ringAt(P, run(outer, front), h)), oB = LR(ringAt(P, run(outer, front), 0));
  const near = [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(oT), "nf lo"],
    [open(iF), "nf"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
  ];
  return { far, near };
}

/** Where marble j is at clock time c, with each ramp pulled forward by pl[k]: world centre, its stage (-1 between or fallen), its size. */
function where(j, c, pl) {
  const q = j / NM + (c * SPEED) / LAP, lap = Math.floor(q);
  let t = (q - lap) * LAP;
  const a = clamp(Math.min(t / 0.15, (LAP - t) / 0.3), 0, 1), s = a * a * (3 - 2 * a);
  let fate = 4;
  for (let k = 3; k >= 0; k--) if (rnd(j, lap, k) > PASS[k]) fate = k;
  for (let k = 0; k < 4; k++) {
    const [xs, xe, , ze] = RAMP[k];
    const y0 = RW / 2 + pl[k];
    if (t < 1) { const x = lerp(xs, xe, t ** 1.25); return { x, y: y0, z: zr(k, x) + R, k, s }; }
    t -= 1;
    if (fate === k) {
      // off the front lip and down into the tray, rolling a little way along it
      const u = Math.min(t / 0.5, 1), lx = xe + (xe > 70 ? -1 : 1) * (4 + 24 * rnd(j, lap, 9));
      return { x: lerp(xe, lx, u), y: lerp(y0, 23, u), z: lerp(ze + R, 1 + R, u * u), k: -1, s };
    }
    if (k === 3) {
      const u = Math.min(t / 0.5, 1);
      return { x: lerp(xe, CUP[0], u), y: lerp(y0, CUP[1], u), z: lerp(ze + R, 2 + R, u * u), k: 4, s };
    }
    if (t < 0.25) { const u = t / 0.25; return { x: xe, y: lerp(y0, RW / 2 + pl[k + 1], u), z: lerp(ze + R, RAMP[k + 1][2] + R, u * u), k: -1, s }; }
    t -= 0.25;
  }
  return { x: CUP[0], y: CUP[1], z: 2 + R, k: 4, s };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let slow = value, over = null, act = -2, clock = 3.2;
  const rate = spring(1, { eps: 0.002 });

  const C = Cam(45, 0.5, 1.5);
  fit(C, [[-18, -8, -4], [156, 36, -4], [156, -8, -4], [-18, 36, -4], [0, -4, BH], [BL, -4, BH], [-18, 36, 0]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const [br, bi] = rings(-18, -8, 156, 36, 8, 2);
  put(solid(g), prism(P, front, br, bi, -4, 0));
  const [wr, wi] = rings(0, -4, BL, 0, 2, 0.8);
  put(solid(g), prism(P, front, wr, wi, 0, BH));

  // the ramps share one group, so the one sliding out (or back) can be painted last, in front of the rest
  const rg = mk("g", {}, g);
  let front0 = -1;
  const ramps = RAMP.map((Rp, k) => {
    const lo = Math.min(Rp[0], Rp[1]) - 3, hi = Math.max(Rp[0], Rp[1]) + 3;
    const outer = rrect(lo, 0, hi, RW, 3, 4), inner = rrect(lo + 1.2, 1.2, hi - 1.2, RW - 1.2, 1.8, 4);
    const el = solid(rg);
    const draw = (pl) => {
      const w = (q, dz = 0) => P(q.u, q.v + pl, zr(k, q.u) + dz);
      put(el, { sil: poly(hull(outer.map((q) => w(q)).concat(outer.map((q) => w(q, -RT))))), crease: open(run(inner, front).map((q) => w(q))) });
    };
    draw(0);
    return { el, draw, tw: tween(0), drawn: 0, a: P(lo, RW / 2, zr(k, lo) + R), b: P(hi, RW / 2, zr(k, hi) + R) };
  });

  const tray = vessel(P, front, rrect(8, 16, 142, 30, 5, 5), rrect(10, 18, 140, 28, 3, 5), 6);
  const cup = vessel(P, front, at(circ(CR, 24), ...CUP), at(circ(CR - 1.6, 24), ...CUP), CH);
  const draw = (list) => list.map(([d, cls]) => mk("path", { d, class: cls }, g));
  draw(tray.far);
  const cupFar = draw(cup.far);
  const layer = mk("g", {}, g), pool = [];
  for (let j = 0; j < NM; j++) pool.push(mk("ellipse", { rx: 0, ry: 0 }, layer));
  draw(tray.near);
  const cupNear = draw(cup.near);
  const cupMid = P(CUP[0], CUP[1], CH / 2);

  /** The ramp whose fixed centre line is nearest the pointer, or the cup (4); -1 when nothing is within reach. */
  function pick(p) {
    if (!p) return -1;
    const near = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
    };
    const d = ramps.map((r) => near(r.a, r.b)).concat(Math.hypot(p[0] - cupMid[0], p[1] - cupMid[1]));
    const best = d.indexOf(Math.min(...d));
    return d[best] < 20 ? best : -1;
  }

  function setAct(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 && a < 4 ? a : Math.max(0, Math.min(act, 3));
    act = a;
    ramps.forEach((r, k) => { r.el.sil.classList.toggle("hi", k === a); tset(r.tw, k === a ? PULL : 0, now, Math.abs(k - from) * 40); });
    const lit = a < 0 || a === 4;
    cupFar[0].classList.toggle("hi", lit);
    cupNear[3].classList.toggle("hi", lit);
    read.textContent = a < 0 ? "rest" : `0${a + 1} · ${NAME[a]}` + (a < 4 ? ` · ${Math.round(PASS[a] * 100)}%` : "");
  }

  const B = register(stage, (dt, now) => {
    stepS(rate, dt);
    const pl = ramps.map((r) => {
      const v = tval(r.tw, now);
      if (v !== r.drawn) { r.drawn = v; r.draw(v); }
      return v;
    });
    const out = pl.indexOf(Math.max(...pl)), lead = pl[out] > 0.01 ? out : -1;
    if (lead !== front0) { front0 = lead; if (lead >= 0) rg.appendChild(ramps[lead].el.g); else ramps.forEach((r) => rg.appendChild(r.el.g)); }
    if (!over) rate.t = reducedMotion() ? 0 : 1;
    clock += dt * rate.x;
    // nearer marbles last: pool order is paint order, so the sorted marbles are dealt into it
    const ms = Array.from({ length: NM }, (_, j) => where(j, clock, pl)).sort((m, n) => (m.x + m.y) * 0.61 + m.z * 0.5 - ((n.x + n.y) * 0.61 + n.z * 0.5));
    ms.forEach((m, i) => {
      const el = pool[i];
      if (m.s < 0.05) { el.setAttribute("visibility", "hidden"); return; }
      el.removeAttribute("visibility");
      place(el, P(m.x, m.y, m.z));
      el.setAttribute("rx", r2(R * C.S * 0.85 * m.s));
      el.setAttribute("ry", r2(R * C.S * 0.85 * m.s));
      el.setAttribute("class", act >= 0 && m.k === act ? "hi" : "");
    });
    return !(reducedMotion() && !over && rate.x === 0 && ramps.every((r) => tdone(r.tw, now)));
  });
  bag.add(B.unregister);

  bag.add(pointer(stage, {
    move: (p) => { over = p; rate.t = slow; setAct(pick(p)); B.wake(); },
    leave: () => { over = null; setAct(-1); B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());
  setAct(-1);

  return {
    set: (v) => { slow = v; if (over) rate.t = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "funnel",
  means: "An app's sales funnel as a marble run: users roll down each stage, some drop out, and hovering slows the run to follow one.",
  rules: [1, 4, 7, 8],
  range: [0.5, 0.25, 0.1],
  tour: [[215, 85], [215, 154], [127, 180], null],
  mount,
});
