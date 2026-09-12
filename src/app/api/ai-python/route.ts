import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";

    // If image upload → forward to /api/analyze-image
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const response = await fetch(`${pythonUrl}/api/analyze-image`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      return NextResponse.json(data);
    }

    // Otherwise → forward JSON to /api/get-price
    const body = await request.json();
    const response = await fetch(`${pythonUrl}/api/get-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Python AI error:", error);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 500 }
    );
  }
}