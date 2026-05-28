type StatCardProps = {
  label: string;
  value: string | number;
  helper: string;
  onClick?: () => void;
};

export function StatCard({ label, value, helper, onClick }: StatCardProps) {
  const content = (
    <>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink-40)]">{label}</p>
      <p className="display mb-2 text-3xl text-[var(--green)]">{value}</p>
      <p className="text-sm text-[var(--ink-60)]">{helper}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        aria-label={`Jump to ${label}`}
        className="surface-card w-full rounded-[20px] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus:outline-none focus:ring-2 focus:ring-[var(--green-border)]"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <div className="surface-card rounded-[20px] p-5 transition duration-200 hover:-translate-y-0.5">{content}</div>;
}
