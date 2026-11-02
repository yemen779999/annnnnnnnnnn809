import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbListUsers, dbCountUsers, dbListProjects, dbGetRecentLogs, isPostgresConfigured } from "@/lib/db";
import { testGeminiConnection, ACTIVE_GEMINI_MODEL } from "@/lib/gemini";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Access denied. Administrator privilege required." },
        { status: 403 }
      );
    }

    const [usersCount, users, allProjects, recentLogs, geminiStatus] = await Promise.all([
      dbCountUsers(),
      dbListUsers(),
      dbListProjects(),
      dbGetRecentLogs(25),
      testGeminiConnection(),
    ]);

    return NextResponse.json({
      success: true,
      metrics: {
        totalUsers: usersCount,
        totalProjects: allProjects.length,
        databaseMode: isPostgresConfigured() ? "PostgreSQL (Production Pool)" : "Persistent Local Storage (Zero-Loss Dev)",
        gemini: {
          activeModel: ACTIVE_GEMINI_MODEL,
          verified: geminiStatus.available,
          latencyMs: geminiStatus.latencyMs,
          statusMessage: geminiStatus.message,
        },
      },
      users,
      recentProjects: allProjects.slice(0, 10).map((p) => ({
        id: p.id,
        title: p.title,
        ownerId: p.ownerId,
        type: p.type,
        qualityScore: p.qualityScore,
        createdAt: p.createdAt,
      })),
      recentLogs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load admin metrics." },
      { status: 500 }
    );
  }
}
