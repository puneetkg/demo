/**
 * Presence: an executive presence coaching app, taken apart as a phone. Four
 * plates float over one another: drills at the base (the practice scenarios),
 * the coach's score dial, the voice layer's mic and waveform, and the glass
 * screen with its notch, record button and home bar. The pointer's x opens
 * the stack on one spring; its y picks a layer, which slides forward out of
 * the stack on the lift curve and takes the bright edge.
 * At rest the stack sits slightly open and the voice layer is lit, because
 * speaking is what the app is about. The slider is the full gap, in units.
 *
 * Picking reads each layer's middle where it will be once the spring lands
 * (the target gap) and before any slide, never where it is drawn, so an
 * opening stack or a sliding layer cannot pull a layer out from under the
 * pointer.
 */
const {
  Cam, circ, clamp, tdone, tset, tval, tween, extremes, facing, fit, open, poly, prism, proj, ringAt, rings, rrect, seg,
  spring, stepS, disposer, mk, pointer, put, register, solid,
} = HL;

const W = 64, L = 128, REST = 0.45, GMAX = 40, SL = 26;
/** Bottom to top. r: footprint x0, y0, x1, y1; rad: corner radius; tk: thickness. */
const LAY = [
  { name: "drills", r: [0, 0, W, L], rad: 11, tk: 6 },
  { name: "coach", r: [6, 10, W - 6, L - 10], rad: 7, tk: 2.4 },
  { name: "voice", r: [10, 56, W - 10, L - 16], rad: 6, tk: 2.4 },
  { name: "screen", r: [0, 0, W, L], rad: 11, tk: 1.8 },
];
const Z0 = LAY.map((_, i) => LAY.slice(0, i).reduce((s, l) => s + l.tk, 0));
const WAVE = [3, 7, 12, 6, 16, 10, 5, 13, 8, 4];
const at = (ring, cx, cy) => ring.map((q) => ({ ...q, u: q.u + cx, v: q.v + cy }));

/** What each plate carries on its top face, at height z: [d, class] pairs that make it that part. */
function marks(P, i, z) {
  const ln = (x0, y0, x1, y1) => seg(P(x0, y0, z), P(x1, y1, z));
  const loop = (ring, cls) => [poly(ringAt(P, ring, z)), cls];
  if (i === 0) return [10, 34, 58, 82].map((y) => loop(rrect(10, y, W - 10, y + 16, 3, 4), "nf lo"));
  if (i === 1) {
    const dial = at(circ(15, 32), 32, 44);
    return [
      loop(dial, "nf lo"),
      [open(ringAt(P, dial.slice(0, 23), z)), "nf"],
      [ln(18, 74, 46, 74) + ln(18, 82, 40, 82) + ln(18, 90, 44, 90), "nf lo"],
    ];
  }
  if (i === 2) {
    const wave = WAVE.map((h, k) => ln(15 + k * 3.8, 94 - h / 2, 15 + k * 3.8, 94 + h / 2)).join("");
    return [loop(rrect(27, 62, 37, 80, 5, 5), "nf"), [ln(32, 80, 32, 84), "nf lo"], [wave, "nf"]];
  }
  return [
    loop(rrect(24, 6, 40, 11, 2.5, 4), "nf"),
    loop(at(circ(8, 24), 32, 98), "nf lo"),
    loop(at(circ(5, 20), 32, 98), "nf"),
    [ln(24, 121, 40, 121), "nf lo"],
  ];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let GAP = value, act = -1, last = null, drawn = "";
  const e = spring(REST, { eps: 0.002 });
  const z = (i, x) => Z0[i] + i * GAP * x;

  // Fitted to the widest open stack the slider allows, so no pose leaves the frame.
  const C = Cam(45, 0.5, 1.6), top = Z0[3] + 3 * GMAX + LAY[3].tk;
  fit(C, [[0, 0, 0], [W, L + SL, 0], [W, 0, 0], [0, L + SL, 0], [0, 0, top], [W, 0, top], [0, L + SL, top]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const els = LAY.map((Ly, i) => {
    const [ring, inner] = rings(...Ly.r, Ly.rad, 1.4);
    // The guide is appended before its plate: paint order is what hides it.
    const guide = i > 0 ? mk("path", { class: "nf dash" }, g) : null;
    const el = solid(g);
    const mk0 = marks(P, i, 0).map(([, cls]) => mk("path", { class: cls }, el.g));
    return { ring, inner, ext: extremes(P, ring), guide, el, mk: mk0, tw: tween(0) };
  });

  /** The layer whose middle, at the target gap, is nearest the pointer's height; -1 off the phone. */
  function pick(p) {
    if (!p) return -1;
    const mid = LAY.map((Ly, i) => P((Ly.r[0] + Ly.r[2]) / 2, (Ly.r[1] + Ly.r[3]) / 2, z(i, e.t) + Ly.tk));
    const xs = [P(0, L, 0)[0], P(W, 0, 0)[0]];
    if (p[0] < xs[0] - 8 || p[0] > xs[1] + 8) return -1;
    if (p[1] < P(0, 0, z(3, e.t))[1] - 12 || p[1] > P(W, L, 0)[1] + 8) return -1;
    let best = 0;
    mid.forEach((m, i) => { if (Math.abs(m[1] - p[1]) < Math.abs(mid[best][1] - p[1])) best = i; });
    return best;
  }

  function setAct(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    els.forEach((E, i) => {
      E.el.sil.classList.toggle("hi", a < 0 ? i === 2 : i === a);
      tset(E.tw, i === a ? SL : 0, now, Math.abs(i - from) * 40);
    });
    read.textContent = a < 0 ? "rest" : `0${a + 1} · ${LAY[a].name}`;
    B.wake();
  }

  const B = register(stage, (dt, now) => {
    let m = stepS(e, dt);
    const sl = els.map((E) => { if (!tdone(E.tw, now)) m = true; return tval(E.tw, now); });
    const key = e.x + "," + sl.join(",");
    if (key === drawn) return m;
    drawn = key;
    LAY.forEach((Ly, i) => {
      const E = els[i], zi = z(i, e.x), zt = zi + Ly.tk, Ps = (x, y, h) => P(x, y + sl[i], h);
      put(E.el, prism(Ps, front, E.ring, E.inner, zi, zt));
      marks(Ps, i, zt).forEach(([d], k) => E.mk[k].setAttribute("d", d));
      if (E.guide) {
        const zp = z(i - 1, e.x) + LAY[i - 1].tk;
        E.guide.setAttribute("d", E.ext.map((q) => seg(Ps(q.u, q.v, zi), Ps(q.u, q.v, zp))).join(""));
      }
    });
    return m;
  });
  bag.add(B.unregister);

  bag.add(pointer(stage, {
    move: (p) => { last = p; e.t = REST + (1 - REST) * clamp((p[0] - 110) / 200, 0, 1); setAct(pick(p)); },
    leave: () => { last = null; e.t = REST; setAct(-1); },
  }));
  bag.add(() => svg.replaceChildren());
  act = 0;
  setAct(-1);

  return {
    set: (v) => { GAP = v; drawn = ""; if (last) setAct(pick(last)); B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "presence",
  means: "A speaking coach taken apart: drills, coach, voice and screen float open, and the layer under the pointer lights up.",
  rules: [1, 2, 4, 6, 9],
  range: [18, 28, 40],
  tour: [[240, 120], [185, 196], [250, 215], null],
  mount,
});
