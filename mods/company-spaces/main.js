// Workspace spaces as metro stations: each machine is a line, each space a stop on it,
// worktrees under their checkout. After a space's name, the repo
// its first terminal is in now, only where unusual: branch, ahead/behind. Agent state lives in the agents list, not here. Click to
// switch, right-click for its menu, drag to reorder.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, machines, panes, agents, run, openOverlay, exec, hc, theme, shared, setShared, watchFolder, window, layout, settings } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
// A space is one floor: a small pixel room, the name, the branch and who is aboard, and a status dot.
// A worktree's card hangs off its repo's line, shifted right and marked by a station sign in its color.
const CARD = 66;
const TREE_INDENT = 10;
const RAIL_CELL = 32;
// The tile has three desks: the most urgent agents get them, the rest are counted.
const RANK = { blocked: 3, working: 2, done: 1 };
const railCell = (el) => h_flex().flex_none().justify_center().child(el);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

const MONO = "JetBrains Mono";
// The layout runs a dark and a light theme; the drawn parts follow it.
const day = () => settings().dark === false;
// A strong space color toned toward the panel tone of the shown theme (pale lavender by night, pale grey-blue by day),
// so frames and bars sit in the same soft palette.
const soften = (c, k = 0.3) => {
  const to = day() ? "#d7d2e9" : "#cdd6f4";
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
// The line head is a platform: a dark canopy by night, a pale one by day.
const HEADBAR = () => (day() ? "#d6d1ea" : "#181825");
// One floor of the building, cut away: the room's wall, windows, moon or sun, LED screen and floor, by time of day.
const ROOMC = () => (day() ? {
  wallOn: "#e2dff0", wallOff: "#d3cde6", trim: "#ffffff88", frame: "#5b5480",
  skyLit: "#cfe0fb", skyDark: "#b7cdf5", bldg: "#8f92c4", pane: "#fab387", glint: "#f9e2af",
  moon: "#f2c94c", screen: "#313244", screenOn: "#1e1e2e",
  floor: "#d5d1e8", skirt: "#b0a8d2", grout: "#bdb7d8", desk: "#8d86b4", deskTop: "#a49cc8",
} : {
  wallOn: "#2a2f52", wallOff: "#20243d", trim: "#ffffff22", frame: "#0c0e1c",
  skyLit: "#1a2350", skyDark: "#0e1226", bldg: "#121733", pane: "#e0b94a", glint: "#f5e9b0",
  moon: "#f7efc0", screen: "#0a0c1a", screenOn: "#10132a",
  floor: "#242843", skirt: "#171a2c", grout: "#1c1f36", desk: "#646a8c", deskTop: "#8a91b6",
});
const GUTTER = 22;
// The metro lines wear soft pastels from the layout's own blue-violet tone (periwinkle first), not the strong space colors.
const LINES = ["#8fa3f0", "#7aa7e8", "#6fc7bd", "#b394f0", "#8fcf94", "#e49ac8"];

function grip(color) {
  return div().absolute().left(1).top(9).w(5).h(10).children([0, 4, 8].flatMap((y) => [0, 3].map((x) => div().absolute().left(x).top(y).size(2).bg(color))));
}

// A solid pixel block with notched corners.
const pix = (c, w, h) => [div().absolute().left(2).top(0).w(w - 4).h(h).bg(c), div().absolute().left(0).top(2).w(w).h(h - 4).bg(c)];
// A notched rectangle, drawn as two overlapping blocks with 2px cut corners. Insets are
// [left, right, top, bottom] from the container, so a shape can sit inside another.
const notch = (c, [l, r, t, b]) => [
  div().absolute().left(l + 2).right(r + 2).top(t).bottom(b).bg(c),
  div().absolute().left(l).right(r).top(t + 2).bottom(b + 2).bg(c),
];

// The track: a thick line with dark sleepers, a square station with notched corners (pulsing where you are or where an agent needs you),
// and a little locomotive that rides while someone works.
function rail(t, line, h, { stop = null, here = false, last = false, crew = [], tint = line } = {}) {
  const c = Math.round(h / 2);
  const blocked = crew.some((a) => a.status === "blocked");
  const moving = blocked || crew.some((a) => a.status === "working");
  const end = last ? c : h;
  const sleepers = [];
  for (let y = 2; y < end; y += 8) sleepers.push(div().absolute().left(5).top(y).w(10).h(2).bg("#00000038"));
  const node = div().absolute().left(3).top(c - 7).w(14).h(14).children(pix(line, 14, 14))
    .child(div().absolute().left(3).top(3).w(8).h(8).bg(blocked ? "#f38ba8" : here ? "#f9e2af" : day() ? "#47445e" : "#ffffff"));
  return div().relative().w(GUTTER).h(h).flex_none()
    .child(div().absolute().left(6).top(0).w(8).h(end).bg(line + "66"))
    .child(div().absolute().left(8).top(0).w(4).h(end).bg(line))
    .child(div().absolute().left(8).top(0).w(1).h(end).bg("#ffffff66"))
    .children(sleepers)
    .when(stop === "station" && (here || blocked), (el) => el.child(div().absolute().left(0).top(c - 10).w(20).h(20).children(pix(blocked ? "#f38ba8" : "#f9e2af", 20, 20))
      .loop("opacity", { from: 0.4, to: 0.9, period: blocked ? 800 : 1800, easing: "ease-in-out" })))
    .when(stop === "station", (el) => el.child(node
      .child(div().absolute().left(-2).right(-2).top(-2).bottom(-2).bg((here ? "#f9e2af" : line) + "99").loop("opacity", { from: 0.5, to: 1, period: here ? 1600 : 3000, easing: "ease-in-out" }))))
    .when(stop === "end", (el) => el.child(div().absolute().left(4).top(c - 6).w(12).h(12).rounded(2).border_2().border_dashed().border_color(line).bg(t.chrome)))
    .when(moving, (el) => el.child(loco(blocked, tint).absolute().left(3)
      .loop("top", { from: c - 32, to: c - 20, period: 2400 })));
}

// A commuter car seen from above, one carriage: a rounded cream nose under two lit lamps, a
// windscreen with light running across it, a band of the row's color fore and aft, a slatted roof
// module between two rows of side windows, and the coupler at the tail.
function loco(blocked, color) {
  const ink = "#1d1e3e";
  const cream = "#f0decc";
  const glass = "#4d4986";
  const glassLit = "#817edf";
  const win = "#7372e0";
  const winLit = "#aca7ee";
  const roof = "#c7b8ea";
  const roofDark = "#4e4a86";
  const lamp = blocked ? "#f38ba8" : "#ffae1a";
  const lampLit = "#fff2b8";
  const T = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
  return div().relative().w(12).h(24).flex_none()
    .child(T(2, 0, 8, 1, ink)).child(T(3, 0, 6, 1, cream))
    .child(T(1, 1, 10, 1, ink)).child(T(2, 1, 8, 1, cream))
    .child(T(0, 2, 12, 22, ink)).child(T(1, 2, 10, 21, cream))
    .child(T(1, 2, 2, 2, lamp)).child(T(1, 2, 1, 1, lampLit))
    .child(T(9, 2, 2, 2, lamp)).child(T(9, 2, 1, 1, lampLit))
    .child(T(2, 4, 8, 5, ink))
    .child(T(3, 5, 6, 3, glass))
    .child(T(3, 7, 2, 1, glassLit)).child(T(5, 6, 2, 1, glassLit))
    .child(T(7, 7, 1, 1, glassLit)).child(T(8, 6, 1, 1, glassLit))
    .child(T(1, 9, 10, 2, color))
    .child(T(3, 12, 6, 7, roofDark)).child(T(4, 13, 4, 5, roof))
    .child(T(5, 14, 2, 1, roofDark)).child(T(5, 16, 2, 1, roofDark))
    .child(T(1, 12, 2, 2, win)).child(T(1, 12, 2, 1, winLit))
    .child(T(9, 12, 2, 2, win)).child(T(9, 12, 2, 1, winLit))
    .child(T(1, 16, 2, 2, win)).child(T(1, 16, 2, 1, winLit))
    .child(T(9, 16, 2, 2, win)).child(T(9, 16, 2, 1, winLit))
    .child(T(1, 20, 10, 2, color))
    .child(T(2, 22, 1, 1, ink)).child(T(9, 22, 1, 1, ink))
    .child(T(4, 22, 4, 2, ink));
}

// A line's header as a station platform: a striped canopy in the line's color with a scalloped
// hem, two posts, a hung name plate, a bench, and a slab with a safety line and a tactile strip.
function platform(line) {
  const stripes = Array.from({ length: 40 }, (_, i) => div().flex_none().w(12).h(10).bg(i % 2 ? soften(line, 0.62) : line));
  const hem = Array.from({ length: 40 }, (_, i) => div().flex_none().w(12).h(2).bg(i % 2 ? line : soften(line, 0.62)));
  const ticks = Array.from({ length: 80 }, () => div().flex_none().w(3).h(2).bg(soften(line, 0.25)));
  const B = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
  const R = (x, y, w, h, c) => div().absolute().right(x).top(y).w(w).h(h).bg(c);
  // A column: a capital that steps in three times, a shaft lit on the left, and a base that steps
  // back out, so it reads as a cast pillar rather than a bar.
  const post = (side) => {
    const A = side === "l" ? B : R;
    return [
      A(0, 13, 16, 3, soften(line, 0.35)),
      A(2, 16, 12, 3, soften(line, 0.45)),
      A(4, 19, 8, 3, soften(line, 0.5)),
      A(5, 22, 6, 33, soften(line, 0.45)),
      A(5, 22, 2, 33, soften(line, 0.72)),
      A(9, 22, 2, 33, soften(line, 0.25)),
      A(4, 55, 8, 2, soften(line, 0.45)),
      A(2, 57, 12, 2, soften(line, 0.35)),
      A(0, 59, 16, 2, soften(line, 0.3)),
      A(0, 61, 16, 1, soften(line, 0.1)),
    ];
  };
  const benchLit = day() ? "#cdc6e8" : "#5d6489";
  const benchBody = day() ? "#b3a8d8" : "#4a4f6e";
  const benchDark = day() ? "#9a90c4" : "#383d58";
  return [
    div().absolute().left(0).right(0).top(0).h(10).overflow_hidden().child(h_flex().h(10).children(stripes)),
    div().absolute().left(0).right(0).top(10).h(2).overflow_hidden().child(h_flex().h(2).gap(1).children(hem)),
    div().absolute().left(0).right(0).top(12).h(1).bg("#00000028"),
    ...post("l"), ...post("r"),
    div().absolute().left(0).right(0).bottom(0).h(10).bg(soften(line, 0.8)),
    div().absolute().left(0).right(0).bottom(5).h(2).bg(day() ? "#e0b94a" : "#c98a1e"),
    div().absolute().left(0).right(0).bottom(1).h(2).overflow_hidden().child(h_flex().h(2).gap(4).children(ticks)),
    // A bench on the platform: a backrest narrower than the seat, each bar lit along its top and
    // shaded under its bottom, standing on four short legs.
    B(30, 52, 22, 4, benchBody), B(30, 52, 22, 1, benchLit), B(30, 55, 22, 1, benchDark),
    B(27, 56, 28, 3, benchBody), B(27, 56, 28, 1, benchLit), B(27, 58, 28, 1, benchDark),
    B(30, 59, 2, 3, benchDark), B(34, 59, 2, 3, benchDark),
    B(46, 59, 2, 3, benchDark), B(50, 59, 2, 3, benchDark),
  ];
}

// A worktree's stop: a sign on its card's left edge, in the space's color, with the branch glyph.
// The shown worktree's sign wears the same warm halo as a station at the main line.
function treeSign(fill, ink, here) {
  return div().absolute().left(18).top(CARD / 2 - 7).w(16).h(14)
    .when(here, (el) => el.child(div().absolute().left(-2).top(-2).w(20).h(18).children(pix("#f9e2af", 20, 18))
      .loop("opacity", { from: 0.4, to: 0.9, period: 1800, easing: "ease-in-out" })))
    .children(pix(fill, 16, 14))
    .child(div().absolute().left(4).top(2).w(8).h(10).children(
      [[0, 0, 2, 2], [0, 8, 2, 2], [5, 2, 2, 2], [0, 2, 1, 6], [1, 4, 5, 1]]
        .map(([x, y, w, h]) => div().absolute().left(x).top(y).w(w).h(h).bg(ink))));
}

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
    for (const state of Object.values(this.reconnecting)) state.busy = false;
    this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]"));
    this.order = JSON.parse(localStorage.getItem("machines.order") ?? "[]");
    this.dragLine = null;
    this.overLine = null;
    this.hoverLine = null;
    this.renaming = null;
    this.renameError = null;
    this.lineNames = [];
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // Refresh only when the refs could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        await Promise.all(keys.map((key) => this.check(key, cx)));
      }
      const used = new Set(Object.values(this.git).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // Ref-only reads avoid scanning the worktree or waking its index watch.
      // Two reads: a folder name may itself contain a newline.
      const [r, common] = await Promise.all([
        exec("git", ["rev-parse", "--path-format=absolute", "--show-toplevel"], { cwd, on }),
        exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on }),
      ]);
      if (r.code !== 0 || common.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.code !== 0 ? r.stderr : common.stderr)) this.unsure.add(key);
        this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = r.stdout.replace(/\n$/, ""), repo = common.stdout.replace(/\n$/, "");
      const [branch, counts] = await Promise.all([
        exec("git", ["symbolic-ref", "-q", "HEAD"], { cwd, on }),
        exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on }),
      ]);
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const [ahead, behind] = counts.code === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
      const info = { name, branch: branch.code === 0 ? branch.stdout.trim().replace(/^refs\/heads\//, "") : "(detached)", ahead, behind, repo: JSON.stringify([on, repo]), linked: repo !== `${top}/.git` };
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo)) this.refreshGit(Object.keys(this.git).filter((k) => this.git[k]?.repo === mine), cx);
        }
      } catch { this.watching.delete(repo); }
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null }));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of list) {
      if (nested(r)) continue;
      out.push({ ...r, tree: null });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    // Simulate the batch so later indexes include earlier moves. An attempted
    // write can lose a sync conflict: allow the echo to settle before retrying.
    const order = sp.map(w => w.id);
    const target = out.map(r => r.w.id);
    const key = JSON.stringify([order, target, machines()]);
    if (order.every((id, i) => id === target[i])) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const moved = new Set();
      this.ordering = { key, at: Date.now(), machines: [] };
      for (let i = 0; i < out.length; i++) {
        const from = order.indexOf(out[i].w.id);
        if (from === i) continue;
        run("space.move", { id: out[i].w.id, index: i + 1 });
        moved.add(out[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => this.shown.has(r.w.id));
  }

  // The rows, one metro line per machine, each ending in a stop that opens a new space.
  grouped(t, collapsed) {
    const rows = this.ordered();
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => h_flex().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).items_center().when(collapsed, el => el.justify_center()).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length && collapsed) return loading(null) && !rows.length ? [loadingRow(null)] : rows.map((r) => this.compact(r, t));
    const rank = (m) => (this.order.includes(m) ? this.order.indexOf(m) : Infinity);
    const byDefault = [null, ...remote];
    const machineNames = [...byDefault].sort((a, b) => rank(a) - rank(b) || byDefault.indexOf(a) - byDefault.indexOf(b));
    this.lineNames = machineNames;
    return machineNames.flatMap((m) => {
      const n = byDefault.indexOf(m);
      const at = machineNames.indexOf(m);
      const from = this.dragLine ? machineNames.indexOf(this.dragLine.m) : -1;
      const target = !collapsed && from !== -1 && from !== at && this.overLine?.m === m;
      const hovered = !collapsed && !this.dragLine && this.hoverLine?.m === m;
      const dropBar = (el, end) => el.child(div().absolute().left(0).right(0).h(2).bg(t.accent).when(end, bar => bar.bottom(0)).when(!end, bar => bar.top(0)));
      const renaming = !collapsed && Boolean(m) && this.renaming?.m === m;
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const login = machine?.state === "needs_login" ? `hc machine login ${m}` : null;
      const folded = this.folded.has(m);
      const line = connected ? LINES[n % LINES.length] : t.dim;
      const draw = (r) => (collapsed ? this.compact(r, t) : this.row(r, t, line));
      const bullet = div().relative().w(20).h(20).flex_none()
        .child(div().absolute().left(-2).top(-2).children(pix(line + "3d", 24, 24)).loop("opacity", { from: 0.4, to: 1, period: 2600, easing: "ease-in-out" }))
        .children(pix(line, 20, 20))
        .child(h_flex().absolute().left(0).top(0).size(20).items_center().justify_center().font_family(MONO).font_bold().text_size(10).text_color(day() ? "#ffffff" : "#11111b")
          .child([...(m ?? "this computer")][0].toUpperCase()));
      const icon = svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none();
      const badge = div().absolute().right(-3).bottom(-2).size(6).rounded(3).border_1().border_color(t.chrome).bg(connected ? t.ansi2 : t.dim);
      // One plate spans the platform, hung from the canopy by two rods: the badge and the line's
      // name at the left, the stop count and the fold mark at the right.
      const sign = h_flex().relative().absolute().left(20).right(20).top(15).h(34).pl(7).pr(8).gap(7).items_center()
        .child(div().absolute().left(24).top(-3).w(2).h(3).bg(day() ? "#8d86b4" : "#3a3f5c"))
        .child(div().absolute().right(24).top(-3).w(2).h(3).bg(day() ? "#8d86b4" : "#3a3f5c"))
        .children([
          ...notch(day() ? "#00000026" : "#00000055", [2, 0, 2, 0]),
          ...notch(line, [0, 2, 0, 2]),
          ...notch(day() ? "#faf9fc" : "#1c1e2b", [2, 4, 2, 4]),
        ])
        .child(bullet)
        .child(v_flex().flex_1().min_w(0).gap(1).justify_center()
          .child(div().min_w(0).truncate().font_family(MONO).font_bold().text_size(9.5).text_color(connected ? t.foreground : t.dim)
            .when(!renaming, el => el.child(`${(m ?? "this computer").toUpperCase()} LINE`))
            .when(renaming, el => el.child(Input.new(this.renaming.input).h(18).text_size(10).font_family(MONO).text_color(t.foreground))))
          .when(!connected && !rebuilt && !login, el => el.child(div().flex_none().font_family(MONO).text_size(8.5).text_color(t.dim).child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(rebuilt, el => el.child(h_flex().gap(3).items_center().font_family(MONO).text_size(8.5)
            .child(div().max_w(90).truncate().text_color(t.dim).child(repair?.error || "rebuilt ·"))
            .child(div().id(`machine-connect-${m}`).flex_none().text_color(repair?.error ? t.blocked : t.muted)
              .hover(s => s.text_color(t.foreground))
              .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
              .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
              .child(repair?.busy ? "Connecting…" : "Connect")))))
        .child(div().flex_none().font_family(MONO).font_bold().text_size(9).text_color(t.dim).child(`${mine.length} ${mine.length === 1 ? "station" : "stations"}`))
        .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(10).flex_none());
      const head = h_flex().relative().id(`machine-${m ?? "local"}`).h(collapsed ? 26 : 72).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().text_size(11).text_color(t.dim)
        .when(collapsed, el => el.mt(4).w(RAIL_CELL).justify_center().rounded(6).tooltip(login ? `${m} needs a login: run ${login}. Click for Copy.` : m ? `${m} · ${connected ? "connected" : (machine?.state ?? "asleep").replace(/_/g, " ")}` : "This computer"))
        .when(collapsed, el => el.cursor_pointer())
        .when(!collapsed, el => el.bg(HEADBAR()).mb(2).children(platform(line)))
        .hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          if (renaming) return;
          if (collapsed && login) { run("app.settings", { section: "machines" }); return; }
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .when(!collapsed, el => el
          .when(Boolean(this.dragLine), el => el.cursor_grabbing())
          .when(!this.dragLine, el => el.cursor_grab())
          .tooltip(m ? "Click to fold · drag to reorder lines · right-click to rename" : "Click to fold · drag to reorder lines")
          .when(Boolean(m), el => el.on_mouse_down("right", (_e, cx) => this.startRename(m, cx)))
          .on_key_down((e, cx) => { if (renaming && e.key === "escape") { this.renaming = null; cx.stop_propagation(); cx.notify(); } })
          .on_hover((on, cx) => {
            if (on) this.hoverLine = { m };
            else if (this.hoverLine?.m === m) this.hoverLine = null;
            cx.notify();
          })
          .on_mouse_down("left", () => { if (!renaming) this.dragLine = { m }; })
          .on_mouse_move((_e, cx) => this.overLineAt(m, cx))
          .on_mouse_up("left", (_e, cx) => { this.dropLine(m); cx.notify(); })
          .when(this.dragLine?.m === m && this.overLine && this.overLine.m !== m, el => el.opacity(0.5))
          .when(target, el => el.bg(t.hover))
          .when(target && from > at, el => dropBar(el, false))
          .when(hovered, el => el.child(grip(t.dim))))
        .when(collapsed, el => el.child(div().relative().flex_none().child(icon).when(Boolean(m), el => el.child(badge))))
        .when(!collapsed, el => el.child(sign));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim)
        .when(collapsed || connected, el => el.hover(s => s.bg(t.hover).text_color(t.foreground)).on_click(() => run("space.new", { machine: m ?? "" })))
        .when(collapsed, el => el.w(RAIL_CELL).rounded(6).justify_center().tooltip(`New space on ${m ?? "this computer"}`)
          .child(h_flex().size(18).rounded(5).border_1().border_color(t.dim).items_center().justify_center()
            .child(svg("mods/workspace-chrome/plus.svg").size(10))))
        .when(!collapsed, el => el.h(26).gap(6).text_size(11.5).child(rail(t, line, 26, { stop: "end", last: true }))
          // A vacant platform: four dashed corners and a plus where the station will stand.
          .child(div().relative().w(12).h(12).flex_none()
            .children([[0, 0], [9, 0], [0, 9], [9, 9]].flatMap(([x, y]) => [
              div().absolute().left(x).top(y).w(3).h(1).bg(t.dim),
              div().absolute().left(x).top(y).w(1).h(3).bg(t.dim),
            ]))
            .child(div().absolute().left(5).top(3).w(2).h(6).bg(t.dim))
            .child(div().absolute().left(3).top(5).w(6).h(2).bg(t.dim)))
          .child("new station"));
      if (!collapsed && rebuilt) return [head];
      const cell = collapsed ? railCell : (el) => el;
      const failed = !collapsed && this.renameError?.m === m ? [div().px(8).pl(36).pb(4).flex_none().text_size(11).text_color(t.blocked).child(this.renameError.message)] : [];
      const guidance = !collapsed && login ? [v_flex().px(8).pb(6).gap(3).flex_none()
        .child(div().text_size(11).text_color(t.blocked).child("needs a login: run"))
        .child(h_flex().gap(5).items_center()
          .child(div().flex_1().min_w(0).truncate().tooltip(login).text_size(11).text_color(t.muted).child(login))
          .child(div().id(`machine-login-copy-${m}`).flex_none().px(5).py(2).rounded(4)
            .text_size(11).text_color(t.foreground).bg(t.raised).cursor_pointer().hover(s => s.bg(t.hover))
            .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(login); this.copiedLogin = login; cx.notify(); })
            .child(this.copiedLogin === login ? "Copied" : "Copy")))] : [];
      const tail = collapsed && mine.length ? [] : [!mine.length && loading(m) ? loadingRow(m) : cell(empty)];
      if (collapsed) return [cell(head), ...guidance, ...(folded ? [] : [...mine.map(draw), ...tail])];
      const zone = (el) => el.relative().on_mouse_move((_e, cx) => this.overLineAt(m, cx)).on_mouse_up("left", (_e, cx) => { if (this.dragLine) { this.dropLine(m); cx.notify(); } });
      const items = [head, ...failed, ...guidance.map(zone), ...(folded ? [] : [...mine.map(draw), ...tail.map(zone)])];
      if (target && from < at) dropBar(items[items.length - 1], true);
      return items;
    });
  }

  startRename(m, cx) {
    const input = InputState.new({ value: m });
    input.set_selected_range({ start: 0, end: m.length });
    input.on("submit", (_e, cx) => this.rename(m, input.value().trim(), cx));
    input.on("blur", (_e, cx) => { if (this.renaming?.input === input) { this.renaming = null; cx.notify(); } });
    this.renaming = { m, input };
    this.renameError = null;
    input.focus();
    cx.timer.after(50, () => input.focus());
    cx.notify();
  }

  rename(from, to, cx) {
    this.renaming = null;
    cx.notify();
    if (!to || to === from) return;
    cx.spawn(async (cx) => {
      const r = await hc(["machine", "rename", from, to, "--json"]);
      if (r.code !== 0) {
        let message;
        try { message = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
        this.renameError = { m: from, message: message || r.stderr || r.stdout || "Couldn't rename this machine." };
      } else {
        const swap = (x) => (x === from ? to : x);
        this.order = this.order.map(swap);
        localStorage.setItem("machines.order", JSON.stringify(this.order));
        this.folded = new Set([...this.folded].map(swap));
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
      }
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  overLineAt(m, cx) {
    if (this.dragLine && this.overLine?.m !== m) { this.overLine = { m }; cx.notify(); }
  }

  dropLine(m) {
    const dragged = this.dragLine;
    this.dragLine = null;
    this.overLine = null;
    if (dragged && dragged.m !== m) this.moveLine(dragged.m, m, this.lineNames);
  }

  moveLine(from, to, names) {
    const list = names.filter((x) => x !== from);
    list.splice(list.indexOf(to) + (names.indexOf(from) < names.indexOf(to) ? 1 : 0), 0, from);
    this.order = list;
    localStorage.setItem("machines.order", JSON.stringify(list));
  }

  // The floor card for a space: a small pixel room (one floor), the name, one dim line, one status dot.
  // A worktree's card is the same card, shifted under its repo's and naming that repo on its line.
  card({ w, g, fill, tree }, t) {
    const crew = [...(this.crew?.get(w.id) ?? [])].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0));
    const count = (k) => crew.filter((a) => a.status === k).length;
    const blocked = count("blocked"), working = count("working");
    // One floor of the building, cut away like a dollhouse: a window and LED screen on the wall, and one desk per agent
    // (up to three) with a tiny pet in its own colours. Lights are on while someone works; an empty floor goes dark.
    const R = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
    const lit = working > 0, any = crew.length > 0;
    const C = ROOMC();
    const skin = (a) => { const k = String(a.program?.key ?? "").toLowerCase(); return k.includes("claude") ? ["#D97757", "#D97757"] : k.includes("codex") ? ["#5B6CF0", "#5B6CF0"] : k.includes("opencode") ? ["#4A5B80", "#F7F4EC"] : (k.includes("antigravity") || k === "agy") ? ["#F6A03A", "#3186FF"] : (k.includes("deepseek") || k.includes("dsh")) ? ["#4D6BFE", "#EDEFF7"] : (k === "pi" || k.startsWith("pi-")) ? ["#4D9ABF", "#F1BE58"] : ["#F1E7D3", "#F1E7D3"]; };
    const room = div().relative().w(54).h(40).flex_none().overflow_hidden()
      .child(R(0, 0, 54, 24, any ? C.wallOn : C.wallOff)).child(R(0, 0, 54, 3, soften(fill))).child(R(0, 3, 54, 1, C.trim))
      .child(R(0, 0, 54, 5, "#89dceb2e").loop("opacity", { from: lit ? 0.5 : 0.2, to: lit ? 1 : 0.4, period: 2600, easing: "ease-in-out" }))
      .child(R(0, 0, 54, 1, "#89dceb").loop("opacity", { from: lit ? 0.6 : 0.25, to: 1, period: 2600, easing: "ease-in-out" }))
      .child(R(4, 7, 22, 15, C.frame)).child(R(5, 8, 20, 13, lit ? C.skyLit : C.skyDark))
      .child(R(6, 15, 4, 6, C.bldg)).child(R(11, 12, 5, 9, C.bldg)).child(R(17, 16, 6, 5, C.bldg))
      .child(R(12, 14, 1, 1, C.glint)).child(R(14, 17, 1, 1, C.glint)).child(R(7, 17, 1, 1, C.pane)).child(R(19, 18, 1, 1, C.pane))
      .child(R(20, 10, 3, 3, lit ? C.glint : C.moon)).child(R(14, 8, 1, 13, C.frame))
      .child(R(29, 4, 23, 20, "#89dceb26").loop("opacity", { from: lit ? 0.4 : 0.1, to: lit ? 1 : 0.25, period: 2200, easing: "ease-in-out" }))
      .child(R(31, 6, 19, 16, C.screen)).child(R(32, 7, 17, 14, lit ? C.screenOn : day() ? "#d3cde6" : "#0e1226"))
      .children([["#fab387", 0, 9], ["#a6e3a1", 3, 10], ["#89dceb", 0, 6], ["#f9e2af", 2, 11], ["#cba6f7", 0, 8], ["#f38ba8", 4, 9]].map(([c, x, w], k) => { const bar = R(34 + x, 9 + k * 2, Math.min(w, 13 - x), 1, day() && !lit ? "#8d86b4" : c); return lit && k % 2 === 0 ? bar.loop("opacity", { from: 0.4, to: 1, period: 800 + k * 200, easing: "ease-in-out" }) : bar; }))
      .child(R(0, 24, 54, 16, C.floor)).child(R(0, 24, 54, 2, C.skirt)).child(R(0, 31, 54, 1, C.grout)).child(R(18, 26, 1, 14, C.grout)).child(R(36, 26, 1, 14, C.grout))
      .children([0, 1, 2].flatMap((k) => {
        const x = 3 + k * 17, a = crew[k];
        const pet = a ? (() => {
          const chair = R(x + 2, 24, 10, 8, day() ? "#cfc9e4" : "#3c4054");
          const k = String(a.program?.key ?? "").toLowerCase();
          if (k.includes("deepseek") || k.includes("dsh")) {
            const f = a.status === "working" ? "typing" : a.status === "blocked" ? "error" : a.status === "done" ? "happy" : "idle";
            return [chair, image(`mods/company-agents/whale/${f}.gif`).absolute().left(x + 1).top(18).h(14)];
          }
          const [c1, c2] = skin(a);
          return [chair, R(x + 3, 23, 8, 4, c1), R(x + 3, 26, 8, 4, c2), R(x + 4, 25, 1, 2, "#14131f"), R(x + 8, 25, 1, 2, "#14131f")];
        })() : [];
        const glow = a ? R(x + 3, 30, 8, 3, a.status === "blocked" ? "#f38ba8" : day() ? "#8d86b4" : "#d8def0") : R(x + 3, 30, 8, 3, day() ? "#b0a8d2" : "#323650");
        const mark = a && a.status === "blocked" ? [R(x + 12, 20, 2, 5, "#f9e2af").loop("opacity", { from: 0.2, to: 1, period: 700, easing: "linear" }), R(x + 12, 26, 2, 2, "#f9e2af")] : a && a.status === "done" ? [R(x + 11, 21, 2, 2, "#a6e3a1"), R(x + 2, 20, 2, 2, "#f9e2af")] : [];
        return [...pet, R(x, 32, 14, 3, C.desk), R(x, 32, 14, 1, C.deskTop), glow, ...mark];
      }));
    // The room sits in a notched frame in the space's own color, its rim lit like a neon sign.
    const tile = div().relative().w(60).h(46).flex_none()
      .children(pix(soften(fill), 60, 46))
      .child(div().absolute().left(-2).top(-2).children(pix(fill + "3a", 64, 50)).loop("opacity", { from: lit ? 0.45 : 0.15, to: lit ? 1 : 0.35, period: 2400, easing: "ease-in-out" }))
      .child(div().absolute().left(3).top(3).child(room))
      .when(crew.length > 3, (el) => {
        const more = String(crew.length - 3);
        const bw = 12 + more.length * 6;
        // A notched pixel plate below the desks, so the extra staff never hides the three who fit.
        return el.child(div().absolute().left(58 - bw).top(41).w(bw).h(14)
          .children(pix(t.dim, bw, 14))
          .child(div().absolute().left(1).top(1).w(bw - 2).h(12).children(pix(t.chrome, bw - 2, 12)))
          .child(div().absolute().left(0).right(0).top(0).bottom(0).flex().items_center().justify_center()
            .font_family(MONO).font_bold().text_size(9).text_color(t.foreground).child(`+${more}`)));
      });
    const raw = g?.branch ?? null;
    const place = raw ?? base(w.folder ?? "");
    const repo = tree ? g?.name ?? "" : "";
    const done = count("done");
    const idle = crew.length - blocked - working - done;
    const dot = blocked > 0 ? t.blocked : working > 0 ? t.working : null;
    // A status chip as a pixel plate: a 1px frame with cut corners around a tint of its own color,
    // the count in mono bold behind a 4px state lamp. The height is fixed so the row keeps its pitch.
    const chip = (text, color, pulse) => {
      const fill = soften(color, 0.82);
      const c = h_flex().relative().flex_none().h(14).pl(6).pr(6).gap(4).items_center()
        .children([
          div().absolute().left(2).right(2).top(0).bottom(0).bg(color + "aa"),
          div().absolute().left(0).right(0).top(2).bottom(2).bg(color + "aa"),
          div().absolute().left(3).right(3).top(1).bottom(1).bg(fill),
          div().absolute().left(1).right(1).top(3).bottom(3).bg(fill),
        ])
        .child(div().flex_none().size(4).bg(color))
        .child(div().font_family(MONO).font_bold().text_size(9.5).text_color(color).child(text));
      return pulse ? c.loop("opacity", { from: 0.55, to: 1, period: 900, easing: "ease-in-out" }) : c;
    };
    // Most urgent first, so a narrow card loses the least important chip.
    const chips = [
      ...(blocked > 0 ? [chip(`${blocked} needs you`, t.blocked, true)] : []),
      ...(working > 0 ? [chip(`${working} typing`, t.working)] : []),
      ...(done > 0 ? [chip(`${done} shipped`, t.done)] : []),
      ...(idle > 0 ? [chip(`${idle} break`, t.idle ?? t.dim)] : []),
    ];
    const glyph = div().relative().w(8).h(10).flex_none().children([[0, 0, 2, 2], [0, 8, 2, 2], [5, 2, 2, 2], [0, 2, 1, 6], [1, 4, 5, 1]].map(([x, y, w2, h2]) => div().absolute().left(x).top(y).w(w2).h(h2).bg(raw ? t.accent : t.dim)));
    return h_flex().size_full().gap(11).items_center().px(4)
      .child(tile)
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(h_flex().gap(6).items_center()
          .child(div().min_w(0).truncate().font_semibold().text_size(13.5).text_color(t.foreground).child(w.name))
          .when(Boolean(dot), (el) => {
            // A pixel lamp: a notched 6px core inside a notched 12px halo that breathes.
            // `pix` degenerates into a plus below 8px, so the core is drawn as two rects.
            const halo = div().absolute().left(-3).top(-3).w(12).h(12).children(pix(dot + "55", 12, 12));
            const core = div().relative().flex_none().w(6).h(6)
              .child(div().absolute().left(1).top(0).w(4).h(6).bg(dot))
              .child(div().absolute().left(0).top(1).w(6).h(4).bg(dot));
            const d = div().relative().flex_none().w(6).h(6).child(halo).child(core);
            return el.child(blocked > 0 ? d.loop("opacity", { from: 0.3, to: 1, period: 800, easing: "ease-in-out" }) : d.loop("opacity", { from: 0.6, to: 1, period: 1600, easing: "ease-in-out" }));
          }))
        .child(h_flex().gap(5).items_center().text_size(10.5).font_family(MONO).text_color(t.dim)
          .when(Boolean(repo), (el) => el.child(div().flex_none().text_color(t.dim).child(`${repo} ›`)))
          .child(glyph)
          .child(div().min_w(tree ? 46 : 0).truncate().text_size(10.5).font_family(MONO).text_color(raw ? t.accent : t.dim).child(place))
          .when(!tree, (el) => el.child(div().flex_none().child(`\u00b7 ${crew.length ? `${crew.length} aboard` : "no service"}`)))
          .when(g?.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
          .when(g?.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`))))
        .child(h_flex().gap(4).items_center().min_w(0).overflow_hidden().tooltip(`${working} typing · ${blocked} need you · ${done} shipped · ${idle} on break`).children(chips.length ? chips : [div().text_size(10).font_family(MONO).text_color(t.dim).child("dark floor")])));
  }

  row({ w, i, g, tree }, t, line) {
    const on = w.active;
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const colors = shared("space.colors") ?? {};
    const color = colors[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .h(CARD)
      .flex_none()
      .justify_center()
      .rounded(8)
      .when(on, (el) => el.bg(t.selected).child(div().absolute().left(0).top(12).bottom(12).w(3).bg(line)))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(fromIndex < i, bar => bar.bottom(0))
          .when(fromIndex > i, bar => bar.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        if (this.dragLine) { this.overLineAt(w.machine ?? null, cx); return; }
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        if (this.dragLine) { this.dropLine(w.machine ?? null); cx.notify(); return; }
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .child(
        h_flex().relative().size_full().items_center()
          .when(Boolean(tree), (el) => el.child(treeSign(fill, t.chrome, on)))
          .child(rail(t, line, CARD, { stop: tree ? null : "station", here: on, crew: tree ? [] : this.crew?.get(w.id) ?? [], tint: fill }))
          .child(div().flex_1().min_w(0).h_full().flex().items_center()
            .when(Boolean(tree), (el) => el.pl(TREE_INDENT))
            .child(this.card({ w, g, fill, tree }, t)))
      );
  }

  compact({ w, i }, t) {
    return railCell(h_flex()
      .id(`space-${w.id}`)
      .relative()
      .w(RAIL_CELL)
      .h(26)
      .rounded(6)
      .justify_center()
      .items_center()
      .when(w.active, (el) => el.bg(t.selected))
      .when(!w.active, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => run("space.select", { id: w.id }))
      .child(div().text_color(w.active ? t.foreground : t.muted).child(String(i + 1)))
      .child(div().absolute().right(5).text_color(tone(t, w.status)).child(glyph(w.status))));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    this.crew = new Map();
    for (const a of agents()) { if (!this.crew.has(a.space)) this.crew.set(a.space, []); this.crew.get(a.space).push(a); }
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(collapsed, el => el.pl(0).pr(0).justify_center())
        .when(!collapsed, el => el.child("Spaces"))
        .child(div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6).hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new")).child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(collapsed ? 0 : 8).pb(14).overflow_y_scrollbar().mode("always")
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; this.dragLine = null; this.overLine = null; cx.notify(); })
        .children(this.grouped(t, collapsed)));
  }
}
