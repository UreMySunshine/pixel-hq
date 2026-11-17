import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, settings } from "herdr";

const MONO = "JetBrains Mono";
const R = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
const day = () => settings().dark === false;
// A strong color toned toward the panel tone, so a plate's fill stays a tint of its own color.
const soften = (c, k = 0.82) => {
  const to = day() ? "#d7d2e9" : "#cdd6f4";
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
// A label color pushed toward ink: keeps the hue, reads on the pale tint its plate sits on.
const deepen = (c, k = 0.65) => {
  const to = "#1d1e3e";
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
// A notched pixel plate: a 1px frame with cut corners around a tint of the same color.
const notch = (border, fill) => [
  div().absolute().left(2).right(2).top(0).bottom(0).bg(border),
  div().absolute().left(0).right(0).top(2).bottom(2).bg(border),
  div().absolute().left(3).right(3).top(1).bottom(1).bg(fill),
  div().absolute().left(1).right(1).top(3).bottom(3).bg(fill),
];

const monitor = (c) => div().relative().w(10).h(8).flex_none()
  .child(R(0, 0, 10, 1, c)).child(R(0, 7, 10, 1, c)).child(R(0, 1, 1, 6, c)).child(R(9, 1, 1, 6, c))
  .child(R(2, 2, 6, 4, c + "55")).child(R(3, 7, 4, 1, c));
const server = (c) => div().relative().w(8).h(8).flex_none()
  .children([0, 3, 6].flatMap((y) => [R(0, y, 8, 2, c), R(1, y, 6, 1, c + "88")]));
const branch = (c) => div().relative().w(8).h(10).flex_none().children(
  [[0, 0, 2, 2], [0, 8, 2, 2], [5, 2, 2, 2], [0, 2, 1, 6], [1, 4, 5, 1]].map(([x, y, w, h]) => R(x, y, w, h, c)));

export default class WorkspaceStatus extends View {
  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const working = t.working ?? "#89b4fa";
    const blocked = t.blocked ?? "#e8744f";
    const done = t.done ?? "#8ec07c";
    const idle = t.idle ?? t.dim;
    const n = (k) => list.filter(a => a.status === k).length;
    const rest = list.length - n("working") - n("blocked") - n("done");
    const plate = (color, text) => h_flex().relative().h(15).pl(6).pr(6).gap(4).items_center()
      .children(notch(color + "aa", soften(color)))
      .child(div().flex_none().size(4).bg(color))
      .child(div().font_family(MONO).font_bold().text_size(9.5).text_color(deepen(color)).child(text));
    const mark = (icon, text) => h_flex().gap(5).items_center().child(icon)
      .child(div().font_family(MONO).text_size(9.5).child(text));
    const sep = () => div().flex_none().w(1).h(11).bg(t.surface);
    return h_flex().size_full().px(12).gap(11).items_center().bg(t.chrome).border_t(1).border_color(t.surface)
      .child(h_flex().relative().h(15).pl(6).pr(6).items_center().children(notch(t.accent, t.accent))
        .child(div().font_family(MONO).font_bold().text_size(9.5).text_color(t.accent_foreground).child("PIXEL HQ")))
      .child(sep())
      .child(mark(space?.machine ? server(t.muted) : monitor(t.muted), space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(mark(branch(t.muted), space.branch)))
      .child(sep())
      .child(div().font_family(MONO).text_size(9.5).child(`${list.length} on the team`))
      .when(n("working") > 0, el => el.child(plate(working, `${n("working")} typing`)))
      .when(n("blocked") > 0, el => el.child(plate(blocked, `${n("blocked")} ${n("blocked") === 1 ? "needs" : "need"} you`)))
      .when(n("done") > 0, el => el.child(plate(done, `${n("done")} shipped`)))
      .when(rest > 0, el => el.child(plate(idle, `${rest} on break`)))
      .child(div().flex_1())
      .child(sep())
      .child(h_flex().id("palette").relative().h(15).pl(5).pr(5).items_center().cursor_pointer()
        .children(notch(t.raised, soften(t.raised)))
        .on_click(() => run("app.palette"))
        .child(div().font_family(MONO).text_size(9).text_color(deepen(t.dim)).child(this.hint(t))));
  }
}