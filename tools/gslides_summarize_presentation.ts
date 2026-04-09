import { GSlidesSummarizePresentationInput } from "./types.js";
import {
  errorResponse,
  extractSpeakerNotesText,
  extractTextFromPageElements,
  getPresentationUrl,
  getSlideUrl,
  joinTextFragments,
  okResponse,
  slides,
} from "./gslides_shared.js";

export const schema = {
  name: "gslides_summarize_presentation",
  description:
    "Extract slide text from a Google Slides presentation into a compact JSON summary. Optionally include speaker notes.",
  inputSchema: {
    type: "object",
    properties: {
      presentationId: {
        type: "string",
        description: "The Google Slides presentation ID.",
      },
      includeNotes: {
        type: "boolean",
        description: "Whether to include speaker notes in the summary.",
        optional: true,
      },
    },
    required: ["presentationId"],
  },
} as const;

export async function summarizePresentation(
  args: GSlidesSummarizePresentationInput,
) {
  try {
    const response = await slides.presentations.get({
      presentationId: args.presentationId,
    });

    const presentation = response.data;
    const summarizedSlides = (presentation.slides || []).map((slide, index) => {
      const slideObjectId = slide.objectId || `slide_${index + 1}`;
      const text = joinTextFragments(
        extractTextFromPageElements(slide.pageElements),
      );
      const notes = extractSpeakerNotesText(slide.slideProperties?.notesPage);

      return {
        slideNumber: index + 1,
        slideObjectId,
        slideUrl: getSlideUrl(args.presentationId, slideObjectId),
        text,
        ...(args.includeNotes ? { notes } : {}),
      };
    });

    return okResponse({
      presentationId: args.presentationId,
      title: presentation.title || "Untitled Presentation",
      presentationUrl: getPresentationUrl(args.presentationId),
      revisionId: presentation.revisionId,
      slideCount: summarizedSlides.length,
      slides: summarizedSlides,
    });
  } catch (error) {
    return errorResponse("summarizing presentation", error);
  }
}
