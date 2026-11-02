import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbGetProjectById, dbUpdateProject, dbDeleteProject, dbLogAction } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;
    const project = await dbGetProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // Authorization check
    if (project.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await dbGetProjectById(id);

    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (existing.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const updates = await req.json();
    const updated = await dbUpdateProject(id, updates);

    return NextResponse.json({ success: true, project: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await dbGetProjectById(id);

    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (existing.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    await dbDeleteProject(id);
    await dbLogAction("DELETE_PROJECT", user.id, { projectId: id });

    return NextResponse.json({ success: true, message: "Project deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
