import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { google, keep_v1 } from "googleapis";
import { InternalToolResponse } from "./types.js";

export const keep = google.keep("v1");

export function okResponse(payload: unknown): InternalToolResponse {
  return {
    content: [
      {
        type: "text",
        text:
          typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    isError: false,
  };
}

export function errorResponse(
  action: string,
  error: unknown,
): InternalToolResponse {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: "text",
        text: `Error ${action}: ${message}`,
      },
    ],
    isError: true,
  };
}

export function normalizeNoteName(noteName: string): string {
  const value = noteName.trim();
  if (!value) {
    throw new Error("noteName is required");
  }

  return value.startsWith("notes/") ? value : `notes/${value}`;
}

export function normalizeAttachmentName(attachmentName: string): string {
  const value = attachmentName.trim();
  if (!value) {
    throw new Error("attachmentName is required");
  }

  if (!value.startsWith("notes/")) {
    throw new Error(
      "attachmentName must be the full attachment resource name, for example notes/{noteId}/attachments/{attachmentId}",
    );
  }

  return value;
}

function normalizeText(value?: string | null): string {
  return (value || "").replace(/\r/g, "").trim();
}

function extractListItemText(item?: keep_v1.Schema$ListItem | null): string[] {
  if (!item) {
    return [];
  }

  const parts: string[] = [];
  const text = normalizeText(item.text?.text);
  if (text) {
    parts.push(text);
  }

  for (const childItem of item.childListItems || []) {
    parts.push(...extractListItemText(childItem));
  }

  return parts;
}

export function extractNotePlainText(note?: keep_v1.Schema$Note | null): string {
  if (!note) {
    return "";
  }

  const parts: string[] = [];
  const title = normalizeText(note.title);
  const textBody = normalizeText(note.body?.text?.text);

  if (title) {
    parts.push(title);
  }

  if (textBody) {
    parts.push(textBody);
  }

  for (const item of note.body?.list?.listItems || []) {
    parts.push(...extractListItemText(item));
  }

  return parts.join("\n").trim();
}

export function serializeListItem(item?: keep_v1.Schema$ListItem | null): unknown {
  if (!item) {
    return null;
  }

  return {
    text: normalizeText(item.text?.text),
    checked: Boolean(item.checked),
    childItems: (item.childListItems || [])
      .map((childItem) => serializeListItem(childItem))
      .filter(Boolean),
  };
}

export function serializeNote(note?: keep_v1.Schema$Note | null): unknown {
  if (!note) {
    return null;
  }

  return {
    name: note.name || null,
    title: note.title || "",
    text: normalizeText(note.body?.text?.text),
    listItems: (note.body?.list?.listItems || [])
      .map((item) => serializeListItem(item))
      .filter(Boolean),
    plainText: extractNotePlainText(note),
    trashed: Boolean(note.trashed),
    createTime: note.createTime || null,
    updateTime: note.updateTime || null,
    trashTime: note.trashTime || null,
    attachments: (note.attachments || []).map((attachment) => ({
      name: attachment.name || null,
      mimeTypes: attachment.mimeType || [],
    })),
    permissions: (note.permissions || []).map((permission) => ({
      name: permission.name || null,
      role: permission.role || null,
      email:
        permission.email ||
        permission.user?.email ||
        permission.group?.email ||
        null,
      deleted: Boolean(permission.deleted),
    })),
  };
}

export function buildListItems(
  items: { text: string; checked?: boolean; childItems?: any[] }[],
): keep_v1.Schema$ListItem[] {
  return items.map((item) => ({
    text: { text: item.text },
    checked: Boolean(item.checked),
    childListItems: item.childItems?.length ? buildListItems(item.childItems) : undefined,
  }));
}

export function noteMatchesQuery(note: keep_v1.Schema$Note, query: string): boolean {
  const haystack = extractNotePlainText(note).toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function listNotesPage(params: keep_v1.Params$Resource$Notes$List) {
  return keep.notes.list(params);
}

export async function listNotesForSearch(options: {
  includeTrashed: boolean;
  pageSize: number;
  maxResults: number;
  query: string;
}) {
  const collected: keep_v1.Schema$Note[] = [];
  const pageSize = Math.max(1, Math.min(options.pageSize, 100));
  const maxResults = Math.max(1, options.maxResults);

  const runSearch = async (filter?: string) => {
    let pageToken: string | undefined;

    while (collected.length < maxResults) {
      const response = await keep.notes.list({
        pageSize,
        pageToken,
        filter,
      });

      for (const note of response.data.notes || []) {
        if (noteMatchesQuery(note, options.query)) {
          collected.push(note);
          if (collected.length >= maxResults) {
            break;
          }
        }
      }

      pageToken = response.data.nextPageToken || undefined;
      if (!pageToken) {
        break;
      }
    }
  };

  await runSearch();

  if (options.includeTrashed && collected.length < maxResults) {
    await runSearch("trashed = true");
  }

  return collected.slice(0, maxResults);
}

export async function writeAttachmentToFile(options: {
  attachmentName: string;
  mimeType: string;
  outputPath: string;
  overwrite: boolean;
}) {
  const directory = path.dirname(options.outputPath);
  await fs.promises.mkdir(directory, { recursive: true });

  if (!options.overwrite) {
    try {
      await fs.promises.access(options.outputPath, fs.constants.F_OK);
      throw new Error(`File already exists: ${options.outputPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  const response = await keep.media.download(
    {
      name: options.attachmentName,
      mimeType: options.mimeType,
    },
    {
      responseType: "stream",
    },
  );

  await pipeline(response.data, fs.createWriteStream(options.outputPath));
}