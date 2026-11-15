// Day and night colours for the office mod's pixel chrome. The layout runs a dark
// and a light theme (themes/pixel-hq.json, themes/pixel-hq-light.json) and the
// drawn parts follow it: by day the plaques and forms get light fills and the
// scene (scene.js) is a daytime office. The pets themselves stay the same.
import { settings } from "herdr";

export const isDay = () => settings().dark === false;

// Notched frames, plaque fills, buttons, nameplates and the like.
export const pal = () => (isDay() ? {
  frame: "#b3add0",     // a plaque's 2px frame
  fill: "#f6f4fb",      // plaque fill
  deep: "#e4e0f2",      // deepest fill: the search box, the hire form
  deepBox: "#f6f4fbee", // floating boxes (the update notice, "+N more")
  shadow: "#c6c0dd",    // the hard 2px shadow under a plaque
  dim: "#7d7899",       // the idle magnifier
  accent: "#7c5fe0",
  accentInk: "#ffffff",
  panel: "#c6c0dd",     // a secondary button
  panelInk: "#47445e",
  mutedText: "#6f6a8c", // unselected program chips
  plate: "#f6f4fbe6",   // a desk's nameplate
  plateInk: "#47445e",
  row: "#f6f4fbcc",     // a collapsed-list row
  rowEdge: "#7c5fe040",
} : {
  frame: "#45475a",
  fill: "#181825",
  deep: "#11111b",
  deepBox: "#11111bee",
  shadow: "#11111b",
  dim: "#7f849c",
  accent: "#89b4fa",
  accentInk: "#11111b",
  panel: "#313244",
  panelInk: "#cdd6f4",
  mutedText: "#a6adc8",
  plate: "#0f111acc",
  plateInk: "#ffffff",
  row: "#10121ccc",
  rowEdge: "#5B8C3A66",
});
