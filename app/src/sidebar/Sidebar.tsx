import { useState } from "react";
import type { Tab } from "../store/documents";
import { Outline } from "./OutlineView";
import { Thumbnails } from "./Thumbnails";

export function Sidebar({ tab }: { tab: Tab }) {
  const [panel, setPanel] = useState<"thumbs" | "outline">("thumbs");
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button aria-pressed={panel === "thumbs"} onClick={() => setPanel("thumbs")}>Páginas</button>
        <button aria-pressed={panel === "outline"} onClick={() => setPanel("outline")}>Marcadores</button>
      </div>
      <div className="sidebar-body">
        {panel === "thumbs" ? <Thumbnails tab={tab} /> : <Outline pdf={tab.pdf} />}
      </div>
    </aside>
  );
}
