// Notifications as a Pixel HQ nameplate: a stepped paper plate with a hard shadow,
// a pixel status tile and monospace text. Click to run its action and dismiss it.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, settings } from "herdr";

const MONO = "JetBrains Mono";

// `tone` is the level's theme colour. The name `color` is not used: the integrity test reports any call of that name as an unknown GPUI method.
const LEVEL = {
  error: { glyph: "x", tone: (t) => t.blocked ?? "#f38ba8" },
  warning: { glyph: "bang", tone: (t) => t.ansi3 ?? "#f9e2af" },
  success: { glyph: "tick", tone: (t) => t.done ?? "#a6e3a1" },
  info: { glyph: "dot", tone: (t) => t.working ?? "#89b4fa" },
};
// The office nameplates use cream paper by day and the night panel after dark.
const day = () => settings().dark === false;
const mix = (c, to, k) => {
  if (!/^#[0-9a-f]{6}$/i.test(c) || !/^#[0-9a-f]{6}$/i.test(to)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
const deepen = (c, k = 0.65) => mix(c, "#1d1e3e", k);

// A stepped rectangle: three overlapping blocks cut each corner in 2px steps. Insets are
// [left, right, top, bottom] from the container, so a shape can sit inside another.
const stairs = (c, [l, r, t, b]) => [
  div().absolute().left(l + 4).right(r + 4).top(t).bottom(b).bg(c),
  div().absolute().left(l + 2).right(r + 2).top(t + 2).bottom(b + 2).bg(c),
  div().absolute().left(l).right(r).top(t + 4).bottom(b + 4).bg(c),
];
// A pixel box: a 2px frame and a hard 2px shadow, both stepped. The container leaves the
// shadow's 2px on its right and bottom; the content sits 2px inside the frame.
const box = (frame, fill, shadow) => [
  ...stairs(shadow, [2, 0, 2, 0]),
  ...stairs(frame, [0, 2, 0, 2]),
  ...stairs(fill, [2, 4, 2, 4]),
];

// Pixel glyphs on a 2px grid.
const GLYPH = {
  tick: (c) => div().relative().flex_none().w(10).h(10)
    .children([[0, 6], [2, 8], [4, 6], [6, 4], [8, 2]].map(([x, y]) => div().absolute().left(x).top(y - 2).w(2).h(4).bg(c))),
  bang: (c) => div().relative().flex_none().w(4).h(10)
    .children([div().absolute().left(1).top(0).w(2).h(6).bg(c), div().absolute().left(1).top(8).w(2).h(2).bg(c)]),
  dot: (c) => div().relative().flex_none().size(10)
    .child(div().absolute().left(1).top(1).size(8).bg(c)),
  x: (c) => {
    const step = 2;
    return div().relative().flex_none().size(10)
      .children([0, 1, 2, 3, 4].flatMap((i) => [
        div().absolute().left(i * step).top(i * step).w(step).h(step).bg(c),
        div().absolute().left(10 - step - i * step).top(i * step).w(step).h(step).bg(c),
      ]));
  },
};

export default class Toast extends View {
  init() {
    this.hovered = false;
    this.copied = false;
  }

  render(cx) {
    const t = theme();
    const p = props() ?? {};
    if (this.overlay !== p.overlay) {
      this.overlay = p.overlay;
      this.copied = false;
      this.hovered = false;
      // The plate slides up from 12px below: it is first drawn at the offset, then moved.
      this.shown = false;
      cx.timer.after(30, (cx) => { this.shown = true; cx.notify(); });
    }
    const lvl = LEVEL[p.level] ?? LEVEL.info;
    const accent = lvl.tone(t);
    // Each level owns its plate: the frame takes the level colour, the paper is that colour
    // mixed into the office paper, and the title is written in the frame colour.
    const border = day() ? deepen(accent, 0.35) : accent;
    const paper = mix(day() ? "#f6ead6" : (t.chrome ?? "#181825"), accent, day() ? 0.26 : 0.14);
    const ink = day() ? border : deepen(accent, 0.5);
    const fill = this.hovered ? mix(paper, accent, day() ? 0.12 : 0.1) : paper;
    const shadow = day() ? deepen(accent, 0.35) + "59" : "#00000073";
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const text = (value) => p.fitHeight
      ? div().child(value)
      : div().truncate().child(typeof value === "string" ? value.split("\n", 1)[0] : value);
    // The tile is solid in the level colour; its glyph is the paper colour, so it reads on the tinted plate.
    const tileFill = day() ? accent : mix(accent, "#1d1e3e", 0.45);
    const tileInk = day() ? "#fffaf2" : accent;
    const badge = p.icon
      ? image(p.icon).w(18).h(18).flex_none()
      : h_flex().relative().flex_none().size(28).pl(2).pr(4).pt(2).pb(4).items_center().justify_center()
          .children(box(day() ? deepen(accent, 0.35) : accent, tileFill, day() ? deepen(accent, 0.35) + "3a" : "#00000055"))
          .child(GLYPH[lvl.glyph](tileInk));
    return h_flex()
      .id("toast")
      .relative()
      .when(p.fitHeight, (el) => el.w_full().min_h(70).flex_none())
      .when(!p.fitHeight, (el) => el.size_full())
      .top(this.shown ? 0 : 12).opacity(this.shown ? 1 : 0)
      .transition("top", { duration: 260, easing: "ease-out" })
      .transition("opacity", { duration: 180 })
      .cursor_pointer()
      .on_hover((hovered, cx) => { if (hovered !== this.hovered) { this.hovered = hovered; cx.notify(); } })
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(div().absolute().left(2).right(2).top(2).bottom(5).children(box(border, fill, shadow)))
      // A 4px strip of the level colour down the left edge, inside the frame.
      .child(div().absolute().left(6).top(8).bottom(9).w(4).bg(accent))
      .child(h_flex().relative().size_full().pl(18).pr(14).py(10).gap(10).items_center()
        .child(badge)
        .child(v_flex().flex_1().min_w(0).overflow_hidden().gap(2)
          .child(text(login ? `${login[1]} needs a login: run` : p.title ?? "").font_family(MONO).font_bold().text_size(12).text_color(ink))
          .when(!login && Boolean(p.body), (el) => el.child(text(p.body).font_family(MONO).text_size(10).text_color(day() ? mix(border, paper, 0.25) : t.muted)))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).font_family(MONO).text_size(10).text_color(day() ? mix(border, paper, 0.25) : t.muted).child(command))
            .child(h_flex().id("toast-login-copy").relative().h(20).pl(6).pr(8).pt(0).pb(2).items_center()
              .children(box(border, fill, day() ? border + "3a" : "#00000033"))
              .cursor_pointer()
              .on_click((_e, cx) => {
                cx.stop_propagation();
                cx.write_to_clipboard(command);
                this.copied = true;
                cx.notify();
              })
              .child(div().font_family(MONO).font_bold().text_size(9).text_color(day() ? ink : deepen(accent, 0.85)).child(this.copied ? "COPIED" : "COPY")))))));
  }
}
