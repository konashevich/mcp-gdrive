# MCP Google Drive Server Improvement Plan

## Overview
The current MCP Google Drive server lacks several key features that would make it more useful for file management:
1. File metadata (especially parent folder information) is not exposed, making it impossible to distinguish root folder files from subfolder files
2. No ability to create folders
3. No ability to move files between folders

This plan outlines a phased approach to address these gaps while maintaining backward compatibility and following Google Drive API best practices.

## Phase 1: Enhance File Metadata in Existing Tools
**Goal**: Modify existing tools to include comprehensive file metadata, especially parent folder information.

**Tasks**:
- Update `gdrive_search` tool to include metadata fields in response
- Update `gdrive_read_file` tool to return file metadata alongside content
- Add parent folder ID and path information to all file responses
- Ensure metadata includes: id, name, mimeType, parents, createdTime, modifiedTime, size

**Implementation**:
- Modify tool handlers in `tools/gdrive_search.ts` and `tools/gdrive_read_file.ts`
- Update TypeScript interfaces in `tools/types.ts`
- Add utility functions for metadata extraction

**Testing**:
- Verify metadata appears in tool responses
- Test with files in root vs subfolders
- Ensure no breaking changes to existing functionality

## Phase 2: Add Folder Creation Tool
**Goal**: Implement a new tool to create folders in Google Drive.

**Tasks**:
- Create new tool `gdrive_create_folder` in `tools/gdrive_create_folder.ts`
- Add tool to main tools array in `tools/index.ts`
- Implement handler that accepts folder name and optional parent folder ID
- Return created folder metadata

**Implementation**:
- Use Google Drive API `files.create` with `mimeType: 'application/vnd.google-apps.folder'`
- Handle optional parent folder specification
- Add proper error handling for invalid parent IDs

**Testing**:
- Create folders in root directory
- Create nested folders (subfolders)
- Test error cases (invalid parent, permissions)

## Phase 3: Add File Move Tool
**Goal**: Implement a new tool to move files between folders in Google Drive.

**Tasks**:
- Create new tool `gdrive_move_file` in `tools/gdrive_move_file.ts`
- Add tool to main tools array in `tools/index.ts`
- Implement handler that accepts file ID and destination folder ID
- Return updated file metadata after move

**Implementation**:
- Use Google Drive API `files.update` with `addParents` and `removeParents` parameters
- Validate that destination folder exists and is accessible
- Handle moving to root (remove all parents)

**Testing**:
- Move files between folders
- Move files to root directory
- Test error cases (invalid file ID, invalid destination folder, permissions)

## Phase 4: Integration and Documentation
**Goal**: Ensure all new features work together and are properly documented.

**Tasks**:
- Update README.md with new tool descriptions and examples
- Add integration tests for combined operations (create folder, move file into it)
- Update package.json version and changelog
- Test full workflows: search → create folder → move files → verify metadata

**Implementation**:
- Update documentation in README.md
- Add example usage scenarios
- Ensure all tools follow consistent response formats

## Phase 5: Advanced Features (Future)
**Goal**: Consider additional enhancements for completeness.

**Potential Features**:
- File deletion tool
- Bulk operations (move multiple files)
- Folder listing tool (separate from file search)
- File sharing/permissions management

## Risk Mitigation
- All changes maintain backward compatibility
- Extensive testing before deployment
- Gradual rollout with feature flags if needed
- Clear error messages for API failures

## Success Criteria
- Users can identify root folder files via metadata
- Users can create folder hierarchies
- Users can organize files by moving them between folders
- All operations work reliably with proper error handling
- Documentation is clear and up-to-date