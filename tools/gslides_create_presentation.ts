import { GSlidesCreatePresentationInput } from "./types.js";
import {
  errorResponse,
  getPresentationUrl,
  movePresentationToFolder,
  okResponse,
  slides,
} from "./gslides_shared.js";

export const schema = {
  name: "gslides_create_presentation",
  description:
    "Create a new Google Slides presentation. Optionally move it into an existing Drive folder.",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title for the new presentation.",
      },
      folderId: {
        type: "string",
        description:
          "Optional Google Drive folder ID to move the new presentation into.",
        optional: true,
      },
    },
    required: ["title"],
  },
} as const;

export async function createPresentation(args: GSlidesCreatePresentationInput) {
  try {
    const title = args.title.trim();
    if (!title) {
      throw new Error("title must be a non-empty string");
    }

    const response = await slides.presentations.create({
      requestBody: {
        title,
      },
    });

    const presentationId = response.data.presentationId;
    if (!presentationId) {
      throw new Error("Google Slides API did not return a presentationId");
    }

    if (args.folderId) {
      await movePresentationToFolder(presentationId, args.folderId);
    }

    return okResponse({
      presentationId,
      title: response.data.title || title,
      presentationUrl: getPresentationUrl(presentationId),
      folderId: args.folderId,
    });
  } catch (error) {
    return errorResponse("creating presentation", error);
  }
}
