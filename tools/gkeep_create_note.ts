import { GKeepCreateNoteInput, InternalToolResponse } from "./types.js";
import { buildListItems, errorResponse, keep, okResponse, serializeNote } from "./gkeep_shared.js";

export const schema = {
  name: "gkeep_create_note",
  description:
    "Create a Google Keep text note or checklist note using the official Keep API",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Optional note title",
        optional: true,
      },
      text: {
        type: "string",
        description: "Text body for a standard note",
        optional: true,
      },
      items: {
        type: "array",
        description:
          "Checklist items for a list note. Each item is an object with text, checked, and optional childItems.",
        items: {
          type: "object",
        },
        optional: true,
      },
    },
    required: [],
  },
} as const;

export async function createKeepNote(
  args: GKeepCreateNoteInput,
): Promise<InternalToolResponse> {
  try {
    const title = args.title?.trim();
    const text = args.text?.trim();
    const hasItems = Boolean(args.items?.length);

    if (!title && !text && !hasItems) {
      throw new Error("Provide at least one of title, text, or items");
    }

    if (text && hasItems) {
      throw new Error("Official Keep API notes can contain either text or list content, not both");
    }

    const response = await keep.notes.create({
      requestBody: {
        title,
        body: hasItems
          ? {
              list: {
                listItems: buildListItems(args.items || []),
              },
            }
          : text
            ? {
                text: {
                  text,
                },
              }
            : undefined,
      },
    });

    return okResponse(serializeNote(response.data));
  } catch (error) {
    return errorResponse("creating Keep note", error);
  }
}