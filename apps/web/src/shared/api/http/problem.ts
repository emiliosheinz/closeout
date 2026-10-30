import { problemDocumentSchema } from "@closeout/contracts/schemas";

export type Problem = {
  detail: string;
  /** First error detail per JSON pointer. */
  fieldErrors: Record<string, string>;
};

/** Reads an error response as a problem document; anything else yields `fallback`. */
export async function readProblem(
  response: Response,
  fallback: string,
): Promise<Problem> {
  const body: unknown = await response.json().catch(() => undefined);
  const problem = problemDocumentSchema.safeParse(body);
  if (!problem.success) return { detail: fallback, fieldErrors: {} };
  const fieldErrors: Record<string, string> = {};
  for (const { pointer, detail } of problem.data.errors ?? []) {
    fieldErrors[pointer] ??= detail;
  }
  return { detail: problem.data.detail, fieldErrors };
}
