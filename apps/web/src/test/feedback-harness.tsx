import {
  type DehydratedState,
  type QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AdminProviders } from "@/_app/admin-panel/admin-providers";
import { Toaster } from "@/shared/ui/sonner";

/** Sonner keeps its toasts in a module-level store that outlives each test. */
export async function dismissToasts() {
  toast.dismiss();
  await waitFor(() => expect(toast.getToasts()).toHaveLength(0));
}

afterEach(dismissToasts);

/**
 * Renders UI inside the real admin providers: the admin query client with its
 * cache handlers, and the Toaster. Assertions about toasts, invalidation and
 * session expiry go through this, not through a bare hook.
 */
export function renderWithFeedback(
  ui: React.ReactNode,
  state?: DehydratedState,
) {
  let client: QueryClient | undefined;
  function CaptureClient() {
    const current = useQueryClient();
    useEffect(() => {
      client = current;
    }, [current]);
    return null;
  }
  const view = render(
    <AdminProviders state={state}>
      <CaptureClient />
      {ui}
    </AdminProviders>,
  );
  if (!client) throw new Error("The admin providers did not mount");
  return { ...view, client };
}

/** Renders UI next to a Toaster, as the public and login pages mount one. */
export function renderWithToaster(ui: React.ReactNode) {
  return render(
    <>
      {ui}
      <Toaster />
    </>,
  );
}
