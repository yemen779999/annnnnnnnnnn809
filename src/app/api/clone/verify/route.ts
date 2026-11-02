import { NextRequest, NextResponse } from "next/server";
import { calculateQualityScore } from "@/lib/generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { siteData, code } = body;

    const quality = calculateQualityScore(siteData, code);

    return NextResponse.json({
      success: true,
      quality,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to verify quality." },
      { status: 500 }
    );
  }
}
