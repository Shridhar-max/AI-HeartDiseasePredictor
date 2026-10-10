const ACCOUNTS_KEY = "cardio-demo-accounts";
const SESSION_KEY = "cardio-demo-auth";
const PROFILE_KEY = "cardio-profile";
const PASSWORD_ITERATIONS = 120_000;

export interface DemoAccount {
  email: string;
  fullName: string;
  salt: string;
  passwordHash: string;
}

function isDemoAccount(value: unknown): value is DemoAccount {
  if (typeof value !== "object" || value === null) return false;
  return (
    "email" in value &&
    typeof value.email === "string" &&
    "fullName" in value &&
    typeof value.fullName === "string" &&
    "salt" in value &&
    typeof value.salt === "string" &&
    "passwordHash" in value &&
    typeof value.passwordHash === "string"
  );
}

function readDemoAccounts(): DemoAccount[] {
  const stored = window.localStorage.getItem(ACCOUNTS_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isDemoAccount)) {
    throw new Error("Saved demo accounts could not be read. Clear this browser's demo account data and register again.");
  }
  return parsed;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error("Saved demo account credentials are invalid. Register the account again.");
  }
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const result = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(result));
}

function saveDemoProfile(fullName: string, email: string) {
  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      fullName,
      email,
      phone: "Not provided",
      role: "Research User",
      institution: "Heart Disease Prediction Lab",
    }),
  );
}

export async function registerDemoAccount(fullName: string, email: string, password: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  const accounts = readDemoAccounts();

  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error("An account with this email is already registered. Please sign in instead.");
  }
  if (!window.crypto?.subtle) {
    throw new Error("Secure password hashing is unavailable in this browser. Use a modern browser and try again.");
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const account: DemoAccount = {
    email: normalizedEmail,
    fullName: normalizedName,
    salt: bytesToHex(salt),
    passwordHash: await hashPassword(password, salt),
  };

  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
  saveDemoProfile(normalizedName, normalizedEmail);
  window.localStorage.removeItem(SESSION_KEY);
}

export async function authenticateDemoAccount(email: string, password: string): Promise<DemoAccount | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const account = readDemoAccounts().find((savedAccount) => savedAccount.email === normalizedEmail);
  if (!account) return null;
  if (!window.crypto?.subtle) {
    throw new Error("Secure password verification is unavailable in this browser. Use a modern browser and try again.");
  }

  const expectedHash = hexToBytes(account.passwordHash);
  const actualHash = hexToBytes(await hashPassword(password, hexToBytes(account.salt)));
  if (expectedHash.length !== actualHash.length) return null;

  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= expectedHash[index] ^ actualHash[index];
  }
  return difference === 0 ? account : null;
}

export function startDemoSession(email: string): void {
  window.localStorage.setItem(SESSION_KEY, email.trim().toLowerCase());
}

export function hasAuthenticatedDemoSession(): boolean {
  const email = window.localStorage.getItem(SESSION_KEY);
  if (!email) return false;
  return readDemoAccounts().some((account) => account.email === email);
}
