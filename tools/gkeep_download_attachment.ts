import { GKeepDownloadAttachmentInput, InternalToolResponse } from "./types.js";
import {
  errorResponse,
  normalizeAttachmentName,
  okResponse,
  writeAttachmentToFile,
} from "./gkeep_shared.js";

export const schema = {
  name: "gkeep_download_attachment",
  description:
    "Download a Google Keep note attachment to a local file using the official Keep API",
  inputSchema: {
    type: "object",
    properties: {
      attachmentName: {
        type: "string",
        description:
          "Full attachment resource name like notes/{noteId}/attachments/{attachmentId}",
      },
      mimeType: {
        type: "string",
        description: "One MIME type advertised by the attachment metadata",
      },
      outputPath: {
        type: "string",
        description: "Absolute local path where the attachment should be written",
      },
      overwrite: {
        type: "boolean",
        description: "Whether to overwrite the output file if it already exists",
        optional: true,
      },
    },
    required: ["attachmentName", "mimeType", "outputPath"],
  },
} as const;

export async function downloadKeepAttachment(
  args: GKeepDownloadAttachmentInput,
): Promise<InternalToolResponse> {
  try {
    const attachmentName = normalizeAttachmentName(args.attachmentName);
    await writeAttachmentToFile({
      attachmentName,
      mimeType: args.mimeType,
      outputPath: args.outputPath,
      overwrite: Boolean(args.overwrite),
    });

    return okResponse({
      attachmentName,
      mimeType: args.mimeType,
      outputPath: args.outputPath,
      downloaded: true,
    });
  } catch (error) {
    return errorResponse("downloading Keep attachment", error);
  }
}