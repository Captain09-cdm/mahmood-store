"use client";
const PROFILES_KEY = "mahmood_store_profiles_v1";
export type StoreProfile = { id: string; name: string; salt: string; pinHash: string };
export function getProfiles(): StoreProfile[] {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return [];
  const profiles = JSON.parse(raw);
  if (!Array.isArray(profiles)) throw new Error("invalid profiles");
  return profiles;
}
async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 210000 }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
}
export async function createProfile(name: string, pin: string) {
  if (!name.trim() || !/^\d{4,8}$/.test(pin)) throw new Error("invalid");
  const salt = crypto.randomUUID();
  const pinHash = await hashPin(pin, salt);
  // Read again after the asynchronous hash so another tab's creation is preserved.
  const profiles = getProfiles();
  if (profiles.some(p => p.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) throw new Error("duplicate");
  // The first workspace retains the original storage key, without moving or overwriting records.
  const profile = { id: profiles.length ? crypto.randomUUID() : "legacy", name: name.trim(), salt, pinHash };
  localStorage.setItem(PROFILES_KEY, JSON.stringify([...profiles, profile]));
  return profile;
}
export async function unlockProfile(id: string, pin: string) {
  const profile = getProfiles().find(p => p.id === id);
  return profile && await hashPin(pin, profile.salt) === profile.pinHash ? profile : null;
}
