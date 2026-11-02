import { NextRequest, NextResponse } from "next/server";
import { generateComponentFromSite, generateComponentFromPrompt, calculateQualityScore } from "@/lib/generator";
import { getCurrentUser } from "@/lib/auth";
import { dbLogAction } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { mode, siteData, prompt, style } = body;

    let result;

    if (mode === "prompt") {
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return NextResponse.json(
          { error: "A prompt description is required for prompt-to-site generation." },
          { status: 400 }
        );
      }
      result = await generateComponentFromPrompt(prompt.trim(), style || "modern");
    } else {
      if (!siteData || !siteData.title) {
        return NextResponse.json(
          { error: "Valid extracted site data is required for website cloning." },
          { status: 400 }
        );
      }
      result = await generateComponentFromSite(siteData);
    }

    const quality = calculateQualityScore(siteData, result.code);

    await dbLogAction("GENERATE_COMPONENT_SUCCESS", user?.id, {
      mode: mode || "clone",
      source: result.source,
      modelUsed: result.modelUsed,
      overallQuality: quality.overallScore,
    });

    return NextResponse.json({
      success: true,
      code: result.code,
      componentName: result.componentName,
      source: result.source,
      modelUsed: result.modelUsed,
      summary: result.summary,
      quality,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate component." },
      { status: 500 }
    );
  }
}
