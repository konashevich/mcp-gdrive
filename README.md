# Google Drive server

This MCP server integrates with Google Drive to allow listing, reading, and searching files, as well as the ability to read and write Google Sheets, Google Docs, and Google Slides.

It also includes limited official Google Keep support for creating notes, listing/searching notes, reading notes, deleting notes, and downloading existing attachments.

For features that the official API does not expose, this repository also includes an unofficial Google Keep backend powered by `gkeepapi`. That unofficial path covers note edits, label management, pinning, archiving, and checklist item updates, but it requires separate unofficial Keep credentials.

This project includes code originally developed by Anthropic, PBC, licensed under the MIT License from [this repo](https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive).

## Components

### Tools

- **gdrive_search**

  - **Description**: Search for files in Google Drive.
  - **Input**:
    - `query` (string): Search query.
    - `pageToken` (string, optional): Token for the next page of results.
    - `pageSize` (number, optional): Number of results per page (max 100).
  - **Output**: Returns file names and MIME types of matching files.

- **gdrive_read_file**

  - **Description**: Read contents of a file from Google Drive.
  - **Input**:
    - `fileId` (string): ID of the file to read.
  - **Output**: Returns the contents of the specified file.

- **gdrive_find_cleanup_candidates**

  - **Description**: Find Google Docs and Google Sheets cleanup candidates in Drive, including root-level, untitled, and empty files.
  - **Input**:
    - `rootOnly` (boolean, optional): Limit results to files in the Drive root. Defaults to `true`.
    - `fileTypes` (array of strings, optional): Filter by `docs` or `sheets`.
    - `untitledOnly` (boolean, optional): Return only untitled files.
    - `emptyOnly` (boolean, optional): Return only empty files.
    - `inspectEmpty` (boolean, optional): Detect emptiness using Docs and Sheets APIs. Defaults to `true`.
    - `pageToken` (string, optional): Token for the next page of results.
    - `pageSize` (number, optional): Number of results per page.
  - **Output**: Returns structured cleanup candidates with untitled and empty flags.

- **gdrive_trash_files**

  - **Description**: Move one or more Google Drive files to trash.
  - **Input**:
    - `fileIds` (array of strings): File IDs to move to trash.
    - `dryRun` (boolean, optional): Preview which files would be trashed.
  - **Output**: Returns a per-file trash result summary.

- **gdrive_move_files**

  - **Description**: Move one or more Google Drive files into a destination folder.
  - **Input**:
    - `fileIds` (array of strings): File IDs to move.
    - `destinationFolderId` (string): Destination Google Drive folder ID.
    - `dryRun` (boolean, optional): Preview the move without changing anything.
  - **Output**: Returns a per-file move result summary.

- **gdrive_organize_root**

  - **Description**: Bulk-organize Google Docs and Google Sheets from Drive root into dedicated folders.
  - **Input**:
    - `docsFolderId` (string, optional): Existing destination folder ID for Docs.
    - `sheetsFolderId` (string, optional): Existing destination folder ID for Sheets.
    - `docsFolderName` (string, optional): Folder name to locate or create for Docs. Defaults to `Google Docs`.
    - `sheetsFolderName` (string, optional): Folder name to locate or create for Sheets. Defaults to `Google Sheets`.
    - `dryRun` (boolean, optional): Preview the organization plan. Defaults to `true`.
  - **Output**: Returns the planned or completed root organization summary.

- **gdrive_upload_local_file**

  - **Description**: Upload a local file into a Google Drive folder. Useful for attachments linked from imported notes.
  - **Input**:
    - `filePath` (string): Absolute path to the local file.
    - `folderId` (string): Destination Google Drive folder ID.
    - `fileName` (string, optional): Optional file name override.
    - `reuseIfExists` (boolean, optional): Reuse a same-named file already present in the destination folder. Defaults to `true`.
  - **Output**: Returns the Drive file ID and web link for the uploaded or reused file.

- **gdrive_import_joplin_export**

  - **Description**: Import a Joplin Markdown export into Google Drive by recreating folders, creating Google Docs for notes, uploading linked attachments, and rewriting local links.
  - **Input**:
    - `sourceRootPath` (string): Absolute path to the exported Joplin root folder.
    - `driveRootFolderName` (string, optional): Top-level Drive folder to create or reuse. Defaults to `Joplin`.
    - `resourcesFolderName` (string, optional): Name of the special resource folder. Defaults to `_resources`.
    - `supportsBasicGfm` (boolean, optional): Parse basic GFM features. Defaults to `true`.
    - `embedImagesInline` (boolean, optional): Embed supported images inline in Google Docs using temporary anyone-with-link access during insertion. Defaults to `true`.
    - `dryRun` (boolean, optional): Preview what would be imported without changing Drive. Defaults to `false`.
  - **Output**: Returns summary counts for folders, Docs, attachments, and rewritten links.

- **gsheets_read**

  - **Description**: Read data from a Google Spreadsheet with flexible options for ranges and formatting.
  - **Input**:
    - `spreadsheetId` (string): The ID of the spreadsheet to read.
    - `ranges` (array of strings, optional): Optional array of A1 notation ranges (e.g., `['Sheet1!A1:B10']`). If not provided, reads the entire sheet.
    - `sheetId` (number, optional): Specific sheet ID to read. If not provided with ranges, reads the first sheet.
  - **Output**: Returns the specified data from the spreadsheet.

- **gsheets_update_cell**
  - **Description**: Update a cell value in a Google Spreadsheet.
  - **Input**:
    - `fileId` (string): ID of the spreadsheet.
    - `range` (string): Cell range in A1 notation (e.g., `'Sheet1!A1'`).
    - `value` (string): New cell value.
  - **Output**: Confirms the updated value in the specified cell.

- **gdocs_create_from_markdown_file**

  - **Description**: Read a local Markdown file, create a new Google Doc, and reproduce core Markdown structure with native Google Docs formatting.
  - **Input**:
    - `filePath` (string): Absolute path to a local `.md` file.
    - `title` (string, optional): Title for the new Google Doc. Defaults to the Markdown filename.
    - `folderId` (string, optional): Destination Google Drive folder ID for the created document.
    - `supportsBasicGfm` (boolean, optional): Enables parsing of basic GFM features like tables, task lists, and strikethrough. Defaults to `true`.
  - **Output**: Returns the Google Doc ID and URL, the Markdown features applied, and any unsupported elements that were preserved as plain text.

- **gslides_create_presentation**

  - **Description**: Create a new Google Slides presentation.
  - **Input**:
    - `title` (string): Title for the new presentation.
    - `folderId` (string, optional): Existing Drive folder ID to move the new presentation into.
  - **Output**: Returns the new presentation ID and URL.

- **gslides_get_presentation**

  - **Description**: Read a Google Slides presentation as JSON.
  - **Input**:
    - `presentationId` (string): Presentation ID.
    - `fields` (string, optional): Optional Slides API field mask to reduce response size.
  - **Output**: Returns the presentation payload and presentation URL.

- **gslides_get_slide**

  - **Description**: Read one slide from a presentation as JSON.
  - **Input**:
    - `presentationId` (string): Presentation ID.
    - `slideObjectId` (string): Slide object ID.
  - **Output**: Returns the slide payload and direct slide URL.

- **gslides_summarize_presentation**

  - **Description**: Extract slide text into compact JSON, with optional speaker notes.
  - **Input**:
    - `presentationId` (string): Presentation ID.
    - `includeNotes` (boolean, optional): Include speaker notes in the summary.
  - **Output**: Returns presentation metadata plus per-slide extracted text.

- **gslides_batch_update_presentation**

  - **Description**: Apply raw Google Slides `batchUpdate` requests for write operations such as creating slides, inserting text, replacing text, or moving elements.
  - **Input**:
    - `presentationId` (string): Presentation ID.
    - `requests` (array): Raw Google Slides `batchUpdate` request objects.
    - `writeControl` (object, optional): Optional revision control object.
  - **Output**: Returns the Slides API batch update response.

- **gkeep_list_notes**

  - **Description**: List Google Keep notes using the official Keep API.
  - **Input**:
    - `pageToken` (string, optional): Token for the next page of results.
    - `pageSize` (number, optional): Maximum number of notes to return.
    - `filter` (string, optional): Keep API filter over `create_time`, `update_time`, `trash_time`, and `trashed`.
  - **Output**: Returns serialized note objects and the next page token.

- **gkeep_search_notes**

  - **Description**: Search Keep note titles and body content client-side by scanning note pages from the official API.
  - **Input**:
    - `query` (string): Text to match against title and body content.
    - `includeTrashed` (boolean, optional): Whether to also search trashed notes.
    - `limit` (number, optional): Maximum number of matches to return.
    - `pageSize` (number, optional): Page size used while scanning.
  - **Output**: Returns matched serialized note objects.

- **gkeep_get_note**

  - **Description**: Read one Google Keep note by resource name.
  - **Input**:
    - `noteName` (string): Resource name like `notes/{noteId}` or a bare note ID.
  - **Output**: Returns the serialized note.

- **gkeep_create_note**

  - **Description**: Create a Google Keep text note or checklist note using the official API.
  - **Input**:
    - `title` (string, optional): Note title.
    - `text` (string, optional): Text body for a standard note.
    - `items` (array, optional): Checklist items for a list note.
  - **Output**: Returns the created serialized note.

- **gkeep_delete_note**

  - **Description**: Permanently delete a Google Keep note using the official API.
  - **Input**:
    - `noteName` (string): Resource name like `notes/{noteId}` or a bare note ID.
  - **Output**: Confirms deletion.

- **gkeep_download_attachment**

  - **Description**: Download an existing Google Keep attachment to a local file.
  - **Input**:
    - `attachmentName` (string): Full attachment resource name like `notes/{noteId}/attachments/{attachmentId}`.
    - `mimeType` (string): MIME type to download.
    - `outputPath` (string): Absolute local destination path.
    - `overwrite` (boolean, optional): Overwrite existing file.
  - **Output**: Confirms the local file download.

- **gkeep_update_note**

  - **Description**: Update an existing Google Keep note through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `title` (string, optional): Updated note title.
    - `text` (string, optional): Updated note text.
  - **Output**: Returns the updated note payload.

- **gkeep_pin_note**

  - **Description**: Pin or unpin a Google Keep note through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `pinned` (boolean, optional): Defaults to `true`.
  - **Output**: Returns the updated note payload.

- **gkeep_archive_note**

  - **Description**: Archive or unarchive a Google Keep note through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `archived` (boolean, optional): Defaults to `true`.
  - **Output**: Returns the updated note payload.

- **gkeep_list_labels**

  - **Description**: List Keep labels through the unofficial Keep backend.
  - **Input**:
    - `includeStats` (boolean, optional): Include per-label note counts.
  - **Output**: Returns labels, optionally with note counts.

- **gkeep_create_label**

  - **Description**: Create a Keep label through the unofficial Keep backend.
  - **Input**:
    - `name` (string): Label name.
  - **Output**: Returns the created or existing label.

- **gkeep_rename_label**

  - **Description**: Rename a Keep label through the unofficial Keep backend.
  - **Input**:
    - `labelId` (string): Label ID.
    - `newName` (string): New label name.
  - **Output**: Returns the renamed label.

- **gkeep_delete_label**

  - **Description**: Delete a Keep label through the unofficial Keep backend.
  - **Input**:
    - `labelId` (string): Label ID.
  - **Output**: Confirms deletion.

- **gkeep_add_label_to_note**

  - **Description**: Assign a label to a Keep note through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `labelId` (string): Label ID.
  - **Output**: Returns the updated note payload.

- **gkeep_remove_label_from_note**

  - **Description**: Remove a label from a Keep note through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `labelId` (string): Label ID.
  - **Output**: Returns the updated note payload.

- **gkeep_add_list_item**

  - **Description**: Add a checklist item to a list note through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `text` (string): Checklist item text.
    - `checked` (boolean, optional): Whether the item starts checked.
  - **Output**: Returns the updated note and new item ID.

- **gkeep_update_list_item**

  - **Description**: Update a checklist item through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `itemId` (string): Checklist item ID.
    - `text` (string, optional): Updated item text.
    - `checked` (boolean, optional): Updated checked state.
  - **Output**: Returns the updated note payload.

- **gkeep_delete_list_item**

  - **Description**: Delete a checklist item through the unofficial Keep backend.
  - **Input**:
    - `noteId` (string): Keep note ID or `notes/{id}` resource name.
    - `itemId` (string): Checklist item ID.
  - **Output**: Confirms deletion and returns the updated note payload.

### Google Keep limitations

The official Google Keep API does not currently expose note content updates, label CRUD, pinning, archiving, or attachment upload. Those operations are therefore not included in this server when using the official API.

This means the official Keep integration in this repository intentionally covers only the subset that the official API supports: create, list, search, get, delete, permission metadata visibility, and downloading existing attachments.

For everything else, the unofficial backend is used. The main remaining limitation is true attachment upload into Keep notes: `gkeepapi` exposes media reading and media links but currently leaves upload support stubbed, so this repository still does not provide a working tool to upload an image or file directly into a Keep note.

### Joplin Import Notes

- The first-pass Joplin importer recreates notebook folders, imports Markdown notes as Google Docs, uploads linked attachments into the same Drive folder as the note, and rewrites local links to Google Drive or Google Docs URLs.
- Local links to other Markdown notes are rewritten to the corresponding Google Doc when the target note is part of the same import.
- Supported PNG, JPEG, and GIF attachments can be embedded inline. The importer temporarily grants anyone-with-link access to those uploaded image files so the Docs API can fetch them, then removes that temporary permission after the Doc write completes.
- The import runs server-side against the filesystem and Google APIs. It does not need to push all note contents through the model context window.

### Resources

The server provides access to Google Drive files:

- **Files** (`gdrive:///<file_id>`)
  - Supports all file types
  - Google Workspace files are automatically exported:
    - Docs → Markdown
    - Sheets → CSV
    - Presentations → Plain text
    - Drawings → PNG
  - Other files are provided in their native format

## Getting started

1. [Create a new Google Cloud project](https://console.cloud.google.com/projectcreate)
2. [Enable the Google Drive API](https://console.cloud.google.com/workspace-api/products)
3. [Configure an OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) ("internal" is fine for testing)
4. Add OAuth scopes `https://www.googleapis.com/auth/drive`, `https://www.googleapis.com/auth/documents`, `https://www.googleapis.com/auth/keep`, `https://www.googleapis.com/auth/presentations`, `https://www.googleapis.com/auth/spreadsheets`
5. In order to allow interaction with Drive, Sheets, Docs, Slides, and Keep you will also need to enable the [Google Drive API](https://console.cloud.google.com/workspace-api/products), [Google Sheets API](https://console.cloud.google.com/apis/api/sheets.googleapis.com/), [Google Docs API](https://console.cloud.google.com/marketplace/product/google/docs.googleapis.com), [Google Slides API](https://console.cloud.google.com/apis/library/slides.googleapis.com), and the Google Keep API in your project's Enabled APIs and Services section.
6. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) for application type "Desktop App"
7. Download the JSON file of your client's OAuth keys
8. Rename the key file to `gcp-oauth.keys.json` and place into the path you specify with `GDRIVE_CREDS_DIR` (i.e. `/Users/username/.config/mcp-gdrive`)
9. Note your OAuth Client ID and Client Secret. They must be provided as environment variables along with your configuration directory.
10. You will also need to setup a .env file within the project with the following fields. You can find the Client ID and Client Secret in the Credentials section of the Google Cloud Console.

```
GDRIVE_CREDS_DIR=/path/to/config/directory
CLIENT_ID=<CLIENT_ID>
CLIENT_SECRET=<CLIENT_SECRET>
```

### Unofficial Google Keep setup

The unofficial Keep tools require a separate Python environment and unofficial Keep credentials.

The helper scripts are bundled in the npm package, but the Python environment is not. That means npm-installed users must create `.venv-keep` inside the installed package directory before the unofficial Keep tools can run.

1. Create the helper virtual environment:

```bash
python3 -m venv .venv-keep
.venv-keep/bin/pip install -r requirements-keep.txt
```

  If you are running from a repository checkout, do this in the repository root.

  If you installed the package from npm, do this in the installed package directory so these paths exist relative to the package root:
  - `.venv-keep/bin/python`
  - `scripts/gkeep_unofficial_helper.py`

  For a global npm install, first locate the package directory:

```bash
npm root -g
```

  Then `cd` into `@isaacphi/mcp-gdrive` under that directory and create `.venv-keep` there.

2. Add these values to `.env`:

```bash
GOOGLE_EMAIL=your-google-account-email@example.com
GOOGLE_MASTER_TOKEN=your-google-master-token
```

3. Obtain the master token using the `gkeepapi` / `gpsoauth` workflow. This is separate from the official OAuth flow used for Drive, Docs, Sheets, Slides, and the official Keep API.

  The repository includes an interactive helper for this:

```bash
npm run setup:keep-unofficial -- --write-env
```

  It supports two methods:
  - `oauth-token` (default): open `https://accounts.google.com/EmbeddedSetup`, sign in, then paste the `oauth_token` cookie value.
  - `password`: enter the Google account password or app password directly into the helper.

  You can force either mode with one of these commands:

```bash
npm run setup:keep-unofficial -- --method oauth-token --write-env
npm run setup:keep-unofficial -- --method password --write-env
```

4. Restart the MCP server after the helper environment and credentials are in place.

The unofficial Keep backend can edit notes, manage labels, pin/archive notes, and modify checklist items, but it is not supported by Google and can break if Google changes Keep internals.

You can verify the unofficial backend wiring with:

```bash
npm run smoke:keep-unofficial
```

That command is read-only. It authenticates through the Python helper and lists labels with counts.

Make sure to build the server with either `npm run build` or `npm run watch`.

### VS Code setup

1. Install dependencies with `npm install` (the project runs the TypeScript build automatically).
2. Populate `.env` with your `CLIENT_ID`, `CLIENT_SECRET`, and `GDRIVE_CREDS_DIR` values.
3. In VS Code, open the **Run and Debug** view and select **Launch MCP GDrive**. The launch configuration builds the TypeScript sources, loads environment variables from `.env`, and starts the server in an integrated terminal with Node source maps enabled.
4. Optional: start the **npm: watch** task from the **Terminal → Run Task…** menu to keep the TypeScript compiler running in watch mode while developing.
5. To integrate with VS Code's MCP client without hard-coding secrets, point your user `mcp.json` entry at the provided script `scripts/launch-mcp-gdrive.ps1`; the script loads `.env`, ensures the project is built, and launches the server over stdio.

### Authentication

Next you will need to run `node ./dist/index.js` to trigger the authentication step

You will be prompted to authenticate with your browser. You must authenticate with an account in the same organization as your Google Cloud project.

Your OAuth token is saved in the directory specified by the `GDRIVE_CREDS_DIR` environment variable.

If you are upgrading an existing installation, delete the saved token or rerun the auth flow so the stored credentials include the newer Drive, Docs, Slides, and Keep scopes.

![Authentication Prompt](https://i.imgur.com/TbyV6Yq.png)

### Usage with Desktop App

To integrate this server with the desktop app, add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@isaacphi/mcp-gdrive"],
      "env": {
        "CLIENT_ID": "<CLIENT_ID>",
        "CLIENT_SECRET": "<CLIENT_SECRET>",
        "GDRIVE_CREDS_DIR": "/path/to/config/directory"
      }
    }
  }
}
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
