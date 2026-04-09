import { GSlidesGetPresentationInput } from "./types.js";
import {
  errorResponse,
  getPresentationUrl,
  okResponse,
  slides,
} from "./gslides_shared.js";

export const schema = {
  name: "gslides_get_presentation",
  description:
    "Get a Google Slides presentation as JSON. Optionally pass a Slides API field mask to reduce payload size.",
  inputSchema: {
    type: "object",
    properties: {
      presentationId: {
        type: "string",
        description: "The Google Slides presentation ID.",
      },
      fields: {
        type: "string",
        description:
          "Optional Slides API field mask, for example `presentationId,title,slides(objectId)`.",
        optional: true,
      },
    },
    required: ["presentationId"],
  },
} as const;

export async function getPresentation(args: GSlidesGetPresentationInput) {
  try {
    const response = await slides.presentations.get({
      presentationId: args.presentationId,
      fields: args.fields,
    });

    return okResponse({
      ...response.data,
      presentationUrl: getPresentationUrl(args.presentationId),
    });
  } catch (error) {
    return errorResponse("getting presentation", error);
  }
}
