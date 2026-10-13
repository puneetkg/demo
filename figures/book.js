/**
 * Book: an open hardback lying on its covers, a page block on each side and
 * fourteen leaves hinged at the spine. Where the pointer crosses the book is
 * how far in it is open: leaves before that point lie turned to the left,
 * leaves after it lie on the right, and the few nearest it stand up between,
 * curling at the free edge the way a turning page lags behind its hinge. Each
 * leaf's angle is its own spring, so the fan follows the hand as one wave.
 * A ribbon bookmark hangs from the spine over the bottom edge, and is the lit
 * mark at rest; when the pointer turns pages, the bright edge goes to the leaf
 * standing nearest upright. The slider is the fan's width, in leaves.
 *
 * Picking reads the pointer on the cover plane, which never moves, so a leaf
 * swinging past cannot change where the book is open.
 */
const {
  Cam, clamp, facing, fit, lerp, poly, prism, proj, rad, rings, rrect, seg, spring, stepS, unproj,
  disposer, mk, pointer, put, register, solid,
} = HL;

const N = 14, W = 66, H = 96, CT = 2.2, Z = 7, PAGES = 312, REST = 0.36;
const PAGE = rrect(0, 0, W, H, 3, 3);
/** The view's slope across the spine, in degrees: leaves are painted from the farthest angle from it to the nearest, so each covers the ones it should. */
const EYE = 39;
const LINES = Array.from({ length: 11 }, (_, k) => 12 + k * 7);

/** Where leaf points sit at angle th (0 lies right, 180 lies left): x and z at distance u from the spine, bent so the free edge lags. */
function bend(th) {
  const pts = [[0, 0]], n = 8, du = W / n;
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, a = rad(th - 24 * Math.sin(rad(th)) * t ** 1.5);
    x += Math.cos(a) * du; z += Math.sin(a) * du;
    pts.push([x, z]);
  }
  return (u) => {
    const f = clamp(u / du, 0, n - 1e-6), i = Math.floor(f), w = f - i;
    return [lerp(pts[i][0], pts[i + 1][0], w), lerp(pts[i][1], pts[i + 1][1], w)];
  };
}

/** The angle leaf i takes when the book is open at kc leaves, with a fan s leaves wide. */
const target = (i, kc, s) => 180 * clamp(0.5 + (kc - i - 0.5) / s, 0, 1);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let fan = value, kc = REST * N, act = false;

  const C = Cam(45, 0.5, 1.75);
  fit(C, [[-W - 3, -3, 0], [W + 3, H + 3, 0], [W + 3, -3, 0], [-W - 3, H + 3, 0], [0, 0, Z + W * 0.9], [0, H, Z + W * 0.9], [3, H + 6, -10]], 200, 172);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // covers, then the page blocks: left before right, since right is nearer
  for (const [x0, y0, x1, y1, z0, z1, r] of [[-W - 3, -3, -0.5, H + 3, 0, CT, 4], [0.5, -3, W + 3, H + 3, 0, CT, 4], [-W, 0, -1, H, CT, Z, 3], [1, 0, W, H, CT, Z, 3]]) {
    const [ring, inner] = rings(x0, y0, x1, y1, r, 1.2);
    put(solid(g), prism(P, front, ring, inner, z0, z1));
  }

  // leaves: each a group, re-sorted whenever their angles change which covers which
  const lg = mk("g", {}, g);
  const leaves = Array.from({ length: N }, (_, i) => {
    const grp = mk("g", {}, lg), th = target(i, kc, fan);
    return { grp, sp: spring(th, { eps: 0.05 }), out: mk("path", { class: "sil" }, grp), text: mk("path", { class: "nf lo" }, grp), drawn: NaN };
  });
  let order = "";

  // the ribbon: from the open page, over the block's bottom edge, down past the cover
  const RIB = [[H - 16, Z + 0.3], [H + 0.4, Z + 0.3], [H + 1.6, Z - 2], [H + 2.4, CT + 0.3], [H + 3.4, CT + 0.3], [H + 5, -4], [H + 6, -10]];
  const side = (x) => RIB.map(([y, z]) => P(x, y, z));
  const tip = P(2.6, H + 5.2, -7.5);
  const ribbon = mk("path", { class: "sil", d: poly([...side(1.2), tip, ...side(4).reverse()]) }, g);

  function drawLeaf(L, th) {
    const b = bend(th), w = (u, y) => { const [x, z] = b(u); return P(x, y, Z + z); };
    L.out.setAttribute("d", poly(PAGE.map((q) => w(q.u, q.v))));
    L.text.setAttribute("d", LINES.map((y, k) => seg(w(7, y), w(k % 4 === 3 ? W * 0.55 : W - 7, y))).join(""));
  }

  let lit = -1;
  function light() {
    // the leaf standing nearest upright, read from the targets so the bright edge does not hop mid-swing
    let best = -1;
    if (act) leaves.forEach((L, i) => { const d = Math.abs(L.sp.t - 90); if (d < 80 && (best < 0 || d < Math.abs(leaves[best].sp.t - 90))) best = i; });
    if (best === lit) return;
    lit = best;
    leaves.forEach((L, i) => L.out.classList.toggle("hi", i === best));
    ribbon.classList.toggle("hi", !act);
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const L of leaves) {
      if (stepS(L.sp, dt)) m = true;
      const th = Math.round(L.sp.x * 20) / 20;
      if (th !== L.drawn) { L.drawn = th; drawLeaf(L, th); }
    }
    const sorted = leaves.map((L, i) => [i, -Math.abs(L.drawn - EYE)]).sort((a, b) => a[1] - b[1]);
    const sig = sorted.map((e) => e[0]).join();
    if (sig !== order) { order = sig; sorted.forEach(([i]) => lg.appendChild(leaves[i].grp)); }
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    leaves.forEach((L, i) => { L.sp.t = target(i, kc, fan); });
    light();
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      const [x, y] = unproj(C, p[0], p[1], CT);
      act = x > -W - 12 && x < W + 12 && y > -14 && y < H + 14;
      kc = act ? clamp((x + W) / (2 * W), 0, 1) * N : REST * N;
      read.textContent = act ? `p. ${Math.round(4 + (kc / N) * (PAGES - 8))}` : "rest";
      retarget();
    },
    leave: () => { act = false; kc = REST * N; read.textContent = "rest"; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";
  lit = -2;
  light();

  return {
    set: (v) => { fan = v; retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "book",
  means: "An open book: its pages turn where the pointer crosses it, standing up in a fan that follows the hand.",
  rules: [1, 3, 5, 8],
  range: [1.5, 3, 5],
  tour: [[120, 172], [212, 196], [278, 232], null],
  mount,
});
