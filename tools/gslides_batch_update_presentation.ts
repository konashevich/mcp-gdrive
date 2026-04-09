import { GSlidesBatchUpdatePresentationInput } from "./types.js";
import {
  errorResponse,
  getPresentationUrl,
  okResponse,
  slides,
} from "./gslides_shared.js";

export const schema = {
  name: "gslides_batch_update_presentation",
  description:
    "Apply one or more raw Google Slides batchUpdate requests to a presentation.",
  inputSchema: {
    type: "object",
    properties: {
      presentationId: {
        type: "string",
        description: "The Google Slides presentation ID to modify.",
      },
      requests: {
        type: "array",
        description:
          "Array of raw Google Slides batchUpdate request objects, such as `createSlide`, `insertText`, or `replaceAllText`.",
        items: {
          type: "object",
        },
      },
      writeControl: {
        type: "object",
        description:
          "Optional Slides write control object, for example `{ requiredRevisionId: \"...\" }`.",
        optional: true,
      },
    },
    required: ["presentationId", "requests"],
  },
} as const;

export async function batchUpdatePresentation(
  args: GSlidesBatchUpdatePresentationInput,
) {
  try {
    if (!Array.isArray(args.requests) || args.requests.length === 0) {
      throw new Error("requests must be a non-empty array");
    }

    const response = await slides.presentations.batchUpdate({
      presentationId: args.presentationId,
      requestBody: {
        requests: args.requests,
        writeControl: args.writeControl,
      },
    });

    return okResponse({
      presentationId: args.presentationId,
      presentationUrl: getPresentationUrl(args.presentationId),
      ...response.data,
    });
  } catch (error) {
    return errorResponse("updating presentation", error);
  }
}
