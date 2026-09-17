"use client";
const KEY = "mahmood_store_v1";
const now = () => new Date().toISOString();
type Store = {
  traders: any[];
  purchases: any[];
  period_started_at: string;
  archives: any[];
};
const empty = (): Store => ({
  traders: [],
  purchases: [],
  period_started_at: now(),
  archives: [],
});
export function getLocalStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    return {
      traders: d.traders || [],
      purchases: d.purchases || [],
      period_started_at: d.period_started_at || now(),
      archives: d.archives || [],
    };
  } catch {
    return empty();
  }
}
function save(d: Store) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
export async function localAction(b: Record<string, unknown>) {
  const data = getLocalStore();
  let result: any = { ok: true };
  if (b.action === "trader") {
    const name = String(b.name || "").trim();
    if (!name) return response(false);
    result = { id: Date.now(), name };
    data.traders.push(result);
  } else if (b.action === "buy") {
    const buyKg = Number(b.buyKg),
      kiloPrice = Number(b.kiloPrice),
      created = now(),
      subtotal = buyKg * kiloPrice;
    if (
      !String(b.item || "").trim() ||
      !String(b.trader || "").trim() ||
      buyKg <= 0 ||
      kiloPrice <= 0
    )
      return response(false);
    result = {
      id: Date.now(),
      item: String(b.item).trim(),
      date: String(b.date),
      created_at: created,
      trader: String(b.trader),
      buy_kg: buyKg,
      kilo_price: kiloPrice,
      subtotal,
      fee: subtotal * 0.06,
      total: subtotal * 1.06,
      paid: Boolean(b.paid),
      paid_at: b.paid ? created : null,
      sold_kg: null,
      sold_money: null,
      sale_expense: 0,
      sale_expense_reason: "",
      difference_kg: null,
      profit: null,
      sold_at: null,
    };
    data.purchases.unshift(result);
  } else if (b.action === "sell" || b.action === "editSell") {
    const r = data.purchases.find((x) => x.id === Number(b.id)),
      soldKg = Number(b.soldKg),
      soldMoney = Number(b.soldMoney),
      expense = Number(b.expense || 0);
    if (!r || soldKg <= 0 || soldMoney <= 0 || expense < 0)
      return response(false);
    r.sold_kg = soldKg;
    r.sold_money = soldMoney;
    r.sale_expense = expense;
    r.sale_expense_reason = String(b.expenseReason || "").trim();
    r.difference_kg = r.buy_kg - soldKg;
    r.profit = soldMoney - r.total - expense;
    r.sold_at = r.sold_at || now();
    result = r;
  } else if (b.action === "editBuy") {
    const r = data.purchases.find((x) => x.id === Number(b.id)),
      buyKg = Number(b.buyKg),
      kiloPrice = Number(b.kiloPrice);
    if (
      !r ||
      !String(b.item || "").trim() ||
      !String(b.trader || "").trim() ||
      buyKg <= 0 ||
      kiloPrice <= 0
    )
      return response(false);
    r.item = String(b.item).trim();
    r.date = String(b.date);
    r.trader = String(b.trader);
    r.buy_kg = buyKg;
    r.kilo_price = kiloPrice;
    r.subtotal = buyKg * kiloPrice;
    r.fee = r.subtotal * 0.06;
    r.total = r.subtotal + r.fee;
    r.paid = Boolean(b.paid);
    r.paid_at = r.paid ? r.paid_at || now() : null;
    if (r.sold_money != null) {
      r.difference_kg = r.buy_kg - (r.sold_kg || 0);
      r.profit = r.sold_money - r.total - r.sale_expense;
    }
    result = r;
  } else if (b.action === "paid") {
    const r = data.purchases.find((x) => x.id === Number(b.id));
    if (!r) return response(false);
    r.paid = Boolean(b.paid);
    r.paid_at = r.paid ? now() : null;
    result = r;
  } else if (b.action === "reset") {
    const cleared = now();
    if (data.purchases.length)
      data.archives.unshift({
        id: Date.now(),
        from: data.period_started_at,
        to: cleared,
        cleared_at: cleared,
        records: data.purchases,
      });
    data.purchases = [];
    data.period_started_at = cleared;
    result = { ok: true };
  } else return response(false);
  save(data);
  return response(true, result);
}
function response(ok: boolean, value: any = {}) {
  return { ok, json: async () => value };
}
export function downloadBackup() {
  const blob = new Blob([JSON.stringify(getLocalStore(), null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mahmood-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
export async function restoreBackup(file: File) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.purchases) || !Array.isArray(data.traders))
    throw new Error("invalid");
  localStorage.setItem(KEY, JSON.stringify(data));
}
