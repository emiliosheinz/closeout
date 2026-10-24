"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { readQuery } from "@/shared/api";
import { toMember } from "../model/to-member";
import type { Member } from "../model/types";
import { sessionReads } from "./reads";

/** The signed-in member, read from the cache the admin panel layout seeds. */
export function useMember(): Member {
  const { data: me } = useSuspenseQuery(readQuery(sessionReads.me()));
  const member = toMember(me);
  if (!member) throw new Error("The admin panel needs a store membership");
  return member;
}
