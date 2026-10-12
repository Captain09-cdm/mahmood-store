"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  downloadBackup,
  getLocalStore,
  localAction,
  restoreBackup,
} from "./local-store";
import { Archive, Purchase, Trader, localDate, money } from "./reporting";
import Reports, { ReportDocument, ReportSnapshot } from "./Reports";
type PrintJob = { kind: "receipts"; rows: Purchase[]; receiptKind: "buy" | "sell" } | { kind: "report"; snapshot: ReportSnapshot };
const dt = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("ckb-IQ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";
export default function FruitApp({ displayName, storeId, storeName, onSwitchStore }: { displayName: string; storeId: string; storeName: string; onSwitchStore: () => void }) {
  const [view, setView] = useState<"buy" | "sell" | "history" | "report">(
      "buy",
    ),
    [traders, setTraders] = useState<Trader[]>([]),
    [records, setRecords] = useState<Purchase[]>([]),
    [archives, setArchives] = useState<Archive[]>([]),
    [periodStart, setPeriodStart] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [traderDialog, setTraderDialog] = useState(false),
    [newTraderName, setNewTraderName] = useState("");
  const [item, setItem] = useState(""),
    [date, setDate] = useState(localDate()),
    [trader, setTrader] = useState(""),
    [kg, setKg] = useState(0),
    [price, setPrice] = useState(0),
    [paid, setPaid] = useState(false);
  const [selected, setSelected] = useState(""),
    [soldKg, setSoldKg] = useState(0),
    [soldMoney, setSoldMoney] = useState(0),
    [expense, setExpense] = useState(0),
    [expenseReason, setExpenseReason] = useState("");
  const [printJob, setPrintJob] = useState<PrintJob | null>(null),
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
    const d = getLocalStore(storeId);
    setTraders(d.traders);
    setRecords(d.purchases);
    setArchives(d.archives || []);
    setPeriodStart(d.period_started_at);
  };
  useEffect(() => {
    // Hydrate this store's browser-only data after static rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(e => setNotice(e.message));
    // The parent remounts this app whenever the store changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!printJob) return;
    const clear = () => setPrintJob(null);
    window.addEventListener("afterprint", clear);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", clear); };
  }, [printJob]);
  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try { return await localAction(storeId, body); }
    catch { setNotice("پاشەکەوتکردن سەرکەوتوو نەبوو. شوێنی پاشەکەوتکردنی وێبگەڕ بپشکنە."); return { ok: false, json: async () => ({ ok: false }) }; }
    finally { setBusy(false); }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (!confirm(`ئەم باکئەپە جێگای تۆمارەکانی «${storeName}» دەگرێتەوە. دڵنیایت؟`)) return;
      await restoreBackup(storeId, file);
      await load();
      setNotice("باکئەپەکە بە سەرکەوتوویی گەڕێندرایەوە");
    } catch {
      setNotice("فایلی باکئەپ دروست نییە");
    }
  }
  function openTraderDialog() {
    setNewTraderName("");
    setTraderDialog(true);
  }
  async function addTrader(e: FormEvent) {
    e.preventDefault();
    const name = newTraderName.trim();
    if (!name) return;
    const r = await post({ action: "trader", name });
    if (r.ok) {
      const t = await r.json() as Trader;
      setTraders((x) => [...x, t]);
      setTrader(t.name);
      setTraderDialog(false);
      setNewTraderName("");
      setNotice("ناوە نوێیەکە زیاد کرا");
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

      await load();
    }
  }
  function printReceipt(r: Purchase, kind: "buy" | "sell") {
    setPrintJob({ kind: "receipts", rows: [r], receiptKind: kind });
  }
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark">M</div>
          <div>
            <h1>{storeName}</h1>
            <p>سیستەمی کڕین و فرۆشتن</p>
          </div>
        </div>
        <button type="button" className="store-switch" onClick={onSwitchStore}>گۆڕینی فرۆشگا / دەرچوون</button>
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
                  <button
                    type="button"
                    onClick={openTraderDialog}
                    className="addbtn"
                    aria-label="زیادکردنی ناوی نوێ"
                  >
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
        {view === "report" && <Reports
          records={records} archives={archives} periodStart={periodStart} storeName={storeName} busy={busy}
          onPrintReport={snapshot => setPrintJob({ kind: "report", snapshot })}
          onPrintReceipts={(rows, receiptKind) => setPrintJob({ kind: "receipts", rows, receiptKind })}
          onReset={resetPeriod}
          onBackup={() => downloadBackup(storeId, storeName)}
          onImport={importBackup}
        />}
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
            setPrintJob(null);
            setView("report");
          }}
          icon="▦"
          label="ڕاپۆرت"
        />
      </nav>
      {printJob && <div className="print-only print-root">
        {printJob.kind === "report"
          ? <ReportDocument snapshot={printJob.snapshot} storeName={storeName} />
          : printJob.rows.map(r => <Receipt key={r.id} record={r} kind={printJob.receiptKind} storeName={storeName} />)}
      </div>}
      {edit && (
        <EditReceipt
          storeName={storeName}
          record={edit.record}
          kind={edit.kind}
          traders={traders}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
        />
      )}
      {traderDialog && (
        <div
          className="modalbackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTraderDialog(false);
          }}
        >
          <form
            className="namemodal"
            onSubmit={addTrader}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-trader-title"
          >
            <button
              type="button"
              className="modalclose"
              onClick={() => setTraderDialog(false)}
              aria-label="داخستن"
            >
              ×
            </button>
            <div className="modalicon" aria-hidden="true">＋</div>
            <div className="modalheading">
              <h3 id="new-trader-title">زیادکردنی ناوی نوێ</h3>
              <p>ناوی معل یان مامەڵەکارەکە لێرە بنووسە</p>
            </div>
            <label className="modalfield" htmlFor="new-trader-name">
              <span>ناو</span>
              <input
                id="new-trader-name"
                value={newTraderName}
                onChange={(e) => setNewTraderName(e.target.value)}
                placeholder="بۆ نموونە: ئەحمەد"
                autoFocus
                autoComplete="off"
              />
            </label>
            <div className="modalactions">
              <button
                type="submit"
                className="primary"
                disabled={busy || !newTraderName.trim()}
              >
                {busy ? "چاوەڕوان بە..." : "زیادکردن"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setTraderDialog(false)}
                disabled={busy}
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </form>
        </div>
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
function EditReceipt({
  storeName,
  record,
  kind,
  traders,
  busy,
  onClose,
  onSave,
}: {
  storeName: string;
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
            <small>{storeName}</small>
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
  storeName,
}: {
  storeName: string;
  record: Purchase;
  kind: "buy" | "sell";
}) {
  return (
    <section className="receipt-paper batch-receipt">
      <header>
        <div className="receipt-logo">M</div>
        <h1>{storeName}</h1>
        <p>{kind === "buy" ? "پسوڵەی کڕین" : "پسوڵەی فرۆشتن"}</p>
      </header>
      <div className="receipt-meta">
        <span>ژمارە: {r.id}</span>
        <span>بەروار: {kind === "buy" ? r.date : dt(r.sold_at)}</span>
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
