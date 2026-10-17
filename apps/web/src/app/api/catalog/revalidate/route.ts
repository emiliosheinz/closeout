import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/admin/origin";
import { adminGet } from "@/lib/admin/server-api";
import type { Me } from "@/lib/admin/types";
import { CATALOG_CACHE_TAG } from "@/lib/catalog/api";
import { requireEnv } from "@/lib/env";

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
  if (!(await adminGet<Me>("/me"))) {
    return NextResponse.json(
      { message: "Sua sessão expirou. Entre de novo." },
      { status: 401 },
    );
  }
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  return new NextResponse(null, { status: 204 });
}
