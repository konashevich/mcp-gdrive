import { google } from "googleapis";
import { remark } from "remark";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";

const docs = google.docs("v1");
const drive = google.drive("v3");

export type NamedStyleType =
  | "NORMAL_TEXT"
  | "HEADING_1"
  | "HEADING_2"
  | "HEADING_3"
  | "HEADING_4"
  | "HEADING_5"
  | "HEADING_6";

export interface MarkdownNode {
  type: string;
  children?: MarkdownNode[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  url?: string;
  lang?: string;
  title?: string;
  alt?: string;
}

interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  linkUrl?: string;
}

interface InlineSpan extends InlineStyle {
  text: string;
}

interface ParagraphBlock {
  kind: "paragraph";
  inlines: InlineSpan[];
  namedStyleType?: NamedStyleType;
  bullet?: {
    ordered: boolean;
  };
  blockquote?: boolean;
}

interface ImageBlock {
  kind: "image";
  uri: string;
  altText?: string;
}

interface RenderState {
  features: Set<string>;
  warnings: Set<string>;
}

interface StyledRange extends InlineStyle {
  startIndex: number;
  endIndex: number;
}

interface ParagraphInstruction {
  startIndex: number;
  endIndex: number;
  namedStyleType?: NamedStyleType;
  bullet?: {
    ordered: boolean;
  };
  blockquote?: boolean;
}

interface ImagePlaceholder {
  marker: string;
  uri: string;
  altText?: string;
}

interface BatchBuildResult {
  insertRequests: any[];
  textStyleRequests: any[];
  paragraphStyleRequests: any[];
  bulletRequests: any[];
  imagePlaceholders: ImagePlaceholder[];
}

export interface GoogleDocWriteSummary {
  appliedFeatures: string[];
  unsupportedElements: string[];
}

export interface GoogleDocReference {
  documentId: string;
  documentUrl: string;
}

function describeDocsRequest(request: any): string {
  if (request.updateTextStyle) {
    return "updateTextStyle";
  }

  if (request.updateParagraphStyle) {
    return "updateParagraphStyle";
  }

  if (request.createParagraphBullets) {
    return "createParagraphBullets";
  }

  if (request.insertText) {
    return "insertText";
  }

  if (request.insertInlineImage) {
    return "insertInlineImage";
  }

  if (request.deleteContentRange) {
    return "deleteContentRange";
  }

  return "unknownRequest";
}

async function applyRequestsBestEffort(args: {
  documentId: string;
  requests: any[];
  state: RenderState;
  warningPrefix: string;
}) {
  if (!args.requests.length) {
    return;
  }

  try {
    await docs.documents.batchUpdate({
      documentId: args.documentId,
      requestBody: { requests: args.requests },
    });
    return;
  } catch {
    for (const request of args.requests) {
      try {
        await docs.documents.batchUpdate({
          documentId: args.documentId,
          requestBody: { requests: [request] },
        });
      } catch (error: any) {
        args.state.warnings.add(
          `${args.warningPrefix}: skipped ${describeDocsRequest(request)} due to ${error.message}`,
        );
      }
    }
  }
}

function sanitizeGoogleDocsText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000C-\u001F\uE000-\uF8FF]/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(parseInt(decimal, 10)),
    );
}

function convertHtmlToPlainText(value: string): string {
  return sanitizeGoogleDocsText(
    decodeHtmlEntities(value)
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]\s*>/gi, "\t")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<\/(div|p|li|tr|table|ul|ol|section|article|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\t+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function normalizeInlineText(value: string): string {
  return sanitizeGoogleDocsText(value.replace(/\r\n/g, "\n").replace(/\n/g, " "));
}

function mergeInlineSpans(spans: InlineSpan[]): InlineSpan[] {
  const merged: InlineSpan[] = [];

  for (const span of spans) {
    if (!span.text) {
      continue;
    }

    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.bold === span.bold &&
      previous.italic === span.italic &&
      previous.code === span.code &&
      previous.strikethrough === span.strikethrough &&
      previous.linkUrl === span.linkUrl
    ) {
      previous.text += span.text;
      continue;
    }

    merged.push({ ...span });
  }

  return merged;
}

function createTextSpan(text: string, style: InlineStyle = {}): InlineSpan[] {
  const sanitizedText = sanitizeGoogleDocsText(text);

  if (!sanitizedText) {
    return [];
  }

  return [{ text: sanitizedText, ...style }];
}

function headingStyle(depth = 1): NamedStyleType {
  switch (depth) {
    case 1:
      return "HEADING_1";
    case 2:
      return "HEADING_2";
    case 3:
      return "HEADING_3";
    case 4:
      return "HEADING_4";
    case 5:
      return "HEADING_5";
    default:
      return "HEADING_6";
  }
}

function collectInlineSpans(
  nodes: MarkdownNode[] | undefined,
  state: RenderState,
  style: InlineStyle = {},
): InlineSpan[] {
  if (!nodes?.length) {
    return [];
  }

  const spans: InlineSpan[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        spans.push(...createTextSpan(normalizeInlineText(node.value || ""), style));
        break;
      case "break":
        spans.push(...createTextSpan("\n", style));
        state.features.add("hard line breaks");
        break;
      case "strong":
        state.features.add("bold");
        spans.push(
          ...collectInlineSpans(node.children, state, { ...style, bold: true }),
        );
        break;
      case "emphasis":
        state.features.add("italic");
        spans.push(
          ...collectInlineSpans(node.children, state, { ...style, italic: true }),
        );
        break;
      case "delete":
        state.features.add("strikethrough");
        spans.push(
          ...collectInlineSpans(node.children, state, {
            ...style,
            strikethrough: true,
          }),
        );
        break;
      case "inlineCode":
        state.features.add("inline code");
        spans.push(...createTextSpan(node.value || "", { ...style, code: true }));
        break;
      case "link":
        state.features.add("links");
        spans.push(
          ...collectInlineSpans(node.children, state, {
            ...style,
            linkUrl: node.url,
          }),
        );
        break;
      case "image": {
        const label = node.alt || "image";
        const suffix = node.url ? ` (${node.url})` : "";
        state.features.add("image references");
        state.warnings.add(
          "Images are preserved as links or text references in the generated Google Doc.",
        );
        spans.push(...createTextSpan(`${label}${suffix}`, style));
        break;
      }
      case "html":
        state.features.add("inline html stripped to text");
        state.warnings.add(
          "Simple HTML styling was stripped and preserved as readable plain text.",
        );
        spans.push(
          ...createTextSpan(
            normalizeInlineText(convertHtmlToPlainText(node.value || "")),
            style,
          ),
        );
        break;
      default:
        if (node.children?.length) {
          spans.push(...collectInlineSpans(node.children, state, style));
        } else if (node.value) {
          state.warnings.add(
            `Unsupported inline node '${node.type}' was preserved as plain text.`,
          );
          spans.push(...createTextSpan(node.value, style));
        }
        break;
    }
  }

  return mergeInlineSpans(spans);
}

function fallbackParagraph(text: string, state: RenderState): ParagraphBlock[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  state.warnings.add("A complex Markdown block was flattened to plain text.");

  return [
    {
      kind: "paragraph",
      inlines: [{ text: trimmed }],
    },
  ];
}

function normalizeListItem(
  node: MarkdownNode,
  ordered: boolean,
  state: RenderState,
  blockquote = false,
): Array<ParagraphBlock | ImageBlock> {
  const blocks: Array<ParagraphBlock | ImageBlock> = [];
  const children = node.children || [];
  const taskPrefix =
    node.checked === true ? "[x] " : node.checked === false ? "[ ] " : "";

  if (node.checked !== undefined && node.checked !== null) {
    state.features.add("task lists");
    state.warnings.add("Task lists are preserved with [x]/[ ] markers.");
  }

  const directParagraphs = children.filter((child) => child.type === "paragraph");
  const nestedLists = children.filter((child) => child.type === "list");
  const complexChildren = children.filter(
    (child) => child.type !== "paragraph" && child.type !== "list",
  );

  for (const paragraph of directParagraphs) {
    const inlines = collectInlineSpans(paragraph.children, state);
    const merged = mergeInlineSpans([...createTextSpan(taskPrefix), ...inlines]);

    if (merged.length) {
      blocks.push({
        kind: "paragraph",
        inlines: merged,
        bullet: { ordered },
        blockquote,
      });
    }
  }

  if (!directParagraphs.length) {
    const fallbackText = `${taskPrefix}${toString(node).trim()}`;
    if (fallbackText.trim()) {
      blocks.push({
        kind: "paragraph",
        inlines: [{ text: fallbackText.trim() }],
        bullet: { ordered },
        blockquote,
      });
    }
  }

  if (nestedLists.length) {
    state.warnings.add("Nested lists were flattened to top-level list items.");
    for (const nestedList of nestedLists) {
      const nestedBlocks = normalizeBlocks([nestedList], state, blockquote);
      blocks.push(...nestedBlocks);
    }
  }

  for (const child of complexChildren) {
    blocks.push(...fallbackParagraph(toString(child).trim(), state));
  }

  return blocks;
}

function normalizeTable(node: MarkdownNode, state: RenderState): ParagraphBlock[] {
  state.features.add("tables");
  state.warnings.add("Tables were converted to plain text rows.");

  const rows = node.children || [];
  return rows
    .map((row) => {
      const cells = (row.children || []).map((cell) => toString(cell).trim());
      return cells.join("\t");
    })
    .filter((rowText) => rowText.trim().length > 0)
    .map((rowText) => ({
      kind: "paragraph" as const,
      inlines: [{ text: rowText }],
    }));
}

function isImageOnlyParagraph(node: MarkdownNode): boolean {
  return (
    node.type === "paragraph" &&
    (node.children || []).length === 1 &&
    node.children?.[0]?.type === "image" &&
    Boolean(node.children[0].url)
  );
}

function normalizeBlocks(
  nodes: MarkdownNode[] | undefined,
  state: RenderState,
  blockquote = false,
): Array<ParagraphBlock | ImageBlock> {
  if (!nodes?.length) {
    return [];
  }

  const blocks: Array<ParagraphBlock | ImageBlock> = [];

  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        if (isImageOnlyParagraph(node) && !blockquote) {
          const imageNode = node.children?.[0];
          if (imageNode?.url) {
            state.features.add("inline images");
            blocks.push({
              kind: "image",
              uri: imageNode.url,
              altText: imageNode.alt,
            });
            break;
          }
        }

        state.features.add("paragraphs");
        const inlines = collectInlineSpans(node.children, state);
        if (inlines.length) {
          blocks.push({ kind: "paragraph", inlines, blockquote });
        }
        break;
      }
      case "heading": {
        state.features.add("headings");
        const inlines = collectInlineSpans(node.children, state);
        if (inlines.length) {
          blocks.push({
            kind: "paragraph",
            inlines,
            namedStyleType: headingStyle(node.depth),
            blockquote,
          });
        }
        break;
      }
      case "blockquote":
        state.features.add("blockquotes");
        blocks.push(...normalizeBlocks(node.children, state, true));
        break;
      case "list":
        state.features.add(node.ordered ? "numbered lists" : "bulleted lists");
        for (const item of node.children || []) {
          blocks.push(...normalizeListItem(item, !!node.ordered, state, blockquote));
        }
        break;
      case "code":
        state.features.add("fenced code blocks");
        blocks.push({
          kind: "paragraph",
          inlines: [{ text: node.value || "", code: true }],
          blockquote,
        });
        break;
      case "thematicBreak":
        state.features.add("thematic breaks");
        blocks.push({
          kind: "paragraph",
          inlines: [{ text: "----------" }],
          blockquote,
        });
        break;
      case "table":
        blocks.push(...normalizeTable(node, state));
        break;
      case "html":
        state.features.add("html blocks stripped to text");
        state.warnings.add(
          "Simple HTML blocks were stripped and preserved as readable plain text.",
        );
        blocks.push(
          ...convertHtmlToPlainText(node.value || "")
            .split(/\n+/)
            .flatMap((line) => fallbackParagraph(line, state)),
        );
        break;
      default:
        blocks.push(...fallbackParagraph(toString(node).trim(), state));
        break;
    }
  }

  return blocks;
}

function buildImageMarker(index: number): string {
  return `[[MCP_GDR_IMAGE_${String(index).padStart(6, "0")}]]`;
}

function buildBatchRequests(
  blocks: Array<ParagraphBlock | ImageBlock>,
): BatchBuildResult {
  const insertRequests: any[] = [];
  const textStyleRequests: any[] = [];
  const paragraphStyleRequests: any[] = [];
  const bulletRequests: any[] = [];
  const imagePlaceholders: ImagePlaceholder[] = [];
  let insertionIndex = 1;
  let imageCounter = 0;

  for (const block of blocks) {
    if (block.kind === "image") {
      const marker = buildImageMarker(imageCounter);
      imageCounter += 1;
      const blockText = `${marker}\n`;

      insertRequests.push({
        insertText: {
          location: { index: insertionIndex },
          text: blockText,
        },
      });

      imagePlaceholders.push({
        marker,
        uri: block.uri,
        altText: block.altText,
      });

      insertionIndex += blockText.length;
      continue;
    }

    const blockText = `${block.inlines.map((span) => span.text).join("")}\n`;
    const paragraphStartIndex = insertionIndex;
    insertRequests.push({
      insertText: {
        location: { index: paragraphStartIndex },
        text: blockText,
      },
    });

    let cursor = paragraphStartIndex;
    for (const span of block.inlines) {
      const endIndex = cursor + span.text.length;
      const textStyle: Record<string, unknown> = {};
      const fields: string[] = [];

      if (span.bold) {
        textStyle.bold = true;
        fields.push("bold");
      }

      if (span.italic) {
        textStyle.italic = true;
        fields.push("italic");
      }

      if (span.strikethrough) {
        textStyle.strikethrough = true;
        fields.push("strikethrough");
      }

      if (span.linkUrl) {
        textStyle.link = { url: span.linkUrl };
        fields.push("link");
      }

      if (span.code) {
        textStyle.weightedFontFamily = { fontFamily: "Courier New" };
        textStyle.backgroundColor = {
          color: {
            rgbColor: {
              red: 0.95,
              green: 0.95,
              blue: 0.95,
            },
          },
        };
        fields.push("weightedFontFamily", "backgroundColor");
      }

      if (fields.length) {
        textStyleRequests.push({
          updateTextStyle: {
            range: {
              startIndex: cursor,
              endIndex,
            },
            textStyle,
            fields: fields.join(","),
          },
        });
      }

      cursor = endIndex;
    }

    const paragraphEndIndex = paragraphStartIndex + blockText.length;
    const paragraphInstruction: ParagraphInstruction = {
      startIndex: paragraphStartIndex,
      endIndex: paragraphEndIndex,
      namedStyleType: block.namedStyleType,
      bullet: block.bullet,
      blockquote: block.blockquote,
    };

    if (paragraphInstruction.namedStyleType) {
      paragraphStyleRequests.push({
        updateParagraphStyle: {
          range: {
            startIndex: paragraphInstruction.startIndex,
            endIndex: paragraphInstruction.endIndex,
          },
          paragraphStyle: {
            namedStyleType: paragraphInstruction.namedStyleType,
          },
          fields: "namedStyleType",
        },
      });
    }

    if (paragraphInstruction.blockquote) {
      paragraphStyleRequests.push({
        updateParagraphStyle: {
          range: {
            startIndex: paragraphInstruction.startIndex,
            endIndex: paragraphInstruction.endIndex,
          },
          paragraphStyle: {
            indentStart: {
              magnitude: 18,
              unit: "PT",
            },
            spacingMode: "NEVER_COLLAPSE",
          },
          fields: "indentStart,spacingMode",
        },
      });
    }

    if (paragraphInstruction.bullet) {
      bulletRequests.push({
        createParagraphBullets: {
          range: {
            startIndex: paragraphInstruction.startIndex,
            endIndex: paragraphInstruction.endIndex,
          },
          bulletPreset: paragraphInstruction.bullet.ordered
            ? "NUMBERED_DECIMAL_ALPHA_ROMAN"
            : "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }

    insertionIndex = paragraphEndIndex;
  }

  return {
    insertRequests,
    textStyleRequests,
    paragraphStyleRequests,
    bulletRequests: bulletRequests.sort(
      (left, right) =>
        right.createParagraphBullets.range.startIndex -
        left.createParagraphBullets.range.startIndex,
    ),
    imagePlaceholders,
  };
}

function findImagePlaceholderRanges(
  bodyContent: any[],
  imagePlaceholders: ImagePlaceholder[],
): Array<ImagePlaceholder & { startIndex: number; endIndex: number }> {
  const markerMap = new Map(
    imagePlaceholders.map((placeholder) => [placeholder.marker, placeholder]),
  );
  const ranges: Array<ImagePlaceholder & { startIndex: number; endIndex: number }> = [];

  for (const structuralElement of bodyContent) {
    const elements = structuralElement.paragraph?.elements || [];

    for (const element of elements) {
      const content = element.textRun?.content;
      const elementStartIndex = element.startIndex;

      if (typeof content !== "string" || typeof elementStartIndex !== "number") {
        continue;
      }

      for (const [marker, placeholder] of markerMap) {
        const offset = content.indexOf(marker);
        if (offset === -1) {
          continue;
        }

        ranges.push({
          ...placeholder,
          startIndex: elementStartIndex + offset,
          endIndex: elementStartIndex + offset + marker.length,
        });
        markerMap.delete(marker);
      }
    }
  }

  return ranges.sort((left, right) => right.startIndex - left.startIndex);
}

export function parseMarkdownSource(
  source: string,
  supportsBasicGfm = true,
): MarkdownNode {
  const processor = remark().use(remarkParse);

  if (supportsBasicGfm) {
    processor.use(remarkGfm);
  }

  return processor.parse(source) as MarkdownNode;
}

export async function moveDocumentToFolder(documentId: string, folderId: string) {
  const folder = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType",
  });

  if (folder.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("folderId must refer to a Google Drive folder");
  }

  const file = await drive.files.get({
    fileId: documentId,
    fields: "parents",
  });

  await drive.files.update({
    fileId: documentId,
    addParents: folderId,
    removeParents: (file.data.parents || []).join(",") || undefined,
    fields: "id,parents",
  });
}

export async function createEmptyGoogleDoc(
  title: string,
  folderId?: string,
): Promise<GoogleDocReference> {
  const createResponse = await docs.documents.create({
    requestBody: { title },
  });

  const documentId = createResponse.data.documentId;
  if (!documentId) {
    throw new Error("Google Docs API did not return a document ID");
  }

  if (folderId) {
    await moveDocumentToFolder(documentId, folderId);
  }

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

export async function writeMarkdownTreeToDocument(
  documentId: string,
  tree: MarkdownNode,
): Promise<GoogleDocWriteSummary> {
  const state: RenderState = {
    features: new Set<string>(),
    warnings: new Set<string>(),
  };

  const blocks = normalizeBlocks(tree.children, state);
  const batchBuild = buildBatchRequests(blocks);
  const requests: any[] = [];

  const existing = await docs.documents.get({
    documentId,
    fields: "body/content/endIndex",
  });
  const bodyContent = existing.data.body?.content || [];
  const finalContent = bodyContent[bodyContent.length - 1];
  const endIndex = finalContent?.endIndex || 1;

  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  requests.push(...batchBuild.insertRequests);

  if (requests.length) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }

  const formatRequests = [
    ...batchBuild.paragraphStyleRequests,
    ...batchBuild.textStyleRequests,
  ];

  await applyRequestsBestEffort({
    documentId,
    requests: formatRequests,
    state,
    warningPrefix: "Some text or paragraph styling could not be applied",
  });

  await applyRequestsBestEffort({
    documentId,
    requests: batchBuild.bulletRequests,
    state,
    warningPrefix: "Some list formatting could not be applied",
  });

  if (batchBuild.imagePlaceholders.length) {
    const updatedDocument = await docs.documents.get({
      documentId,
      fields: "body/content",
    });
    const placeholderRanges = findImagePlaceholderRanges(
      updatedDocument.data.body?.content || [],
      batchBuild.imagePlaceholders,
    );
    const foundMarkers = new Set(placeholderRanges.map((range) => range.marker));

    for (const placeholder of batchBuild.imagePlaceholders) {
      if (!foundMarkers.has(placeholder.marker)) {
        state.warnings.add(
          `Image placeholder ${placeholder.marker} could not be resolved in the generated Google Doc.`,
        );
      }
    }

    for (const range of placeholderRanges) {
      try {
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    startIndex: range.startIndex,
                    endIndex: range.endIndex,
                  },
                },
              },
              {
                insertInlineImage: {
                  uri: range.uri,
                  location: { index: range.startIndex },
                },
              },
            ],
          },
        });
      } catch (error: any) {
        const fallbackText = sanitizeGoogleDocsText(range.altText?.trim() || "Image");
        state.warnings.add(
          `Inline image could not be retrieved by Google Docs and was replaced with text: ${fallbackText}`,
        );

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    startIndex: range.startIndex,
                    endIndex: range.endIndex,
                  },
                },
              },
              {
                insertText: {
                  location: { index: range.startIndex },
                  text: fallbackText,
                },
              },
            ],
          },
        });
      }
    }
  }

  return {
    appliedFeatures: Array.from(state.features).sort(),
    unsupportedElements: Array.from(state.warnings).sort(),
  };
}

export async function createGoogleDocFromMarkdownSource(args: {
  title: string;
  source: string;
  folderId?: string;
  supportsBasicGfm?: boolean;
}): Promise<GoogleDocReference & GoogleDocWriteSummary> {
  const tree = parseMarkdownSource(args.source, args.supportsBasicGfm !== false);
  const document = await createEmptyGoogleDoc(args.title, args.folderId);
  const summary = await writeMarkdownTreeToDocument(document.documentId, tree);

  return {
    ...document,
    ...summary,
  };
}
