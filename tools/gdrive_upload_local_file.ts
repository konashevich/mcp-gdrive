import path from "path";
import { GDriveUploadLocalFileInput, InternalToolResponse } from "./types.js";
import { ensureAbsolutePath, uploadLocalFileToFolder } from "./gdrive_import_shared.js";

export const schema = {
  name: "gdrive_upload_local_file",
  description:
    "Upload a local file into a Google Drive folder. Use this for attachments or binary files that should be stored in Drive.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Absolute path to the local file that should be uploaded.",
      },
      folderId: {
        type: "string",
        description: "Destination Google Drive folder ID.",
      },
      fileName: {
        type: "string",
        description: "Optional file name override. Defaults to the local file name.",
        optional: true,
      },
      reuseIfExists: {
        type: "boolean",
        description:
          "When true, reuse a same-named file already present in the destination folder instead of uploading a duplicate. Defaults to true.",
        optional: true,
      },
    },
    required: ["filePath", "folderId"],
  },
} as const;

export async function uploadLocalFile(
  args: GDriveUploadLocalFileInput,
): Promise<InternalToolResponse> {
  try {
    ensureAbsolutePath(args.filePath);

    const uploaded = await uploadLocalFileToFolder({
      filePath: args.filePath,
      folderId: args.folderId,
      fileName: args.fileName,
      reuseIfExists: args.reuseIfExists !== false,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              filePath: args.filePath,
              uploadedAs: args.fileName || path.basename(args.filePath),
              fileId: uploaded.id,
              name: uploaded.name,
              mimeType: uploaded.mimeType,
              webViewLink: uploaded.webViewLink,
              reused: uploaded.reused === true,
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
          text: `Error uploading local file: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
