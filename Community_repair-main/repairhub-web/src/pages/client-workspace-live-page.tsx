import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/shared/page-header";
import { StatCard } from "../components/shared/stat-card";
import { chatMessages } from "../data/mock-data";
import { api, type RepairJobPayload, type RepairRequestPayload } from "../lib/api/client";
import { formatAudCurrency } from "../lib/payments/format";
import { formatRepairStatusLabel, isAwaitingActiveWork } from "../lib/repairs/status";
import { useAuthStore } from "../state/auth-store";

type ClientWorkspaceView = {
  repairRequests: RepairRequestPayload[];
  approvalQueue: RepairRequestPayload[];
  awaitingActiveWorkJobs: RepairJobPayload[];
  activeJobs: RepairJobPayload[];
  completedJobs: RepairJobPayload[];
};

async function fetchClientWorkspaceView(): Promise<ClientWorkspaceView> {
  const [repairRequests, jobs] = await Promise.all([api.listRepairRequests(), api.getClientJobs()]);
  const awaitingActiveWorkJobs = jobs.filter((job) => isAwaitingActiveWork(job.status));
  const activeOrCompletedRequestIds = new Set(
    jobs.filter((job) => !isAwaitingActiveWork(job.status)).map((job) => job.repair_request),
  );

  return {
    repairRequests,
    approvalQueue: repairRequests.filter(
      (repairRequest) =>
        (repairRequest.selected_repairer || repairRequest.selection_status !== "none") &&
        !activeOrCompletedRequestIds.has(repairRequest.id),
    ),
    awaitingActiveWorkJobs,
    activeJobs: jobs.filter((job) => !isAwaitingActiveWork(job.status) && !["collected", "completed"].includes(job.status)),
    completedJobs: jobs.filter((job) => ["collected", "completed"].includes(job.status)),
  };
}

export function ClientWorkspaceLivePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [removingJobId, setRemovingJobId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ["client-workspace"],
    queryFn: fetchClientWorkspaceView,
  });
  const checkoutMutation = useMutation({
    mutationFn: (bookingId: string) => api.createBookingCheckoutSession(bookingId),
  });
  const removeCollectedItemMutation = useMutation({
    mutationFn: (jobId: string) => api.removeCollectedItemFromWorkspace(jobId),
    onMutate: async (jobId) => {
      setRemovingJobId(jobId);
      setRemoveError(null);
      await queryClient.cancelQueries({ queryKey: ["client-workspace"] });
      const previousWorkspace = queryClient.getQueryData<ClientWorkspaceView>(["client-workspace"]);

      queryClient.setQueryData<ClientWorkspaceView | undefined>(["client-workspace"], (current) =>
        current
          ? {
              ...current,
              completedJobs: current.completedJobs.filter((job) => job.id !== jobId),
            }
          : current,
      );

      return { previousWorkspace };
    },
    onError: (mutationError, _jobId, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(["client-workspace"], context.previousWorkspace);
      }

      setRemoveError(
        mutationError instanceof Error
          ? mutationError.message
          : "RepairHub could not remove this collected item right now.",
      );
    },
    onSuccess: async (_response, jobId) => {
      queryClient.setQueryData<ClientWorkspaceView | undefined>(["client-workspace"], (current) =>
        current
          ? {
              ...current,
              completedJobs: current.completedJobs.filter((job) => job.id !== jobId),
            }
          : current,
      );
      await queryClient.invalidateQueries({ queryKey: ["client-workspace"] });
    },
    onSettled: () => {
      setRemovingJobId(null);
    },
  });

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    const bookingId = searchParams.get("booking_id");

    if (paymentStatus === "cancelled") {
      setPaymentNotice("Stripe checkout was cancelled. Your repair is still waiting for payment.");
      setPaymentError(null);
      setSearchParams({}, { replace: true });
      return;
    }

    if (paymentStatus !== "success" || !sessionId || !bookingId) {
      return;
    }

    const confirmedSessionId = sessionId;
    const confirmedBookingId = bookingId;
    let isCancelled = false;

    async function confirmStripePayment() {
      setPaymentNotice("Confirming Stripe payment...");
      setPaymentError(null);
      try {
        await api.confirmBookingPayment(confirmedBookingId, confirmedSessionId);
        if (isCancelled) {
          return;
        }
        setPaymentNotice("Stripe payment confirmed. Your repair has been marked as completed.");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["client-workspace"] }),
          queryClient.invalidateQueries({ queryKey: ["repairer-dashboard"] }),
        ]);
      } catch (confirmationError) {
        if (isCancelled) {
          return;
        }
        setPaymentNotice(null);
        setPaymentError(
          confirmationError instanceof Error
            ? confirmationError.message
            : "RepairHub could not confirm the Stripe payment.",
        );
      } finally {
        if (!isCancelled) {
          setSearchParams({}, { replace: true });
        }
      }
    }

    void confirmStripePayment();

    return () => {
      isCancelled = true;
    };
  }, [queryClient, searchParams, setSearchParams]);

  if (isPending) {
    return (
      <div className="surface-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-40)]">Client Workspace</p>
        <h1 className="display mt-2 text-3xl text-[var(--green)]">Loading workspace</h1>
        <p className="mt-3 text-sm text-[var(--ink-60)]">Fetching your repair requests, approval queue, and job status updates.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="surface-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-40)]">Client Workspace</p>
        <h1 className="display mt-2 text-3xl text-[var(--green)]">Workspace unavailable</h1>
        <p className="mt-3 text-sm text-[var(--ink-60)]">
          {error instanceof Error
            ? error.message
            : "RepairHub could not load the client workspace right now."}
        </p>
      </div>
    );
  }

  const pendingApprovals = data.approvalQueue.filter((request) => request.selection_status === "pending").length;
  const approvedAwaitingPayment = data.approvalQueue.filter((request) => request.selection_status === "approved").length;
  const completedAwaitingPaymentJobs = data.activeJobs.filter(
    (job) => job.status === "ready" && job.payment_status !== "paid",
  );
  const awaitingActiveWorkJobsByRequestId = new Map(
    data.awaitingActiveWorkJobs.map((job) => [job.repair_request, job]),
  );

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="space-y-8">
      {/* <section className="rounded-[32px] bg-[linear-gradient(180deg,#f6f3ee_0%,#e6efe7_100%)] p-8 text-white shadow-[var(--shadow-lg)]">
        <PageHeader
          aside={
            <div className="rounded-[20px] bg-white/8 px-5 py-4 text-sm text-white/80">
              {data.approvalQueue.length} repairer decisions · {data.activeJobs.length} live repair(s)
            </div>
          }
          className="border-white/10 pb-0"
          description="Track repairer approval decisions, unlock payment only after approval, and follow the same live status updates the repairer sets on the job."
          eyebrow="Client Workspace"
          title={`Welcome back, ${user?.first_name ?? "Customer"}`}
        >
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/80">
            <span>{data.repairRequests.length} total repair request(s)</span>
            <span>{data.completedJobs.length} completed collection(s)</span>
          </div>
        </PageHeader>
      </section> */}
      <section className="rounded-4xl bg-[linear-gradient(180deg,#f6f3ee_0%,#e6efe7_100%)] p-8 text-[#1a1916] shadow-(--shadow-lg)">
          <PageHeader
            aside={
              /* Changed bg-white/8 to a soft green tint, and white text to your deep ink color */
              <div className="rounded-[20px] bg-[#1d4b20]/10 px-5 py-4 text-sm text-[#1a1916]/80 font-medium">
                {data.approvalQueue.length} repairer decisions · {data.activeJobs.length} live repair(s)
              </div>
            }
            /* Changed the border divider from white to a soft green border */
            className="border-[#b8d4ba]/40 pb-0"
            /* The sub-components will inherit the dark text, but you can pass classes if PageHeader requires explicit styling */
            description="Track repairer approval decisions, unlock payment only after approval, and follow the same live status updates the repairer sets on the job."
            eyebrow="Client Workspace"
            title={`Welcome back, ${user?.first_name ?? "Customer"}`}
          >
            {/* Changed text-white/80 to text-[#1a1916]/70 for secondary text clarity */}
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#1a1916]/70">
              <span>{data.repairRequests.length} total repair request(s)</span>
              <span>{data.completedJobs.length} completed collection(s)</span>
            </div>
          </PageHeader>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper="Waiting for a repairer response"
          label="Pending Approval"
          onClick={() => scrollToSection("approval-queue-section")}
          value={pendingApprovals}
        />
        <StatCard
          helper="Approved items waiting for payment or active work"
          label="Approved Queue"
          onClick={() => scrollToSection("approval-queue-section")}
          value={approvedAwaitingPayment}
        />
        <StatCard
          helper="Live statuses from repairers"
          label="Active Repairs"
          onClick={() => scrollToSection("active-repairs-section")}
          value={data.activeJobs.length}
        />
        <StatCard
          helper="Collected or completed items"
          label="Completed"
          onClick={() => scrollToSection("completed-jobs-section")}
          value={data.completedJobs.length}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="surface-card p-6" id="approval-queue-section">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-40)]">Repairer Decisions</p>
              <h3 className="display text-3xl text-[var(--green)]">Approval and rejection queue</h3>
            </div>
            {data.approvalQueue.length ? (
              <div className="space-y-4">
                {data.approvalQueue.map((repairRequest) => {
                  const awaitingActiveWorkJob = awaitingActiveWorkJobsByRequestId.get(repairRequest.id);

                  return (
                  <div key={repairRequest.id} className="rounded-[20px] border border-[var(--cream-3)] bg-[var(--card)] p-5">
                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{repairRequest.item_name}</p>
                        <p className="text-sm text-[var(--ink-60)]">
                          {repairRequest.category_name ?? "Uncategorised"} · {repairRequest.selected_repairer_name ?? "No repairer selected"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--cream-2)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-60)]">
                        {formatRepairStatusLabel(repairRequest.selection_status)}
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-[var(--ink-60)]">
                      <span className="font-semibold text-[var(--ink)]">Your reason:</span> {repairRequest.customer_selection_reason || "No reason submitted yet."}
                    </p>
                    <p className="text-sm text-[var(--ink-60)]">
                      <span className="font-semibold text-[var(--ink)]">Repairer response:</span>{" "}
                      {repairRequest.repairer_response_reason ||
                        (repairRequest.selection_status === "pending"
                          ? "Waiting for the repairer to review this item."
                          : repairRequest.selection_status === "approved"
                            ? awaitingActiveWorkJob
                              ? "Approved. Waiting for the repairer to move this item into Active Work."
                              : "Approved. Waiting for the repairer to prepare this item for work."
                            : "No response recorded.")}
                    </p>
                  </div>
                );
                })}
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--ink-60)]">No repairer approvals are waiting right now. Select a matched repairer from the request flow to start the review process.</p>
            )}
          </section>

          <section className="surface-card p-6" id="active-repairs-section">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-40)]">Live Repair Status</p>
              <h3 className="display text-3xl text-[var(--green)]">Active repairs</h3>
            </div>
            {paymentNotice ? (
              <p className="mb-4 rounded-[18px] bg-[var(--green-light)] p-4 text-sm text-[var(--green)]">{paymentNotice}</p>
            ) : null}
            {paymentError ? (
              <p className="mb-4 rounded-[18px] bg-[rgba(175,99,18,0.12)] p-4 text-sm text-[var(--amber)]">{paymentError}</p>
            ) : null}
            {completedAwaitingPaymentJobs.length ? (
              <p
                aria-live="polite"
                className="mb-4 rounded-[18px] bg-[var(--green-light)] p-4 text-sm text-[var(--green)]"
              >
                {completedAwaitingPaymentJobs.length === 1
                  ? "Your repair is completed. Review the final update below and pay when you are ready to close the repair."
                  : `${completedAwaitingPaymentJobs.length} repairs are completed. Review the final updates below and pay when you are ready to close them.`}
              </p>
            ) : null}
            {data.activeJobs.length ? (
              <div className="space-y-4">
                {data.activeJobs.map((job) => (
                  <div key={job.id} className="rounded-[20px] border border-[var(--cream-3)] bg-[var(--card)] p-5">
                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{job.item_name}</p>
                        <p className="text-sm text-[var(--ink-60)]">
                          {job.repairer_name} · Ref #{job.reference_code}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--green-light)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--green)]">
                        {formatRepairStatusLabel(job.status, job.payment_status)}
                      </span>
                    </div>
                    <p className="mb-2 text-sm text-[var(--ink-60)]">
                      <span className="font-semibold text-[var(--ink)]">Issue:</span> {job.issue_description}
                    </p>
                    <p className="mb-2 text-sm text-[var(--ink-60)]">
                      <span className="font-semibold text-[var(--ink)]">Quote:</span> {formatAudCurrency(job.quote_amount)}
                    </p>
                    {job.status === "ready" && job.payment_status !== "paid" ? (
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[var(--green-light)] p-4 text-sm text-[var(--green)]">
                        <p>Your repair is completed. Pay now to close this repair and move it into the completed list on both dashboards.</p>
                        <button
                          className="rounded-full bg-[var(--green)] px-5 py-3 text-sm font-semibold text-white"
                          disabled={checkoutMutation.isPending}
                          onClick={() =>
                            checkoutMutation.mutate(job.booking, {
                              onSuccess: (session) => {
                                setPaymentNotice(null);
                                setPaymentError(null);
                                window.location.assign(session.url);
                              },
                              onError: (checkoutError) => {
                                setPaymentError(
                                  checkoutError instanceof Error
                                    ? checkoutError.message
                                    : "RepairHub could not start Stripe checkout.",
                                );
                              },
                            })
                          }
                          type="button"
                        >
                          {checkoutMutation.isPending ? "Redirecting..." : "Pay Now"}
                        </button>
                      </div>
                    ) : null}
                    <div className="rounded-[18px] bg-[var(--cream-2)] p-4 text-sm text-[var(--ink-60)]">
                      <span className="font-semibold text-[var(--ink)]">Latest update:</span> {job.latest_update || "The repairer has not posted an update yet."}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--ink-60)]">No active repair jobs yet. Once payment is confirmed after approval, the repair status will appear here.</p>
            )}
          </section>

          {data.completedJobs.length ? (
            <section className="surface-card p-6" id="completed-jobs-section">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-40)]">Completed Jobs</p>
                <h3 className="display text-3xl text-[var(--green)]">Collected items</h3>
              </div>
              {removeError ? (
                <p className="mb-4 rounded-[18px] bg-[rgba(175,99,18,0.12)] p-4 text-sm text-[var(--amber)]">{removeError}</p>
              ) : null}
              <div className="space-y-3">
                {data.completedJobs.map((job) => (
                  <div key={job.id} className="rounded-[20px] border border-[var(--cream-3)] bg-[var(--card)] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{job.item_name}</p>
                        <p className="text-sm text-[var(--ink-60)]">
                          {job.repairer_name} · {formatRepairStatusLabel(job.status, job.payment_status)} · Ref #{job.reference_code}
                        </p>
                      </div>
                      <button
                        aria-label={`Remove ${job.item_name} from collected items`}
                        className="rounded-full border border-[var(--cream-3)] px-4 py-2 text-sm font-semibold text-[var(--ink-60)] transition hover:border-[var(--green-border)] hover:text-[var(--green)]"
                        disabled={removingJobId === job.id}
                        onClick={() => removeCollectedItemMutation.mutate(job.id)}
                        type="button"
                      >
                        {removingJobId === job.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <div className="soft-panel rounded-[24px] p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--green-mid)]">Payment Rule</p>
            <h3 className="display mb-3 text-3xl text-[var(--green)]">Approval before payment</h3>
            <p className="text-sm leading-7 text-[var(--ink-60)]">
              RepairHub now blocks payment until the selected repairer approves your item. Pending and rejected decisions stay visible here until you act.
            </p>
          </div>
          <div className="surface-card p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-40)]">Chat Panel</p>
            <div className="space-y-3">
              {chatMessages.map((message) => (
                <div key={`${message.time}-${message.body}`} className={`rounded-[18px] p-3 text-sm ${message.from === "repairer" ? "bg-[var(--cream-2)] text-[var(--ink)]" : "bg-[var(--green)] text-white"}`}>
                  <p>{message.body}</p>
                  <p className={`mt-2 text-xs ${message.from === "repairer" ? "text-[var(--ink-40)]" : "text-white/70"}`}>{message.time}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
