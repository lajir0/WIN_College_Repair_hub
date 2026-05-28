import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../state/auth-store";
import { LoginPage } from "./login-page";

vi.mock("../lib/api/client", () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        role: "guest",
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("toggles password visibility on the sign-in form", () => {
    renderPage();

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput.type).toBe("password");
  });

  it("toggles password visibility on the create-account form", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    const registerPasswordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText("Confirm password") as HTMLInputElement;

    expect(registerPasswordInput.type).toBe("password");
    expect(confirmPasswordInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    fireEvent.click(screen.getByRole("button", { name: "Show confirm password" }));

    expect(registerPasswordInput.type).toBe("text");
    expect(confirmPasswordInput.type).toBe("text");
  });
});
