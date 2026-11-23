const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const fmtMoney = (n: number) => money.format(n);
export const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
