import { useState } from 'react'
import { ToolDocumentation } from '@/types'
import React from 'react'

function App() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [documentation, setDocumentation] = useState<ToolDocumentation | null>(null)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <span className="font-bold">MCP Tools</span>
            </a>
          </div>
        </div>
      </header>

      <div className="container grid flex-1 gap-12 md:grid-cols-[200px_1fr] py-6">
        <aside className="w-[200px] flex-col">
          <nav className="grid items-start gap-2">
            {/* Tool selection will go here */}
          </nav>
        </aside>

        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {documentation ? (
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <h1>{documentation.name}</h1>
              <div className="text-sm text-muted-foreground">
                Version: {documentation.version}
              </div>
              <pre className="mt-4 p-4 bg-muted rounded-lg overflow-auto">
                {documentation.helpText}
              </pre>
            </div>
          ) : (
            <div className="flex h-[450px] items-center justify-center">
              <p className="text-muted-foreground">
                Select a tool to view its documentation
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App 