"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  downloadBackup,
  getLocalStore,
  localAction,
  restoreBackup,
} from "./local-store";
type Purchase = {
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
type Trader = { id: number; name: string };
type Archive = {
  id: number;
  from: string;
  to: string;
  cleared_at: string;
  records: Purchase[];
};
const iso = () => new Date().toISOString().slice(0, 10);
const localIso = (d: Date) => {
  const copy = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
};
const money = (n: number) =>
  Math.round(n || 0).toLocaleString("en-US") + " د.ع";
const dt = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("ckb-IQ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";
export default function FruitApp({ displayName }: { displayName: string }) {
  const [view, setView] = useState<"buy" | "sell" | "history" | "report">(
      "buy",
    ),
    [traders, setTraders] = useState<Trader[]>([]),
    [records, setRecords] = useState<Purchase[]>([]),
    [archives, setArchives] = useState<Archive[]>([]),
    [periodStart, setPeriodStart] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [item, setItem] = useState(""),
    [date, setDate] = useState(iso()),
    [trader, setTrader] = useState(""),
    [kg, setKg] = useState(0),
    [price, setPrice] = useState(0),
    [paid, setPaid] = useState(false);
  const [selected, setSelected] = useState(""),
    [soldKg, setSoldKg] = useState(0),
    [soldMoney, setSoldMoney] = useState(0),
    [expense, setExpense] = useState(0),
    [expenseReason, setExpenseReason] = useState("");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [weekItem, setWeekItem] = useState(""),
    [receipt, setReceipt] = useState<{
      record: Purchase;
      kind: "buy" | "sell";
    } | null>(null),
    [edit, setEdit] = useState<{
      record: Purchase;
      kind: "buy" | "sell";
    } | null>(null);
  const subtotal = kg * price,
    fee = subtotal * 0.06,
    total = subtotal + fee;
  const purchase = useMemo(
    () => records.find((r) => r.id === Number(selected)),
    [records, selected],
  );
  const diff = purchase ? purchase.buy_kg - soldKg : 0,
    profit = purchase ? soldMoney - purchase.total - expense : 0;
  const load = async () => {
    const d = getLocalStore();
    setTraders(d.traders);
    setRecords(d.purchases);
    setArchives(d.archives || []);
    setPeriodStart(d.period_started_at);
  };
  useEffect(() => {
    load();
  }, []);
  const reportRecords = useMemo(
    () =>
      records.filter((r) => (!from || r.date >= from) && (!to || r.date <= to)),
    [records, from, to],
  );
  const stats = useMemo(() => {
    const sold = reportRecords.filter((r) => r.sold_money != null),
      profits = sold.filter((r) => (r.profit || 0) >= 0),
      losses = sold.filter((r) => (r.profit || 0) < 0);
    return {
      buy: reportRecords.reduce((s, r) => s + r.total, 0),
      sales: sold.reduce((s, r) => s + (r.sold_money || 0), 0),
      expenses: sold.reduce((s, r) => s + (r.sale_expense || 0), 0),
      profit: profits.reduce((s, r) => s + (r.profit || 0), 0),
      loss: losses.reduce((s, r) => s + Math.abs(r.profit || 0), 0),
      low: sold
        .filter((r) => (r.difference_kg || 0) > 0)
        .reduce((s, r) => s + Math.abs(r.difference_kg || 0), 0),
      over: sold
        .filter((r) => (r.difference_kg || 0) < 0)
        .reduce((s, r) => s + Math.abs(r.difference_kg || 0), 0),
      unpaid: reportRecords
        .filter((r) => !r.paid)
        .reduce((s, r) => s + r.total, 0),
    };
  }, [reportRecords]);
  const weekInfo = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sold = records.filter((r) => {
      if (r.sold_money == null || !r.sold_at) return false;
      const saleDate = new Date(r.sold_at);
      return saleDate >= start && saleDate < new Date(end.getTime() + 86400000);
    });
    const grouped = new Map<string, { name: string; rows: Purchase[] }>();
    sold.forEach((r) => {
      const key = r.item.trim().toLocaleLowerCase();
      const group = grouped.get(key) || { name: r.item.trim(), rows: [] };
      group.rows.push(r);
      grouped.set(key, group);
    });
    return {
      start: localIso(start),
      end: localIso(end),
      groups: [...grouped.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "ckb"),
      ),
    };
  }, [records]);
  const visibleWeekGroups = weekItem
    ? weekInfo.groups.filter((g) => g.name === weekItem)
    : weekInfo.groups;
  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const r = await localAction(body);
    setBusy(false);
    return r;
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      await restoreBackup(file);
      await load();
      setNotice("باکئەپەکە بە سەرکەوتوویی گەڕێندرایەوە");
    } catch {
      setNotice("فایلی باکئەپ دروست نییە");
    }
  }
  async function addTrader() {
    const name = prompt("ناوی نوێ بنووسە");
    if (!name?.trim()) return;
    const r = await post({ action: "trader", name });
    if (r.ok) {
      const t = await r.json();
      setTraders((x) => [...x, t]);
      setTrader(t.name);
    }
  }
  async function saveBuy(e: FormEvent) {
    e.preventDefault();
    if (!item || !trader || kg <= 0 || price <= 0) {
      setNotice("تکایە هەموو خانە پێویستەکان پڕ بکەوە");
      return;
    }
    const r = await post({
      action: "buy",
      item,
      date,
      trader,
      buyKg: kg,
      kiloPrice: price,
      paid,
    });
    if (r.ok) {
      setNotice("پسوڵەی کڕین پاشەکەوت کرا");
      setItem("");
      setKg(0);
      setPrice(0);
      setPaid(false);
      await load();
    }
  }
  async function saveSell(e: FormEvent) {
    e.preventDefault();
    if (
      !purchase ||
      soldKg <= 0 ||
      soldMoney <= 0 ||
      (expense > 0 && !expenseReason.trim())
    ) {
      setNotice(
        expense > 0 && !expenseReason.trim()
          ? "هۆکاری مەسروفات بنووسە"
          : "تکایە زانیاری فرۆشتن پڕ بکەوە",
      );
      return;
    }
    const r = await post({
      action: "sell",
      id: purchase.id,
      soldKg,
      soldMoney,
      expense,
      expenseReason,
    });
    if (r.ok) {
      setNotice("پسوڵەی فرۆشتن پاشەکەوت کرا");
      setSelected("");
      setSoldKg(0);
      setSoldMoney(0);
      setExpense(0);
      setExpenseReason("");
      await load();
    }
  }
  async function togglePaid(r: Purchase) {
    await post({ action: "paid", id: r.id, paid: !r.paid });
    await load();
  }
  async function saveEdit(body: Record<string, unknown>) {
    const response = await post(body);
    if (response.ok) {
      setEdit(null);
      setNotice("پسوڵەکە نوێکرایەوە و هەژمارەکان دووبارە ژمێردران");
      await load();
    } else {
      setNotice("تکایە زانیارییەکان بە دروستی پڕ بکەوە");
    }
  }
  async function resetPeriod() {
    if (
      !confirm(
        "دڵنیایت؟ هەموو هەژماری ئێستا دەچێتە ئەرشیف و دەورەیەکی نوێ دەست پێدەکات.",
      )
    )
      return;
    const r = await post({ action: "reset", confirm: "CLEAR" });
    if (r.ok) {
      setNotice("هەژماری نوێ دەستی پێکرد؛ دەورەی پێشوو لە ئەرشیف پارێزرا");
      setFrom("");
      setTo("");
      await load();
    }
  }
  function printReceipt(r: Purchase, kind: "buy" | "sell") {
    setReceipt({ record: r, kind });
    setTimeout(() => window.print(), 80);
  }
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">M</div>
          <div>
            <h1>Mahmood</h1>
            <p>سیستەمی کڕین و فرۆشتن</p>
          </div>
        </div>
        <span className="offline-badge">● ئۆفلاین</span>
      </header>
      <section className="content">
        <div className="welcome">
          <div>
            <h2>بەخێربێیت 👋</h2>
            <p>{displayName}</p>
          </div>
          <span className="datechip">
            {new Intl.DateTimeFormat("ckb-IQ", { dateStyle: "long" }).format(
              new Date(),
            )}
          </span>
        </div>
        {notice && (
          <button className="notice" onClick={() => setNotice("")}>
            {notice} ×
          </button>
        )}
        {view !== "report" && view !== "history" && (
          <div className="tabs">
            <button
              onClick={() => setView("buy")}
              className={`tab ${view === "buy" ? "active" : ""}`}
            >
              کڕین
            </button>
            <button
              onClick={() => setView("sell")}
              className={`tab ${view === "sell" ? "active" : ""}`}
            >
              فرۆشتن
            </button>
          </div>
        )}
        {view === "buy" && (
          <form onSubmit={saveBuy} className="card">
            <Head n="١" title="فۆڕمی کڕین" />
            <div className="formgrid">
              <Field label="بابەت" full>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="بۆ نموونە: پرتەقاڵ"
                />
              </Field>
              <Field label="بەروار">
                <input
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  type="date"
                />
              </Field>
              <div className="field">
                <label>ناوی معل</label>
                <div className="inline">
                  <div className="inputwrap">
                    <select
                      value={trader}
                      onChange={(e) => setTrader(e.target.value)}
                    >
                      <option value="">ناو هەڵبژێرە</option>
                      {traders.map((t) => (
                        <option key={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={addTrader} className="addbtn">
                    ＋
                  </button>
                </div>
              </div>
              <Num label="کێشی کڕین" value={kg} set={setKg} suffix="کیلۆ" />
              <Num
                label="نرخی هەر کیلۆ"
                value={price}
                set={setPrice}
                suffix="د.ع"
              />
              <label className="checkfield full">
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                <span>
                  <b>پارەکە دراوە</b>
                  <small>کاتی دان بەخۆکار تۆمار دەکرێت</small>
                </span>
              </label>
            </div>
            <Summary
              rows={[
                ["کۆی نرخی کڕین", money(subtotal)],
                ["زیادکراوی ٦٪", money(fee)],
              ]}
              total={money(total)}
            />
            <div className="actions">
              <button disabled={busy} className="primary">
                {busy ? "چاوەڕوانبە…" : "پاشەکەوتکردن"}
              </button>
            </div>
          </form>
        )}
        {view === "sell" && (
          <form onSubmit={saveSell} className="card">
            <Head n="٢" title="فۆڕمی فرۆشتن" />
            <div className="formgrid">
              <Field label="بابەتی کڕدراو" full>
                <select
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setSoldKg(0);
                    setSoldMoney(0);
                    setExpense(0);
                    setExpenseReason("");
                  }}
                >
                  <option value="">کاڵایەک هەڵبژێرە</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.item} — {r.buy_kg} کیلۆ — {r.date}
                    </option>
                  ))}
                </select>
              </Field>
              <Num
                label="کێشی فرۆشراو"
                value={soldKg}
                set={setSoldKg}
                suffix="کیلۆ"
              />
              <Num
                label="پارەی فرۆشراو"
                value={soldMoney}
                set={setSoldMoney}
                suffix="د.ع"
              />
              <Num
                label="مەسروفات"
                value={expense}
                set={setExpense}
                suffix="د.ع"
              />
              <Field label="هۆکاری مەسروفات">
                <input
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder="بۆ نموونە: گواستنەوە"
                />
              </Field>
            </div>
            {purchase && (
              <>
                <div className={`weightbox ${diff < 0 ? "extra" : "missing"}`}>
                  <span>
                    {diff === 0
                      ? "کێش یەکسانە"
                      : diff > 0
                        ? "وەزنی کەم"
                        : "وەزنی زیاد"}
                  </span>
                  <b>{Math.abs(diff).toLocaleString()} کیلۆ</b>
                  <small>
                    کڕدراو: {purchase.buy_kg} / فرۆشراو: {soldKg}
                  </small>
                </div>
                <div className={`result ${profit >= 0 ? "win" : "loss"}`}>
                  <small>{profit >= 0 ? "قازانجی پاک" : "زیانی پاک"}</small>
                  <strong>{money(Math.abs(profit))}</strong>
                </div>
              </>
            )}
            <div className="actions">
              <button disabled={busy} className="primary">
                پاشەکەوتکردن
              </button>
            </div>
          </form>
        )}
        {view === "history" && (
          <section className="card wide">
            <Head n="▤" title="تۆماری مامەڵەکان" />
            <div className="records">
              {records.length === 0 ? (
                <p className="empty">هێشتا هیچ مامەڵەیەک نییە</p>
              ) : (
                records.map((r) => (
                  <article key={r.id} className="record detailed">
                    <div className="record-main">
                      <div>
                        <b>{r.item}</b>
                        <small>
                          {r.date} · {r.trader} · {r.buy_kg} کیلۆ
                        </small>
                      </div>
                      <strong>{money(r.total)}</strong>
                    </div>
                    <div className="statusrow">
                      <button
                        onClick={() => togglePaid(r)}
                        className={`paidbadge ${r.paid ? "yes" : "no"}`}
                      >
                        {r.paid ? "✓ پارە دراوە" : "○ پارە نەدراوە"}
                      </button>
                      <small>
                        {r.paid_at ? dt(r.paid_at) : dt(r.created_at)}
                      </small>
                    </div>
                    {r.sold_money != null && (
                      <div className="sale-mini">
                        <span>فرۆش: {money(r.sold_money)}</span>
                        <span
                          className={(r.profit || 0) >= 0 ? "green" : "red"}
                        >
                          {(r.profit || 0) >= 0 ? "قازانج" : "زیان"}:{" "}
                          {money(Math.abs(r.profit || 0))}
                        </span>
                      </div>
                    )}
                    <div className="receipt-actions">
                      <button
                        className="edit-receipt"
                        onClick={() => setEdit({ record: r, kind: "buy" })}
                      >
                        دەستکاری کڕین ✎
                      </button>
                      <button onClick={() => printReceipt(r, "buy")}>
                        پسوڵەی کڕین
                      </button>
                      {r.sold_money != null && (
                        <>
                          <button
                            className="edit-receipt"
                            onClick={() => setEdit({ record: r, kind: "sell" })}
                          >
                            دەستکاری فرۆشتن ✎
                          </button>
                          <button onClick={() => printReceipt(r, "sell")}>
                            پسوڵەی فرۆشتن
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
        {view === "report" && (
          <section className="report">
            <div className="report-title">
              <div>
                <h2>ڕاپۆرتی هەژمار</h2>
                <p>دەورە لە {dt(periodStart)} دەستی پێکردووە</p>
              </div>
              <button
                onClick={() => {
                  setReceipt(null);
                  setTimeout(() => window.print(), 50);
                }}
                className="secondary"
              >
                چاپی ڕاپۆرت 🖨
              </button>
            </div>
            <div className="range">
              <Field label="لە بەرواری">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="تا بەرواری">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                هەمووی
              </button>
            </div>
            <div className="metricgrid">
              <Metric label="کۆی کڕین" value={money(stats.buy)} />
              <Metric
                label="کۆی فرۆشتن"
                value={money(stats.sales)}
                tone="blue"
              />
              <Metric
                label="کۆی قازانج"
                value={money(stats.profit)}
                tone="green"
              />
              <Metric label="کۆی زیان" value={money(stats.loss)} tone="red" />
              <Metric
                label="کۆی مەسروفات"
                value={money(stats.expenses)}
                tone="orange"
              />
              <Metric
                label="قەرزی نەدراو"
                value={money(stats.unpaid)}
                tone="red"
              />
              <Metric
                label="کۆی وەزنی زیاد"
                value={`${stats.over.toLocaleString()} کیلۆ`}
                tone="blue"
              />
              <Metric
                label="کۆی وەزنی کەم"
                value={`${stats.low.toLocaleString()} کیلۆ`}
                tone="orange"
              />
            </div>
            <section className="card weekly-items">
              <div className="weekly-head">
                <div>
                  <Head n="٧" title="فرۆشی ئەم هەفتەیە بە پێی بابەت" />
                  <p>
                    لە {weekInfo.start} تا {weekInfo.end}
                  </p>
                </div>
                <select
                  value={weekItem}
                  onChange={(e) => setWeekItem(e.target.value)}
                >
                  <option value="">هەموو بابەتەکان</option>
                  {weekInfo.groups.map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              {visibleWeekGroups.length === 0 ? (
                <p className="empty">ئەم هەفتەیە هیچ فرۆشتنێک تۆمار نەکراوە</p>
              ) : (
                <div className="weekly-grid">
                  {visibleWeekGroups.map((group) => {
                    const totals = group.rows.reduce(
                      (sum, r) => ({
                        bought: sum.bought + r.buy_kg,
                        sold: sum.sold + (r.sold_kg || 0),
                        money: sum.money + (r.sold_money || 0),
                        expense: sum.expense + (r.sale_expense || 0),
                        profit: sum.profit + Math.max(r.profit || 0, 0),
                        loss: sum.loss + Math.abs(Math.min(r.profit || 0, 0)),
                        low: sum.low + Math.max(r.difference_kg || 0, 0),
                        over:
                          sum.over +
                          Math.abs(Math.min(r.difference_kg || 0, 0)),
                      }),
                      {
                        bought: 0,
                        sold: 0,
                        money: 0,
                        expense: 0,
                        profit: 0,
                        loss: 0,
                        low: 0,
                        over: 0,
                      },
                    );
                    return (
                      <details className="weekly-card" key={group.name}>
                        <summary>
                          <div>
                            <b>{group.name}</b>
                            <small>{group.rows.length} پسوڵەی فرۆشتن</small>
                          </div>
                          <strong>{money(totals.money)}</strong>
                        </summary>
                        <div className="weekly-totals">
                          <span>
                            کڕدراو <b>{totals.bought} کیلۆ</b>
                          </span>
                          <span>
                            فرۆشراو <b>{totals.sold} کیلۆ</b>
                          </span>
                          <span>
                            مەسروفات <b>{money(totals.expense)}</b>
                          </span>
                          <span className="green">
                            قازانج <b>{money(totals.profit)}</b>
                          </span>
                          <span className="red">
                            زیان <b>{money(totals.loss)}</b>
                          </span>
                          <span>
                            وەزنی کەم <b>{totals.low} کیلۆ</b>
                          </span>
                          <span>
                            وەزنی زیاد <b>{totals.over} کیلۆ</b>
                          </span>
                        </div>
                        <div className="weekly-lines">
                          {group.rows.map((r) => (
                            <div key={r.id}>
                              <span>
                                {dt(r.sold_at)} · {r.trader}
                              </span>
                              <span>
                                {r.sold_kg} کیلۆ · {money(r.sold_money || 0)}
                              </span>
                              <b
                                className={
                                  (r.profit || 0) >= 0 ? "green" : "red"
                                }
                              >
                                {(r.profit || 0) >= 0 ? "قازانج" : "زیان"}{" "}
                                {money(Math.abs(r.profit || 0))}
                              </b>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="card report-details">
              <Head n="≡" title="وردەکاری تاکەکان" />
              {reportRecords.length === 0 ? (
                <p className="empty">مامەڵە نییە</p>
              ) : (
                reportRecords.map((r) => (
                  <div className="reportrow" key={r.id}>
                    <div>
                      <b>{r.item}</b>
                      <small>
                        {r.date} · {r.trader}
                      </small>
                    </div>
                    <div>
                      <span>کڕین {money(r.total)}</span>
                      <span>
                        فرۆشتن{" "}
                        {r.sold_money == null ? "—" : money(r.sold_money)}
                      </span>
                    </div>
                    <div>
                      <span>
                        {r.difference_kg == null
                          ? "کێش —"
                          : `${r.difference_kg >= 0 ? "کەم" : "زیاد"} ${Math.abs(r.difference_kg)} کیلۆ`}
                      </span>
                      <strong
                        className={(r.profit || 0) >= 0 ? "green" : "red"}
                      >
                        {r.profit == null
                          ? "—"
                          : `${r.profit >= 0 ? "قازانج" : "زیان"} ${money(Math.abs(r.profit))}`}
                      </strong>
                    </div>
                  </div>
                ))
              )}
            </section>
            <button
              onClick={resetPeriod}
              disabled={busy || records.length === 0}
              className="clearbtn"
            >
              پاککردنەوەی هەژماری ئەم هەفتەیە
              <small>
                تۆمارەکان نازڕێنەوە؛ دەچنە ئەرشیف ({archives.length})
              </small>
            </button>
            <div className="backup-actions">
              <button type="button" onClick={downloadBackup}>
                داگرتنی باکئەپ
              </button>
              <label>
                گەڕاندنەوەی باکئەپ
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => importBackup(e.target.files?.[0])}
                />
              </label>
            </div>
          </section>
        )}
      </section>
      <nav className="bottomnav four">
        <Nav
          active={view === "buy"}
          onClick={() => setView("buy")}
          icon="＋"
          label="کڕین"
        />
        <Nav
          active={view === "sell"}
          onClick={() => setView("sell")}
          icon="⇄"
          label="فرۆشتن"
        />
        <Nav
          active={view === "history"}
          onClick={() => setView("history")}
          icon="▤"
          label="تۆمار"
        />
        <Nav
          active={view === "report"}
          onClick={() => {
            setReceipt(null);
            setView("report");
          }}
          icon="▦"
          label="ڕاپۆرت"
        />
      </nav>
      {receipt && <Receipt record={receipt.record} kind={receipt.kind} />}{" "}
      {edit && (
        <EditReceipt
          record={edit.record}
          kind={edit.kind}
          traders={traders}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
        />
      )}
    </main>
  );
}
function Head({ n, title }: { n: string; title: string }) {
  return (
    <div className="cardhead">
      <span className="step">{n}</span>
      <h3>{title}</h3>
    </div>
  );
}
function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>{label}</label>
      <div className="inputwrap">{children}</div>
    </div>
  );
}
function Num({
  label,
  value,
  set,
  suffix,
  full,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  suffix: string;
  full?: boolean;
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>{label}</label>
      <div className="inputwrap has-suffix">
        <input
          value={value || ""}
          onChange={(e) => set(+e.target.value)}
          inputMode="decimal"
          type="number"
          min="0"
          step="any"
          placeholder="٠"
        />
        <span className="suffix">{suffix}</span>
      </div>
    </div>
  );
}
function Summary({ rows, total }: { rows: string[][]; total: string }) {
  return (
    <div className="summary">
      {rows.map((r) => (
        <div key={r[0]} className="sumrow">
          <span>{r[0]}</span>
          <b>{r[1]}</b>
        </div>
      ))}
      <div className="sumrow total">
        <span>کۆی گشتی</span>
        <span>{total}</span>
      </div>
    </div>
  );
}
function Nav({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button onClick={onClick} className={`navitem ${active ? "active" : ""}`}>
      <span>{icon}</span>
      {label}
    </button>
  );
}
function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function EditReceipt({
  record,
  kind,
  traders,
  busy,
  onClose,
  onSave,
}: {
  record: Purchase;
  kind: "buy" | "sell";
  traders: Trader[];
  busy: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [item, setItem] = useState(record.item);
  const [date, setDate] = useState(record.date);
  const [trader, setTrader] = useState(record.trader);
  const [buyKg, setBuyKg] = useState(record.buy_kg);
  const [kiloPrice, setKiloPrice] = useState(record.kilo_price);
  const [paid, setPaid] = useState(record.paid);
  const [soldKg, setSoldKg] = useState(record.sold_kg || 0);
  const [soldMoney, setSoldMoney] = useState(record.sold_money || 0);
  const [expense, setExpense] = useState(record.sale_expense || 0);
  const [reason, setReason] = useState(record.sale_expense_reason || "");
  const buyTotal = buyKg * kiloPrice * 1.06;
  const editedProfit = soldMoney - record.total - expense;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (kind === "buy")
      await onSave({
        action: "editBuy",
        id: record.id,
        item,
        date,
        trader,
        buyKg,
        kiloPrice,
        paid,
      });
    else
      await onSave({
        action: "editSell",
        id: record.id,
        soldKg,
        soldMoney,
        expense,
        expenseReason: reason,
      });
  }
  return (
    <div className="edit-overlay" role="dialog" aria-modal="true">
      <form className="edit-modal" onSubmit={submit}>
        <div className="edit-head">
          <div>
            <small>Mahmood</small>
            <h3>
              {kind === "buy"
                ? "دەستکاری پسوڵەی کڕین"
                : "دەستکاری پسوڵەی فرۆشتن"}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="داخستن">
            ×
          </button>
        </div>
        <div className="formgrid">
          {kind === "buy" ? (
            <>
              <Field label="بابەت" full>
                <input value={item} onChange={(e) => setItem(e.target.value)} />
              </Field>
              <Field label="بەروار">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="ناوی معل">
                <select
                  value={trader}
                  onChange={(e) => setTrader(e.target.value)}
                >
                  {traders.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Num
                label="کێشی کڕین"
                value={buyKg}
                set={setBuyKg}
                suffix="کیلۆ"
              />
              <Num
                label="نرخی هەر کیلۆ"
                value={kiloPrice}
                set={setKiloPrice}
                suffix="د.ع"
              />
              <label className="checkfield full">
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                <span>
                  <b>پارەکە دراوە</b>
                </span>
              </label>
            </>
          ) : (
            <>
              <div className="edit-context full">
                <span>{record.item}</span>
                <small>
                  کڕین: {record.buy_kg} کیلۆ · {money(record.total)}
                </small>
              </div>
              <Num
                label="کێشی فرۆشراو"
                value={soldKg}
                set={setSoldKg}
                suffix="کیلۆ"
              />
              <Num
                label="پارەی فرۆشراو"
                value={soldMoney}
                set={setSoldMoney}
                suffix="د.ع"
              />
              <Num
                label="مەسروفات"
                value={expense}
                set={setExpense}
                suffix="د.ع"
              />
              <Field label="هۆکاری مەسروفات">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
        <div
          className={`edit-calc ${kind === "sell" && editedProfit < 0 ? "bad" : ""}`}
        >
          <span>
            {kind === "buy"
              ? "کۆی نوێ"
              : editedProfit >= 0
                ? "قازانجی نوێ"
                : "زیانی نوێ"}
          </span>
          <strong>
            {money(kind === "buy" ? buyTotal : Math.abs(editedProfit))}
          </strong>
        </div>
        <div className="edit-buttons">
          <button type="button" onClick={onClose}>
            پاشگەزبوونەوە
          </button>
          <button disabled={busy} className="primary">
            {busy ? "چاوەڕوانبە…" : "پاشەکەوتکردنی دەستکاری"}
          </button>
        </div>
      </form>
    </div>
  );
}
function Receipt({
  record: r,
  kind,
}: {
  record: Purchase;
  kind: "buy" | "sell";
}) {
  return (
    <section className="print-only receipt-paper">
      <header>
        <div className="receipt-logo">M</div>
        <h1>Mahmood</h1>
        <p>{kind === "buy" ? "پسوڵەی کڕین" : "پسوڵەی فرۆشتن"}</p>
      </header>
      <div className="receipt-meta">
        <span>ژمارە: {r.id}</span>
        <span>{dt(kind === "buy" ? r.created_at : r.sold_at)}</span>
      </div>
      <div className="receipt-lines">
        <p>
          <span>بابەت</span>
          <b>{r.item}</b>
        </p>
        <p>
          <span>ناوی معل</span>
          <b>{r.trader}</b>
        </p>
        {kind === "buy" ? (
          <>
            <p>
              <span>کێشی کڕین</span>
              <b>{r.buy_kg} کیلۆ</b>
            </p>
            <p>
              <span>نرخی کیلۆ</span>
              <b>{money(r.kilo_price)}</b>
            </p>
            <p>
              <span>زیادکراوی ٦٪</span>
              <b>{money(r.fee)}</b>
            </p>
            <p>
              <span>دۆخی پارە</span>
              <b>{r.paid ? "دراوە" : "نەدراوە"}</b>
            </p>
            {r.paid_at && (
              <p>
                <span>کاتی دان</span>
                <b>{dt(r.paid_at)}</b>
              </p>
            )}
            <p className="grand">
              <span>کۆی گشتی</span>
              <b>{money(r.total)}</b>
            </p>
          </>
        ) : (
          <>
            <p>
              <span>کێشی فرۆشراو</span>
              <b>{r.sold_kg} کیلۆ</b>
            </p>
            <p>
              <span>پارەی فرۆشراو</span>
              <b>{money(r.sold_money || 0)}</b>
            </p>
            <p>
              <span>مەسروفات</span>
              <b>{money(r.sale_expense)}</b>
            </p>
            <p>
              <span>هۆکار</span>
              <b>{r.sale_expense_reason || "—"}</b>
            </p>
            <p>
              <span>
                {(r.difference_kg || 0) >= 0 ? "وەزنی کەم" : "وەزنی زیاد"}
              </span>
              <b>{Math.abs(r.difference_kg || 0)} کیلۆ</b>
            </p>
            <p className="grand">
              <span>{(r.profit || 0) >= 0 ? "قازانجی پاک" : "زیانی پاک"}</span>
              <b>{money(Math.abs(r.profit || 0))}</b>
            </p>
          </>
        )}
      </div>
      <footer>سوپاس بۆ مامەڵەتان</footer>
    </section>
  );
}
