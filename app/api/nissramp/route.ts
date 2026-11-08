import { NextResponse } from "next/server";
import {
  fetchNissrampData,
  searchNissrampData,
} from "../../../lib/nissramp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hsCode = url.searchParams.get("hs_code")?.trim() || "";
    const query = url.searchParams.get("q")?.trim() || "";

    if (!hsCode && !query) {
      return NextResponse.json(
        { error: "Provide at least an hs_code or q search parameter." },
        { status: 400 },
      );
    }

    const result = await fetchNissrampData(hsCode || "0");
    const matches = searchNissrampData(result.records, query, hsCode);

    return NextResponse.json({
      source: result.source,
      warning: result.warning,
      matches,
      record_count: matches.length,
    });
  } catch (error) {
    console.error("NISSRAMP API route failed:", error);
    return NextResponse.json(
      {
        error: "NISSRAMP data is temporarily unavailable.",
        matches: [],
      },
      { status: 503 },
    );
  }
}
