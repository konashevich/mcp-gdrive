import {
  GDriveFindCleanupCandidatesInput,
  InternalToolResponse,
} from "./types.js";
import {
  jsonText,
  listCleanupFiles,
  summarizeCleanupCandidate,
} from "./gdrive_cleanup_shared.js";

export const schema = {
  name: "gdrive_find_cleanup_candidates",
  description:
    "Find Google Docs and Google Sheets cleanup candidates, including untitled files, empty files, and root-level files.",
  inputSchema: {
    type: "object",
    properties: {
      rootOnly: {
        type: "boolean",
        description:
          "When true, only inspect files stored directly in Google Drive root. Defaults to true.",
        optional: true,
      },
      fileTypes: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "Optional file type filters. Supported values: docs, document, sheets, spreadsheet.",
        optional: true,
      },
      untitledOnly: {
        type: "boolean",
        description: "When true, return only untitled files.",
        optional: true,
      },
      emptyOnly: {
        type: "boolean",
        description:
          "When true, return only files detected as empty. Defaults to false.",
        optional: true,
      },
      inspectEmpty: {
        type: "boolean",
        description:
          "When true, call Docs or Sheets APIs to detect empty files. Defaults to true.",
        optional: true,
      },
      pageToken: {
        type: "string",
        description: "Token for the next page of results.",
        optional: true,
      },
      pageSize: {
        type: "number",
        description: "Number of results per page. Defaults to 25.",
        optional: true,
      },
    },
    required: [],
  },
} as const;

export async function findCleanupCandidates(
  args: GDriveFindCleanupCandidatesInput,
): Promise<InternalToolResponse> {
  try {
    const inspectEmpty = args.inspectEmpty !== false;
    const response = await listCleanupFiles({
      rootOnly: args.rootOnly !== false,
      fileTypes: args.fileTypes,
      pageSize: args.pageSize,
      pageToken: args.pageToken,
    });

    const candidates = await Promise.all(
      response.files.map((file) => summarizeCleanupCandidate(file, inspectEmpty)),
    );

    const filteredCandidates = candidates.filter((candidate) => {
      if (args.untitledOnly && !candidate.isUntitled) {
        return false;
      }

      if (args.emptyOnly && candidate.isEmpty !== true) {
        return false;
      }

      return true;
    });

    return {
      content: [
        {
          type: "text",
          text: jsonText({
            filters: {
              rootOnly: args.rootOnly !== false,
              fileTypes: args.fileTypes || ["docs", "sheets"],
              untitledOnly: args.untitledOnly || false,
              emptyOnly: args.emptyOnly || false,
              inspectEmpty,
            },
            count: filteredCandidates.length,
            nextPageToken: response.nextPageToken || null,
            files: filteredCandidates,
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
          text: `Error finding cleanup candidates: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}