import { NextRequest, NextResponse } from "next/server";
import { registerUser, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await registerUser(email, password, name || "");
    await setSessionCookie(user);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to register user." },
      { status: 400 }
    );
  }
}
