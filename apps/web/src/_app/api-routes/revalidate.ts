import { SESSION_EXPIRED } from "@closeout/contracts/schemas";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { problem, refuseCrossOrigin } from "@/_app/api-routes/auth-route";
import { CATALOG_CACHE_TAG } from "@/entities/listing/index.server";
import { getMe } from "@/entities/session/index.server";

/**
 * Expires the cached storefront data so an admin's change shows on the next
 * page load. Admin writes go straight to the API through the proxy, so the
 * admin client calls this after each successful one.
 */
export async function POST(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;
  if (!(await getMe())) return problem(401, SESSION_EXPIRED);
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  return new NextResponse(null, { status: 204 });
}
