# Tool Types and Command Patterns

This document outlines the types of tools supported by the documentation system and how they are handled.

## 1. Package Manager Commands

### npm/pnpm/yarn
```
Format: <package-manager> <subcommand> [script-name]

Allowed Subcommands:
- run   (requires script name)  e.g., "pnpm run build"
- exec  (requires command)      e.g., "npm exec vite"
- start (no additional args)    e.g., "pnpm start"
- test  (no additional args)    e.g., "yarn test"
```

### Command Validation Rules:
- Must start with npm, pnpm, or yarn
- Subcommand must be one of: run, exec, start, test
- For 'run' and 'exec', requires a third argument
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

### Help Text
- Primary: --help
- Fallback: -h
- Timeout: 5 seconds
- Max output size: 50KB

## 5. Caching Strategy

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