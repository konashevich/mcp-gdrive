import { GDriveOrganizeRootInput, InternalToolResponse } from "./types.js";
import {
  createRootFolder,
  findRootFolderByName,
  GOOGLE_DOC_MIME_TYPE,
  GOOGLE_SHEET_MIME_TYPE,
  jsonText,
  listAllCleanupFiles,
  moveFileToFolder,
  getFolder,
} from "./gdrive_cleanup_shared.js";

export const schema = {
  name: "gdrive_organize_root",
  description:
    "Organize all Google Docs and Google Sheets from Drive root into dedicated folders, with an optional dry run preview.",
  inputSchema: {
    type: "object",
    properties: {
      docsFolderId: {
        type: "string",
        description: "Optional existing destination folder ID for Google Docs.",
        optional: true,
      },
      sheetsFolderId: {
        type: "string",
        description:
          "Optional existing destination folder ID for Google Sheets.",
        optional: true,
      },
      docsFolderName: {
        type: "string",
        description:
          "Folder name to use when creating or locating the Google Docs destination. Defaults to 'Google Docs'.",
        optional: true,
      },
      sheetsFolderName: {
        type: "string",
        description:
          "Folder name to use when creating or locating the Google Sheets destination. Defaults to 'Google Sheets'.",
        optional: true,
      },
      dryRun: {
        type: "boolean",
        description:
          "When true, return the planned organization changes without moving any files. Defaults to true.",
        optional: true,
      },
    },
    required: [],
  },
} as const;

async function resolveDestinationFolder(
  folderId: string | undefined,
  fallbackName: string,
  dryRun: boolean,
): Promise<{
  id?: string;
  name: string;
  action: "existing" | "would-create" | "created";
}> {
  if (folderId) {
    const folder = await getFolder(folderId);
    return {
      id: folder.id,
      name: folder.name || fallbackName,
      action: "existing",
    };
  }

  const existingFolder = await findRootFolderByName(fallbackName);
  if (existingFolder) {
    return {
      id: existingFolder.id,
      name: existingFolder.name || fallbackName,
      action: "existing",
    };
  }

  if (dryRun) {
    return {
      name: fallbackName,
      action: "would-create",
    };
  }

  const createdFolder = await createRootFolder(fallbackName);
  return {
    id: createdFolder.id,
    name: createdFolder.name || fallbackName,
    action: "created",
  };
}

export async function organizeRoot(
  args: GDriveOrganizeRootInput,
): Promise<InternalToolResponse> {
  try {
    const dryRun = args.dryRun !== false;
    const docsFolderName = args.docsFolderName || "Google Docs";
    const sheetsFolderName = args.sheetsFolderName || "Google Sheets";
    const rootFiles = await listAllCleanupFiles({
      rootOnly: true,
      fileTypes: ["docs", "sheets"],
    });

    const docFiles = rootFiles.filter((file) => file.mimeType === GOOGLE_DOC_MIME_TYPE);
    const sheetFiles = rootFiles.filter(
      (file) => file.mimeType === GOOGLE_SHEET_MIME_TYPE,
    );

    const docsFolder = await resolveDestinationFolder(
      args.docsFolderId,
      docsFolderName,
      dryRun,
    );
    const sheetsFolder = await resolveDestinationFolder(
      args.sheetsFolderId,
      sheetsFolderName,
      dryRun,
    );

    const plannedMoves = [
      ...docFiles.map((file) => ({
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        destinationFolderId: docsFolder.id || null,
        destinationFolderName: docsFolder.name,
      })),
      ...sheetFiles.map((file) => ({
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        destinationFolderId: sheetsFolder.id || null,
        destinationFolderName: sheetsFolder.name,
      })),
    ];

    if (dryRun) {
      return {
        content: [
          {
            type: "text",
            text: jsonText({
              dryRun: true,
              counts: {
                docs: docFiles.length,
                sheets: sheetFiles.length,
                total: plannedMoves.length,
              },
              destinations: {
                docs: docsFolder,
                sheets: sheetsFolder,
              },
              plannedMoves,
            }),
          },
        ],
        isError: false,
      };
    }

    if (!docsFolder.id || !sheetsFolder.id) {
      throw new Error("Failed to resolve destination folders");
    }

    const moveResults = await Promise.all(
      plannedMoves.map(async (move) => {
        try {
          const updated = await moveFileToFolder(
            move.fileId,
            move.destinationFolderId as string,
          );
          return {
            ...move,
            parents: updated.parents || [],
            status: "moved",
          };
        } catch (error: any) {
          return {
            ...move,
            status: "error",
            error: error.message,
          };
        }
      }),
    );

    return {
      content: [
        {
          type: "text",
          text: jsonText({
            dryRun: false,
            counts: {
              docs: docFiles.length,
              sheets: sheetFiles.length,
              total: plannedMoves.length,
            },
            destinations: {
              docs: docsFolder,
              sheets: sheetsFolder,
            },
            results: moveResults,
          }),
        },
      ],
      isError: false,
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error organizing root files: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}