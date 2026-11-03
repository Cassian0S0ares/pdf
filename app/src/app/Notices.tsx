import { useEffect } from "react";
import { useNotices } from "../store/notices";

export function Notices() {
  const { notices, dismiss } = useNotices();
  useEffect(() => {
    const timers = notices.filter((n) => n.kind === "info").map((n) => setTimeout(() => dismiss(n.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [notices, dismiss]);
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice ${n.kind}`}>
          <span>{n.text}</span>
          <button aria-label="Dispensar" onClick={() => dismiss(n.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
