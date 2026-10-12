export type Purchase = {
  id: number;
  item: string;
  date: string;
  created_at: string;
  trader: string;
  buy_kg: number;
  kilo_price: number;
  subtotal: number;
  fee: number;
  total: number;
  paid: boolean;
  paid_at: string | null;
  sold_kg: number | null;
  sold_money: number | null;
  sale_expense: number;
  sale_expense_reason: string;
  difference_kg: number | null;
  profit: number | null;
  sold_at: string | null;
};
export type Trader = { id: number; name: string };
export type Archive = { id: number; from: string; to: string; cleared_at: string; records: Purchase[] };
export const itemKey = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const money = (n: number) => Math.round(n || 0).toLocaleString("en-US") + " د.ع";
export const weight = (n: number) => Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 3 }) + " کیلۆ";
export const profitLabel = (n: number) => n > 0 ? "قازانجی پاک" : n < 0 ? "زیانی پاک" : "قازانج و زیان یەکسانن";
export const weightLabel = (n: number) => n > 0 ? "وەزنی کەمی پاک" : n < 0 ? "وەزنی زیادی پاک" : "کێش یەکسانە";
export const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function filterRecords(records: Purchase[], from: string, to: string, item: string, basis: "buy" | "sell" = "buy") {
  if (from && to && from > to) return [];
  return records.filter(r => {
    if (basis === "sell" && (r.sold_money == null || !r.sold_at)) return false;
    const date = basis === "sell" ? localDate(new Date(r.sold_at!)) : r.date;
    return (!from || date >= from) && (!to || date <= to) && (!item || itemKey(r.item) === item);
  });
}
export function summarize(records: Purchase[]) {
  const sold = records.filter(r => r.sold_money != null);
  // Unsold purchases are inventory; they are not realized losses or missing weight.
  return {
    buy: records.reduce((s, r) => s + r.total, 0),
    boughtKg: records.reduce((s, r) => s + r.buy_kg, 0),
    sales: sold.reduce((s, r) => s + (r.sold_money ?? 0), 0),
    soldKg: sold.reduce((s, r) => s + (r.sold_kg ?? 0), 0),
    expenses: sold.reduce((s, r) => s + (r.sale_expense || 0), 0),
    netProfit: Math.round(sold.reduce((s, r) => s + (r.sold_money ?? 0) - r.total - (r.sale_expense || 0), 0) * 100) / 100,
    netWeight: Math.round(sold.reduce((s, r) => s + r.buy_kg - (r.sold_kg ?? 0), 0) * 1000) / 1000,
    unpaid: records.filter(r => !r.paid).reduce((s, r) => s + r.total, 0),
    soldCount: sold.length,
  };
}
export function groupRecords(records: Purchase[]) {
  const groups = new Map<string, { key: string; name: string; rows: Purchase[] }>();
  records.forEach(r => {
    const key = itemKey(r.item);
    const group = groups.get(key) || { key, name: r.item.trim(), rows: [] };
    group.rows.push(r);
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "ckb"));
}
