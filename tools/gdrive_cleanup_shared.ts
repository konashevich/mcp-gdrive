import { google } from "googleapis";

export const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";
export const GOOGLE_SHEET_MIME_TYPE =
  "application/vnd.google-apps.spreadsheet";
export const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const drive = google.drive("v3");
const docs = google.docs("v1");
const sheets = google.sheets("v4");

export interface CleanupListOptions {
  rootOnly?: boolean;
  fileTypes?: string[];
  pageSize?: number;
  pageToken?: string;
}

export interface CleanupCandidateSummary {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
  parents?: string[] | null;
  isUntitled: boolean;
  isEmpty?: boolean;
  emptyCheckError?: string;
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function normalizeCleanupFileType(fileType: string): string | null {
  switch (fileType.trim().toLowerCase()) {
    case "doc":
    case "docs":
    case "document":
    case "documents":
      return GOOGLE_DOC_MIME_TYPE;
    case "sheet":
    case "sheets":
    case "spreadsheet":
    case "spreadsheets":
      return GOOGLE_SHEET_MIME_TYPE;
    default:
      return null;
  }
}

export function getCleanupMimeTypes(fileTypes?: string[]): string[] {
  const requested = (fileTypes && fileTypes.length > 0
    ? fileTypes
    : ["docs", "sheets"]
  )
    .map(normalizeCleanupFileType)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(requested));
}

export function isUntitledFileName(name: string, mimeType: string): boolean {
  const normalizedName = name.trim().toLowerCase();

  if (mimeType === GOOGLE_DOC_MIME_TYPE) {
    return normalizedName === "untitled document";
  }

  if (mimeType === GOOGLE_SHEET_MIME_TYPE) {
    return normalizedName === "untitled spreadsheet";
  }

  return /^untitled(?:\s|$)/.test(normalizedName);
}

function buildCleanupQuery(options: CleanupListOptions): string {
  const conditions = ["trashed = false"];

  if (options.rootOnly !== false) {
    conditions.push("'root' in parents");
  }

  const mimeTypes = getCleanupMimeTypes(options.fileTypes);
  if (mimeTypes.length > 0) {
    const mimeConditions = mimeTypes.map(
      (mimeType) => `mimeType = '${escapeDriveQueryValue(mimeType)}'`,
    );
    conditions.push(`(${mimeConditions.join(" or ")})`);
  }

  return conditions.join(" and ");
}

export async function listCleanupFiles(options: CleanupListOptions): Promise<{
  files: any[];
  nextPageToken?: string | null;
}> {
  const response = await drive.files.list({
    q: buildCleanupQuery(options),
    orderBy: "modifiedTime desc",
    pageSize: options.pageSize || 25,
    pageToken: options.pageToken,
    fields:
      "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, size, parents)",
  });

  return {
    files: response.data.files || [],
    nextPageToken: response.data.nextPageToken,
  };
}

export async function listAllCleanupFiles(
  options: Omit<CleanupListOptions, "pageToken">,
): Promise<any[]> {
  const allFiles: any[] = [];
  let pageToken: string | undefined;

  do {
    const response = await listCleanupFiles({
      ...options,
      pageToken,
      pageSize: 100,
    });
    allFiles.push(...response.files);
    pageToken = response.nextPageToken || undefined;
  } while (pageToken);

  return allFiles;
}

function extractDocumentText(elements: any[] = []): string {
  let text = "";

  for (const element of elements) {
    const paragraphElements = element.paragraph?.elements || [];
    for (const paragraphElement of paragraphElements) {
      text += paragraphElement.textRun?.content || "";
    }

    const tableRows = element.table?.tableRows || [];
    for (const row of tableRows) {
      const tableCells = row.tableCells || [];
      for (const cell of tableCells) {
        text += extractDocumentText(cell.content || []);
      }
    }

    if (element.tableOfContents?.content) {
      text += extractDocumentText(element.tableOfContents.content);
    }
  }

  return text;
}

export async function isGoogleDocumentEmpty(fileId: string): Promise<boolean> {
  const document = await docs.documents.get({
    documentId: fileId,
    fields: "body/content",
  });

  const text = extractDocumentText(document.data.body?.content || []);
  return text.replace(/\s/g, "").length === 0;
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function hasMeaningfulSheetValues(values: any[][] | null | undefined): boolean {
  if (!values) {
    return false;
  }

  for (const row of values) {
    for (const cell of row) {
      if (typeof cell === "string") {
        if (cell.trim() !== "") {
          return true;
        }
      } else if (cell !== null && cell !== undefined) {
        return true;
      }
    }
  }

  return false;
}

export async function isGoogleSpreadsheetEmpty(
  spreadsheetId: string,
): Promise<boolean> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const sheetTitles = (metadata.data.sheets || [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));

  if (sheetTitles.length === 0) {
    return true;
  }

  const ranges = sheetTitles.map((title) => `${quoteSheetTitle(title)}!A1:ZZZ`);
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  const valueRanges = response.data.valueRanges || [];
  return !valueRanges.some((range) => hasMeaningfulSheetValues(range.values));
}

export async function inspectCleanupCandidate(file: any): Promise<{
  isEmpty: boolean;
}> {
  switch (file.mimeType) {
    case GOOGLE_DOC_MIME_TYPE:
      return {
        isEmpty: await isGoogleDocumentEmpty(file.id),
      };
    case GOOGLE_SHEET_MIME_TYPE:
      return {
        isEmpty: await isGoogleSpreadsheetEmpty(file.id),
      };
    default:
      return {
        isEmpty: false,
      };
  }
}

export async function summarizeCleanupCandidate(
  file: any,
  inspectEmpty: boolean,
): Promise<CleanupCandidateSummary> {
  const summary: CleanupCandidateSummary = {
    id: file.id,
    name: file.name || file.id,
    mimeType: file.mimeType || "application/octet-stream",
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
    size: file.size,
    parents: file.parents,
    isUntitled: isUntitledFileName(file.name || "", file.mimeType || ""),
  };

  if (!inspectEmpty) {
    return summary;
  }

  try {
    const inspection = await inspectCleanupCandidate(file);
    summary.isEmpty = inspection.isEmpty;
  } catch (error: any) {
    summary.emptyCheckError = error.message;
  }

  return summary;
}

export async function getFolder(folderId: string): Promise<any> {
  const folder = await drive.files.get({
    fileId: folderId,
    fields: "id, name, mimeType, parents",
  });

  if (folder.data.mimeType !== GOOGLE_FOLDER_MIME_TYPE) {
    throw new Error("destinationFolderId must refer to a Google Drive folder");
  }

  return folder.data;
}

export async function findRootFolderByName(name: string): Promise<any | null> {
  const response = await drive.files.list({
    q:
      `name = '${escapeDriveQueryValue(name)}' and ` +
      `mimeType = '${GOOGLE_FOLDER_MIME_TYPE}' and trashed = false and 'root' in parents`,
    pageSize: 1,
    fields: "files(id, name, mimeType, parents)",
  });

  return response.data.files?.[0] || null;
}

export async function createRootFolder(name: string): Promise<any> {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: GOOGLE_FOLDER_MIME_TYPE,
      parents: ["root"],
    },
    fields: "id, name, mimeType, parents",
  });

  return response.data;
}

export async function moveFileToFolder(
  fileId: string,
  destinationFolderId: string,
): Promise<any> {
  const file = await drive.files.get({
    fileId,
    fields: "id, name, parents",
  });

  const updated = await drive.files.update({
    fileId,
    addParents: destinationFolderId,
    removeParents: (file.data.parents || []).join(",") || undefined,
    fields: "id, name, parents",
  });

  return updated.data;
}

export async function trashFile(fileId: string): Promise<any> {
  const response = await drive.files.update({
    fileId,
    requestBody: {
      trashed: true,
    },
    fields: "id, name, trashed",
  });

  return response.data;
}