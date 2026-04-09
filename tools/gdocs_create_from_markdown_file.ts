import fs from "fs/promises";
import path from "path";
import {
  GDocsCreateFromMarkdownFileInput,
  InternalToolResponse,
} from "./types.js";
import {
  createGoogleDocFromMarkdownSource,
} from "./gdocs_markdown_shared.js";

export const schema = {
  name: "gdocs_create_from_markdown_file",
  description:
    "Create a Google Doc from a local Markdown file using the Google Docs API, preserving headings, paragraphs, emphasis, links, lists, blockquotes, and code formatting.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Absolute path to a local Markdown file.",
      },
      title: {
        type: "string",
        description: "Optional Google Doc title. Defaults to the Markdown filename.",
        optional: true,
      },
      folderId: {
        type: "string",
        description: "Optional Google Drive folder ID to move the created document into.",
        optional: true,
      },
      supportsBasicGfm: {
        type: "boolean",
        description: "Whether to parse basic GitHub Flavored Markdown constructs such as tables, task lists, and strikethrough. Defaults to true.",
        optional: true,
      },
    },
    required: ["filePath"],
  },
} as const;

function ensureAbsoluteMarkdownPath(filePath: string) {
  if (!path.isAbsolute(filePath)) {
    throw new Error("filePath must be an absolute path");
  }

  if (path.extname(filePath).toLowerCase() !== ".md") {
    throw new Error("filePath must point to a .md file");
  }
}
export async function createFromMarkdownFile(
  args: GDocsCreateFromMarkdownFileInput,
): Promise<InternalToolResponse> {
  try {
    ensureAbsoluteMarkdownPath(args.filePath);

    const source = await fs.readFile(args.filePath, "utf-8");
    const title = args.title || path.basename(args.filePath, path.extname(args.filePath));
    const result = await createGoogleDocFromMarkdownSource({
      title,
      source,
      folderId: args.folderId,
      supportsBasicGfm: args.supportsBasicGfm,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              documentId: result.documentId,
              documentUrl: result.documentUrl,
              title,
              appliedFeatures: result.appliedFeatures,
              unsupportedElements: result.unsupportedElements,
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
          text: `Error creating Google Doc from Markdown: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}