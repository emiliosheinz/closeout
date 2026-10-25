import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { TableSort } from "@/shared/lib/table-url-state";
import { DataTable, type DataTableColumns, useDataTable } from "../data-table";

type Row = { name: string; age: number };

const columns: DataTableColumns<Row> = [
  { accessorKey: "name", header: "Nome" },
  { accessorKey: "age", header: "Idade" },
  { id: "actions", header: "Ações", enableSorting: false, cell: () => "-" },
];

function Harness({
  data,
  initialSort = { column: "name", direction: "asc" },
  initialPage = 1,
}: {
  data: Row[];
  initialSort?: TableSort | null;
  initialPage?: number;
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(initialPage);
  const table = useDataTable({
    data,
    columns,
    sort,
    onSortChange: setSort,
    page,
    onPageChange: setPage,
  });
  return <DataTable table={table} empty={<p>Nada aqui</p>} />;
}

function names() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);
}

const people: Row[] = [
  { name: "Carla", age: 30 },
  { name: "Ana", age: 50 },
  { name: "Bruno", age: 40 },
];

function many(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Pessoa ${String(i).padStart(2, "0")}`,
    age: i,
  }));
}

describe("sorting", () => {
  it("reorders rows when a sort header is clicked, toggling direction", () => {
    render(<Harness data={people} />);
    expect(names()).toEqual(["Ana", "Bruno", "Carla"]);

    fireEvent.click(screen.getByRole("button", { name: /Nome/ }));
    expect(names()).toEqual(["Carla", "Bruno", "Ana"]);

    fireEvent.click(screen.getByRole("button", { name: /Nome/ }));
    expect(names()).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("starts a newly sorted column ascending and never leaves it unsorted", () => {
    render(<Harness data={people} />);
    fireEvent.click(screen.getByRole("button", { name: /Idade/ }));
    expect(names()).toEqual(["Carla", "Bruno", "Ana"]);

    fireEvent.click(screen.getByRole("button", { name: /Idade/ }));
    fireEvent.click(screen.getByRole("button", { name: /Idade/ }));
    expect(screen.getByRole("columnheader", { name: /Idade/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("reports aria-sort on sortable headers only", () => {
    render(
      <Harness
        data={people}
        initialSort={{ column: "age", direction: "desc" }}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Idade/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: /Nome/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(
      screen.getByRole("columnheader", { name: "Ações" }),
    ).not.toHaveAttribute("aria-sort");

    fireEvent.click(screen.getByRole("button", { name: /Idade/ }));
    expect(screen.getByRole("columnheader", { name: /Idade/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });
});

it("shows every sortable header unsorted without a sort", () => {
  render(<Harness data={people} initialSort={null} />);
  expect(names()).toEqual(["Carla", "Ana", "Bruno"]);
  for (const name of [/Nome/, /Idade/]) {
    expect(screen.getByRole("columnheader", { name })).toHaveAttribute(
      "aria-sort",
      "none",
    );
  }
});

describe("empty", () => {
  it("shows the empty slot when there are no rows", () => {
    render(<Harness data={[]} />);
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Próxima página" }),
    ).not.toBeInTheDocument();
  });
});

describe("pagination", () => {
  it("splits 45 rows into pages of 20, 20 and 5", () => {
    render(<Harness data={many(45)} />);
    const next = () => screen.getByRole("button", { name: "Próxima página" });
    const previous = () =>
      screen.getByRole("button", { name: "Página anterior" });

    expect(names()).toHaveLength(20);
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();

    fireEvent.click(next());
    expect(names()).toHaveLength(20);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(previous()).toBeEnabled();
    expect(next()).toBeEnabled();

    fireEvent.click(next());
    expect(names()).toHaveLength(5);
    expect(names()[0]).toBe("Pessoa 40");
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(next()).toBeDisabled();

    fireEvent.click(previous());
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("shows no controls for one page or fewer", () => {
    for (const count of [0, 1, 20]) {
      const { unmount } = render(<Harness data={many(count)} />);
      expect(
        screen.queryByRole("button", { name: "Próxima página" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Página \d+ de/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the controlled page when the data changes", () => {
    const { rerender } = render(<Harness data={many(45)} initialPage={2} />);
    rerender(<Harness data={many(44)} initialPage={2} />);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });
});
