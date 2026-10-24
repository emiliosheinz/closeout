"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  LISTING_NOTICE_PARAMS,
  LISTING_NOTICES,
  parseListingNotice,
} from "@/entities/listing";
import { notify } from "@/shared/ui/sonner";

const TOAST_ID = "listing-notice";

/**
 * Toasts the notice the URL carries, then drops it from the URL so a reload
 * does not repeat it. The fixed toast id keeps a repeated effect (StrictMode)
 * to one toast.
 */
export function useListingNoticeToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const notice = params ? parseListingNotice(params) : undefined;
  useEffect(() => {
    if (!notice || !params) return;
    const { kind, message } = LISTING_NOTICES[notice];
    notify[kind](message, { id: TOAST_ID });
    const rest = new URLSearchParams(params);
    for (const name of LISTING_NOTICE_PARAMS) rest.delete(name);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [notice, params, pathname, router]);
}
