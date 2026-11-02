import dns from "dns/promises";
import net from "net";

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed -> reject
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Network benchmark tests)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, or reserved range
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // Loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  // Unspecified
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
  // Unique local fc00::/7
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Link-local fe80::/10
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  // IPv4 mapped ::ffff:x.x.x.x
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.substring(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
  }
  return false;
}

/**
 * Validates a hostname and verifies all resolved IP addresses are public
 */
export async function validateTargetHost(hostname: string): Promise<string[]> {
  const cleanHost = hostname.toLowerCase().trim();

  // Known metadata hostnames
  const BLOCKED_HOSTS = [
    "localhost",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "169.254.169.254",
  ];

  if (BLOCKED_HOSTS.includes(cleanHost) || cleanHost.endsWith(".localhost") || cleanHost.endsWith(".local")) {
    throw new SecurityError(`Access to host '${cleanHost}' is forbidden (SSRF protection).`);
  }

  // Direct IP checks
  if (net.isIPv4(cleanHost)) {
    if (isPrivateIPv4(cleanHost)) {
      throw new SecurityError(`Target IP ${cleanHost} is within a forbidden or private address space.`);
    }
    return [cleanHost];
  }

  if (net.isIPv6(cleanHost)) {
    if (isPrivateIPv6(cleanHost)) {
      throw new SecurityError(`Target IP ${cleanHost} is within a forbidden or private address space.`);
    }
    return [cleanHost];
  }

  // DNS Resolution check (prevents DNS rebinding and internal network scanning)
  try {
    const records = await dns.lookup(cleanHost, { all: true });
    if (!records || records.length === 0) {
      throw new SecurityError(`Could not resolve hostname '${cleanHost}'.`);
    }

    const resolvedIps: string[] = [];

    for (const record of records) {
      if (record.family === 4) {
        if (isPrivateIPv4(record.address)) {
          throw new SecurityError(`Hostname '${cleanHost}' resolves to private/internal IP ${record.address}. Access blocked.`);
        }
      } else if (record.family === 6) {
        if (isPrivateIPv6(record.address)) {
          throw new SecurityError(`Hostname '${cleanHost}' resolves to private/internal IPv6 ${record.address}. Access blocked.`);
        }
      }
      resolvedIps.push(record.address);
    }

    return resolvedIps;
  } catch (err: any) {
    if (err instanceof SecurityError) throw err;
    throw new SecurityError(`DNS lookup failed for '${cleanHost}': ${err.message}`);
  }
}

/**
 * Safe fetch with strict SSRF validation, per-hop DNS resolution, and redirect control
 */
export async function safeFetchHtml(initialUrl: string): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = initialUrl.trim();
  let redirects = 0;

  while (redirects <= MAX_REDIRECTS) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new SecurityError(`Invalid target URL: '${currentUrl}'`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new SecurityError(`Forbidden protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`);
    }

    // SSRF & DNS check
    await validateTargetHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 WebCraft-Analyzer/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
        redirect: "manual", // Handle manually to validate every redirect target IP
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms when fetching '${currentUrl}'.`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect HTTP ${response.status} returned without Location header.`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      redirects++;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Target website responded with HTTP status ${response.status} (${response.statusText}).`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`Target returned non-HTML content-type: '${contentType}'.`);
    }

    const text = await response.text();
    if (text.length > MAX_CONTENT_LENGTH) {
      throw new Error(`Content length exceeds maximum permitted size of 5MB.`);
    }

    return {
      html: text,
      finalUrl: currentUrl,
    };
  }

  throw new SecurityError(`Exceeded maximum redirect limit (${MAX_REDIRECTS}).`);
}
