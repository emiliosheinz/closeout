import { meSchema } from "@closeout/contracts/schemas";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { CATALOG_CACHE_TAG } from "@/entities/listing/index.server";
import { adminGet } from "@/shared/api/index.server";
import { requireEnv } from "@/shared/config/env";
import { isSameOrigin } from "@/shared/lib/origin";

/**
 * Expires the cached storefront data so an admin's change shows on the next
 * page load. Admin writes go straight to the API through the proxy, so the
 * admin client calls this after each successful one.
 */
export async function POST(request: NextRequest) {
  if (
    !isSameOrigin(request.headers.get("origin"), requireEnv("PUBLIC_BASE_URL"))
  ) {
    return NextResponse.json(
      { message: "Origem não permitida." },
      { status: 403 },
    );
  }
  if (!(await adminGet("/me", meSchema))) {
    return NextResponse.json(
      { message: "Sua sessão expirou. Entre de novo." },
      { status: 401 },
    );
  }
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  return new NextResponse(null, { status: 204 });
}
