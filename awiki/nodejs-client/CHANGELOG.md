# Change Log

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-03-11

### Added
- Complete CLI script migration from Python to Node.js
- Handle recovery functionality (`recover_handle.js`)
- Handle resolution functionality (`resolve_handle.js`)
- E2EE key regeneration functionality (`regenerate_e2ee_keys.js`)
- CLI comparison test suite
- Comprehensive test suite (29/29 tests passing)

### Fixed
- Path comparison issue in `check_status.js` (Windows compatibility)
- Function import naming in `recover_handle.js`
- Missing handle resolution functions in `resolve_handle.js`

### Changed
- Updated package name from `nodejs-awiki` to `node-awiki`
- Updated documentation to reflect version 0.1.2
- Improved error handling in CLI scripts

### Removed
- Temporary test files

## [0.1.1] - 2026-03-10

### Added
- Initial Node.js client implementation
- Core infrastructure modules (Phase 1-2)
- E2EE processing module (Phase 3)
- Advanced features modules (Phase 4)

### Fixed
- Initial migration issues

## [0.1.0] - 2026-03-08

### Added
- Initial release
- Basic DID identity management
- E2EE messaging support
- CLI interface
