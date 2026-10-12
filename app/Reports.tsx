"use client";
import { useMemo, useState } from "react";
import { Archive, Purchase, filterRecords, groupRecords, localDate, money, profitLabel, summarize, weight, weightLabel } from "./reporting";

export type ReportSnapshot = { rows: Purchase[]; title: string; grouped: boolean };
type Props = {
  records: Purchase[]; archives: Archive[]; periodStart: string; storeName: string; busy: boolean;
  onPrintReport: (snapshot: ReportSnapshot) => void;
  onPrintReceipts: (rows: Purchase[], kind: "buy" | "sell") => void;
  onReset: () => void; onBackup: () => void; onImport: (file?: File) => void;
};
function Metrics({ rows }: { rows: Purchase[] }) {
  const totals = summarize(rows);
  return <div className="metricgrid">
    {[
      ["کۆی کڕین", money(totals.buy), ""],
      ["کۆی فرۆشتن", money(totals.sales), "blue"],
      [profitLabel(totals.netProfit), money(Math.abs(totals.netProfit)), totals.netProfit < 0 ? "red" : totals.netProfit > 0 ? "green" : "blue"],
      [weightLabel(totals.netWeight), weight(totals.netWeight), totals.netWeight > 0 ? "orange" : "blue"],
      ["کۆی مەسروفات", money(totals.expenses), "orange"],
      ["قەرزی نەدراو", money(totals.unpaid), "red"],
    ].map(([label, value, tone]) => <div className={`metric ${tone}`} key={label}><small>{label}</small><strong>{value}</strong></div>)}
  </div>;
}
function RecordLine({ r }: { r: Purchase }) {
  const totals = summarize([r]);
  return <div className="reportrow">
    <div><b>{r.item}</b><small>{r.date} · {r.trader}</small><small>#{r.id} · {r.paid ? "پارە دراوە" : "پارە نەدراوە"}</small></div>
    <div><span>کڕین: {money(r.total)} · {weight(r.buy_kg)}</span><span>فرۆشتن: {r.sold_money == null ? "هێشتا نەفرۆشراوە" : `${money(r.sold_money)} · ${weight(r.sold_kg || 0)}`}</span><small>مەسروفات: {money(r.sale_expense)} {r.sale_expense_reason && `· ${r.sale_expense_reason}`}</small></div>
    <div>{r.sold_money != null ? <><span>{weightLabel(totals.netWeight)}: {weight(totals.netWeight)}</span><strong className={totals.netProfit < 0 ? "red" : "green"}>{profitLabel(totals.netProfit)}: {money(Math.abs(totals.netProfit))}</strong></> : <span>هێشتا هەژماری فرۆشتن نییە</span>}</div>
  </div>;
}
function GroupSummary({ rows }: { rows: Purchase[] }) {
  const sum = summarize(rows);
  return <div className="group-totals">
    <span>کڕین: <b>{money(sum.buy)} · {weight(sum.boughtKg)}</b></span>
    <span>فرۆشتن: <b>{money(sum.sales)} · {weight(sum.soldKg)}</b></span>
    <span>مەسروفات: <b>{money(sum.expenses)}</b></span>
    <span className={sum.netProfit < 0 ? "red" : "green"}>{profitLabel(sum.netProfit)}: <b>{money(Math.abs(sum.netProfit))}</b></span>
    <span>{weightLabel(sum.netWeight)}: <b>{weight(sum.netWeight)}</b></span>
    <span>{rows.length} پسوڵەی کڕین · {sum.soldCount} پسوڵەی فرۆشتن</span>
  </div>;
}
export function ReportDocument({ snapshot, storeName }: { snapshot: ReportSnapshot; storeName: string }) {
  return <article className="report-document receipt-paper">
    <header><h1>{storeName}</h1><p>ڕاپۆرتی هەژمار</p><p>{snapshot.title}</p><small>{snapshot.rows.length} مامەڵە</small></header>
    <Metrics rows={snapshot.rows} />
    {snapshot.grouped ? groupRecords(snapshot.rows).map(g => <section key={g.key}><h2>{g.name}</h2><GroupSummary rows={g.rows} />{g.rows.map(r => <RecordLine key={r.id} r={r} />)}</section>) : snapshot.rows.map(r => <RecordLine key={r.id} r={r} />)}
    <footer>قازانج و کێشی پاک تەنها بۆ مامەڵە فرۆشراوەکان هەژمار کراون.</footer>
  </article>;
}
export default function Reports(props: Props) {
  const { records, archives, periodStart, storeName, onPrintReport, onPrintReceipts } = props;
  const [period, setPeriod] = useState("current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [item, setItem] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [basis, setBasis] = useState<"buy" | "sell">("buy");
  const [selected, setSelected] = useState<number[]>([]);
  const source = useMemo(() => period === "current" ? records : archives.find(a => String(a.id) === period)?.records || [], [period, records, archives]);
  const items = useMemo(() => groupRecords(source), [source]);
  const rows = useMemo(() => filterRecords(source, from, to, item, basis).slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id), [source, from, to, item, basis]);
  const groups = useMemo(() => groupRecords(rows), [rows]);
  const chosen = rows.filter(r => selected.includes(r.id));
  const printRows = chosen.length ? chosen : rows;
  const invalidRange = !!from && !!to && from > to;
  const periodLabel = period === "current" ? "دەورەی ئێستا" : "ئەرشیف";
  const title = `${periodLabel} · ${item ? items.find(g => g.key === item)?.name || item : "هەموو بابەتەکان"} · ${basis === "buy" ? "بەرواری کڕین" : "بەرواری فرۆشتن"}: ${from || "سەرەتا"} — ${to || "کۆتایی"}`;
  function datePreset(week: boolean) {
    const start = new Date();
    if (week) start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
    setFrom(localDate(start)); setTo(localDate()); setSelected([]);
  }
  return <section className="report">
    <div className="report-title"><div><h2>ڕاپۆرتی هەژمار</h2><p>{storeName} · دەستپێکی دەورە: {periodStart ? new Date(periodStart).toLocaleDateString("ckb-IQ") : "—"}</p></div></div>
    <div className="report-filters card">
      <label>دەورە<select value={period} onChange={e => { setPeriod(e.target.value); setItem(""); setFrom(""); setTo(""); setSelected([]); }}><option value="current">دەورەی ئێستا</option>{archives.map(a => <option key={a.id} value={a.id}>ئەرشیف: {localDate(new Date(a.from))} — {localDate(new Date(a.to))}</option>)}</select></label>
      <label>بابەت<select value={item} onChange={e => { setItem(e.target.value); setSelected([]); }}><option value="">هەموو بابەتەکان</option>{items.map(g => <option value={g.key} key={g.key}>{g.name}</option>)}</select></label>
      <label>جۆری بەروار<select value={basis} onChange={e => { setBasis(e.target.value as "buy" | "sell"); setSelected([]); }}><option value="buy">بەرواری کڕین</option><option value="sell">بەرواری فرۆشتن</option></select></label>
      <label>لە بەرواری<input type="date" value={from} onChange={e => { setFrom(e.target.value); setSelected([]); }} /></label>
      <label>تا بەرواری<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setSelected([]); }} /></label>
      <div className="report-presets"><button onClick={() => datePreset(false)}>ئەمڕۆ</button><button onClick={() => datePreset(true)}>ئەم هەفتەیە</button><button onClick={() => { setFrom(""); setTo(""); setItem(""); setSelected([]); }}>هەمووی</button></div>
    </div>
    {invalidRange && <p className="loginerror" role="alert">بەرواری کۆتایی نابێت پێش بەرواری سەرەتا بێت.</p>}
    <Metrics rows={rows} />
    <p className="report-hint">قازانج و کێشی پاک تەنها بۆ مامەڵە فرۆشراوەکانن. بۆ زانینی فرۆشی هەفتەیەک، «بەرواری فرۆشتن» و «ئەم هەفتەیە» هەڵبژێرە.</p>
    <div className="tabs"><button className={`tab ${!grouped ? "active" : ""}`} onClick={() => setGrouped(false)}>هەر مامەڵەیەک بە جیا</button><button className={`tab ${grouped ? "active" : ""}`} onClick={() => setGrouped(true)}>کۆکردنەوە بەپێی بابەت</button></div>
    <div className="batch-toolbar card">
      <b>{chosen.length ? `${chosen.length} مامەڵە هەڵبژێردراوە` : `${rows.length} مامەڵە لە ڕاپۆرتدا`}</b>
      <p>چەند پسوڵە هەڵبژێرە، یان هەموو ئەنجامەکان پێکەوە چاپ بکە. بۆ پاشەکەوتکردن، لە پەنجەرەی چاپ «Save as PDF» هەڵبژێرە.</p>
      <div className="batch-actions">
        <button disabled={!rows.length} onClick={() => onPrintReport({ rows, title, grouped })}>چاپ / PDF ـی ڕاپۆرت</button>
        <button disabled={!printRows.length} onClick={() => onPrintReceipts(printRows, "buy")}>پسوڵەکانی کڕین ({printRows.length})</button>
        <button disabled={!printRows.some(r => r.sold_money != null)} onClick={() => onPrintReceipts(printRows.filter(r => r.sold_money != null), "sell")}>پسوڵەکانی فرۆشتن ({printRows.filter(r => r.sold_money != null).length})</button>
      </div>
      <label className="batch-check"><input type="checkbox" checked={!!rows.length && chosen.length === rows.length} disabled={!rows.length} onChange={e => setSelected(e.target.checked ? rows.map(r => r.id) : [])} />هەڵبژاردنی هەمووی</label>
    </div>
    <section className="card report-details">
      {!rows.length && <p className="empty">هیچ مامەڵەیەک لەم هەڵبژاردنەدا نییە</p>}
      {(grouped ? groups : [{ key: "all", name: "", rows }]).map(g => <section className="item-report-group" key={g.key}>
        {grouped && <><h3>{g.name}</h3><GroupSummary rows={g.rows} /><div className="batch-actions"><button onClick={() => onPrintReceipts(g.rows, "buy")}>پسوڵەکانی کڕینی {g.name}</button><button disabled={!g.rows.some(r => r.sold_money != null)} onClick={() => onPrintReceipts(g.rows.filter(r => r.sold_money != null), "sell")}>پسوڵەکانی فرۆشتنی {g.name}</button></div></>}
        {g.rows.map(r => <div key={r.id} className="selectable-record"><label className="batch-check"><input type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id))} /><span>پسوڵەی {r.item} · {r.date}</span></label><RecordLine r={r} /></div>)}
      </section>)}
    </section>
    {period === "current" && <button onClick={props.onReset} disabled={props.busy || !records.length} className="clearbtn">داخستنی دەورە و دەستپێکردنی دەورەی نوێ<small>تەنها هەژمارەکانی {storeName} دەچنە ئەرشیف؛ تۆمارەکان ناسڕدرێنەوە.</small></button>}
    <div className="backup-actions"><button onClick={props.onBackup}>داگرتنی باکئەپی {storeName}</button><label>گەڕاندنەوەی باکئەپ<input type="file" accept=".json,application/json" onChange={e => { props.onImport(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
  </section>;
}
