"use client";

import {
  createParser,
  type inferParserType,
  type ParserMap,
  parseAsString,
  useQueryStates,
} from "nuqs";

export const PAGE_SIZE = 20;

export type SortDirection = "asc" | "desc";

export type TableSort<Column extends string = string> = {
  column: Column;
  direction: SortDirection;
};

export type TableState<Column extends string = string> = {
  /** `null` keeps the rows in their incoming order. */
  sort: TableSort<Column> | null;
  /** 1-based. */
  page: number;
  query: string;
};

/** The last page that has rows; an empty table still has page 1. */
export function lastPage(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
}

/**
 * URL keys and parsers for one admin table. `prefix` keeps tables on the same
 * page from sharing keys (`members-` gives `members-q`, `members-sort`,
 * `members-page`). Sort is `<column>-asc|desc`; defaults are left out of the
 * URL and invalid values fall back to them. A `null` default means no sort.
 */
export function createTableUrlState<Column extends string>({
  prefix,
  sorts,
  defaultSort,
}: {
  prefix: string;
  sorts: readonly Column[];
  defaultSort: TableSort<Column> | null;
}) {
  const sort = createParser<TableSort<Column>>({
    parse(value) {
      const match = /^(.+)-(asc|desc)$/.exec(value);
      const column = sorts.find((candidate) => candidate === match?.[1]);
      if (!match || !column) return null;
      return { column, direction: match[2] as SortDirection };
    },
    serialize: ({ column, direction }) => `${column}-${direction}`,
    eq: (a, b) => a.column === b.column && a.direction === b.direction,
  });

  return {
    parsers: {
      query: parseAsString.withDefault(""),
      sort: defaultSort ? sort.withDefault(defaultSort) : sort,
      page: createParser<number>({
        parse: (value) =>
          /^\d+$/.test(value) ? Math.max(1, Number(value)) : null,
        serialize: String,
      }).withDefault(1),
    },
    urlKeys: {
      query: `${prefix}q`,
      sort: `${prefix}sort`,
      page: `${prefix}page`,
    },
  };
}

/**
 * A table's URL state. The page is as read from the URL; the table clamps it
 * to its rows. `set` resets the page unless the update names one, so a new
 * search, sort or `extra` filter never leaves the user on a stale page.
 * `extra` adds table-specific parsers (the listings status) to the same state.
 */
export function useTableUrlState<
  Column extends string,
  Extra extends ParserMap = Record<never, never>,
>(table: ReturnType<typeof createTableUrlState<Column>>, extra?: Extra) {
  const [state, setState] = useQueryStates(
    { ...table.parsers, ...extra },
    { urlKeys: table.urlKeys },
  );
  const values = state as TableState<Column> & inferParserType<Extra>;

  function set(update: Partial<typeof values>) {
    return setState({ page: null, ...update } as never);
  }

  return [values, set] as const;
}
