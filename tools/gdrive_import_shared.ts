import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { google } from "googleapis";

export const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";
export const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const drive = google.drive("v3");

const EMBEDDABLE_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
]);

const MIME_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".py": "text/x-python",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

export interface DriveFileReference {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string | null;
  parents?: string[] | null;
  reused?: boolean;
}

function ensureFileName(name: string) {
  if (!name.trim()) {
    throw new Error("File name cannot be empty");
  }
}

export function ensureAbsolutePath(filePath: string) {
  if (!path.isAbsolute(filePath)) {
    throw new Error("Path must be absolute");
  }
}

export function inferMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

export function buildDriveWebViewLink(fileId: string, mimeType?: string | null): string {
  if (mimeType === GOOGLE_DOC_MIME_TYPE) {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }

  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function isEmbeddableImageMimeType(mimeType: string): boolean {
  return EMBEDDABLE_IMAGE_MIME_TYPES.has(mimeType);
}

export function buildPublicImageUri(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export async function findChildByName(args: {
  parentId: string;
  name: string;
  mimeType?: string;
}): Promise<DriveFileReference | null> {
  ensureFileName(args.name);
  const escapedName = args.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const mimeTypeClause = args.mimeType ? ` and mimeType = '${args.mimeType}'` : "";

  const response = await drive.files.list({
    q:
      `'${args.parentId}' in parents and trashed = false and name = '${escapedName}'` +
      mimeTypeClause,
    pageSize: 1,
    fields: "files(id,name,mimeType,webViewLink,webContentLink,parents)",
  });

  const file = response.data.files?.[0];
  if (!file?.id || !file.name || !file.mimeType) {
    return null;
  }

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink || buildDriveWebViewLink(file.id, file.mimeType),
    webContentLink: file.webContentLink,
    parents: file.parents,
    reused: true,
  };
}

export async function ensureRootFolderByName(name: string): Promise<DriveFileReference> {
  const existing = await findChildByName({
    parentId: "root",
    name,
    mimeType: GOOGLE_FOLDER_MIME_TYPE,
  });

  if (existing) {
    return existing;
  }

  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: GOOGLE_FOLDER_MIME_TYPE,
      parents: ["root"],
    },
    fields: "id,name,mimeType,webViewLink,parents",
  });

  if (!response.data.id || !response.data.name || !response.data.mimeType) {
    throw new Error(`Failed to create root folder '${name}'`);
  }

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    webViewLink:
      response.data.webViewLink ||
      `https://drive.google.com/drive/folders/${response.data.id}`,
    parents: response.data.parents,
  };
}

export async function ensureChildFolder(
  parentId: string,
  name: string,
): Promise<DriveFileReference> {
  const existing = await findChildByName({
    parentId,
    name,
    mimeType: GOOGLE_FOLDER_MIME_TYPE,
  });

  if (existing) {
    return existing;
  }

  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: GOOGLE_FOLDER_MIME_TYPE,
      parents: [parentId],
    },
    fields: "id,name,mimeType,webViewLink,parents",
  });

  if (!response.data.id || !response.data.name || !response.data.mimeType) {
    throw new Error(`Failed to create child folder '${name}'`);
  }

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    webViewLink:
      response.data.webViewLink ||
      `https://drive.google.com/drive/folders/${response.data.id}`,
    parents: response.data.parents,
  };
}

export async function ensureFolderPath(
  rootFolderId: string,
  segments: string[],
): Promise<DriveFileReference> {
  let current: DriveFileReference = {
    id: rootFolderId,
    name: "",
    mimeType: GOOGLE_FOLDER_MIME_TYPE,
    webViewLink: `https://drive.google.com/drive/folders/${rootFolderId}`,
  };

  for (const segment of segments) {
    current = await ensureChildFolder(current.id, segment);
  }

  return current;
}

export async function uploadLocalFileToFolder(args: {
  filePath: string;
  folderId: string;
  fileName?: string;
  reuseIfExists?: boolean;
}): Promise<DriveFileReference> {
  ensureAbsolutePath(args.filePath);
  await fsPromises.access(args.filePath);

  const fileName = args.fileName || path.basename(args.filePath);
  ensureFileName(fileName);

  if (args.reuseIfExists !== false) {
    const existing = await findChildByName({
      parentId: args.folderId,
      name: fileName,
    });

    if (existing) {
      return existing;
    }
  }

  const mimeType = inferMimeType(args.filePath);
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [args.folderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(args.filePath),
    },
    fields: "id,name,mimeType,webViewLink,webContentLink,parents",
  });

  if (!response.data.id || !response.data.name || !response.data.mimeType) {
    throw new Error(`Failed to upload file '${fileName}'`);
  }

  return {
    id: response.data.id,
    name: response.data.name,
    mimeType: response.data.mimeType,
    webViewLink:
      response.data.webViewLink ||
      buildDriveWebViewLink(response.data.id, response.data.mimeType),
    webContentLink: response.data.webContentLink,
    parents: response.data.parents,
  };
}

export async function ensureAnyoneReaderPermission(fileId: string): Promise<{
  permissionId?: string;
  reusedExisting: boolean;
}> {
  const existing = await drive.permissions.list({
    fileId,
    fields: "permissions(id,type,role,allowFileDiscovery)",
  });

  const anyoneReader = existing.data.permissions?.find(
    (permission) =>
      permission.type === "anyone" &&
      permission.role === "reader" &&
      permission.allowFileDiscovery === false,
  );

  if (anyoneReader?.id) {
    return {
      permissionId: anyoneReader.id,
      reusedExisting: true,
    };
  }

  const created = await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
      allowFileDiscovery: false,
    },
    fields: "id",
  });

  return {
    permissionId: created.data.id || undefined,
    reusedExisting: false,
  };
}

export async function deletePermission(
  fileId: string,
  permissionId: string,
): Promise<void> {
  await drive.permissions.delete({
    fileId,
    permissionId,
  });
}
