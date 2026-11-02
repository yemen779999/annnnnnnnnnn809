import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { dbGetUserByEmail, dbGetUserById, dbCreateUser, UserRecord, dbLogAction } from "./db";

const SESSION_COOKIE_NAME = "webcraft_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "webcraft_super_secret_session_key_production_2026";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  email: string;
  role: "admin" | "user";
  name: string;
  exp: number;
}

/**
 * Ensures the administrator/owner exists based strictly on ADMIN_EMAIL and ADMIN_PASSWORD
 */
export async function bootstrapOwnerAccount(): Promise<UserRecord | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return null;
  }

  const existing = await dbGetUserByEmail(adminEmail);
  if (existing) {
    // If existing account isn't admin, ensure role is admin
    if (existing.role !== "admin") {
      const updated: UserRecord = {
        ...existing,
        role: "admin",
        updatedAt: new Date().toISOString(),
      };
      await dbCreateUser(updated);
      return updated;
    }
    return existing;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const ownerUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    email: adminEmail,
    passwordHash,
    name: "System Owner",
    role: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dbCreateUser(ownerUser);
  await dbLogAction("SYSTEM_OWNER_BOOTSTRAPPED", ownerUser.id, { email: adminEmail });
  console.log(`[Auth] System owner account created from environment secrets: ${adminEmail}`);
  return ownerUser;
}

/**
 * Sign session token using HMAC-SHA256
 */
export function signSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verify and unpack session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(data)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (Date.now() / 1000 > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Get current session user from request cookies
 */
export async function getCurrentUser(): Promise<UserRecord | null> {
  // Ensure owner bootstrap is checked
  await bootstrapOwnerAccount();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await dbGetUserById(payload.userId);
  return user;
}

/**
 * Set session cookie
 */
export async function setSessionCookie(user: UserRecord) {
  const cookieStore = await cookies();
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp,
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Registers a new user. In production, regular user registrations are always role: 'user'.
 */
export async function registerUser(email: string, password: string, name: string): Promise<UserRecord> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await dbGetUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // Check if this matches configured ADMIN_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const role: "admin" | "user" = adminEmail && normalizedEmail === adminEmail ? "admin" : "user";

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    email: normalizedEmail,
    passwordHash,
    name: name.trim() || normalizedEmail.split("@")[0],
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dbCreateUser(newUser);
  await dbLogAction("USER_REGISTERED", newUser.id, { email: normalizedEmail, role });
  return newUser;
}

/**
 * Authenticates user credentials
 */
export async function loginUser(email: string, password: string): Promise<UserRecord> {
  await bootstrapOwnerAccount();

  const normalizedEmail = email.toLowerCase().trim();
  const user = await dbGetUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password.");
  }

  await dbLogAction("USER_LOGGED_IN", user.id, { email: normalizedEmail });
  return user;
}
