import { View, div } from "gpui-kit";
import { agents, checking, setBadge } from "herdr";

export default class DockBadge extends View {
  render() {
    const list = agents();
    const count = list.filter(
      (a) => a.status === "blocked" || a.status === "done",
    ).length;

    // The Dock badge is app-wide, so set it when the count changes rather than on
    // every render. Both blocked and done agents are waiting for the person.
    const badge = count === 0 ? null : count > 99 ? "99+" : String(count);
    if (!checking() && badge !== this.badge) {
      this.badge = badge;
      setBadge(badge);
    }

    // The mod needs a block in the layout to run. The block is 0 px, so this
    // draws nothing and takes no space.
    return div();
  }
}