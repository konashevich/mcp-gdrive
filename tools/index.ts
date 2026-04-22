import { schema as gdriveSearchSchema, search } from './gdrive_search.js';
import { schema as gdriveReadFileSchema, readFile } from './gdrive_read_file.js';
import { schema as gdriveFindCleanupCandidatesSchema, findCleanupCandidates } from './gdrive_find_cleanup_candidates.js';
import { schema as gdriveTrashFilesSchema, trashFiles } from './gdrive_trash_files.js';
import { schema as gdriveMoveFilesSchema, moveFiles } from './gdrive_move_files.js';
import { schema as gdriveOrganizeRootSchema, organizeRoot } from './gdrive_organize_root.js';
import { schema as gdriveUploadLocalFileSchema, uploadLocalFile } from './gdrive_upload_local_file.js';
import { schema as gdriveImportJoplinExportSchema, importJoplinExport } from './gdrive_import_joplin_export.js';
import { schema as gsheetsUpdateCellSchema, updateCell } from './gsheets_update_cell.js';
import { schema as gsheetsReadSchema, readSheet } from './gsheets_read.js';
import { schema as gdocsCreateFromMarkdownFileSchema, createFromMarkdownFile } from './gdocs_create_from_markdown_file.js';
import { schema as gslidesCreatePresentationSchema, createPresentation } from './gslides_create_presentation.js';
import { schema as gslidesGetPresentationSchema, getPresentation } from './gslides_get_presentation.js';
import { schema as gslidesGetSlideSchema, getSlide } from './gslides_get_slide.js';
import { schema as gslidesSummarizePresentationSchema, summarizePresentation } from './gslides_summarize_presentation.js';
import { schema as gslidesBatchUpdatePresentationSchema, batchUpdatePresentation } from './gslides_batch_update_presentation.js';
import { schema as gslidesInsertImageSchema, insertImage } from './gslides_insert_image.js';
import { Tool } from './types.js';

export const tools: Tool<any>[] = [
  {
    ...gdriveSearchSchema,
    handler: search,
  },
  {
    ...gdriveReadFileSchema,
    handler: readFile,
  },
  {
    ...gdriveFindCleanupCandidatesSchema,
    handler: findCleanupCandidates,
  },
  {
    ...gdriveTrashFilesSchema,
    handler: trashFiles,
  },
  {
    ...gdriveMoveFilesSchema,
    handler: moveFiles,
  },
  {
    ...gdriveOrganizeRootSchema,
    handler: organizeRoot,
  },
  {
    ...gdriveUploadLocalFileSchema,
    handler: uploadLocalFile,
  },
  {
    ...gdriveImportJoplinExportSchema,
    handler: importJoplinExport,
  },
  {
    ...gsheetsUpdateCellSchema,
    handler: updateCell,
  },
  {
    ...gsheetsReadSchema,
    handler: readSheet,
  },
  {
    ...gdocsCreateFromMarkdownFileSchema,
    handler: createFromMarkdownFile,
  },
  {
    ...gslidesCreatePresentationSchema,
    handler: createPresentation,
  },
  {
    ...gslidesGetPresentationSchema,
    handler: getPresentation,
  },
  {
    ...gslidesGetSlideSchema,
    handler: getSlide,
  },
  {
    ...gslidesSummarizePresentationSchema,
    handler: summarizePresentation,
  },
  {
    ...gslidesBatchUpdatePresentationSchema,
    handler: batchUpdatePresentation,
  },
  {
    ...gslidesInsertImageSchema,
    handler: insertImage,
  }
];
