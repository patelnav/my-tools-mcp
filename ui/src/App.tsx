import { useState, useEffect } from 'react'
import { ToolSelection, DocumentationResponse } from '@my-tools-mcp/shared'
import { ToolSelector } from './components/tool-selector'
import { useWebSocket } from './hooks/use-websocket'
import './App.css'

function App() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [documentation, setDocumentation] = useState<DocumentationResponse | null>(null)
  const { isConnected, error, sendMessage, addMessageHandler } = useWebSocket('ws://localhost:8080')

  const handleToolSelect = (tool: ToolSelection) => {
    setSelectedTool(tool.name)
    sendMessage({
      type: 'SELECT_TOOL',
      payload: tool
    })
  }

  useEffect(() => {
    return addMessageHandler((message) => {
      if (message.type === 'DOCUMENTATION_UPDATED') {
        setDocumentation(message.payload)
      }
    })
  }, [addMessageHandler])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container py-8 space-y-8">
        <h1 className="text-3xl font-bold text-center text-primary">MCP Tools</h1>
        
        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <ToolSelector 
          onToolSelect={handleToolSelect}
          selectedTool={selectedTool}
        />

        {documentation ? (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {documentation.success && documentation.data ? (
              <>
                <h2>{documentation.data.name}</h2>
                <div className="text-sm text-muted-foreground">
                  Version: {documentation.data.version}
                </div>
                <pre className="mt-4 p-4 bg-muted rounded-lg overflow-auto">
                  {documentation.data.helpText}
                </pre>
              </>
            ) : (
              <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
                {documentation.error}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            Select a tool to view its documentation
          </p>
        )}
      </div>
    </div>
  )
}

export default App
