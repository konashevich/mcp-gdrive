import { google } from "googleapis";
import { GDriveTrashFilesInput, InternalToolResponse } from "./types.js";
import { jsonText, trashFile } from "./gdrive_cleanup_shared.js";

const drive = google.drive("v3");

export const schema = {
  name: "gdrive_trash_files",
  description:
    "Move one or more Google Drive files to trash. Use dryRun to preview which files would be trashed.",
  inputSchema: {
    type: "object",
    properties: {
      fileIds: {
        type: "array",
        items: {
          type: "string",
        },
        description: "The Google Drive file IDs to trash.",
      },
      dryRun: {
        type: "boolean",
        description:
          "When true, return the files that would be moved to trash without changing anything.",
        optional: true,
      },
    },
    required: ["fileIds"],
  },
} as const;

export async function trashFiles(
  args: GDriveTrashFilesInput,
): Promise<InternalToolResponse> {
  try {
    const dryRun = args.dryRun === true;
    const results = await Promise.all(
      args.fileIds.map(async (fileId) => {
        try {
          if (dryRun) {
            const file = await drive.files.get({
              fileId,
              fields: "id, name, mimeType",
            });

            return {
              fileId,
              name: file.data.name || fileId,
              mimeType: file.data.mimeType,
              status: "would-trash",
            };
          }

          const file = await trashFile(fileId);
          return {
            fileId,
            name: file.name || fileId,
            status: "trashed",
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
          text: `Error trashing files: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}