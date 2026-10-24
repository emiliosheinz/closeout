import { NextResponse } from "next/server";
import { unusableEnv } from "@/shared/config/env";

export const dynamic = "force-dynamic";

/** Readiness: fails until every required variable is usable. */
export function GET() {
  const unusable = unusableEnv();
  if (unusable.length > 0) {
    return NextResponse.json(
      { status: "misconfigured", unusable },
      { status: 503 },
    );
  }
  return NextResponse.json({ status: "ok" });
}
