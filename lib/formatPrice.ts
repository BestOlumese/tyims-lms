export function formatPrice(amount: number): string {
  if (amount === 0) return "Free";
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
