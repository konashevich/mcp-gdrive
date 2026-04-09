# Markdown To Google Docs MCP Plan

## Goal

Add an MCP tool that reads a local Markdown file, creates a new Google Doc, and reproduces the Markdown structure as native Google Docs formatting.

This should avoid relying on Google Docs UI-only features such as "Paste from Markdown" and instead use the Google Docs API directly for deterministic output.

## Desired Tool

Proposed tool name:

- `gdocs_create_from_markdown_file`

Proposed inputs:

- `filePath`: absolute path to a local `.md` file
- `title`: optional document title
- `folderId`: optional Google Drive folder ID
- `supportsBasicGfm`: optional boolean, default `true`

Proposed output:

- created Google Doc ID
- created Google Doc URL
- summary of Markdown features applied
- list of unsupported elements encountered, if any

## Recommended Approach

Use a three-stage pipeline:

1. Read local Markdown file.
2. Parse Markdown into an AST.
3. Convert the AST into Google Docs API `batchUpdate` requests.

This is the most reliable implementation because it does not depend on undocumented Docs editor behavior or file conversion heuristics.

## Dependencies

Recommended packages:

- `remark`
- `remark-parse`
- `remark-gfm`
- optionally `mdast-util-to-string`

These are sufficient for a first pass that supports normal prose documents and common GitHub-flavored Markdown features.

## Authentication And API Changes

Current limitation:

- the server currently uses `drive.readonly`
- this is not enough to create or move Docs files

Required changes:

1. Update OAuth scopes in `auth.ts`.
2. Re-authenticate so the stored token includes the new scopes.
3. Ensure both Google Drive API and Google Docs API are enabled in the Google Cloud project.

Recommended scopes:

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/documents`
- keep Sheets scope only if still needed

Notes:

- `drive.file` is narrower than full `drive` and is preferable if it covers the intended workflow.
- If moving files across folders or broader Drive operations prove restrictive, switch to full Drive scope only if necessary.

## Server Changes

### 1. Add New Tool Definition

Add a new tool module:

- `tools/gdocs_create_from_markdown_file.ts`

Update:

- `tools/index.ts`
- `tools/types.ts`

Add a new input type similar to:

```ts
export interface GDocsCreateFromMarkdownFileInput {
  filePath: string;
  title?: string;
  folderId?: string;
  supportsBasicGfm?: boolean;
}
```

### 2. Create Document

Use Google Docs API:

- `docs.documents.create()`

This creates a blank document and returns a document ID.

### 3. Populate Document

Use Google Docs API:

- `docs.documents.batchUpdate()`

Generate a sequence of requests that:

- insert text
- apply paragraph styles
- create bullets for list items
- apply text styles for bold, italic, code, and links

### 4. Move To Target Folder

If `folderId` is provided, use Drive API after document creation to move the file from root into the requested folder.

## Formatting Support

### Phase 1: Must Support

- document title from parameter or filename
- paragraphs
- headings `#` to `######`
- bold
- italic
- links
- bulleted lists
- numbered lists
- fenced code blocks
- inline code
- blockquotes
- thematic breaks

### Phase 2: Nice To Have

- nested lists
- tables
- task lists
- strikethrough
- images as links or inserted images

### Phase 3: Optional Advanced Support

- frontmatter handling
- footnotes
- table alignment
- syntax-aware code block styling
- partial update into an existing Doc

## Conversion Strategy

Build an intermediate internal representation instead of writing directly from the AST into Docs requests.

Suggested flow:

1. Parse Markdown AST.
2. Convert AST into a normalized block/inline model.
3. Convert that model into Docs API requests.

Why:

- easier testing
- easier handling of offsets and style ranges
- easier support for unsupported elements fallback

Suggested internal model:

- block nodes: paragraph, heading, list, listItem, blockquote, codeBlock, rule
- inline spans: text, strong, emphasis, code, link

## Important Docs API Constraints

Be careful with index management.

The Docs API uses character indexes for insertions and style ranges. The implementation should either:

- build the whole document text first and then apply styles by calculated offsets, or
- insert block by block while tracking the current end index carefully

Recommended first implementation:

- create a single text buffer with block separators
- keep a list of style ranges and paragraph ranges
- apply formatting in batched requests after insertion

This is simpler and less error-prone than interleaving inserts and styles.

## Unsupported Markdown Handling

Do not fail the whole import on unsupported syntax.

Fallback behavior:

- preserve unsupported content as readable plain text
- include a warning summary in the tool response

Examples:

- tables can fall back to tab-separated plain text in the first version
- task lists can fall back to bullets with `[ ]` and `[x]`

## Validation Plan

Test with these fixtures:

1. Simple prose with headings and emphasis
2. Bulleted and numbered lists
3. Links and inline code
4. Fenced code blocks
5. Mixed GFM document with task lists and tables

For each test, verify:

- Doc is created successfully
- structure is preserved
- text is complete
- formatting is applied to the correct ranges
- unsupported syntax is reported cleanly

## Suggested Implementation Order

1. Add scopes and refresh authentication.
2. Add Docs client wiring and new tool schema.
3. Implement Markdown parsing.
4. Implement phase 1 formatting.
5. Add folder move support.
6. Add warnings for unsupported constructs.
7. Add tests or at minimum manual fixture verification.
8. Update `README.md` with tool usage and auth requirements.

## Minimal First Deliverable

The first usable version should support:

- local `.md` input
- new Google Doc creation
- headings
- paragraphs
- bold
- italic
- links
- flat bullet and numbered lists
- fenced code blocks as monospace paragraphs

That is enough to handle most normal writing workflows.

## Risks

- OAuth token must be regenerated after scope changes
- Docs API index calculations are easy to get wrong
- nested list handling is non-trivial
- table fidelity will not match full Markdown semantics in the first version
- Drive folder placement may require broader scope depending on workflow

## Optional Alternative

If implementation speed matters more than fidelity, a fallback tool could:

1. convert Markdown to HTML
2. upload HTML to Drive
3. convert to Google Doc

This may produce acceptable output for many files, but it is less deterministic than direct Docs API formatting and harder to control when conversions change.

## Recommendation

Implement the direct Docs API path first.

If needed later, add a second tool for faster but less strict conversion, for example:

- `gdocs_import_markdown_via_html`

That gives a clean split between:

- high-fidelity structured import
- convenience conversion path