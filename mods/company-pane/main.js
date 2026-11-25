// A desk nameplate as the pane header: the agent's pixel pet, its job title, status and folder.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, InputState, Input } from "gpui-base";
import { panes, props, run, theme, home, layout, shared, setShared, appHome, readTextFile, writeTextFile, settings } from "herdr";
import { agentOf, duckMood, duckWidth, mood } from "./duck.js";

const ROLE = (p) => agentOf(p.program?.key)?.role ?? (p.program?.shell ? "Terminal" : (p.program?.name ?? "Contractor"));

// A notched pixel plate: a 2px outline with cut corners, a fill and a 2px drop shadow under it.
const frame = (border, fill, shadow = "#00000000") => [
  div().absolute().left(3).right(3).top(2).bottom(-2).bg(shadow),
  div().absolute().left(2).right(2).top(0).bottom(0).bg(border),
  div().absolute().left(0).right(0).top(2).bottom(2).bg(border),
  div().absolute().left(3).right(3).top(1).bottom(1).bg(fill),
  div().absolute().left(1).right(1).top(3).bottom(3).bg(fill),
];
// An opaque tint of c over the plate paper, and a label color pushed toward ink: a translucent fill lets the frame layers
// show through and darkens the plate, and the raw pastel is too light to read on it. By day the paper is cream, matching
// the office nameplates; by night it is the panel's lavender.
const day = () => settings().dark === false;
const mix = (c, to, k) => {
  if (!/^#[0-9a-f]{6}$/i.test(c) || !/^#[0-9a-f]{6}$/i.test(to)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
const soften = (c, k = 0.82) => mix(c, day() ? "#f6ead6" : "#cdd6f4", k);
const deepen = (c, k = 0.65) => mix(c, "#1d1e3e", k);
// The status plate keeps the hue of its status colour: it is tinted toward white (or the night panel), not toward the cream.
const tint = (c, k = 0.7) => mix(c, day() ? "#ffffff" : "#cdd6f4", k);
const MONO = "JetBrains Mono";

function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) { const f = paneFrame(child); if (f) return f; }
  return null;
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class CompanyPane extends View {
  init(_props, cx) {
    this.editing = null;
    this.file = `${appHome()}/pixel-hq-names.json`;
    // Shared with the office list, so a new name shows there too; the file keeps it across restarts.
    cx.spawn(async (cx) => {
      if (shared("pixel-hq.names")) return;
      const raw = await readTextFile(this.file).catch(() => null);
      try { const v = JSON.parse(raw ?? "{}"); if (v && typeof v === "object" && !shared("pixel-hq.names")) { setShared("pixel-hq.names", v); cx.notify(); } } catch {}
    });
    this.input = InputState.new({ placeholder: "" });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.input.on("blur", (_e, cx) => { if (this.editing) { this.editing = null; cx.notify(); } });
  }

  // Click the name or the job title to rename it; an empty name restores the default.
  start(field, pane, current, cx) {
    this.editing = { field, pane };
    this.input.set_value(current);
    cx.notify();
    cx.timer.after(40, () => this.input.focus());
  }

  commit(cx) {
    const e = this.editing;
    if (!e) return;
    const v = this.input.value().trim().slice(0, 40);
    const names = { ...(shared("pixel-hq.names") ?? {}) };
    const mine = { ...(names[e.pane] ?? {}) };
    if (v) mine[e.field] = v; else delete mine[e.field];
    if (Object.keys(mine).length) names[e.pane] = mine; else delete names[e.pane];
    setShared("pixel-hq.names", names);
    const text = JSON.stringify(names, null, 2);
    cx.spawn(async () => { const raw = await readTextFile(this.file).catch(() => null); await writeTextFile(this.file, text, raw).catch(() => {}); });
    this.editing = null;
    cx.notify();
  }

  me() { return panes().find((p) => p.pane === props()?.pane); }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const st = p.status;
    const pane = p.pane;
    const species = agentOf(p.program?.key)?.species ?? null;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    const H = 30;
    const avatar = species
      ? div().flex_none().w(duckWidth(H)).h(H).child(duckMood(mood(st ?? "idle"), H, { species }))
      : div().flex_none().size(24).bg(t.raised).flex().items_center().justify_center().text_size(12).text_color(t.muted).child(">_");
    const custom = (shared("pixel-hq.names") ?? {})[pane] ?? {};
    const title = custom.name ?? ((((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name) || "shell");
    const idleColor = t.ansi3 ?? t.idle ?? t.dim;
    const chip = (text, color, spin) => h_flex().relative().flex_none().gap(5).px(6).h(20).items_center()
      .children(frame(deepen(color, 0.55), tint(color), day() ? "#3b33583a" : "#00000055"))
      .child(div().flex_none().size(5).bg(color).when(st === "blocked", (lamp) => lamp.loop("opacity", { from: 0.3, to: 1, period: 900, easing: "ease-in-out" })))
      .when(Boolean(spin), el => el.child(svg("mods/company-pane/pixel-spinner.svg").size(12).flex_none().text_color(deepen(color, 0.85)).spin(900)))
      .child(div().font_family(MONO).font_bold().text_size(10).text_color(deepen(color, 0.85)).child(text));
    const status = st === "working" ? chip("typing", t.working ?? "#89b4fa", true)
      : st === "blocked" ? chip("needs you", t.blocked ?? "#e8744f")
      : st === "done" ? chip("shipped", t.done ?? "#8ec07c")
      : species ? chip("on break", idleColor) : null;
    const edit = (field, el, width) => this.editing?.pane === pane && this.editing.field === field
      ? div().id(`pe-${pane}-${field}`).relative().flex_none().w(width).h(22).px(6).flex().items_center()
          .children(frame(t.accent, t.background))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Input.new(this.input).h_full().text_size(11.5).text_color(t.foreground))
      : el.cursor_text().hover((s) => s.bg(t.hover)).tooltip("Click to rename")
          .on_click((_e, cx) => { cx.stop_propagation(); this.start(field, pane, field === "role" ? (custom.role ?? ROLE(p)) : title, cx); });
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(9)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_click(() => run("pane.focus", { pane }))
      .child(avatar)
      .child(h_flex().flex_none().gap(7).items_center()
        .child(edit("name", div().id(`pn-${pane}`).truncate().max_w(220).px(3).font_semibold().text_color(t.foreground).child(title), 170))
        .child(edit("role", div().id(`pr-${pane}`).relative().flex_none().gap(5).pl(5).pr(7).h(20).flex().items_center()
          .children(frame(day() ? "#3b3358" : deepen(t.accent, 0.5), day() ? "#f6ead6" : soften(t.accent), day() ? "#3b33583a" : "#00000055"))
          .child(div().flex_none().w(2).h(10).bg(t.accent))
          .child(div().font_family(MONO).font_bold().text_size(10).text_color(day() ? "#3b3358" : deepen(t.accent, 0.85)).child(custom.role ?? ROLE(p))), 120)))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(Boolean(status), el => el.child(status));
  }
}
