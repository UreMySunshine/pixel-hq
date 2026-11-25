import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, keys, appHome, readTextFile, theme, settings } from "herdr";

const MONO = "JetBrains Mono, Menlo, monospace";

const notch = (c, [l, r, t, b]) => [
  div().absolute().left(l + 2).right(r + 2).top(t).bottom(b).bg(c),
  div().absolute().left(l).right(r).top(t + 2).bottom(b + 2).bg(c),
];
const box = (frame, fill, shadow) => [
  ...notch(shadow, [2, 0, 2, 0]),
  ...notch(frame, [0, 2, 0, 2]),
  ...notch(fill, [2, 4, 2, 4]),
];

// The panel follows the layout's theme: cream paper with an ink frame by day, the night panel after dark.
const day = () => settings().dark === false;
const PALETTE = {
  light: {
    frame: "#3b3358", shadow: "#3b335859", plate: "#f6ead6", group: "#fdf6ea", groupFrame: "#c9b99a", head: "#efe2c8",
    row: "#f6ead6", rowHover: "#eeddba", rowHoverFrame: "#3b3358", rowFrame: "#c9b99a", key: "#ffffff", keyFrame: "#3b3358", button: "#f6ead6", buttonText: "#3b3358", buttonHover: "#3b3358",
    badgeFill: "#2748c414", badgeFrame: "#2748c444",
    accent: "#2748c4", title: "#3b3358", name: "#3b3358", desc: "#6b6584", faint: "#8a84a3", none: "#a39dbb",
    rule: "#c9b99a",
  },
  dark: {
    frame: "#45475a", shadow: "#11111b", plate: "#181825", group: "#14141e", groupFrame: "#262637", head: "#1e1e2e",
    row: "#181825", rowHover: "#222334", rowHoverFrame: "#3b3e5b", rowFrame: "#262637", key: "#11111b", keyFrame: "#45475a", button: "#313244", buttonText: "#a6adc8", buttonHover: "#ffffff",
    badgeFill: "#89b4fa18", badgeFrame: "#89b4fa44",
    accent: "#89b4fa", title: "#cdd6f4", name: "#cdd6f4", desc: "#6c7086", faint: "#6c7086", none: "#585b70",
    rule: "#313244",
  },
};

const HOTKEY_CATEGORIES = [
  {
    category: "Workspace Floors",
    items: [
      { action: "mod.open:company-switcher", name: "Floor Switcher", desc: "Open floor switcher (hold Ctrl and press P repeatedly to cycle)" },
      { action: "space.next", name: "Next Floor", desc: "Switch to next workspace floor" },
      { action: "space.prev", name: "Previous Floor", desc: "Switch to previous workspace floor" },
      { action: "space.new", name: "New Floor", desc: "Create a new workspace floor" },
      { action: "space.select:1", name: "Jump to Floor 1–9", desc: "Jump directly to floor 1–9", customKeys: ["alt-1 … alt-9"] },
      { action: "space.rename", name: "Rename Floor", desc: "Rename current workspace floor" },
    ],
  },
  {
    category: "Split Panes",
    items: [
      { action: "pane.split:right", name: "Split Right", desc: "Split active pane vertically to the right" },
      { action: "pane.split:down", name: "Split Down", desc: "Split active pane horizontally downward" },
      { action: "pane.close", name: "Close Pane", desc: "Close active workspace pane" },
      { action: "pane.zoom", name: "Toggle Zoom", desc: "Toggle maximize / restore active pane" },
      { action: "layout.switch", name: "Switch Layout", desc: "Switch active display layout" },
      { action: "pane.go:left", name: "Focus Navigation", desc: "Navigate focus between adjacent panes", customKeys: ["alt-h / j / k / l", "alt-left / right"] },
    ],
  },
  {
    category: "Tabs & Terminals",
    items: [
      { action: "tab.new", name: "New Tab", desc: "Open a new terminal tab in active pane" },
      { action: "tab.close", name: "Close Tab", desc: "Close current terminal tab" },
      { action: "tab.next", name: "Next Tab", desc: "Switch to next tab" },
      { action: "tab.prev", name: "Previous Tab", desc: "Switch to previous tab" },
      { action: "tab.select:1", name: "Jump to Tab 1–9", desc: "Jump directly to tab 1–9", customKeys: ["ctrl-1 … ctrl-9"] },
      { action: "tab.rename", name: "Rename Tab", desc: "Rename current terminal tab" },
      { action: "terminal.copy", name: "Copy Selection", desc: "Copy selection from terminal" },
      { action: "terminal.paste", name: "Paste", desc: "Paste clipboard text into terminal" },
      { action: "terminal.search", name: "Search Terminal", desc: "Search scrollback buffer in terminal" },
    ],
  },
  {
    category: "System & Palette",
    items: [
      { action: "app.palette", name: "Command Palette", desc: "Open global command palette" },
      { action: "app.settings", name: "Settings", desc: "Open application settings" },
      { action: "app.help", name: "Help", desc: "Open help and documentation" },
      { action: "layout.toggle:sidebar", name: "Toggle Sidebar", desc: "Toggle left sidebar" },
      { action: "app.zoom_in", name: "Zoom In / Out / Reset", desc: "Adjust UI zoom scale", customKeys: ["ctrl-+", "ctrl--", "ctrl-0"] },
    ],
  },
];

function formatChord(chord) {
  if (!chord) return "";
  return chord
    .split("-")
    .map((p) => {
      p = p.trim().toLowerCase();
      if (p === "ctrl") return "Ctrl";
      if (p === "alt") return "Alt";
      if (p === "shift") return "Shift";
      if (p === "pagedown") return "PgDn";
      if (p === "pageup") return "PgUp";
      if (p === "escape") return "Esc";
      if (p === "enter") return "Enter";
      return p.toUpperCase();
    })
    .join(" + ");
}

export default class CompanyHotkeys extends View {
  init(_props, cx) {
    this.rawKeys = null;
    this.handle = cx.focus_handle();
    this.handle.focus();

    cx.spawn(async (cx) => {
      try {
        const home = appHome();
        const raw = await readTextFile(`${home}/keys.json`).catch(() => null);
        if (raw) {
          this.rawKeys = JSON.parse(raw);
          cx.notify();
        }
      } catch {}
    });
  }

  closeModal() {
    const ov = props()?.overlay;
    if (ov) {
      closeOverlay(ov);
    } else {
      run("overlay.close");
    }
  }

  getBindingsMap() {
    const map = new Map();

    if (this.rawKeys?.global) {
      for (const [chord, act] of Object.entries(this.rawKeys.global)) {
        if (!map.has(act)) map.set(act, []);
        map.get(act).push(chord);
      }
    }

    const allKeys = keys() ?? [];
    for (const k of allKeys) {
      if (k.section === "global") {
        if (!map.has(k.action)) map.set(k.action, []);
        if (!map.get(k.action).includes(k.keys)) {
          map.get(k.action).push(k.keys);
        }
      }
    }

    return map;
  }

  render(cx) {
    const bindingsMap = this.getBindingsMap();
    const C = PALETTE[day() ? "light" : "dark"];

    return v_flex()
      .id("company-hotkeys")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          this.closeModal();
          cx.stop_propagation();
        }
      })
      .size_full()
      .min_h(0)
      .relative()
      .children(box(C.frame, C.plate, C.shadow))
      .child(
        v_flex()
          .relative()
          .size_full()
          .p(12)
          .gap(8)
          .font_family(MONO)
          .text_size(12)
          .child(
            h_flex()
              .h(30)
              .px(4)
              .pb(6)
              .items_center()
              .justify_between()
              .border_b(1)
              .border_color(C.rule)
              .child(
                h_flex()
                  .gap(8)
                  .items_center()
                  .child(svg("mods/company-brand/keyboard.svg").size(15).text_color(C.accent))
                  .child(
                    div()
                      .text_size(12)
                      .font_bold()
                      .text_color(C.title)
                      .child("HOTKEYS REFERENCE"),
                  )
                  .child(
                    div()
                      .px(5)
                      .py(1)
                      .bg(C.badgeFill)
                      .border_2()
                      .border_color(C.badgeFrame)
                      .text_size(9)
                      .font_bold()
                      .text_color(C.accent)
                      .child("READ-ONLY"),
                  ),
              )
              .child(
                h_flex()
                  .id("btn-esc-hotkeys")
                  .relative()
                  .h(22)
                  .px(8)
                  .items_center()
                  .justify_center()
                  .cursor_pointer()
                  .children(box(C.frame, C.button, C.shadow))
                  .hover((s) => s.text_color(C.buttonHover))
                  .on_click((_e, _cx) => this.closeModal())
                  .child(
                    div()
                      .font_family(MONO)
                      .text_size(9.5)
                      .font_bold()
                      .text_color(C.buttonText)
                      .child("ESC"),
                  ),
              ),
          )
      .child(
        v_flex()
          .id("hotkeys-scroll-area")
          .flex_1()
          .min_h(0)
          .gap(8)
          .overflow_y_scrollbar()
          .children(
            HOTKEY_CATEGORIES.map((cat, catIdx) =>
              v_flex()
                .id(`hotkey-cat-${catIdx}`)
                .p(6)
                .gap(5)
                .bg(C.group)
                .border_2()
                .border_color(C.groupFrame)
                .child(
                  h_flex()
                    .px(8)
                    .py(3)
                    .bg(C.head)
                    .border_2()
                    .border_color(C.groupFrame)
                    .items_center()
                    .child(
                      div()
                        .font_bold()
                        .font_family(MONO)
                        .text_size(10)
                        .text_color(C.accent)
                        .child(`■ ${cat.category.toUpperCase()} ■`),
                    ),
                )
                .child(
                  v_flex()
                    .gap(3)
                    .children(
                      cat.items.map((item, itemIdx) => {
                        const boundChords = item.customKeys ?? bindingsMap.get(item.action) ?? [];

                        return h_flex()
                          .id(`hotkey-row-${catIdx}-${itemIdx}`)
                          .px(8)
                          .py(4)
                          .bg(C.row)
                          .border_2()
                          .border_color(C.rowFrame)
                          .items_center()
                          .justify_between()
                          .hover((s) => s.bg(C.rowHover).border_color(C.rowHoverFrame))
                          .child(
                            v_flex()
                              .flex_1()
                              .min_w(0)
                              .gap(1)
                              .child(
                                div()
                                  .font_family(MONO)
                                  .text_size(11)
                                  .font_bold()
                                  .text_color(C.name)
                                  .child(item.name),
                              )
                              .child(
                                div()
                                  .font_family(MONO)
                                  .text_size(9)
                                  .text_color(C.desc)
                                  .child(item.desc),
                              ),
                          )
                          .child(
                            h_flex()
                              .gap(4)
                              .items_center()
                              .flex_wrap()
                              .children(
                                boundChords.length > 0
                                  ? boundChords.map((chord) =>
                                      div()
                                        .px(6)
                                        .py(1)
                                        .bg(C.key)
                                        .border_2()
                                        .border_color(C.keyFrame)
                                        .text_size(9)
                                        .font_bold()
                                        .font_family(MONO)
                                        .text_color(C.accent)
                                        .child(formatChord(chord)),
                                    )
                                  : [
                                      div()
                                        .font_family(MONO)
                                        .text_size(11)
                                        .text_color(C.none)
                                        .child("—"),
                                    ],
                              ),
                          );
                      }),
                    ),
                ),
            ),
          ),
      )
          .child(
            h_flex()
              .h(24)
              .px(6)
              .items_center()
              .justify_between()
              .border_t(1)
              .border_color(C.rule)
              .font_family(MONO)
              .text_size(9)
              .text_color(C.faint)
              .child("HOLD CTRL + TAP P TO CYCLE FLOORS · ALT+[ / ALT+] SWITCH FLOORS")
              .child("ESC CLOSE"),
          ),
      );
  }
}
