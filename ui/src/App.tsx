import { useState } from 'react'
import { ToolSelection } from '@my-tools-mcp/shared'
import { ToolSelector } from './components/tool-selector'
import { useWebSocket } from './hooks/use-websocket'
import './App.css'

function App() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const { isConnected, error, sendMessage } = useWebSocket('ws://localhost:8080')

  const handleToolSelect = (tool: ToolSelection) => {
    setSelectedTool(tool.name)
    sendMessage({
      type: 'SELECT_TOOL',
      payload: tool
    })
  }

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

        <p className="text-center text-muted-foreground">
          Select a tool to view its documentation
        </p>
      </div>
    </div>
  )
}

export default App
