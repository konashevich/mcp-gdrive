import { GKeepListNotesInput, InternalToolResponse } from "./types.js";
import { errorResponse, keep, okResponse, serializeNote } from "./gkeep_shared.js";

export const schema = {
  name: "gkeep_list_notes",
  description:
    "List Google Keep notes using the official Keep API. This supports Keep's native paging and timestamp/trashed filter syntax.",
  inputSchema: {
    type: "object",
    properties: {
      pageToken: {
        type: "string",
        description: "Token for the next page of results",
        optional: true,
      },
      pageSize: {
        type: "number",
        description: "Maximum number of notes to return (max 100)",
        optional: true,
      },
      filter: {
        type: "string",
        description:
          "Optional Keep API filter. Valid fields are create_time, update_time, trash_time, and trashed.",
        optional: true,
      },
    },
    required: [],
  },
} as const;

export async function listKeepNotes(
  args: GKeepListNotesInput,
): Promise<InternalToolResponse> {
  try {
    const response = await keep.notes.list({
      pageToken: args.pageToken,
      pageSize: args.pageSize,
      filter: args.filter,
    });

    return okResponse({
      notes: (response.data.notes || []).map((note) => serializeNote(note)),
      nextPageToken: response.data.nextPageToken || null,
    });
  } catch (error) {
    return errorResponse("listing Keep notes", error);
  }
}