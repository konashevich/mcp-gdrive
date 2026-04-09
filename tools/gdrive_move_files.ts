import { google } from "googleapis";
import { GDriveMoveFilesInput, InternalToolResponse } from "./types.js";
import {
  getFolder,
  jsonText,
  moveFileToFolder,
} from "./gdrive_cleanup_shared.js";

const drive = google.drive("v3");

export const schema = {
  name: "gdrive_move_files",
  description:
    "Move one or more Google Drive files into a destination folder. Use dryRun to preview changes.",
  inputSchema: {
    type: "object",
    properties: {
      fileIds: {
        type: "array",
        items: {
          type: "string",
        },
        description: "The Google Drive file IDs to move.",
      },
      destinationFolderId: {
        type: "string",
        description: "The folder ID to move the files into.",
      },
      dryRun: {
        type: "boolean",
        description:
          "When true, return the files that would be moved without changing anything.",
        optional: true,
      },
    },
    required: ["fileIds", "destinationFolderId"],
  },
} as const;

export async function moveFiles(
  args: GDriveMoveFilesInput,
): Promise<InternalToolResponse> {
  try {
    const dryRun = args.dryRun === true;
    const destinationFolder = await getFolder(args.destinationFolderId);

    const results = await Promise.all(
      args.fileIds.map(async (fileId) => {
        try {
          if (dryRun) {
            const file = await drive.files.get({
              fileId,
              fields: "id, name, parents",
            });

            return {
              fileId,
              name: file.data.name || fileId,
              fromParents: file.data.parents || [],
              destinationFolderId: destinationFolder.id,
              destinationFolderName: destinationFolder.name,
              status: "would-move",
            };
          }

          const updated = await moveFileToFolder(fileId, args.destinationFolderId);
          return {
            fileId,
            name: updated.name || fileId,
            parents: updated.parents || [],
            destinationFolderId: destinationFolder.id,
            destinationFolderName: destinationFolder.name,
            status: "moved",
          };
        } catch (error: any) {
          return {
            fileId,
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
            dryRun,
            destinationFolder: {
              id: destinationFolder.id,
              name: destinationFolder.name,
            },
            count: results.length,
            results,
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
          text: `Error moving files: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}