// Pixel HQ Hotkeys Reference (View-Only Cheat Sheet)
// Clean, read-only system hotkey inspection and cheat sheet for all workspace commands.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, keys, appHome, readTextFile } from "herdr";

const MONO = "JetBrains Mono, Menlo, monospace";

const HOTKEY_CATEGORIES = [
  {
    category: "Workspace Floors (Chuyển đổi sàn làm việc)",
    items: [
      { action: "mod.open:company-switcher", name: "Floor Switcher", desc: "Mở menu chuyển đổi sàn (hỗ trợ giữ Ctrl ấn P liên tục)" },
      { action: "space.next", name: "Next Floor", desc: "Chuyển sang sàn làm việc kế tiếp" },
      { action: "space.prev", name: "Previous Floor", desc: "Chuyển về sàn làm việc trước đó" },
      { action: "space.new", name: "New Floor", desc: "Tạo một sàn làm việc mới" },
      { action: "space.select:1", name: "Jump to Floor 1–9", desc: "Chuyển trực tiếp tới sàn số 1 đến 9", customKeys: ["alt-1 … alt-9"] },
      { action: "space.rename", name: "Rename Floor", desc: "Đổi tên sàn làm việc hiện tại" },
    ],
  },
  {
    category: "Split Panes (Chia khung làm việc)",
    items: [
      { action: "pane.split:right", name: "Split Right", desc: "Chia đôi khung theo chiều dọc sang bên phải" },
      { action: "pane.split:down", name: "Split Down", desc: "Chia đôi khung theo chiều ngang xuống dưới" },
      { action: "pane.close", name: "Close Pane", desc: "Đóng khung làm việc đang chọn" },
      { action: "pane.zoom", name: "Toggle Zoom", desc: "Phóng to / khôi phục kích thước khung đang chọn" },
      { action: "layout.switch", name: "Switch Layout", desc: "Chuyển đổi giao diện layout hiển thị" },
      { action: "pane.go:left", name: "Focus Navigation", desc: "Di chuyển tiêu điểm giữa các khung lân cận", customKeys: ["alt-h / j / k / l", "alt-left / right"] },
    ],
  },
  {
    category: "Tabs & Terminals (Tab & Dòng lệnh)",
    items: [
      { action: "tab.new", name: "New Tab", desc: "Mở tab terminal mới trong khung" },
      { action: "tab.close", name: "Close Tab", desc: "Đóng tab terminal hiện tại" },
      { action: "tab.next", name: "Next Tab", desc: "Chuyển sang tab kế tiếp" },
      { action: "tab.prev", name: "Previous Tab", desc: "Chuyển về tab trước đó" },
      { action: "tab.select:1", name: "Jump to Tab 1–9", desc: "Chuyển trực tiếp tới tab 1 đến 9", customKeys: ["ctrl-1 … ctrl-9"] },
      { action: "tab.rename", name: "Rename Tab", desc: "Đổi tên tab terminal hiện tại" },
      { action: "terminal.copy", name: "Copy Selection", desc: "Sao chép đoạn văn bản đã chọn trong terminal" },
      { action: "terminal.paste", name: "Paste", desc: "Dán văn bản từ clipboard vào terminal" },
      { action: "terminal.search", name: "Search Terminal", desc: "Tìm kiếm văn bản trong bộ đệm terminal" },
    ],
  },
  {
    category: "System & Palette (Hệ thống & Lệnh nhanh)",
    items: [
      { action: "app.palette", name: "Command Palette", desc: "Mở thanh tìm kiếm lệnh toàn cục" },
      { action: "app.settings", name: "Settings", desc: "Mở cửa sổ cài đặt ứng dụng" },
      { action: "app.help", name: "Help", desc: "Mở tài liệu hướng dẫn và trợ giúp" },
      { action: "layout.toggle:sidebar", name: "Toggle Sidebar", desc: "Ẩn / hiện thanh danh sách sàn bên trái" },
      { action: "app.zoom_in", name: "Zoom In / Out / Reset", desc: "Điều chỉnh tỷ lệ thu phóng giao diện", customKeys: ["ctrl-+", "ctrl--", "ctrl-0"] },
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
      .p(16)
      .gap(12)
      .bg("#181825")
      .rounded(12)
      .border_1()
      .border_color("#ffffff14")
      .text_size(12.5)
      // Header
      .child(
        h_flex()
          .h(30)
          .items_center()
          .justify_between()
          .child(
            h_flex()
              .gap(9)
              .items_center()
              .child(
                h_flex()
                  .size(24)
                  .rounded(6)
                  .bg("#89b4fa22")
                  .items_center()
                  .justify_center()
                  .child(div().text_size(12).font_bold().text_color("#89b4fa").child("⌨")),
              )
              .child(
                v_flex()
                  .gap(1)
                  .child(
                    h_flex()
                      .gap(8)
                      .items_center()
                      .child(
                        div()
                          .text_size(14)
                          .font_semibold()
                          .text_color("#cdd6f4")
                          .child("Pixel HQ Hotkeys Reference"),
                      )
                      .child(
                        h_flex()
                          .px(6)
                          .py(1)
                          .rounded(4)
                          .bg("#89b4fa18")
                          .border_1()
                          .border_color("#89b4fa44")
                          .child(
                            div()
                              .text_size(9.5)
                              .font_bold()
                              .text_color("#89b4fa")
                              .child("READ-ONLY"),
                          ),
                      ),
                  )
                  .child(
                    div()
                      .text_size(10.5)
                      .text_color("#6c7086")
                      .child("Bảng tra cứu phím tắt hệ thống đang kích hoạt"),
                  ),
              ),
          )
          .child(
            h_flex()
              .id("btn-esc-hotkeys")
              .px(10)
              .py(3)
              .rounded(5)
              .text_size(11)
              .text_color("#6c7086")
              .cursor_pointer()
              .hover((s) => s.bg("#ffffff14").text_color("#cdd6f4"))
              .on_click((_e, _cx) => this.closeModal())
              .child("Esc close"),
          ),
      )
      // Scrollable Reference List
      .child(
        v_flex()
          .id("hotkeys-scroll-area")
          .flex_1()
          .min_h(0)
          .gap(12)
          .overflow_y_scrollbar()
          .children(
            HOTKEY_CATEGORIES.map((cat, catIdx) =>
              v_flex()
                .id(`hotkey-cat-${catIdx}`)
                .p(10)
                .gap(6)
                .rounded(8)
                .bg("#1e1e2e")
                .border_1()
                .border_color("#ffffff14")
                .child(
                  div()
                    .font_semibold()
                    .text_size(12)
                    .text_color("#89b4fa")
                    .child(cat.category),
                )
                .child(
                  v_flex()
                    .gap(4)
                    .children(
                      cat.items.map((item, itemIdx) => {
                        const boundChords = item.customKeys ?? bindingsMap.get(item.action) ?? [];

                        return h_flex()
                          .id(`hotkey-row-${catIdx}-${itemIdx}`)
                          .px(8)
                          .py(5)
                          .rounded(5)
                          .bg("#181825")
                          .items_center()
                          .justify_between()
                          .hover((s) => s.bg("#1b1b2a"))
                          .child(
                            v_flex()
                              .flex_1()
                              .min_w(0)
                              .gap(1)
                              .child(
                                div()
                                  .text_size(11.5)
                                  .font_medium()
                                  .text_color("#cdd6f4")
                                  .child(item.name),
                              )
                              .child(
                                div()
                                  .text_size(10)
                                  .text_color("#6c7086")
                                  .child(item.desc),
                              ),
                          )
                          .child(
                            h_flex()
                              .gap(5)
                              .items_center()
                              .flex_wrap()
                              .children(
                                boundChords.length > 0
                                  ? boundChords.map((chord) =>
                                      h_flex()
                                        .h(22)
                                        .px(7)
                                        .rounded(4)
                                        .bg("#11111b")
                                        .border_1()
                                        .border_color("#89b4fa44")
                                        .items_center()
                                        .child(
                                          div()
                                            .text_size(10.5)
                                            .font_bold()
                                            .font_family(MONO)
                                            .text_color("#89b4fa")
                                            .child(formatChord(chord)),
                                        ),
                                    )
                                  : [
                                      div()
                                        .text_size(11)
                                        .text_color("#585b70")
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
      // Footer
      .child(
        h_flex()
          .justify_between()
          .text_size(10.5)
          .text_color("#6c7086")
          .child("💡 Tip: Giữ Ctrl ấn P nhiều lần để đổi sàn nhanh · Alt+[ / Alt+] chuyển sàn kế tiếp")
          .child("Esc close"),
      );
  }
}
