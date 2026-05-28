function parseAmount(value: string | number) {
  return typeof value === "number" ? value : Number.parseFloat(value);
}

export function formatAudCurrency(value: string | number) {
  return `AUD ${new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseAmount(value))}`;
}
