import { useMutation, useQuery } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiError, apiParsed, successFor, withId } from "@/shared/api";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import oracle from "@/test/copy-oracle.json";
import { renderWithFeedback } from "@/test/feedback-harness";

const SESSION_EXPIRED_HREF = "/admin/login?error=session-expired";

function Mutate({
  fn,
  meta,
}: {
  fn: () => Promise<unknown>;
  meta?: Parameters<typeof useMutation>[0]["meta"];
}) {
  const mutation = useMutation({ mutationFn: fn, meta });
  return (
    <button type="button" onClick={() => mutation.mutate(undefined)}>
      Executar
    </button>
  );
}

const run = () =>
  fireEvent.click(screen.getByRole("button", { name: "Executar" }));

let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal("location", { assign });
});
afterEach(() => vi.unstubAllGlobals());

describe("mutation error routing", () => {
  it("sends the member to login with the session-expired marker on a 401", async () => {
    renderWithFeedback(
      <Mutate fn={() => Promise.reject(new ApiError(401, "Sessão."))} />,
    );
    run();
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(SESSION_EXPIRED_HREF),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows nothing for an error the mutation claims", async () => {
    const error = new ApiError(400, "Campo inválido.");
    const handlesError = vi.fn((e: unknown) => e === error);
    renderWithFeedback(
      <Mutate fn={() => Promise.reject(error)} meta={{ handlesError }} />,
    );
    run();
    await waitFor(() => expect(handlesError).toHaveBeenCalledWith(error));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("still toasts an error the mutation does not claim", async () => {
    renderWithFeedback(
      <Mutate
        fn={() => Promise.reject(new ApiError(500, "Servidor caiu."))}
        meta={{ handlesError: () => false }}
      />,
    );
    run();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servidor caiu.",
    );
  });

  it("shows the connection copy for a network failure", async () => {
    renderWithFeedback(
      <Mutate
        fn={() => Promise.reject(new ApiError(0, oracle.networkFailure))}
      />,
    );
    run();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      oracle.networkFailure,
    );
  });

  it("shows the error's own message otherwise", async () => {
    renderWithFeedback(
      <Mutate
        fn={() =>
          Promise.reject(new ApiError(409, "Este e-mail já está na equipe."))
        }
      />,
    );
    run();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já está na equipe.",
    );
  });

  it("shows the generic copy for a failure that is not an API error", async () => {
    renderWithFeedback(
      <Mutate fn={() => Promise.reject(new TypeError("x"))} />,
    );
    run();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      oracle.adminGenericError,
    );
  });
});

function Listing({ onFetch }: { onFetch: () => void }) {
  const { data } = useQuery({
    queryKey: ["listing"],
    queryFn: () => {
      onFetch();
      return "ok";
    },
  });
  return <p>{data}</p>;
}

describe("mutation success", () => {
  it("toasts the message and refetches the declared queries", async () => {
    const onFetch = vi.fn();
    renderWithFeedback(
      <>
        <Listing onFetch={onFetch} />
        <Mutate
          fn={async () => undefined}
          meta={{ success: "Alterações salvas.", invalidates: [["listing"]] }}
        />
      </>,
    );
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

    run();

    expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
  });

  it("builds the toast message from the mutation's variables", async () => {
    function WithVariables() {
      const mutation = useMutation({
        mutationFn: async (_count: number) => undefined,
        meta: { success: successFor((count: number) => `${count} itens.`) },
      });
      return (
        <button type="button" onClick={() => mutation.mutate(3)}>
          Executar
        </button>
      );
    }
    renderWithFeedback(<WithVariables />);
    run();
    expect(await screen.findByText("3 itens.")).toBeInTheDocument();
  });

  it("shows no toast when the mutation declares no message", async () => {
    const onFetch = vi.fn();
    renderWithFeedback(
      <>
        <Listing onFetch={onFetch} />
        <Mutate
          fn={async () => undefined}
          meta={{ invalidates: [["listing"]] }}
        />
      </>,
    );
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));
    run();
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("reports a write whose response has the wrong shape as a success", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ unexpected: true })),
    );
    const onFetch = vi.fn();
    renderWithFeedback(
      <>
        <Listing onFetch={onFetch} />
        <Mutate
          fn={() => apiParsed("POST", "/stores/s/listings", {}, withId)}
          meta={{ success: "Anúncio criado.", invalidates: [["listing"]] }}
        />
      </>,
    );
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(1));

    run();

    expect(await screen.findByText("Anúncio criado.")).toBeInTheDocument();
    await waitFor(() => expect(onFetch).toHaveBeenCalledTimes(2));
    expect(consoleError).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("query errors", () => {
  it("sends the member to login with the marker when a read returns 401", async () => {
    function Read() {
      useQuery({
        queryKey: ["expired"],
        queryFn: () => Promise.reject(new ApiError(401, "Sessão.")),
      });
      return null;
    }
    renderWithFeedback(<Read />);
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(SESSION_EXPIRED_HREF),
    );
  });
});

describe("a confirm dialog whose action fails", () => {
  it("stays open and shows the error toast", async () => {
    function RemoveMember() {
      const mutation = useMutation({
        mutationFn: () =>
          Promise.reject(new ApiError(500, "Não foi possível remover.")),
      });
      return (
        <ConfirmDialog
          title={oracle.removeMember.title}
          description={oracle.removeMember.description}
          confirmLabel={oracle.removeMember.confirmLabel}
          pendingLabel={oracle.removeMember.pendingLabel}
          onConfirm={() => mutation.mutateAsync()}
          trigger={(open) => (
            <button type="button" onClick={open}>
              Abrir
            </button>
          )}
        />
      );
    }
    renderWithFeedback(<RemoveMember />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: oracle.removeMember.confirmLabel,
      }),
    );

    const toast = await screen.findByText("Não foi possível remover.");
    expect(toast.closest("[role=alert]")).not.toBeNull();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
