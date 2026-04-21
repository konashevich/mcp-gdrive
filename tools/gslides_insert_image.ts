import { GSlidesInsertImageInput } from "./types.js";
import {
  errorResponse,
  getPresentationUrl,
  getSlideUrl,
  okResponse,
  slides,
} from "./gslides_shared.js";
import {
  buildPublicImageUri,
  ensureAbsolutePath,
  ensureAnyoneReaderPermission,
  uploadLocalFileToFolder,
} from "./gdrive_import_shared.js";

export const schema = {
  name: "gslides_insert_image",
  description:
    "Insert an image into a Google Slides presentation. Accepts either a local file path (which is uploaded to Drive automatically) or a public image URL. Optionally specify size and position.",
  inputSchema: {
    type: "object",
    properties: {
      presentationId: {
        type: "string",
        description: "The Google Slides presentation ID.",
      },
      slideObjectId: {
        type: "string",
        description:
          "The object ID of the slide to insert the image on. Use gslides_get_presentation to find slide IDs.",
      },
      localFilePath: {
        type: "string",
        description:
          "Absolute path to a local image file (png, jpg, gif). Mutually exclusive with imageUrl.",
      },
      imageUrl: {
        type: "string",
        description:
          "A publicly accessible image URL. Mutually exclusive with localFilePath.",
      },
      uploadFolderId: {
        type: "string",
        description:
          "Google Drive folder ID to upload the local image into. Required when using localFilePath.",
      },
      width: {
        type: "number",
        description:
          "Image width in points (1 inch = 72 points). Defaults to 400.",
      },
      height: {
        type: "number",
        description:
          "Image height in points (1 inch = 72 points). Defaults to 300.",
      },
      translateX: {
        type: "number",
        description:
          "Horizontal position in points from the top-left corner of the slide. Defaults to 100.",
      },
      translateY: {
        type: "number",
        description:
          "Vertical position in points from the top-left corner of the slide. Defaults to 100.",
      },
    },
    required: ["presentationId", "slideObjectId"],
  },
} as const;

const EMU_PER_POINT = 12700;

export async function insertImage(args: GSlidesInsertImageInput) {
  try {
    if (!args.localFilePath && !args.imageUrl) {
      throw new Error(
        "Provide either localFilePath or imageUrl",
      );
    }
    if (args.localFilePath && args.imageUrl) {
      throw new Error(
        "Provide only one of localFilePath or imageUrl, not both",
      );
    }

    let imageUrl = args.imageUrl;
    let uploadedFileId: string | undefined;

    // Upload local file to Drive and make it accessible
    if (args.localFilePath) {
      ensureAbsolutePath(args.localFilePath);

      if (!args.uploadFolderId) {
        throw new Error(
          "uploadFolderId is required when using localFilePath",
        );
      }

      const uploaded = await uploadLocalFileToFolder({
        filePath: args.localFilePath,
        folderId: args.uploadFolderId,
        reuseIfExists: true,
      });

      uploadedFileId = uploaded.id;

      // Make the file publicly readable so Google Slides API can fetch it
      await ensureAnyoneReaderPermission(uploaded.id);

      imageUrl = buildPublicImageUri(uploaded.id);
    }

    const widthPt = args.width ?? 400;
    const heightPt = args.height ?? 300;
    const translateXPt = args.translateX ?? 100;
    const translateYPt = args.translateY ?? 100;

    const response = await slides.presentations.batchUpdate({
      presentationId: args.presentationId,
      requestBody: {
        requests: [
          {
            createImage: {
              url: imageUrl,
              elementProperties: {
                pageObjectId: args.slideObjectId,
                size: {
                  width: { magnitude: widthPt * EMU_PER_POINT, unit: "EMU" },
                  height: { magnitude: heightPt * EMU_PER_POINT, unit: "EMU" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: translateXPt * EMU_PER_POINT,
                  translateY: translateYPt * EMU_PER_POINT,
                  unit: "EMU",
                },
              },
            },
          },
        ],
      },
    });

    const imageObjectId =
      response.data.replies?.[0]?.createImage?.objectId;

    return okResponse({
      presentationId: args.presentationId,
      slideObjectId: args.slideObjectId,
      presentationUrl: getPresentationUrl(args.presentationId),
      slideUrl: getSlideUrl(args.presentationId, args.slideObjectId),
      imageObjectId,
      imageUrl,
      uploadedFileId,
      size: { widthPt, heightPt },
      position: { translateXPt, translateYPt },
    });
  } catch (error) {
    return errorResponse("inserting image into slide", error);
  }
}
