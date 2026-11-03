import { EmptyState } from "./app/EmptyState";
import { Notices } from "./app/Notices";
import { PasswordDialog } from "./app/PasswordDialog";
import { Tabs } from "./app/Tabs";
import { Toolbar } from "./app/Toolbar";
import { useOpenFileSources } from "./app/useOpenFileSources";
import { Sidebar } from "./sidebar/Sidebar";
import { selectActiveTab, useDocuments } from "./store/documents";
import { DocumentView } from "./viewer/DocumentView";

export default function App() {
  useOpenFileSources();
  const tab = useDocuments(selectActiveTab);
  const sidebarOpen = useDocuments((s) => s.sidebarOpen);
  return (
    <div className="app">
      <Tabs />
      <Toolbar />
      <div className="main">
        {tab && sidebarOpen && <Sidebar key={tab.info.docId} tab={tab} />}
        {tab ? <DocumentView key={tab.info.docId} tab={tab} /> : <EmptyState />}
      </div>
      <PasswordDialog />
      <Notices />
    </div>
  );
}
