import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongodb";

export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({
      status: "success",
      message: "MongoDB connected successfully",
      mongodb_uri_set: !!process.env.MONGODB_URI,
      mongodb_uri_prefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + "..." : "not set",
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message || "MongoDB connection failed",
      mongodb_uri_set: !!process.env.MONGODB_URI,
      mongodb_uri_prefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + "..." : "not set",
    }, { status: 500 });
  }
}
