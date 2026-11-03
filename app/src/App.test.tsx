import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./app/useOpenFileSources", () => ({ useOpenFileSources: () => undefined }));

import App from "./App";

describe("App", () => {
  it("shows empty state when no document is open", () => {
    render(<App />);
    expect(screen.getByText("Abra um PDF para começar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir arquivo" })).toBeInTheDocument();
  });
});
