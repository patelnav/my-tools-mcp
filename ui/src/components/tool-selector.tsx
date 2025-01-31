import { useState } from 'react'
import { ToolSelection } from '@my-tools-mcp/shared'
import { cn } from '../lib/utils'

interface ToolSelectorProps {
  onToolSelect: (tool: ToolSelection) => void
  selectedTool: string | null
}

export function ToolSelector({ onToolSelect, selectedTool }: ToolSelectorProps) {
  const [projectPath, setProjectPath] = useState('')
  const [toolName, setToolName] = useState('')

  const handleAddTool = () => {
    if (!toolName || !projectPath) return

    onToolSelect({
      name: toolName,
      projectPath,
    })

    setToolName('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="project-path"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Project Path
        </label>
        <input
          id="project-path"
          type="text"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          placeholder="/path/to/project"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="tool-name"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Tool Name
        </label>
        <div className="flex space-x-2">
          <input
            id="tool-name"
            type="text"
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            placeholder="drizzle-kit"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
          />
          <button
            onClick={handleAddTool}
            disabled={!toolName || !projectPath}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              "bg-primary text-primary-foreground shadow hover:bg-primary/90",
              "h-9 px-4 py-2"
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
} 