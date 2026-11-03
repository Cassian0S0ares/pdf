import { pickAndOpen } from "./actions";

export function EmptyState() {
  return (
    <div className="empty-state">
      <p>Abra um PDF para começar</p>
      <button onClick={() => void pickAndOpen()}>Abrir arquivo</button>
      <small>ou arraste um arquivo para esta janela</small>
    </div>
  );
}
