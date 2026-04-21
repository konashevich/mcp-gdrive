import { GKeepSearchNotesInput, InternalToolResponse } from "./types.js";
import { errorResponse, listNotesForSearch, okResponse, serializeNote } from "./gkeep_shared.js";

export const schema = {
  name: "gkeep_search_notes",
  description:
    "Search Google Keep note titles and contents client-side using the official Keep API. This is text matching over returned notes, since the official list API does not support full-text search.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Text to match against note title and body content",
      },
      includeTrashed: {
        type: "boolean",
        description: "Whether to also search trashed notes",
        optional: true,
      },
      limit: {
        type: "number",
        description: "Maximum number of matches to return",
        optional: true,
      },
      pageSize: {
        type: "number",
        description: "Page size to use while scanning notes via the Keep API",
        optional: true,
      },
    },
    required: ["query"],
  },
} as const;

export async function searchKeepNotes(
  args: GKeepSearchNotesInput,
): Promise<InternalToolResponse> {
  try {
    const query = args.query.trim();
    if (!query) {
      throw new Error("query must not be empty");
    }

    const limit = args.limit ?? 25;
    const matches = await listNotesForSearch({
      query,
      includeTrashed: Boolean(args.includeTrashed),
      pageSize: args.pageSize ?? 100,
      maxResults: limit,
    });

    return okResponse({
      query,
      includeTrashed: Boolean(args.includeTrashed),
      matches: matches.map((note) => serializeNote(note)),
      returned: matches.length,
      limit,
    });
  } catch (error) {
    return errorResponse("searching Keep notes", error);
  }
}