import { GKeepGetNoteInput, InternalToolResponse } from "./types.js";
import { errorResponse, keep, normalizeNoteName, okResponse, serializeNote } from "./gkeep_shared.js";

export const schema = {
  name: "gkeep_get_note",
  description: "Get a Google Keep note by resource name or bare note ID",
  inputSchema: {
    type: "object",
    properties: {
      noteName: {
        type: "string",
        description: "Note resource name like notes/123 or bare note ID",
      },
    },
    required: ["noteName"],
  },
} as const;

export async function getKeepNote(
  args: GKeepGetNoteInput,
): Promise<InternalToolResponse> {
  try {
    const response = await keep.notes.get({
      name: normalizeNoteName(args.noteName),
    });

    return okResponse(serializeNote(response.data));
  } catch (error) {
    return errorResponse("getting Keep note", error);
  }
}