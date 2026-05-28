import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api/client";
import { useAuthStore } from "../state/auth-store";
import { ClientWorkspaceLivePage } from "./client-workspace-live-page";

vi.mock("../lib/api/client", () => ({
  api: {
    listRepairRequests: vi.fn(),
    getClientJobs: vi.fn(),
    createBookingCheckoutSession: vi.fn(),
    confirmBookingPayment: vi.fn(),
    removeCollectedItemFromWorkspace: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

function renderPage(initialEntry = "/client") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ClientWorkspaceLivePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ClientWorkspaceLivePage", () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        role: "customer",
        user: {
          id: "customer-1",
          email: "customer@example.com",
          first_name: "Elena",
          last_name: "Adeyemi",
          role: "customer",
          profile_status: "active",
        },
        accessToken: "access-token",
        refreshToken: "refresh-token",
        isAuthenticated: true,
      });
    });

    mockedApi.listRepairRequests.mockResolvedValue([]);
    mockedApi.getClientJobs.mockResolvedValue([
      {
        id: "job-1",
        repair_request: "repair-request-1",
        booking: "booking-1",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        repairer: "repairer-profile-1",
        repairer_name: "Marcus Rivera",
        item_name: "Dining Chair",
        issue_description: "Rear chair leg is loose.",
        quote_amount: "105.00",
        payment_status: "pending",
        client_removed_at: null,
        status: "in_repair",
        reference_code: "RH-100001",
        estimated_ready_at: null,
        latest_update: "Repairer started active work on the device.",
        created_at: "2026-04-05T00:00:00Z",
        updated_at: "2026-04-05T00:05:00Z",
      },
    ]);
    mockedApi.createBookingCheckoutSession.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
      session_id: "cs_test_123",
    });
    mockedApi.confirmBookingPayment.mockResolvedValue({
      id: "booking-1",
      repair_request: "repair-request-1",
      repairer: "repairer-profile-1",
      scheduled_for: null,
      notes: "",
      subtotal_amount: "105.00",
      platform_fee_amount: "5.25",
      total_amount: "110.25",
      payment_status: "paid",
    });
    mockedApi.removeCollectedItemFromWorkspace.mockResolvedValue({
      job_id: "job-collected-1",
      removed_at: "2026-05-06T00:10:00Z",
      summary: {
        active_jobs: 1,
        completed_jobs: 0,
      },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
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

  it("shows the same active work status to the customer", async () => {
    renderPage();

    expect(await screen.findByText("Active repairs")).toBeInTheDocument();
    expect(screen.getByText("active work")).toBeInTheDocument();
    expect(screen.getByText(/Repairer started active work on the device\./)).toBeInTheDocument();
  });

  it("jumps to the relevant workspace sections when the summary cards are clicked", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    mockedApi.listRepairRequests.mockResolvedValue([
      {
        id: "repair-request-1",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        customer_email: "customer@example.com",
        category: "category-1",
        category_name: "Electronics",
        item_name: "Tablet",
        issue_description: "Screen flickers after startup.",
        urgency: "standard",
        pickup_preference: "dropoff",
        status: "matched",
        estimated_min_cost: 75,
        estimated_max_cost: 95,
        estimated_hours: 2,
        selected_repairer: "repairer-profile-1",
        selected_repairer_name: "Marcus Rivera",
        selected_service: "service-1",
        selected_service_title: "Tablet display repair",
        selected_quote_amount: "85.00",
        selection_status: "pending",
        customer_selection_reason: "Please review this item for repair.",
        repairer_response_reason: "",
        created_at: "2026-04-05T00:00:00Z",
        updated_at: "2026-04-05T00:05:00Z",
      },
      {
        id: "repair-request-2",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        customer_email: "customer@example.com",
        category: "category-2",
        category_name: "Furniture",
        item_name: "Dining Chair",
        issue_description: "Rear chair leg is loose.",
        urgency: "standard",
        pickup_preference: "dropoff",
        status: "booked",
        estimated_min_cost: 90,
        estimated_max_cost: 110,
        estimated_hours: 3,
        selected_repairer: "repairer-profile-2",
        selected_repairer_name: "Aiden Kim",
        selected_service: "service-2",
        selected_service_title: "Chair leg reinforcement",
        selected_quote_amount: "105.00",
        selection_status: "approved",
        customer_selection_reason: "Please fix the loose rear leg.",
        repairer_response_reason: "Approved and ready for work.",
        created_at: "2026-04-06T00:00:00Z",
        updated_at: "2026-04-06T00:05:00Z",
      },
    ]);
    mockedApi.getClientJobs.mockResolvedValue([
      {
        id: "job-1",
        repair_request: "repair-request-3",
        booking: "booking-1",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        repairer: "repairer-profile-1",
        repairer_name: "Marcus Rivera",
        item_name: "Desk Lamp",
        issue_description: "Rear chair leg is loose.",
        quote_amount: "105.00",
        payment_status: "pending",
        client_removed_at: null,
        status: "in_repair",
        reference_code: "RH-100001",
        estimated_ready_at: null,
        latest_update: "Repairer started active work on the device.",
        created_at: "2026-04-05T00:00:00Z",
        updated_at: "2026-04-05T00:05:00Z",
      },
      {
        id: "job-2",
        repair_request: "repair-request-4",
        booking: "booking-2",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        repairer: "repairer-profile-2",
        repairer_name: "Aiden Kim",
        item_name: "Desk Fan",
        issue_description: "Motor housing was repaired.",
        quote_amount: "55.00",
        payment_status: "paid",
        client_removed_at: null,
        status: "completed",
        reference_code: "RH-300002",
        estimated_ready_at: null,
        latest_update: "Desk fan repair is complete.",
        created_at: "2026-05-05T00:10:00Z",
        updated_at: "2026-05-05T00:15:00Z",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Approval and rejection queue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jump to Pending Approval" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Jump to Approved Queue" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Jump to Active Repairs" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: "Jump to Completed" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(4);
  });

  it("shows a pay action after the repairer marks the item completed", async () => {
    mockedApi.createBookingCheckoutSession.mockImplementation(
      () => new Promise(() => undefined),
    );
    mockedApi.getClientJobs.mockResolvedValue([
      {
        id: "job-2",
        repair_request: "repair-request-2",
        booking: "booking-2",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        repairer: "repairer-profile-1",
        repairer_name: "Marcus Rivera",
        item_name: "Dining Chair",
        issue_description: "Rear chair leg is loose.",
        quote_amount: "105.00",
        payment_status: "pending",
        client_removed_at: null,
        status: "ready",
        reference_code: "RH-100002",
        estimated_ready_at: null,
        latest_update: "Repair work is completed and waiting for customer payment.",
        created_at: "2026-04-05T00:00:00Z",
        updated_at: "2026-04-05T00:05:00Z",
      },
    ]);

    renderPage();

    expect(await screen.findByText("completed awaiting payment")).toBeInTheDocument();
    expect(
      screen.getByText("Your repair is completed. Review the final update below and pay when you are ready to close the repair."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your repair is completed. Pay now to close this repair and move it into the completed list on both dashboards."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));

    await waitFor(() => {
      expect(mockedApi.createBookingCheckoutSession).toHaveBeenCalledWith("booking-2");
    });
  });

  it("confirms the Stripe payment after redirecting back from checkout", async () => {
    mockedApi.getClientJobs.mockResolvedValue([
      {
        id: "job-2",
        repair_request: "repair-request-2",
        booking: "booking-2",
        customer: "customer-1",
        customer_name: "Elena Adeyemi",
        repairer: "repairer-profile-1",
        repairer_name: "Marcus Rivera",
        item_name: "Dining Chair",
        issue_description: "Rear chair leg is loose.",
        quote_amount: "105.00",
        payment_status: "pending",
        client_removed_at: null,
        status: "ready",
        reference_code: "RH-100002",
        estimated_ready_at: null,
        latest_update: "Repair work is completed and waiting for customer payment.",
        created_at: "2026-04-05T00:00:00Z",
        updated_at: "2026-04-05T00:05:00Z",
      },
    ]);

    renderPage("/client?payment=success&session_id=cs_test_123&booking_id=booking-2");

    await waitFor(() => {
      expect(mockedApi.confirmBookingPayment).toHaveBeenCalledWith("booking-2", "cs_test_123");
    });
    expect(await screen.findByText("Stripe payment confirmed. Your repair has been marked as completed.")).toBeInTheDocument();
  });

  it("removes only the customer's collected item from the completed list and decrements the completed count", async () => {
    const collectedJob = {
      id: "job-collected-1",
      repair_request: "repair-request-collected-1",
      booking: "booking-collected-1",
      customer: "customer-1",
      customer_name: "Elena Adeyemi",
      repairer: "repairer-profile-1",
      repairer_name: "Marcus Rivera",
      item_name: "Table Lamp",
      issue_description: "Switch assembly was replaced.",
      quote_amount: "75.00",
      payment_status: "paid",
      client_removed_at: null,
      status: "collected",
      reference_code: "RH-300001",
      estimated_ready_at: null,
      latest_update: "Customer collected the repaired lamp.",
      created_at: "2026-05-05T00:00:00Z",
      updated_at: "2026-05-05T00:05:00Z",
    } as const;
    const secondCollectedJob = {
      id: "job-collected-2",
      repair_request: "repair-request-collected-2",
      booking: "booking-collected-2",
      customer: "customer-1",
      customer_name: "Elena Adeyemi",
      repairer: "repairer-profile-2",
      repairer_name: "Aiden Kim",
      item_name: "Desk Fan",
      issue_description: "Motor housing was repaired.",
      quote_amount: "55.00",
      payment_status: "paid",
      client_removed_at: null,
      status: "completed",
      reference_code: "RH-300002",
      estimated_ready_at: null,
      latest_update: "Desk fan repair is complete.",
      created_at: "2026-05-05T00:10:00Z",
      updated_at: "2026-05-05T00:15:00Z",
    } as const;
    mockedApi.getClientJobs.mockResolvedValueOnce([collectedJob, secondCollectedJob]).mockResolvedValue([secondCollectedJob]);

    renderPage();

    expect(await screen.findByText("Collected items")).toBeInTheDocument();
    expect(screen.getByText("2 completed collection(s)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Table Lamp from collected items" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove Table Lamp from collected items" })).toHaveTextContent("Removing...");
      expect(screen.getByRole("button", { name: "Remove Desk Fan from collected items" })).toHaveTextContent("Remove");
    });
    await waitFor(() => {
      expect(mockedApi.removeCollectedItemFromWorkspace).toHaveBeenCalledWith("job-collected-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Table Lamp")).not.toBeInTheDocument();
      expect(screen.getByText("1 completed collection(s)")).toBeInTheDocument();
      expect(screen.getByText("Desk Fan")).toBeInTheDocument();
    });
  });
});
