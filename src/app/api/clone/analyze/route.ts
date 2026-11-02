import { NextRequest, NextResponse } from "next/server";
import { safeFetchHtml, SecurityError } from "@/lib/ssrf";
import { extractSiteData, REFERENCE_PRESETS } from "@/lib/extractor";
import { getCurrentUser } from "@/lib/auth";
import { dbLogAction } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { url, preset } = body;

    // 1. Check if a built-in reference preset was requested
    if (preset && REFERENCE_PRESETS[preset.toLowerCase()]) {
      const data = REFERENCE_PRESETS[preset.toLowerCase()];
      await dbLogAction("ANALYZE_PRESET_USED", user?.id, { preset });
      return NextResponse.json({
        success: true,
        source: "preset",
        data,
      });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid website URL is required." },
        { status: 400 }
      );
    }

    const cleanUrl = url.trim();

    // Check for quick preset match by domain
    const lower = cleanUrl.toLowerCase();
    if (lower.includes("stripe.com")) {
      return NextResponse.json({ success: true, source: "preset", data: REFERENCE_PRESETS.stripe });
    }
    if (lower.includes("linear.app")) {
      return NextResponse.json({ success: true, source: "preset", data: REFERENCE_PRESETS.linear });
    }
    if (lower.includes("vercel.com")) {
      return NextResponse.json({ success: true, source: "preset", data: REFERENCE_PRESETS.vercel });
    }

    // 2. Fetch with SSRF and per-hop DNS validation
    const { html, finalUrl } = await safeFetchHtml(cleanUrl);

    // 3. Extract tokens, assets, and hierarchy
    const data = extractSiteData(html, finalUrl);

    await dbLogAction("ANALYZE_URL_SUCCESS", user?.id, {
      url: cleanUrl,
      finalUrl,
      sectionsCount: data.sections.length,
      imagesCount: data.assets.images.length,
    });

    return NextResponse.json({
      success: true,
      source: "live",
      data,
    });
  } catch (err: any) {
    if (err instanceof SecurityError) {
      return NextResponse.json(
        { error: err.message, securityBlocked: true },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Failed to analyze target website." },
      { status: 400 }
    );
  }
}
