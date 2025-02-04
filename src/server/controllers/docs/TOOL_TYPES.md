# Tool Types and Command Patterns

This document outlines the types of tools supported by the documentation system and how they are handled.

## 1. Package Manager Commands

### npm/pnpm/yarn
```
Format: <package-manager> <subcommand> [script-name]

Allowed Subcommands:
- run   (requires script/binary name)  e.g., "pnpm run build", "npm run vitest"
- exec  (requires binary name)         e.g., "npm exec vite"
- start (no additional args)           e.g., "pnpm start"
- test  (no additional args)           e.g., "yarn test"
```

### Command Types
1. Package Binaries
   - Tools installed in node_modules with a `bin` field
   - Can be run via `run` or `exec`
   - Examples: vitest, drizzle-kit, vite
   - Support documentation flags (-h, --help)

2. NPM Scripts
   - Custom scripts defined in package.json
   - Can only be run via `run`
   - Examples: build, test:coverage, dev
   - Do NOT support documentation flags

### Command Validation Rules:
- Must start with npm, pnpm, or yarn
- Subcommand must be one of: run, exec, start, test
- For 'run' and 'exec', requires a third argument
- Documentation flags only allowed for package binaries
- All parts must contain only: alphanumeric, @, -, _, .
- No path traversal or shell operators allowed

## 2. Direct CLI Tools

### Global Tools
```
Format: <tool-name> [args]
Examples:
- git
- vite
- drizzle-kit
```

### Command Validation Rules:
- Must contain only: alphanumeric, @, -, _, .
- No spaces unless part of package manager command
- No path traversal or shell operators
- Not in blacklist of dangerous commands

## 3. Security Restrictions

### Blacklisted Tools
- System commands (rm, chmod, etc.)
- Shell access (bash, sh, cmd, etc.)
- Network tools (wget, curl, ssh, etc.)
- Raw interpreters (python, ruby, perl, etc.)
- Process management (kill, pkill, etc.)

### Character Restrictions
Forbidden:
- Shell operators (&&, ||, |, ;)
- Variable expansions (${...}, $(..))
- Backticks (`)
- Path separators (/, \)
- Special characters (!#$%^&*()=+{}[]'"<>?,)

## 4. Documentation Retrieval

### Version Information
- Primary: --version, -v
- Fallback: Try both if first fails
- Only available for binaries and global tools

### Help Text
- Primary: --help
- Fallback: -h
- Only available for:
  1. Package binaries (node_modules/.bin)
  2. Global CLI tools
  3. Package manager base commands
- NOT available for:
  1. NPM scripts (test:coverage, build, etc.)
  2. Package manager script commands (start, test)
- Timeout: 5 seconds
- Max output size: 50KB

## 5. Caching Strategy

### Package Scanning Cache
- Cache key: Project path
- Cached data:
  - Available scripts
  - Available dependencies
  - Binary packages (has `bin` field)
  - Detected package manager
- Cache invalidation: Manual via clearPackageCache()
- Cache storage: In-memory Map

### Documentation Cache
- Cache key: Combination of tool name and project path
- Cache invalidation: Not implemented (always fresh fetch)
- Cache storage: In-memory Map
- Cache format: Full DocumentationResponse object

## 6. Error Handling

### Validation Errors
- Invalid tool name: Detailed message with correct format
- Invalid project path: Access/existence check
- Package manager missing: Installation instructions
- Command not found: PATH-related guidance
- Documentation not available: Clear message about script vs binary distinction

### Runtime Errors
- Execution timeout: 5 second limit
- Output size limit: 50KB max
- Permission issues: Detailed error message
- General errors: Include original error message

## 7. Future Considerations

Potential additions:
- Support for cargo (Rust package manager)
- Support for go commands
- Support for dotnet CLI
- Version-specific command validation
- Project-specific command allowlisting
- Better distinction between dev and prod scripts
- Improved script categorization
- Documentation for composite commands 