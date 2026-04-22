// Define base types for our tool system
export interface Tool<T> {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: readonly string[];
  };
  handler: (args: T) => Promise<InternalToolResponse>;
}

// Our internal tool response format
export interface InternalToolResponse {
  content: {
    type: string;
    text: string;
  }[];
  isError: boolean;
}

// Input types for each tool
export interface GDriveSearchInput {
  query: string;
  pageToken?: string;
  pageSize?: number;
}

export interface GDriveReadFileInput {
  fileId: string;
}

export interface GDriveFindCleanupCandidatesInput {
  rootOnly?: boolean;
  fileTypes?: string[];
  untitledOnly?: boolean;
  emptyOnly?: boolean;
  inspectEmpty?: boolean;
  pageToken?: string;
  pageSize?: number;
}

export interface GDriveTrashFilesInput {
  fileIds: string[];
  dryRun?: boolean;
}

export interface GDriveMoveFilesInput {
  fileIds: string[];
  destinationFolderId: string;
  dryRun?: boolean;
}

export interface GDriveOrganizeRootInput {
  docsFolderId?: string;
  sheetsFolderId?: string;
  docsFolderName?: string;
  sheetsFolderName?: string;
  dryRun?: boolean;
}

export interface GDriveUploadLocalFileInput {
  filePath: string;
  folderId: string;
  fileName?: string;
  reuseIfExists?: boolean;
}

export interface GDriveImportJoplinExportInput {
  sourceRootPath: string;
  driveRootFolderName?: string;
  resourcesFolderName?: string;
  supportsBasicGfm?: boolean;
  embedImagesInline?: boolean;
  dryRun?: boolean;
}

export interface GSheetsUpdateCellInput {
  fileId: string;
  range: string;
  value: string;
}

export interface GSheetsReadInput {
  spreadsheetId: string;
  ranges?: string[]; // Optional A1 notation ranges like "Sheet1!A1:B10"
  sheetId?: number; // Optional specific sheet ID
}

export interface GDocsCreateFromMarkdownFileInput {
  filePath: string;
  title?: string;
  folderId?: string;
  supportsBasicGfm?: boolean;
}

export interface GSlidesCreatePresentationInput {
  title: string;
  folderId?: string;
}

export interface GSlidesGetPresentationInput {
  presentationId: string;
  fields?: string;
}

export interface GSlidesGetSlideInput {
  presentationId: string;
  slideObjectId: string;
}

export interface GSlidesSummarizePresentationInput {
  presentationId: string;
  includeNotes?: boolean;
}

export interface GSlidesBatchUpdatePresentationInput {
  presentationId: string;
  requests: Record<string, unknown>[];
  writeControl?: Record<string, unknown>;
}

export interface GSlidesInsertImageInput {
  presentationId: string;
  slideObjectId: string;
  localFilePath?: string;
  imageUrl?: string;
  uploadFolderId?: string;
  width?: number;
  height?: number;
  translateX?: number;
  translateY?: number;
}
