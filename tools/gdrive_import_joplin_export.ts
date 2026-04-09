import fs from "fs/promises";
import path from "path";
import {
  createEmptyGoogleDoc,
  MarkdownNode,
  parseMarkdownSource,
  writeMarkdownTreeToDocument,
} from "./gdocs_markdown_shared.js";
import {
  buildDriveWebViewLink,
  buildPublicImageUri,
  deletePermission,
  DriveFileReference,
  ensureAbsolutePath,
  ensureAnyoneReaderPermission,
  ensureFolderPath,
  ensureRootFolderByName,
  findChildByName,
  GOOGLE_DOC_MIME_TYPE,
  inferMimeType,
  isEmbeddableImageMimeType,
  uploadLocalFileToFolder,
} from "./gdrive_import_shared.js";
import { GDriveImportJoplinExportInput, InternalToolResponse } from "./types.js";

export const schema = {
  name: "gdrive_import_joplin_export",
  description:
    "Import a Joplin Markdown export into Google Drive by recreating folders, creating Google Docs for notes, uploading linked attachments, and rewriting local links.",
  inputSchema: {
    type: "object",
    properties: {
      sourceRootPath: {
        type: "string",
        description: "Absolute path to the exported Joplin root folder.",
      },
      driveRootFolderName: {
        type: "string",
        description: "Name of the top-level Google Drive folder to create or reuse. Defaults to 'Joplin'.",
        optional: true,
      },
      resourcesFolderName: {
        type: "string",
        description: "Name of the special resources folder in the export. Defaults to '_resources'.",
        optional: true,
      },
      supportsBasicGfm: {
        type: "boolean",
        description: "Whether to parse basic GFM features while importing notes. Defaults to true.",
        optional: true,
      },
      embedImagesInline: {
        type: "boolean",
        description:
          "When true, supported image attachments are embedded inline into Google Docs using temporary anyone-with-link access during insertion. Defaults to true.",
        optional: true,
      },
      dryRun: {
        type: "boolean",
        description: "When true, only report what would be imported without creating folders, files, or Docs.",
        optional: true,
      },
    },
    required: ["sourceRootPath"],
  },
} as const;

interface JoplinScanResult {
  folderRelativePaths: string[];
  noteRelativePaths: string[];
}

interface DocShellReference {
  id: string;
  url: string;
  title: string;
  folderId: string;
  existed: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDocsQuotaError(error: any): boolean {
  const message = String(error?.message || "");
  return (
    message.includes("Quota exceeded") ||
    message.includes("quota metric") ||
    message.includes("Rate Limit Exceeded") ||
    message.includes("User-rate limit exceeded")
  );
}

async function withDocsQuotaRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (!isDocsQuotaError(error) || attempt >= 6) {
        throw error;
      }

      const delayMs = 65000 * (attempt + 1);
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

async function scanJoplinTree(
  sourceRootPath: string,
  resourcesFolderName: string,
): Promise<JoplinScanResult> {
  const folderRelativePaths: string[] = [];
  const noteRelativePaths: string[] = [];

  async function walk(currentPath: string, relativePath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!relativePath && entry.isDirectory() && entry.name === resourcesFolderName) {
        continue;
      }

      const absoluteChildPath = path.join(currentPath, entry.name);
      const relativeChildPath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        folderRelativePaths.push(relativeChildPath);
        await walk(absoluteChildPath, relativeChildPath);
        continue;
      }

      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
        noteRelativePaths.push(relativeChildPath);
      }
    }
  }

  await walk(sourceRootPath, "");

  folderRelativePaths.sort((left, right) => {
    const leftDepth = left.split(path.sep).length;
    const rightDepth = right.split(path.sep).length;
    return leftDepth - rightDepth || left.localeCompare(right);
  });
  noteRelativePaths.sort((left, right) => left.localeCompare(right));

  return {
    folderRelativePaths,
    noteRelativePaths,
  };
}

function isRemoteUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:|data:)/i.test(url);
}

function extractPathFromUrl(url: string): string {
  return url.split("#")[0].split("?")[0];
}

function safeDecodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function convertImageNodeToLink(node: MarkdownNode, url: string) {
  node.type = "link";
  node.url = url;
  node.children = [
    {
      type: "text",
      value: node.alt || path.basename(extractPathFromUrl(url)),
    },
  ];
  delete node.alt;
}

export async function importJoplinExport(
  args: GDriveImportJoplinExportInput,
): Promise<InternalToolResponse> {
  try {
    ensureAbsolutePath(args.sourceRootPath);

    const driveRootFolderName = args.driveRootFolderName || "Joplin";
    const resourcesFolderName = args.resourcesFolderName || "_resources";
    const dryRun = args.dryRun === true;
    const supportsBasicGfm = args.supportsBasicGfm !== false;
    const embedImagesInline = args.embedImagesInline !== false;
    const resourcesRootPath = path.join(args.sourceRootPath, resourcesFolderName);

    const scan = await scanJoplinTree(args.sourceRootPath, resourcesFolderName);
    const folderMap = new Map<string, string>();
    const notePathSet = new Set(
      scan.noteRelativePaths.map((relativePath) => path.resolve(args.sourceRootPath, relativePath)),
    );
    const docCache = new Map<string, DocShellReference>();
    const attachmentCache = new Map<string, DriveFileReference>();
    const temporaryImagePermissions = new Map<string, string>();

    let createdFolderCount = 0;
    let createdDocCount = 0;
    let updatedDocCount = 0;
    let uploadedAttachmentCount = 0;
    let reusedAttachmentCount = 0;
    let rewrittenAttachmentLinkCount = 0;
    let rewrittenNoteLinkCount = 0;
    let imageAsLinkCount = 0;
    let inlineImagesEmbedded = 0;
    let missingReferenceCount = 0;
    const warnings = new Set<string>();

    const rootFolder = dryRun
      ? {
          id: "DRY_RUN_ROOT",
          name: driveRootFolderName,
          mimeType: "application/vnd.google-apps.folder",
          webViewLink: "",
        }
      : await ensureRootFolderByName(driveRootFolderName);

    folderMap.set("", rootFolder.id);

    for (const folderRelativePath of scan.folderRelativePaths) {
      const segments = folderRelativePath.split(path.sep).filter(Boolean);

      if (dryRun) {
        folderMap.set(folderRelativePath, `DRY_RUN:${folderRelativePath}`);
        continue;
      }

      const folder = await ensureFolderPath(rootFolder.id, segments);
      folderMap.set(folderRelativePath, folder.id);
      if (!folder.reused) {
        createdFolderCount += 1;
      }
    }

    async function ensureNoteDocumentShell(noteAbsolutePath: string): Promise<DocShellReference> {
      const normalizedPath = path.resolve(noteAbsolutePath);
      const cached = docCache.get(normalizedPath);
      if (cached) {
        return cached;
      }

      const relativePath = path.relative(args.sourceRootPath, normalizedPath);
      const relativeDirectory = path.dirname(relativePath) === "." ? "" : path.dirname(relativePath);
      const folderId = folderMap.get(relativeDirectory) || rootFolder.id;
      const title = path.basename(relativePath, path.extname(relativePath));

      if (dryRun) {
        const dryDoc: DocShellReference = {
          id: `DRY_RUN_DOC:${relativePath}`,
          url: `dry-run://docs/${relativePath}`,
          title,
          folderId,
          existed: false,
        };
        docCache.set(normalizedPath, dryDoc);
        return dryDoc;
      }

      const existing = await findChildByName({
        parentId: folderId,
        name: title,
        mimeType: GOOGLE_DOC_MIME_TYPE,
      });

      if (existing) {
        const existingDoc: DocShellReference = {
          id: existing.id,
          url: buildDriveWebViewLink(existing.id, existing.mimeType),
          title,
          folderId,
          existed: true,
        };
        docCache.set(normalizedPath, existingDoc);
        return existingDoc;
      }

      const created = await withDocsQuotaRetry(() =>
        createEmptyGoogleDoc(title, folderId),
      );
      createdDocCount += 1;

      const createdDoc: DocShellReference = {
        id: created.documentId,
        url: created.documentUrl,
        title,
        folderId,
        existed: false,
      };
      docCache.set(normalizedPath, createdDoc);
      return createdDoc;
    }

    async function rewriteNodeLinks(
      node: MarkdownNode,
      noteAbsolutePath: string,
      noteFolderId: string,
    ): Promise<void> {
      const originalUrl = node.url;
      if (originalUrl && !isRemoteUrl(originalUrl) && !originalUrl.startsWith("#")) {
        const decodedUrl = safeDecodePath(extractPathFromUrl(originalUrl));
        const noteDirectory = path.dirname(noteAbsolutePath);
        const resolvedPath = path.resolve(noteDirectory, decodedUrl);

        if (path.extname(resolvedPath).toLowerCase() === ".md" && notePathSet.has(resolvedPath)) {
          const linkedDoc = await ensureNoteDocumentShell(resolvedPath);
          node.url = linkedDoc.url;
          rewrittenNoteLinkCount += 1;
        } else if (await pathExists(resolvedPath)) {
          const cacheKey = `${noteFolderId}:${resolvedPath}`;
          let uploaded = attachmentCache.get(cacheKey);
          const localMimeType = inferMimeType(resolvedPath);

          if (!uploaded && !dryRun) {
            uploaded = await uploadLocalFileToFolder({
              filePath: resolvedPath,
              folderId: noteFolderId,
              reuseIfExists: true,
            });
            attachmentCache.set(cacheKey, uploaded);
            if (uploaded.reused) {
              reusedAttachmentCount += 1;
            } else {
              uploadedAttachmentCount += 1;
            }
          }

          const effectiveMimeType = uploaded?.mimeType || localMimeType;
          const canEmbedImageInline =
            node.type === "image" &&
            embedImagesInline &&
            isEmbeddableImageMimeType(effectiveMimeType);

          if (node.type === "image") {
            if (canEmbedImageInline) {
              if (!dryRun && uploaded && !temporaryImagePermissions.has(uploaded.id)) {
                const permission = await ensureAnyoneReaderPermission(uploaded.id);
                if (!permission.reusedExisting && permission.permissionId) {
                  temporaryImagePermissions.set(uploaded.id, permission.permissionId);
                }
              }

              node.url =
                dryRun || !uploaded
                  ? buildPublicImageUri("DRY_RUN_IMAGE")
                  : uploaded.webContentLink || buildPublicImageUri(uploaded.id);
              inlineImagesEmbedded += 1;
            } else {
              imageAsLinkCount += 1;
            }
          }

          if (dryRun) {
            rewrittenAttachmentLinkCount += 1;
          } else if (uploaded) {
            if (!canEmbedImageInline) {
              node.url = uploaded.webViewLink;
            }
            rewrittenAttachmentLinkCount += 1;
            if (node.type === "image" && !canEmbedImageInline) {
              convertImageNodeToLink(node, uploaded.webViewLink);
            }
          }
        } else if (resolvedPath.startsWith(resourcesRootPath)) {
          missingReferenceCount += 1;
          warnings.add(`Missing attachment: ${path.relative(args.sourceRootPath, resolvedPath)}`);
        }
      }

      for (const child of node.children || []) {
        await rewriteNodeLinks(child, noteAbsolutePath, noteFolderId);
      }
    }

    try {
      for (const noteRelativePath of scan.noteRelativePaths) {
        const noteAbsolutePath = path.resolve(args.sourceRootPath, noteRelativePath);
        const noteSource = await fs.readFile(noteAbsolutePath, "utf-8");
        const docShell = await ensureNoteDocumentShell(noteAbsolutePath);
        const tree = parseMarkdownSource(noteSource, supportsBasicGfm);

        await rewriteNodeLinks(tree, noteAbsolutePath, docShell.folderId);

        if (dryRun) {
          continue;
        }

        const writeSummary = await withDocsQuotaRetry(() =>
          writeMarkdownTreeToDocument(docShell.id, tree),
        );
        updatedDocCount += 1;
        for (const warning of writeSummary.unsupportedElements) {
          warnings.add(warning);
        }
      }
    } finally {
      if (!dryRun) {
        for (const [fileId, permissionId] of temporaryImagePermissions.entries()) {
          try {
            await deletePermission(fileId, permissionId);
          } catch (error: any) {
            warnings.add(`Could not remove temporary image sharing for ${fileId}: ${error.message}`);
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              sourceRootPath: args.sourceRootPath,
              driveRootFolderName,
              dryRun,
              counts: {
                foldersDiscovered: scan.folderRelativePaths.length + 1,
                notesDiscovered: scan.noteRelativePaths.length,
                foldersCreated: createdFolderCount,
                docsCreated: createdDocCount,
                docsWritten: dryRun ? 0 : updatedDocCount,
                attachmentsUploaded: uploadedAttachmentCount,
                attachmentsReused: reusedAttachmentCount,
                attachmentLinksRewritten: rewrittenAttachmentLinkCount,
                noteLinksRewritten: rewrittenNoteLinkCount,
                inlineImagesEmbedded,
                imagesConvertedToLinks: imageAsLinkCount,
                missingReferences: missingReferenceCount,
              },
              rootFolder: {
                id: dryRun ? null : rootFolder.id,
                name: driveRootFolderName,
                webViewLink: dryRun ? null : rootFolder.webViewLink,
              },
              warnings: Array.from(warnings).slice(0, 100),
            },
            null,
            2,
          ),
        },
      ],
      isError: false,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error importing Joplin export: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
