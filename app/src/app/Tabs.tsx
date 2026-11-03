import { useDocuments } from "../store/documents";
import { closeFile } from "./openFile";

export function Tabs() {
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  const setActive = useDocuments((s) => s.setActive);
  if (tabs.length === 0) return null;
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.info.docId}
          role="tab"
          aria-selected={t.info.docId === activeId}
          className={t.info.docId === activeId ? "tab active" : "tab"}
          onClick={() => setActive(t.info.docId)}
          title={t.info.path ?? t.info.fileName}
        >
          <span>{t.info.title ?? t.info.fileName}</span>
          <button
            aria-label={`Fechar ${t.info.fileName}`}
            onClick={(e) => {
              e.stopPropagation();
              void closeFile(t.info.docId);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
