"use client";
import { FormEvent, useEffect, useState } from "react";
import FruitApp from "./FruitApp";
import { createProfile, getProfiles, StoreProfile, unlockProfile } from "./store-profiles";
const digits = (value: string) => value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/[^0-9]/g, "");

export default function StoreGate() {
  const [profiles, setProfiles] = useState<StoreProfile[]>([]);
  const [active, setActive] = useState<StoreProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function reload() {
    try {
      const saved = getProfiles();
      setProfiles(saved);
      setSelected(saved[0]?.id || "");
      setCreating(!saved.length);
      setReady(true);
    } catch { setError("زانیاری فرۆشگاکان ناخوێندرێتەوە؛ تکایە داتای وێبگەڕ مەسڕەوە."); }
  }
  // Browser storage cannot be read during the static build; hydrate after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, []);
  function switchStore() {
    setActive(null); setPin(""); setRepeat(""); setError(""); reload();
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (creating && !name.trim()) { setError("تکایە ناوی فرۆشگا بنووسە"); return; }
    if (creating && pin !== repeat) { setError("ژمارە نهێنییەکان یەکسان نین"); return; }
    setBusy(true);
    try {
      const profile = creating ? await createProfile(name, pin) : await unlockProfile(selected, pin);
      if (!profile) { setError("ژمارەی نهێنی هەڵەیە"); return; }
      setActive(profile); setPin(""); setRepeat(""); setName("");
    } catch (e) {
      setError(e instanceof Error && e.message === "duplicate" ? "ئەم ناوە پێشتر تۆمار کراوە" : "نەتوانرا هەژمارەکە بکرێتەوە. شوێنی پاشەکەوتکردن و HTTPS بپشکنە.");
    } finally { setBusy(false); }
  }
  if (active) return <FruitApp key={active.id} storeId={active.id} storeName={active.name} displayName={active.name} onSwitchStore={switchStore} />;
  return <main className="loginpage">
    <section className="logincard store-login">
      <div className="loginlogo">M</div>
      <h1>Mahmood</h1>
      <p>{creating ? "دروستکردنی فرۆشگا" : "چوونەژوورەوەی فرۆشگا"}</p>
      {!!error && <p className="loginerror" role="alert">{error}</p>}
      {!ready ? <p>چاوەڕوان بە…</p> : <>
        {!profiles.length && <p className="store-help">تۆمارە کۆنەکانت لە یەکەم فرۆشگا دەپارێزرێن.</p>}
        <form onSubmit={submit}>
          {creating ? <><label htmlFor="store-name">ناوی فرۆشگا</label><input id="store-name" value={name} onChange={e => setName(e.target.value)} placeholder="بۆ نموونە: محمود ـ لق ١" required maxLength={60} /></> : <>
            <label htmlFor="store-select">فرۆشگا هەڵبژێرە</label>
            <select id="store-select" value={selected} onChange={e => { setSelected(e.target.value); setPin(""); setError(""); }}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>}
          <label htmlFor="store-pin">ژمارەی نهێنی (٤ تا ٨ ژمارە)</label>
          <input id="store-pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} autoComplete={creating ? "new-password" : "current-password"} value={pin} onChange={e => setPin(digits(e.target.value))} required />
          {creating && <><label htmlFor="repeat-pin">دووبارەکردنەوەی ژمارەی نهێنی</label><input id="repeat-pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8} autoComplete="new-password" value={repeat} onChange={e => setRepeat(digits(e.target.value))} required /></>}
          <button disabled={busy}>{busy ? "چاوەڕوان بە…" : creating ? "دروستکردن و چوونەژوورەوە" : "چوونەژوورەوە"}</button>
        </form>
        {!!profiles.length && <button type="button" className="store-toggle" disabled={busy} onClick={() => { setCreating(!creating); setPin(""); setRepeat(""); setError(""); }}>{creating ? "گەڕانەوە بۆ چوونەژوورەوە" : "＋ زیادکردنی فرۆشگایەکی تر"}</button>}
      </>}
      <small>داتای هەر فرۆشگایەک جیاوازە و تەنها لەم وێبگەڕە پاشەکەوت دەکرێت. بە ئامێری تر هاوبەش نابێت. ژمارەی نهێنی قفڵی ناوخۆییە؛ داتاکان کۆد ناکات. باکئەپ بەردەوام دابگرە.</small>
    </section>
  </main>;
}
