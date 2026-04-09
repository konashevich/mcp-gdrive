import { google, slides_v1 } from "googleapis";
import { InternalToolResponse } from "./types.js";

export const slides = google.slides("v1");

const drive = google.drive("v3");

function normalizeText(value?: string | null): string {
  return (value || "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

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

export function getPresentationUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}

export function getSlideUrl(
  presentationId: string,
  slideObjectId: string,
): string {
  return `${getPresentationUrl(presentationId)}#slide=id.${slideObjectId}`;
}

export async function movePresentationToFolder(
  presentationId: string,
  folderId: string,
) {
  const file = await drive.files.get({
    fileId: presentationId,
    fields: "parents",
    supportsAllDrives: true,
  });

  const previousParents = file.data.parents?.join(",");

  await drive.files.update({
    fileId: presentationId,
    addParents: folderId,
    removeParents: previousParents || undefined,
    fields: "id, parents",
    supportsAllDrives: true,
  });
}

function extractTextFromTextElements(
  textElements?: (slides_v1.Schema$TextElement | null)[] | null,
): string[] {
  const fragments: string[] = [];

  for (const textElement of textElements || []) {
    const content = normalizeText(textElement?.textRun?.content);
    if (content) {
      fragments.push(content);
    }
  }

  return fragments;
}

export function extractTextFromPageElement(
  pageElement?: slides_v1.Schema$PageElement | null,
): string[] {
  const fragments: string[] = [];

  if (!pageElement) {
    return fragments;
  }

  fragments.push(
    ...extractTextFromTextElements(pageElement.shape?.text?.textElements),
  );

  const wordArtText = normalizeText(pageElement.wordArt?.renderedText);
  if (wordArtText) {
    fragments.push(wordArtText);
  }

  for (const row of pageElement.table?.tableRows || []) {
    for (const cell of row?.tableCells || []) {
      fragments.push(...extractTextFromTextElements(cell?.text?.textElements));
    }
  }

  for (const child of pageElement.elementGroup?.children || []) {
    fragments.push(...extractTextFromPageElement(child));
  }

  return fragments;
}

export function extractTextFromPageElements(
  pageElements?: (slides_v1.Schema$PageElement | null)[] | null,
): string[] {
  const fragments: string[] = [];

  for (const pageElement of pageElements || []) {
    fragments.push(...extractTextFromPageElement(pageElement));
  }

  return fragments;
}

export function findPageElementByObjectId(
  pageElements: (slides_v1.Schema$PageElement | null)[] | null | undefined,
  objectId: string,
): slides_v1.Schema$PageElement | null {
  for (const pageElement of pageElements || []) {
    if (!pageElement) {
      continue;
    }

    if (pageElement.objectId === objectId) {
      return pageElement;
    }

    const nestedMatch = findPageElementByObjectId(
      pageElement.elementGroup?.children,
      objectId,
    );
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

export function extractSpeakerNotesText(
  notesPage?: slides_v1.Schema$Page | null,
): string {
  const speakerNotesObjectId = notesPage?.notesProperties?.speakerNotesObjectId;
  if (!speakerNotesObjectId) {
    return "";
  }

  const speakerNotesElement = findPageElementByObjectId(
    notesPage.pageElements,
    speakerNotesObjectId,
  );
  if (!speakerNotesElement) {
    return "";
  }

  return joinTextFragments(extractTextFromPageElement(speakerNotesElement));
}

export function joinTextFragments(fragments: string[]): string {
  return fragments
    .map((fragment) => normalizeText(fragment))
    .filter(Boolean)
    .join(" ");
}
