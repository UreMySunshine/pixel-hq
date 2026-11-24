// Notifications as a Pixel HQ nameplate: a notched paper plate with a hard shadow,
// a status tab and monospace text. Click to run its action and dismiss it.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, settings } from "herdr";

const MONO = "JetBrains Mono";

const LEVEL = {
  error: { label: "ERROR", color: (t) => t.blocked ?? "#f38ba8" },
  warning: { label: "WARN", color: (t) => t.ansi3 ?? "#f9e2af" },
  success: { label: "DONE", color: (t) => t.done ?? "#a6e3a1" },
  info: { label: "INFO", color: (t) => t.working ?? "#89b4fa" },
};

// The office nameplates use cream paper by day and the night panel after dark.
const day = () => settings().dark === false;
const mix = (c, to, k) => {
  if (!/^#[0-9a-f]{6}$/i.test(c) || !/^#[0-9a-f]{6}$/i.test(to)) return c;
  const [a, b] = [c, to].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
const deepen = (c, k = 0.65) => mix(c, "#1d1e3e", k);
const tint = (c, k = 0.7) => mix(c, day() ? "#ffffff" : "#cdd6f4", k);

// A notched pixel plate: a 2px outline with cut corners, a fill and a hard 2px shadow off its right and bottom.
const frame = (border, fill, shadow = "#00000000") => [
  div().absolute().left(2).right(-2).top(2).bottom(-2).bg(shadow),
  div().absolute().left(2).right(2).top(0).bottom(0).bg(border),
  div().absolute().left(0).right(0).top(2).bottom(2).bg(border),
  div().absolute().left(3).right(3).top(1).bottom(1).bg(fill),
  div().absolute().left(1).right(1).top(3).bottom(3).bg(fill),
];

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
    }
    const lvl = LEVEL[p.level] ?? LEVEL.info;
    const accent = lvl.color(t);
    const ink = day() ? "#3b3358" : t.foreground;
    const paper = day() ? "#f6ead6" : (t.chrome ?? "#181825");
    const fill = this.hovered ? mix(paper, day() ? "#3b3358" : "#ffffff", 0.07) : paper;
    const border = day() ? "#3b3358" : deepen(t.accent, 0.5);
    const shadow = day() ? "#3b335859" : "#00000073";
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const text = (value) => p.fitHeight
      ? div().child(value)
      : div().truncate().child(typeof value === "string" ? value.split("\n", 1)[0] : value);
    const badge = p.icon
      ? image(p.icon).w(18).h(18).flex_none()
      : h_flex().relative().flex_none().gap(5).px(6).h(20).items_center()
          .children(frame(deepen(accent, 0.55), tint(accent), day() ? "#3b33583a" : "#00000055"))
          .child(div().flex_none().size(5).bg(accent))
          .child(div().font_family(MONO).font_bold().text_size(9).text_color(deepen(accent, 0.85)).child(lvl.label));
    return h_flex()
      .id("toast")
      .relative()
      .when(p.fitHeight, (el) => el.w_full().min_h(70).flex_none())
      .when(!p.fitHeight, (el) => el.size_full())
      .cursor_pointer()
      .on_hover((hovered, cx) => { if (hovered !== this.hovered) { this.hovered = hovered; cx.notify(); } })
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(div().absolute().left(2).right(2).top(2).bottom(5).children(frame(border, fill, shadow)))
      .child(h_flex().relative().size_full().px(14).py(10).gap(10).items_center()
        .child(badge)
        .child(v_flex().flex_1().min_w(0).overflow_hidden().gap(2)
          .child(text(login ? `${login[1]} needs a login: run` : p.title ?? "").font_family(MONO).font_bold().text_size(12).text_color(ink))
          .when(!login && Boolean(p.body), (el) => el.child(text(p.body).font_family(MONO).text_size(10).text_color(t.muted)))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).font_family(MONO).text_size(10).text_color(t.muted).child(command))
            .child(h_flex().id("toast-login-copy").relative().h(18).px(6).items_center()
              .children(frame(deepen(accent, 0.55), tint(accent), "#00000033"))
              .cursor_pointer()
              .on_click((_e, cx) => {
                cx.stop_propagation();
                cx.write_to_clipboard(command);
                this.copied = true;
                cx.notify();
              })
              .child(div().font_family(MONO).font_bold().text_size(9).text_color(deepen(accent, 0.85)).child(this.copied ? "COPIED" : "COPY")))))));
  }
}
