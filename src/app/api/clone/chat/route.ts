import { NextRequest, NextResponse } from "next/server";
import { modifyComponentWithChat } from "@/lib/generator";
import { getCurrentUser } from "@/lib/auth";
import { dbLogAction } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { currentCode, userInstruction } = body;

    if (!currentCode || !userInstruction) {
      return NextResponse.json(
        { error: "Both currentCode and userInstruction are required." },
        { status: 400 }
      );
    }

    const result = await modifyComponentWithChat(currentCode, userInstruction);

    await dbLogAction("AI_CHAT_MODIFICATION", user?.id, {
      instruction: userInstruction.slice(0, 100),
      source: result.source,
    });

    return NextResponse.json({
      success: true,
      updatedCode: result.updatedCode,
      explanation: result.explanation,
      source: result.source,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to process chat modification." },
      { status: 500 }
    );
  }
}
