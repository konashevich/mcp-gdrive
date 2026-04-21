import { GKeepDeleteNoteInput, InternalToolResponse } from "./types.js";
import { errorResponse, keep, normalizeNoteName, okResponse } from "./gkeep_shared.js";

export const schema = {
  name: "gkeep_delete_note",
  description:
    "Delete a Google Keep note permanently using the official Keep API",
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

export async function deleteKeepNote(
  args: GKeepDeleteNoteInput,
): Promise<InternalToolResponse> {
  try {
    const noteName = normalizeNoteName(args.noteName);
    await keep.notes.delete({
      name: noteName,
    });

    return okResponse({
      deleted: true,
      noteName,
    });
  } catch (error) {
    return errorResponse("deleting Keep note", error);
  }
}