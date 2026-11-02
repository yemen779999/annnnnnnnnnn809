import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbListProjects, dbCreateProject, dbLogAction } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to access saved projects." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const viewAll = searchParams.get("all") === "true";

    // Non-admins can only view their own projects
    const ownerFilter = user.role === "admin" && viewAll ? undefined : user.id;
    const projects = await dbListProjects(ownerFilter);

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load projects." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Please log in to save your project." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, title, sourceUrl, type, designTokens, assets, code, qualityScore } = body;

    if (!title || !code) {
      return NextResponse.json(
        { error: "Project title and code are required." },
        { status: 400 }
      );
    }

    const projectId = id || `prj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const project = await dbCreateProject({
      id: projectId,
      ownerId: user.id,
      title: title.trim(),
      sourceUrl: sourceUrl || undefined,
      type: type || "clone",
      designTokens: designTokens || {},
      assets: assets || {},
      code,
      qualityScore: qualityScore || 0,
      createdAt: now,
      updatedAt: now,
    });

    await dbLogAction("SAVE_PROJECT", user.id, { projectId, title });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save project." },
      { status: 500 }
    );
  }
}
