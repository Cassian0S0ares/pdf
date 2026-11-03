import { EmptyState } from "./app/EmptyState";
import { Notices } from "./app/Notices";
import { PasswordDialog } from "./app/PasswordDialog";
import { Tabs } from "./app/Tabs";
import { Toolbar } from "./app/Toolbar";
import { useOpenFileSources } from "./app/useOpenFileSources";
import { SearchBar } from "./search/SearchBar";
import { Sidebar } from "./sidebar/Sidebar";
import { selectActiveTab, useDocuments } from "./store/documents";
import { DocumentView } from "./viewer/DocumentView";

export default function App() {
  useOpenFileSources();
  const tab = useDocuments(selectActiveTab);
  const sidebarOpen = useDocuments((s) => s.sidebarOpen);
  const searchOpen = useDocuments((s) => s.searchOpen);
  return (
    <div className="app">
      <Tabs />
      <Toolbar />
      {tab && searchOpen && <SearchBar key={tab.info.docId} tab={tab} />}
      <div className="main">
        {tab && sidebarOpen && <Sidebar key={tab.info.docId} tab={tab} />}
        {tab ? <DocumentView key={tab.info.docId} tab={tab} /> : <EmptyState />}
      </div>
      <PasswordDialog />
      <Notices />
    </div>
  );
}
