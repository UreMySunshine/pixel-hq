// A pixel-art office, seen from the front: a slate wall with two city windows and a server rack in the corner, a water cooler,
// a tiled floor lit by the windows. Everything snaps to a 4px grid and is built from rectangles; lights twinkle with native .loop().
// The wall, windows and floor are drawn for night or day (the layout's light and dark themes); the screens and gadgets stay as they are.
import { div } from "gpui-kit";
import { isDay } from "./palette.js";

const U = 4;
const snap = (v) => Math.round(v / U) * U;
const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

function ellipse(cx, cy, rx, ry, c) {
  const out = [];
  for (let dy = -ry; dy < ry; dy += U) {
    const half = snap(rx * Math.sqrt(Math.max(0, 1 - ((dy + U / 2) / ry) ** 2)));
    if (half > 0) out.push(r(cx - half, cy + dy, half * 2, U, c));
  }
  return out;
}

// A server corner on the wall: two racks full of blinking status lights, and a holographic world map floating above a projector.
const LIGHTS = ["#f4723a", "#f9d23c", "#8fcb4f", "#37c5d6", "#c678dd", "#f38ba8"];
const LIGHTS_DAY = ["#fab387", "#f9e2af", "#a6e3a1", "#89dceb", "#cba6f7", "#f38ba8"]; // Catppuccin Mocha pastels
const WORLD = [
  "....XXXX.....XXXXXX..",
  "...XXXXXXX..XXXXXXXXX",
  "....XXXXXX...XXXXXXX.",
  ".....XXXX.....XXXXX..",
  ".......XX......XXX...",
  ".......XXX.....XX....",
  "........XX....X......",
];
function ledWall(x, w, base) {
  // Two LED code screens on the right wall, set at an angle: 4px strips that step down a little further each time.
  // The screens stay dark so the code reads as glowing LEDs; by day the cabinet frame is a pale mauve and the
  // panel a softer slate than night, so the rack sits in the sunlit wall without becoming a black slab.
  const day = isDay();
  const bezel = day ? "#9c94c2" : "#0a0c1a";
  const screen = day ? "#313244" : "#10132a";
  const lip = day ? "#b3add0" : "#2a2f55";
  const lights = day ? LIGHTS_DAY : LIGHTS;
  const o = [], top = 12, n = Math.floor(w / U), nA = Math.max(2, Math.round(n * 0.45));
  const ph = base - top - Math.round(n * 0.7) - 4;
  if (day) o.push(div().absolute().left(0).top(0).w(1).h(1).children([
    r(x - 12, top - 10, w + 24, ph + 24, "#89dceb26"), r(x - 8, top - 8, w + 16, ph + 18, "#cba6f730"),
    r(x - 4, top - 4, w + 8, ph + 10, "#89dceb40"),
  ]).loop("opacity", { from: 0.55, to: 1, period: 2600, easing: "ease-in-out" }));
  for (let i = 0; i < n; i++) {
    const inA = i < nA, j = inA ? i : i - nA, dy = inA ? Math.round(j * 0.25) : Math.round(j * 0.75) - 2;
    const cx0 = x + i * U + (inA ? 0 : 2);
    if (j === 0) o.push(r(cx0 - 3, top + dy - 3, 3, ph + 6, bezel));
    o.push(r(cx0, top + dy - 3, U, ph + 6, bezel), r(cx0, top + dy, U, ph, screen), r(cx0, top + dy, U, 3, lip));
    for (let row = 0; row < Math.floor((ph - 8) / 6); row++) {
      const seg = i + row * 3 + (inA ? 0 : 7);
      if (seg % 3 === 2 || rnd(row * 13 + Math.floor(seg / 3) * 5 + (inA ? 0 : 99)) < 0.22) continue;
      const bar = r(cx0, top + dy + 6 + row * 6, U, 3, lights[Math.floor(rnd(row * 3 + Math.floor(seg / 3) * 7) * lights.length)]);
      o.push((row + i) % 7 === 0 ? bar.loop("opacity", { from: 0.35, to: 1, period: 900 + ((row * 130 + i * 90) % 900), easing: "ease-in-out" }) : bar);
    }
  }
  // The projector pad stands in front of the screens, a green hologram of the world above it.
  const hx = x + Math.floor((w - 40) / 2), hy = base - 14;
  const beamC = day ? "#89dceb80" : "#6fe0f01c", mapC = day ? "#a6e3a1" : "#7be495";
  const beam = [];
  for (let i = 0; i < 4; i++) beam.push(r(hx + 6 - i * 3, hy - 4 - i * 5, 28 + i * 6, 5, beamC));
  const map = [];
  WORLD.forEach((line, yy) => [...line].forEach((ch, xx) => { if (ch === "X") map.push(r(hx - 6 + xx * 2, hy - 30 + yy * 3, 2, 3, mapC)); }));
  o.push(
    div().absolute().left(0).top(0).w(1).h(1).children(beam).loop("opacity", { from: 0.5, to: 1, period: 2400, easing: "ease-in-out" }),
    r(hx, hy, 40, 14, "#aab4d6"), r(hx, hy, 40, 3, "#d3d8ea"), r(hx + 4, hy - 3, 32, 5, day ? "#89dceb" : "#6fe0f0"), r(hx + 4, hy + 8, 6, 3, day ? "#f9e2af" : "#e8d44a"), r(hx + 28, hy + 8, 8, 3, day ? "#94e2d5" : "#37c5d6"),
    div().absolute().left(0).top(0).w(1).h(1).children(map).loop("opacity", { from: 0.55, to: 1, period: 2200, easing: "ease-in-out" }),
  );
  return o;
}

export const yHorizon = (H) => snap(snap(H) * 0.3); // where the wall ends and the floor begins

// The wall, windows and floor by time of day. Night: a dark city under a moon. Day: a pale sky, a sun, sunlit floor —
// walls and tiles carry the same mauve tint as the night walls, so the neon reads on both.
const NIGHT = {
  wall: "#262a42", ceil: "#161827", band: "#2c3150", bandTop: "#363c5f", skirt: "#171a2c",
  frame: "#0c0e1c", sky: "#0e1226", glint: "#f5e9b0", moon: "#d9cf9a", bldg: "#161b36", pane: "#e0b94a", glass: "#ffffff0d", sill: "#7e86ad",
  clockRim: "#8e94b2", clockFace: "#d8dcee", hand: "#2a2d44", signBg: "#2a2f4a", sign: "#89b4fa",
  floor: "#242843", grout: "#1c1f36", edge: "#0d0f1a", pool: "#ffffff07",
};
const DAY = {
  wall: "#e2dff0", ceil: "#cbc6e0", band: "#d6d1ea", bandTop: "#bfb8dc", skirt: "#b0a8d2",
  frame: "#5b5480", sky: "#b7cdf5", glint: "#f9e2af", moon: "#f2c94c", bldg: "#8f92c4", pane: "#fab387", glass: "#ffffff59", sill: "#a49cc8",
  clockRim: "#9c94c2", clockFace: "#ffffff", hand: "#3c3a54", signBg: "#1e1e2e", sign: "#89dceb",
  floor: "#d5d1e8", grout: "#bdb7d8", edge: "#a49cc8", pool: "#fff3b866",
};

export function scene(W, H) {
  W = snap(W); H = snap(H);
  const p = isDay() ? DAY : NIGHT;
  const yH = yHorizon(H);
  const base = yH - 8; // the top of the baseboard: things stand on it
  const L = [];

  // Back wall, a lighter band, a dark skirting and a dark line under the ceiling.
  L.push(r(0, 0, W, yH, p.wall), r(0, 0, W, 4, p.ceil), r(0, yH - 32, W, 24, p.band), r(0, yH - 32, W, 4, p.bandTop), r(0, base, W, 8, p.skirt));
  // Neon trim: a glowing tube under the ceiling and along the baseboard, pulsing like the screens.
  const tubeA = isDay() ? "#89dceb" : "#89b4fa", tubeB = isDay() ? "#cba6f7" : "#f5c2e7";
  L.push(
    div().absolute().left(0).top(0).w(1).h(1).children([r(0, 2, W, 7, tubeA + "33"), r(0, 4, W, 2, tubeA)]).loop("opacity", { from: 0.55, to: 1, period: 3000, easing: "ease-in-out" }),
    div().absolute().left(0).top(0).w(1).h(1).children([r(0, base - 2, W, 6, tubeB + "33"), r(0, base, W, 2, tubeB)]).loop("opacity", { from: 0.55, to: 1, period: 3400, easing: "ease-in-out" }),
  );

  // Two windows onto the city (a moon in the first by night, a sun by day), in dark frames with a pale sill and glints on the glass.
  const win = (x, seed, withMoon, ww) => {
    const w = snap(ww), h = snap(yH * 0.58), y = snap(yH * 0.1);
    const rim = isDay() ? "#89dceb" : "#89b4fa";
    const o = [
      div().absolute().left(0).top(0).w(1).h(1).children([r(x - 8, y - 8, w + 16, h + 16, rim + "2e"), r(x - 5, y - 5, w + 10, h + 10, rim + "44")]).loop("opacity", { from: 0.5, to: 1, period: 3600, easing: "ease-in-out" }),
      r(x - 4, y - 4, w + 8, h + 8, p.frame), r(x, y, w, h, p.sky),
    ];
    for (let i = 0; i < 6; i++) o.push(r(x + 6 + (i % 4) * snap(w / 4), y + 6 + snap(rnd(i + seed) * h * 0.3), U, U, p.glint).loop("opacity", { from: 0.2, to: 0.9, period: 1500 + i * 400, easing: "ease-in-out" }));
    if (withMoon) o.push(...ellipse(x + w - 16, y + 16, 8, 8, p.moon));
    const bw = snap(w / 6);
    for (let i = 0; i < 6; i++) {
      const bh = snap(14 + rnd(i + seed * 7) * h * 0.5), bx = x + i * bw;
      o.push(r(bx, y + h - bh, bw - 2, bh, p.bldg));
      for (let k = 0; k < 3; k++) if (rnd(i * 5 + k + seed) > 0.35) o.push(r(bx + 4 + (k % 2) * 8, y + h - bh + 6 + Math.floor(k / 2) * 10, U, U, p.pane).loop("opacity", { from: 0.5, to: 1, period: 2000 + k * 700, easing: "ease-in-out" }));
    }
    for (const f of [0.16, 0.5, 0.84]) for (let s = 0; s < h / 4; s++) { const gx = x + f * w - s * 3; if (gx > x + 2 && gx + 8 < x + w - 2) o.push(r(gx, y + s * 4, 8, 4, p.glass)); }
    o.push(r(x + w / 2 - 2, y, 4, h, p.frame), r(x, y + h / 2 - 2, w, 4, p.frame), r(x - 8, y + h + 4, w + 16, 5, p.sill));
    return o;
  };
  // Left to right: a plant, two windows with the clock between them, the water cooler, then the LED screens and hologram.
  const rackW = Math.max(48, Math.min(96, snap(W * 0.2))), rackX = W - rackW - 10;
  const cw = rackX - 30, x0 = 38, usable = cw - 10 - x0;
  const two = usable >= 100;
  const gap = two ? Math.max(32, snap(usable * 0.26)) : 0;
  const wA = two ? snap((usable - gap) / 2) : usable, wB = usable - wA - gap;
  const wx1 = x0, wx2 = x0 + wA + gap;
  L.push(...win(wx1, 1, true, wA));
  if (two) L.push(...win(wx2, 4, false, wB));

  // Clock between the windows and, when there is room, the blue sign under it.
  const cx = two ? wx1 + wA + Math.floor(gap / 2) : snap(W * 0.5), cr = Math.min(14, Math.floor(gap / 2) - 2) || 14;
  const rr = Math.max(8, cr);
  L.push(...ellipse(cx, 26, rr, rr, p.clockRim), ...ellipse(cx, 26, rr - 4, rr - 4, p.clockFace), r(cx - 1, 26 - rr + 4, 2, rr - 3, p.hand), r(cx, 25, rr - 5, 2, p.hand), r(cx - 2, 24, 4, 4, "#c0424e"));
  if (gap >= 44 && base - 48 >= 88) {
    if (isDay()) L.push(div().absolute().left(0).top(0).w(1).h(1).children([r(cx - 24, 40, 48, 48, "#89dceb26"), r(cx - 20, 44, 40, 40, "#89dceb40")]).loop("opacity", { from: 0.5, to: 1, period: 2800, easing: "ease-in-out" }));
    L.push(r(cx - 16, 48, 32, 32, p.signBg), r(cx - 12, 62, 24, 4, p.sign), r(cx - 2, 52, 4, 24, p.sign),
      r(cx - 8, 54, 4, 4, p.sign), r(cx + 4, 54, 4, 4, p.sign), r(cx - 8, 70, 4, 4, p.sign), r(cx + 4, 70, 4, 4, p.sign));
  }

  // The water cooler stands on the baseboard, left of the screens; its tank and tap glow.
  L.push(
    div().absolute().left(0).top(0).w(1).h(1).children([r(cw - 2, base - 58, 24, 30, "#89dceb2e")]).loop("opacity", { from: 0.5, to: 1, period: 2600, easing: "ease-in-out" }),
    r(cw + 2, base - 54, 16, 22, "#6fa8d6"), r(cw + 4, base - 52, 4, 10, "#a9d0ee"), r(cw, base - 32, 20, 32, "#b7bfd6"), r(cw, base - 32, 20, 4, "#d3d8ea"),
    r(cw + 6, base - 26, 8, 8, "#e8744f40"), r(cw + 8, base - 24, 4, 4, "#e8744f"),
  );

  // A potted plant in the left corner and the LED wall in the right one.
  const plant = (x) => [
    r(x, base - 44, 10, 26, "#2f6e3b"), r(x + 8, base - 54, 10, 36, "#3a8247"), r(x + 18, base - 42, 10, 24, "#2f6e3b"), r(x + 4, base - 34, 6, 6, "#52a35f"),
    r(x + 2, base - 18, 24, 18, "#8a5a3c"), r(x, base - 18, 28, 4, "#a06c48"),
  ];
  L.push(...plant(6), ...ledWall(rackX, rackW, base));

  // Tiled floor, a grid of 24px tiles, and a pool of window light under each window.
  L.push(r(0, yH, W, H - yH, p.floor));
  for (let x = 0; x < W; x += 24) L.push(r(x, yH, 2, H - yH, p.grout));
  for (let y = yH + 4; y < H; y += 24) L.push(r(0, y, W, 2, p.grout));
  for (const [wx, wl] of two ? [[wx1, wA], [wx2, wB]] : [[wx1, wA]]) for (let i = 0; i < 9; i++) L.push(r(wx + i * 6, yH + 8 + i * 8, Math.round(wl * 0.85), 8, p.pool));
  L.push(r(0, yH, 4, H - yH, p.edge), r(W - 4, yH, 4, H - yH, p.edge), r(0, H - 4, W, 4, p.edge));
  // Neon floor edges: the same tubes trace the room's footprint.
  const floorTube = isDay() ? "#cba6f7" : "#89b4fa";
  L.push(div().absolute().left(0).top(0).w(1).h(1).children([
    r(0, yH, 2, H - yH, floorTube), r(W - 2, yH, 2, H - yH, floorTube), r(0, H - 2, W, 2, floorTube),
    r(0, yH, 6, H - yH, floorTube + "26"), r(W - 6, yH, 6, H - yH, floorTube + "26"), r(0, H - 6, W, 6, floorTube + "26"),
  ]).loop("opacity", { from: 0.5, to: 1, period: 3800, easing: "ease-in-out" }));

  return div().absolute().left(0).top(0).w(W).h(H).overflow_hidden().children(L);
}

// Where each desk stands: x as a fraction of the width, y of the floor. Two staggered columns.
export const SLOTS = [
  [0.27, 0.0], [0.74, 0.1], [0.27, 0.62], [0.74, 0.72], [0.27, 1.0], [0.74, 1.0],
];
