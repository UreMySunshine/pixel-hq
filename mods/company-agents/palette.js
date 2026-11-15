// Day and night colours for the office mod's pixel chrome. The layout runs a dark
// and a light theme (themes/pixel-hq.json, themes/pixel-hq-light.json) and the
// drawn parts follow it: by day the plaques and forms get light fills and the
// scene (scene.js) is a daytime office. The pets themselves stay the same.
import { settings } from "herdr";

export const isDay = () => settings().dark === false;

// Notched frames, plaque fills, buttons, nameplates and the like.
export const pal = () => (isDay() ? {
  frame: "#bcc0cc",     // a plaque's 2px frame
  fill: "#ffffff",      // plaque fill
  deep: "#e6e9ef",      // deepest fill: the search box, the hire form
  deepBox: "#ffffffee", // floating boxes (the update notice, "+N more")
  shadow: "#c9cede",    // the hard 2px shadow under a plaque
  dim: "#8c8fa1",       // the idle magnifier
  accent: "#1e66f5",
  accentInk: "#ffffff",
  panel: "#ccd0da",     // a secondary button
  panelInk: "#4c4f69",
  mutedText: "#6c6f85", // unselected program chips
  plate: "#ffffffe6",   // a desk's nameplate
  plateInk: "#4c4f69",
  row: "#ffffffcc",     // a collapsed-list row
  rowEdge: "#5B8C3A33",
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
