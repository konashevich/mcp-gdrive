import { GSlidesGetSlideInput } from "./types.js";
import {
  errorResponse,
  getSlideUrl,
  okResponse,
  slides,
} from "./gslides_shared.js";

export const schema = {
  name: "gslides_get_slide",
  description:
    "Get a single slide/page from a Google Slides presentation as JSON.",
  inputSchema: {
    type: "object",
    properties: {
      presentationId: {
        type: "string",
        description: "The Google Slides presentation ID.",
      },
      slideObjectId: {
        type: "string",
        description: "The slide object ID to retrieve.",
      },
    },
    required: ["presentationId", "slideObjectId"],
  },
} as const;

export async function getSlide(args: GSlidesGetSlideInput) {
  try {
    const response = await slides.presentations.pages.get({
      presentationId: args.presentationId,
      pageObjectId: args.slideObjectId,
    });

    return okResponse({
      ...response.data,
      slideUrl: getSlideUrl(args.presentationId, args.slideObjectId),
    });
  } catch (error) {
    return errorResponse("getting slide", error);
  }
}
