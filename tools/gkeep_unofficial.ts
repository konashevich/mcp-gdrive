import {
  GKeepArchiveNoteInput,
  GKeepAddListItemInput,
  GKeepCreateLabelInput,
  GKeepDeleteLabelInput,
  GKeepDeleteListItemInput,
  GKeepUnofficialGetNoteInput,
  GKeepUnofficialSearchNotesInput,
  GKeepLabelListInput,
  GKeepModifyNoteLabelInput,
  GKeepPinNoteInput,
  GKeepRenameLabelInput,
  GKeepUpdateListItemInput,
  GKeepUpdateNoteInput,
} from "./types.js";
import {
  callUnofficialKeepTool,
  normalizeUnofficialNoteId,
} from "./gkeep_unofficial_shared.js";

export const unofficialSearchNotesSchema = {
  name: "gkeep_unofficial_search_notes",
  description: "Search Google Keep notes via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Text to match against note title, body, and checklist items",
      },
      limit: {
        type: "number",
        description: "Maximum number of matches to return. Defaults to 10.",
        optional: true,
      },
      includeTrashed: {
        type: "boolean",
        description: "Whether to include trashed notes in the search",
        optional: true,
      },
    },
    required: ["query"],
  },
} as const;

export async function searchUnofficialKeepNotes(
  args: GKeepUnofficialSearchNotesInput,
) {
  return callUnofficialKeepTool(
    "search_notes",
    {
      query: args.query,
      limit: args.limit,
      includeTrashed: args.includeTrashed,
    },
    "searching unofficial Keep notes",
  );
}

export const unofficialGetNoteSchema = {
  name: "gkeep_unofficial_get_note",
  description: "Get one Google Keep note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
    },
    required: ["noteId"],
  },
} as const;

export async function getUnofficialKeepNote(
  args: GKeepUnofficialGetNoteInput,
) {
  return callUnofficialKeepTool(
    "get_note",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
    },
    "getting unofficial Keep note",
  );
}

export const updateNoteSchema = {
  name: "gkeep_update_note",
  description:
    "Update an existing Google Keep note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      title: {
        type: "string",
        description: "Updated note title",
        optional: true,
      },
      text: {
        type: "string",
        description: "Updated note text",
        optional: true,
      },
    },
    required: ["noteId"],
  },
} as const;

export async function updateUnofficialKeepNote(args: GKeepUpdateNoteInput) {
  return callUnofficialKeepTool(
    "update_note",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      title: args.title,
      text: args.text,
    },
    "updating unofficial Keep note",
  );
}

export const pinNoteSchema = {
  name: "gkeep_pin_note",
  description: "Pin or unpin a Google Keep note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      pinned: {
        type: "boolean",
        description: "Whether the note should be pinned. Defaults to true.",
        optional: true,
      },
    },
    required: ["noteId"],
  },
} as const;

export async function pinUnofficialKeepNote(args: GKeepPinNoteInput) {
  return callUnofficialKeepTool(
    "pin_note",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      pinned: args.pinned,
    },
    "pinning unofficial Keep note",
  );
}

export const archiveNoteSchema = {
  name: "gkeep_archive_note",
  description:
    "Archive or unarchive a Google Keep note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      archived: {
        type: "boolean",
        description: "Whether the note should be archived. Defaults to true.",
        optional: true,
      },
    },
    required: ["noteId"],
  },
} as const;

export async function archiveUnofficialKeepNote(args: GKeepArchiveNoteInput) {
  return callUnofficialKeepTool(
    "archive_note",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      archived: args.archived,
    },
    "archiving unofficial Keep note",
  );
}

export const listLabelsSchema = {
  name: "gkeep_list_labels",
  description: "List Google Keep labels via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      includeStats: {
        type: "boolean",
        description: "Include per-label note counts",
        optional: true,
      },
    },
    required: [],
  },
} as const;

export async function listUnofficialKeepLabels(args: GKeepLabelListInput) {
  return callUnofficialKeepTool(
    "list_labels",
    {
      includeStats: args.includeStats,
    },
    "listing unofficial Keep labels",
  );
}

export const createLabelSchema = {
  name: "gkeep_create_label",
  description: "Create a Google Keep label via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Label name",
      },
    },
    required: ["name"],
  },
} as const;

export async function createUnofficialKeepLabel(args: GKeepCreateLabelInput) {
  return callUnofficialKeepTool(
    "create_label",
    { name: args.name },
    "creating unofficial Keep label",
  );
}

export const renameLabelSchema = {
  name: "gkeep_rename_label",
  description: "Rename a Google Keep label via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      labelId: {
        type: "string",
        description: "Keep label ID",
      },
      newName: {
        type: "string",
        description: "New label name",
      },
    },
    required: ["labelId", "newName"],
  },
} as const;

export async function renameUnofficialKeepLabel(args: GKeepRenameLabelInput) {
  return callUnofficialKeepTool(
    "rename_label",
    {
      labelId: args.labelId,
      newName: args.newName,
    },
    "renaming unofficial Keep label",
  );
}

export const deleteLabelSchema = {
  name: "gkeep_delete_label",
  description: "Delete a Google Keep label via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      labelId: {
        type: "string",
        description: "Keep label ID",
      },
    },
    required: ["labelId"],
  },
} as const;

export async function deleteUnofficialKeepLabel(args: GKeepDeleteLabelInput) {
  return callUnofficialKeepTool(
    "delete_label",
    { labelId: args.labelId },
    "deleting unofficial Keep label",
  );
}

export const addLabelToNoteSchema = {
  name: "gkeep_add_label_to_note",
  description: "Add a label to a Google Keep note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      labelId: {
        type: "string",
        description: "Keep label ID",
      },
    },
    required: ["noteId", "labelId"],
  },
} as const;

export async function addLabelToUnofficialKeepNote(
  args: GKeepModifyNoteLabelInput,
) {
  return callUnofficialKeepTool(
    "add_label_to_note",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      labelId: args.labelId,
    },
    "adding label to unofficial Keep note",
  );
}

export const removeLabelFromNoteSchema = {
  name: "gkeep_remove_label_from_note",
  description:
    "Remove a label from a Google Keep note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      labelId: {
        type: "string",
        description: "Keep label ID",
      },
    },
    required: ["noteId", "labelId"],
  },
} as const;

export async function removeLabelFromUnofficialKeepNote(
  args: GKeepModifyNoteLabelInput,
) {
  return callUnofficialKeepTool(
    "remove_label_from_note",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      labelId: args.labelId,
    },
    "removing label from unofficial Keep note",
  );
}

export const addListItemSchema = {
  name: "gkeep_add_list_item",
  description: "Add an item to a checklist note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      text: {
        type: "string",
        description: "Checklist item text",
      },
      checked: {
        type: "boolean",
        description: "Whether the checklist item starts checked",
        optional: true,
      },
    },
    required: ["noteId", "text"],
  },
} as const;

export async function addUnofficialKeepListItem(args: GKeepAddListItemInput) {
  return callUnofficialKeepTool(
    "add_list_item",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      text: args.text,
      checked: args.checked,
    },
    "adding unofficial Keep list item",
  );
}

export const updateListItemSchema = {
  name: "gkeep_update_list_item",
  description:
    "Update a checklist item in a Google Keep list note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      itemId: {
        type: "string",
        description: "Checklist item ID",
      },
      text: {
        type: "string",
        description: "Updated checklist item text",
        optional: true,
      },
      checked: {
        type: "boolean",
        description: "Updated checked state",
        optional: true,
      },
    },
    required: ["noteId", "itemId"],
  },
} as const;

export async function updateUnofficialKeepListItem(
  args: GKeepUpdateListItemInput,
) {
  return callUnofficialKeepTool(
    "update_list_item",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      itemId: args.itemId,
      text: args.text,
      checked: args.checked,
    },
    "updating unofficial Keep list item",
  );
}

export const deleteListItemSchema = {
  name: "gkeep_delete_list_item",
  description:
    "Delete a checklist item from a Google Keep list note via the unofficial Keep backend",
  inputSchema: {
    type: "object",
    properties: {
      noteId: {
        type: "string",
        description: "Keep note ID or notes/{id} resource name",
      },
      itemId: {
        type: "string",
        description: "Checklist item ID",
      },
    },
    required: ["noteId", "itemId"],
  },
} as const;

export async function deleteUnofficialKeepListItem(
  args: GKeepDeleteListItemInput,
) {
  return callUnofficialKeepTool(
    "delete_list_item",
    {
      noteId: normalizeUnofficialNoteId(args.noteId),
      itemId: args.itemId,
    },
    "deleting unofficial Keep list item",
  );
}