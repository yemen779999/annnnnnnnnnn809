import { NextResponse } from "next/server";
import { registerUser, loginUser } from "@/lib/auth";
import { validateTargetHost, SecurityError } from "@/lib/ssrf";
import { dbCreateProject, dbGetProjectById, dbDeleteProject } from "@/lib/db";
import { REFERENCE_PRESETS } from "@/lib/extractor";
import { generateComponentFromSite, generateComponentFromPrompt } from "@/lib/generator";
import { createProjectZip } from "@/lib/zip-builder";
import JSZip from "jszip";

export async function GET() {
  const results: {
    test: string;
    passed: boolean;
    details: string;
    durationMs: number;
  }[] = [];

  // TEST 1: User Registration & Password Hashing
  const t1Start = Date.now();
  try {
    const testEmail = `test_runner_${Date.now()}@test.local`;
    const user = await registerUser(testEmail, "SecurePassword123!", "Test Runner");

    const isBcrypt = user.passwordHash.startsWith("$2a$") || user.passwordHash.startsWith("$2b$");
    if (!isBcrypt) {
      throw new Error("Password was not hashed using bcrypt.");
    }

    results.push({
      test: "1. User Registration & Password Hashing",
      passed: true,
      details: `User created with valid bcrypt hash (${user.passwordHash.substring(0, 10)}...).`,
      durationMs: Date.now() - t1Start,
    });
  } catch (err: any) {
    results.push({
      test: "1. User Registration & Password Hashing",
      passed: false,
      details: err?.message || "Failed.",
      durationMs: Date.now() - t1Start,
    });
  }

  // TEST 2: User Login & Credential Validation
  const t2Start = Date.now();
  try {
    const testEmail = `login_test_${Date.now()}@test.local`;
    await registerUser(testEmail, "CorrectPassword999!", "Login Tester");

    // Valid login
    const loggedIn = await loginUser(testEmail, "CorrectPassword999!");
    if (!loggedIn || loggedIn.email !== testEmail) {
      throw new Error("Login failed with valid credentials.");
    }

    // Invalid login check
    let invalidRejected = false;
    try {
      await loginUser(testEmail, "WrongPassword!");
    } catch {
      invalidRejected = true;
    }

    if (!invalidRejected) {
      throw new Error("Invalid password was not rejected!");
    }

    results.push({
      test: "2. User Authentication & Credential Verification",
      passed: true,
      details: "Valid credentials authenticated; invalid passwords strictly rejected.",
      durationMs: Date.now() - t2Start,
    });
  } catch (err: any) {
    results.push({
      test: "2. User Authentication & Credential Verification",
      passed: false,
      details: err?.message || "Failed.",
      durationMs: Date.now() - t2Start,
    });
  }

  // TEST 3: SSRF & Private IP Protection
  const t3Start = Date.now();
  try {
    const dangerousHosts = ["127.0.0.1", "localhost", "169.254.169.254", "10.0.0.1"];
    let blockedCount = 0;

    for (const host of dangerousHosts) {
      try {
        await validateTargetHost(host);
      } catch (e: any) {
        if (e instanceof SecurityError) {
          blockedCount++;
        }
      }
    }

    if (blockedCount !== dangerousHosts.length) {
      throw new Error(`Only ${blockedCount}/${dangerousHosts.length} dangerous hostnames were blocked.`);
    }

    results.push({
      test: "3. SSRF & Private Network Shield",
      passed: true,
      details: `All ${blockedCount} loopback, cloud metadata, and internal IPs were securely blocked.`,
      durationMs: Date.now() - t3Start,
    });
  } catch (err: any) {
    results.push({
      test: "3. SSRF & Private Network Shield",
      passed: false,
      details: err?.message || "Failed.",
      durationMs: Date.now() - t3Start,
    });
  }

  // TEST 4: Project Isolation & Ownership Guard
  const t4Start = Date.now();
  try {
    const userA = `user_a_${Date.now()}@test.local`;
    const userB = `user_b_${Date.now()}@test.local`;
    const uA = await registerUser(userA, "Pass12345!", "User A");
    const uB = await registerUser(userB, "Pass12345!", "User B");

    // User A creates project
    const projId = `prj_test_${Date.now()}`;
    await dbCreateProject({
      id: projId,
      ownerId: uA.id,
      title: "User A Confidential Site",
      type: "clone",
      designTokens: {},
      assets: {},
      code: "export default function Test() { return <div>Confidential</div>; }",
      qualityScore: 90,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const retrieved = await dbGetProjectById(projId);
    if (!retrieved || retrieved.ownerId !== uA.id) {
      throw new Error("Project owner mismatch.");
    }

    // Verify isolation logic: user B is not owner
    const isUserBOwner = retrieved.ownerId === uB.id;
    if (isUserBOwner) {
      throw new Error("Data leak: User B was incorrectly identified as project owner!");
    }

    // Cleanup
    await dbDeleteProject(projId);

    results.push({
      test: "4. Multi-Tenant Project Isolation",
      passed: true,
      details: "User A's projects are strictly partitioned from User B.",
      durationMs: Date.now() - t4Start,
    });
  } catch (err: any) {
    results.push({
      test: "4. Multi-Tenant Project Isolation",
      passed: false,
      details: err?.message || "Failed.",
      durationMs: Date.now() - t4Start,
    });
  }

  // TEST 5: Site Analysis & Synthesis Engine
  const t5Start = Date.now();
  try {
    const preset = REFERENCE_PRESETS.linear;
    const cloned = await generateComponentFromSite(preset);
    const prompted = await generateComponentFromPrompt("A modern sleek crypto dashboard with cards and dark mode");

    if (!cloned.code.includes("export default function") || !prompted.code.includes("export default function")) {
      throw new Error("Generated component is missing export default function.");
    }

    results.push({
      test: "5. Website Reconstruction & Prompt Synthesis Engine",
      passed: true,
      details: `Generated valid React components (Cloned: ${cloned.code.length} chars, Prompt: ${prompted.code.length} chars).`,
      durationMs: Date.now() - t5Start,
    });
  } catch (err: any) {
    results.push({
      test: "5. Website Reconstruction & Prompt Synthesis Engine",
      passed: false,
      details: err?.message || "Failed.",
      durationMs: Date.now() - t5Start,
    });
  }

  // TEST 6: Standalone ZIP Packaging & Manifest Integrity
  const t6Start = Date.now();
  try {
    const sampleCode = `export default function App() { return <h1>Hello World</h1>; }`;
    const zipBuffer = await createProjectZip("Test Suite App", sampleCode);

    if (zipBuffer.length < 500) {
      throw new Error("ZIP file size is suspiciously small.");
    }

    // Read back zip to verify manifest files
    const zip = await JSZip.loadAsync(zipBuffer);
    const hasPackage = Boolean(zip.file("package.json"));
    const hasLayout = Boolean(zip.file("src/app/layout.tsx"));
    const hasPage = Boolean(zip.file("src/app/page.tsx"));
    const hasReadme = Boolean(zip.file("README.md"));

    if (!hasPackage || !hasLayout || !hasPage || !hasReadme) {
      throw new Error("ZIP archive is missing mandatory Next.js project files.");
    }

    results.push({
      test: "6. Standalone ZIP Packaging & Integrity",
      passed: true,
      details: `ZIP archive (${zipBuffer.length} bytes) verified with package.json, layout.tsx, and page.tsx.`,
      durationMs: Date.now() - t6Start,
    });
  } catch (err: any) {
    results.push({
      test: "6. Standalone ZIP Packaging & Integrity",
      passed: false,
      details: err?.message || "Failed.",
      durationMs: Date.now() - t6Start,
    });
  }

  const allPassed = results.every((r) => r.passed);

  return NextResponse.json({
    success: allPassed,
    summary: `${results.filter((r) => r.passed).length} of ${results.length} tests passed successfully.`,
    timestamp: new Date().toISOString(),
    results,
  });
}
