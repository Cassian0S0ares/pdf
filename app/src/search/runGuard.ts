/** Garante que apenas a execução mais recente de uma tarefa assíncrona aplique seu resultado. */
export function createRunGuard(): { start(): () => boolean } {
  let current = 0;
  return {
    start() {
      const token = ++current;
      return () => token === current;
    },
  };
}
