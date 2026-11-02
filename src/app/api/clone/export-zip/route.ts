import { NextRequest, NextResponse } from "next/server";
import { createProjectZip } from "@/lib/zip-builder";
import { getCurrentUser } from "@/lib/auth";
import { dbLogAction } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { title, code } = body;

    if (!code) {
      return NextResponse.json({ error: "No code provided for ZIP packaging." }, { status: 400 });
    }

    const safeTitle = (title || "cloned-site").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 30);
    const buffer = await createProjectZip(title || "Cloned Website", code);

    await dbLogAction("EXPORT_ZIP_SUCCESS", user?.id, { title: safeTitle, sizeBytes: buffer.length });

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to package project ZIP." },
      { status: 500 }
    );
  }
}
