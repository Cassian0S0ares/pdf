import { useEffect, useState } from "react";
import { usePasswordPrompt } from "../store/passwordPrompt";

export function PasswordDialog() {
  const { open, incorrect, fileName, answer } = usePasswordPrompt();
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue("");
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-label="Senha do documento"
        onSubmit={(e) => {
          e.preventDefault();
          answer(value);
        }}
      >
        <h2>Documento protegido</h2>
        <p>{fileName} exige senha para abrir.</p>
        {incorrect && <p className="error">Senha incorreta. Tente novamente.</p>}
        <input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Senha" />
        <div className="modal-actions">
          <button type="button" onClick={() => answer(null)}>Cancelar</button>
          <button type="submit">Abrir</button>
        </div>
      </form>
    </div>
  );
}
