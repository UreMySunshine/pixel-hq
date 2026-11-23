// A desk nameplate as the pane header: the agent's pixel pet, its job title, status and folder.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, InputState, Input } from "gpui-base";
import { panes, props, run, theme, home, layout, shared, setShared, appHome, readTextFile, writeTextFile, settings } from "herdr";
import { agentOf, duckMood, duckWidth, mood } from "./duck.js";

const ROLE = (p) => agentOf(p.program?.key)?.role ?? (p.program?.shell ? "Terminal" : (p.program?.name ?? "Contractor"));

// A notched pixel plate: a 2px frame with cut corners around a fill of the same hue.
const frame = (border, fill) => [
  div().absolute().left(2).right(2).top(0).bottom(0).bg(border),
  div().absolute().left(0).right(0).top(2).bottom(2).bg(border),
  div().absolute().left(3).right(3).top(1).bottom(1).bg(fill),
  div().absolute().left(1).right(1).top(3).bottom(3).bg(fill),
];
// An opaque tint of c over the panel tone, and a label color pushed toward ink: a translucent fill lets the frame layers show
// through and darkens the plate, and the raw pastel is too light to read on it.
const day = () => settings().dark === false;
const soften = (c, k = 0.82) => {
  const to = day() ? "#d7d2e9" : "#cdd6f4";
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
const deepen = (c, k = 0.65) => {
  const to = "#1d1e3e";
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
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
    this.hovered = false;
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

  button(t, id, icon, command, args) {
    return div().id(id).p(3).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); run(command, args); })
      .child(svg(`mods/company-pane/${icon}.svg`).size(14));
  }

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
    const chip = (text, color, spin) => h_flex().relative().flex_none().gap(5).px(6).h(20).items_center()
      .children(frame(color + "aa", soften(color)))
      .child(div().flex_none().size(5).bg(color).when(st === "blocked", (lamp) => lamp.loop("opacity", { from: 0.3, to: 1, period: 900, easing: "ease-in-out" })))
      .when(Boolean(spin), el => el.child(svg("mods/company-pane/pixel-spinner.svg").size(12).flex_none().text_color(deepen(color, 0.8)).spin(900)))
      .child(div().font_family(MONO).font_bold().text_size(10).text_color(deepen(color, 0.8)).child(text));
    const status = st === "working" ? chip("typing", t.working ?? "#89b4fa", true)
      : st === "blocked" ? chip("needs you", t.blocked ?? "#e8744f")
      : st === "done" ? chip("shipped", t.done ?? "#8ec07c")
      : species ? chip("on break", t.idle ?? t.dim) : null;
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
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .child(avatar)
      .child(h_flex().flex_none().gap(7).items_center()
        .child(edit("name", div().id(`pn-${pane}`).truncate().max_w(220).px(3).font_semibold().text_color(t.foreground).child(title), 170))
        .child(edit("role", div().id(`pr-${pane}`).relative().flex_none().gap(5).pl(5).pr(7).h(20).flex().items_center()
          .children(frame(t.accent + "88", soften(t.accent)))
          .child(div().flex_none().w(2).h(10).bg(deepen(t.accent, 0.8)))
          .child(div().font_family(MONO).font_bold().text_size(10).text_color(deepen(t.accent, 0.8)).child(custom.role ?? ROLE(p))), 120)))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(Boolean(status), el => el.child(status))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
