# Details.MD

This document provides a **comprehensive, step-by-step guide** for implementing each component of the MCP-connected command-line tool documentation server MVP. It assumes **no further questions** will be asked, so all design decisions are made explicitly.

---

## Table of Contents

- [Details.MD](#detailsmd)
  - [Table of Contents](#table-of-contents)
  - [1. Project Folder Structure](#1-project-folder-structure)
    - [Recommended Layout](#recommended-layout)
  - [2. Vite Configuration for React UI](#2-vite-configuration-for-react-ui)
    - [Steps](#steps)
  - [3. VSCode/Cursor Extension Setup](#3-vscodecursor-extension-setup)
    - [Steps](#steps-1)
    - [Potential Implementation Notes](#potential-implementation-notes)
  - [4. Node.js Server Setup (Express/Koa)](#4-nodejs-server-setup-expresskoa)
    - [Steps](#steps-2)
  - [5. Executing CLI Commands with Child Processes](#5-executing-cli-commands-with-child-processes)
    - [Steps](#steps-3)
  - [6. Communication Channel (Extension ↔ Server ↔ UI)](#6-communication-channel-extension--server--ui)
    - [Options](#options)
    - [Implementation Details](#implementation-details)
  - [7. Tool Selection UI (React)](#7-tool-selection-ui-react)
    - [Main Features](#main-features)
    - [UI Flow Example](#ui-flow-example)
  - [8. Documentation Fetch \& Parse Logic](#8-documentation-fetch--parse-logic)
    - [Steps](#steps-4)
  - [9. File Watching \& Version Checking](#9-file-watching--version-checking)
    - [Approach](#approach)
  - [10. Testing \& Validation](#10-testing--validation)
    - [Types of Tests](#types-of-tests)
  - [11. Packaging \& Distribution](#11-packaging--distribution)
    - [Steps](#steps-5)
  - [Final Notes](#final-notes)

---

## 1. Project Folder Structure

**Goal:** Clearly separate extension logic, server code, and React UI to maintain modularity and easy maintainability.

### Recommended Layout

mcp-doc-server/
├── extension/
│   ├── src/
│   │   ├── extension.ts            # Main extension entry (VSCode/Cursor)
│   │   └── commands/              # Organized commands, if any
│   └── package.json               # Extension metadata, dependencies
│
├── server/
│   ├── src/
│   │   ├── index.ts               # Express/Koa entry point
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── utils/
│   └── package.json
│
├── ui/
│   ├── src/
│   │   ├── App.tsx                # Main React component
│   │   ├── components/            # Reusable UI components
│   │   ├── hooks/                 # Custom React hooks (if needed)
│   └── vite.config.ts             # Vite config for bundling
│
├── shared/                         # (Optional) Shared constants/types/utilities
├── package.json                    # Root-level dev dependencies and scripts
└── README.md

1. **extension/**  
   - Houses the VSCode/Cursor extension files.  
   - `extension.ts` (or `.js`) is the main entry that the editor recognizes.

2. **server/**  
   - Contains Node.js server code using Express or Koa.  
   - Responsible for launching a local server that handles CLI command execution and provides API endpoints.

3. **ui/**  
   - Contains React front-end code, bundled by Vite into a single or minimal set of files.  
   - These files will be served by the Node.js server or loaded as a WebView in the extension.

4. **shared/** (Optional)  
   - If you need to share logic or types between the extension, server, and UI, place them here.

5. **package.json**  
   - At root (optional) for overall dev tooling, scripts to build/test/publish all subprojects.

---

## 2. Vite Configuration for React UI

**Goal:** Use Vite to build a lightweight, fast React application to display the tool selection and documentation.

### Steps

1. **Install Dependencies**  
   - In the `ui/` folder, install React, React DOM, Vite, and any other UI libraries needed for the project.  
   - Example dependencies (no code, just references):  
     - `"react"`, `"react-dom"`, `"vite"`

2. **Set up `vite.config.ts`**  
   - Configure input and output paths.  
   - Ensure the output format is something easily embeddable in VSCode/Cursor (a single HTML/CSS/JS bundle).  
   - Consider using `build: { outDir: 'dist' }` so the final build outputs to `ui/dist`.

3. **Build Scripts**  
   - Add a script in the `ui/` `package.json` like `"build": "vite build"` which will produce production-ready assets.  
   - Use `"dev": "vite"` to run a local development server for iterative UI work.

4. **React Structure**  
   - `App.tsx` should serve as the root, rendering:  
     - A sidebar or main section for **tool selection**.  
     - A content area for **documentation**.  

5. **Production Output**  
   - After building, you’ll get a `dist/` folder with HTML, JS, and CSS.  
   - This can be served either by the Node.js server or loaded via VSCode/Cursor’s WebView approach.

---

## 3. VSCode/Cursor Extension Setup

**Goal:** Create an extension that registers commands, spawns the Node.js server, and displays the React UI inside VSCode/Cursor.

### Steps

1. **Extension Manifest**  
   - In `extension/package.json`, define `name`, `version`, `publisher` (for VSCode), and the commands (if any) you want to appear in the command palette.  
   - For instance, a command: `"mcpDocs.open"`.

2. **Entry Point (`extension.ts`)**  
   - Implement the `activate` function:  
     - Register any commands (e.g., `vscode.commands.registerCommand` or Cursor's equivalent).  
     - Start the Node.js server process in the background or ensure it’s launched once.

3. **Spawning the Node.js Server**  
   - Use Node’s `child_process` from within the extension to run `npm run start` (or a script that starts the server in the `server/` folder).  
   - Store the child process reference to terminate it gracefully on extension deactivation.

4. **Opening the UI**  
   - In the command’s callback (e.g., `mcpDocs.open`), create a WebView panel or integrated view to load the built React UI.  
   - You can embed the compiled `dist/index.html` in the WebView or point the WebView to the server’s `http://localhost:PORT` URL.

5. **Deactivation**  
   - In the `deactivate` function, kill the Node.js server process if it’s still running.

### Potential Implementation Notes

- **Port Management:** If you serve UI from `localhost`, pick an unused port or retrieve a random port dynamically.  
- **WebView vs. Localhost:**  
  - **WebView Approach:** Copy your compiled UI files into the extension’s directory, then load them as a local resource.  
  - **Localhost Approach:** If the server is always running, just load `http://localhost:3000` (or similar).

---

## 4. Node.js Server Setup (Express/Koa)

**Goal:** Create a lightweight server that responds to requests for documentation, handles user-selected tools, and exposes endpoints to the extension/UI.

### Steps

1. **Project Setup**  
   - In `server/`, install your chosen framework: `express` or `koa`.  
   - Add minimal dev dependencies (e.g., TypeScript, if you want typed server code).

2. **Server Entry Point** (`index.ts`)  
   - Initialize the server with a specific port.  
   - Create routes like `/docs` or `/tools` to handle:  
     - **Fetching Documentation** (GET or POST)  
     - **Submitting Tool Selections** (POST)  
   - Optionally serve static files for the UI from `../ui/dist`.

3. **Architecture**  
   - **routes/** directory: Each route is responsible for one feature area (e.g., `tools.ts`, `docs.ts`).  
   - **controllers/** directory: Business logic for handling requests (e.g., orchestrating CLI commands, parsing output).  
   - **utils/** directory: Reusable utilities (e.g., version checks, path resolution).

4. **Data Storage**  
   - For an MVP, you could store selected tools and doc outputs in memory.  
   - Provide an in-memory map:  
     - Key: `toolName@version`  
     - Value: parsed doc content (string or structured object).

5. **Start Script**  
   - In `server/package.json`, define:  
     - `"start": "tsc && node dist/index.js"` (or any compile+run approach).  
   - The extension spawns this command to launch the server.

---

## 5. Executing CLI Commands with Child Processes

**Goal:** Dynamically invoke each tool’s `-h` (or similar) command from the user’s project folder.

### Steps

1. **Child Process Import**  
   - In server code (controllers or dedicated `cliService`), use `child_process.spawn` or `child_process.exec`.

2. **Determine Execution Path**  
   - When the user selects a folder, confirm that the working directory is set to that folder before running the tool.  
   - This ensures the tool version used is the one installed in that folder (if relevant, e.g., local node_modules).

3. **Capturing Output**  
   - Listen to `stdout` and `stderr`.  
   - Buffer the output. Once the process ends, parse or store the result.

4. **Handling Errors**  
   - For an MVP, just store error messages in `stderr` if the process fails or the tool is missing.  
   - Communicate that to the UI so the user knows a command couldn’t be retrieved.

5. **Caching**  
   - If the user runs the same command again without changes, you can skip a new spawn by using a memory cache.  
   - If the user changes version or updates tools, invalidate the cache for that tool.

---

## 6. Communication Channel (Extension ↔ Server ↔ UI)

**Goal:** Allow the UI to tell the server what tools the user wants, retrieve docs, and push updates to the extension if needed.

### Options

1. **HTTP Endpoints** (Poll or Single Requests)  
   - The UI calls `GET /tools` to list current selections or `POST /tools` to update them.  
   - The UI calls `GET /docs?tool=drizzlekit` to get doc content.

2. **WebSocket**  
   - The server and UI maintain a persistent connection for real-time pushes (e.g., doc updates).  
   - For a simple MVP, HTTP requests may suffice.

3. **VSCode/Cursor Extension Integration**  
   - The extension might only need to manage the server’s lifecycle and open the UI.  
   - If you need extension-specific interactions (e.g., commands triggered from the UI that run directly in VSCode), consider using the **VSCode WebView API** (messaging back and forth).

### Implementation Details

- **HTTP Approach** is typically simpler.  
- **If the extension** itself needs doc data, it can call the server’s endpoints.  
- **If only the UI** displays docs, the extension can remain minimal, only spawning the server and opening the WebView.

---

## 7. Tool Selection UI (React)

**Goal:** Let the user pick which command-line tools to use and view the corresponding docs.

### Main Features

1. **List of Known Tools**  
   - A set of tool “cards” or a drop-down that includes recognized CLI tools (e.g., DrizzleKit, VTest).  
   - For advanced usage, a text field to add any CLI tool by name.

2. **Project Folder Input**  
   - A display of the currently selected project folder.  
   - Possibly a button to “change folder” (which notifies the extension).

3. **Tool Actions**  
   - **Add Tool:** UI calls `POST /tools` with `{ name: "drizzlekit" }`.  
   - **Remove Tool:** UI calls `DELETE /tools/:toolName` or something similar.  
   - The server then updates its in-memory list of tools to track.

4. **Documentation Display**  
   - Once the server has run the `-h` command for a tool, it returns the doc text.  
   - Show it in a collapsible panel or a basic text area.

5. **Refresh / Automatic Updates**  
   - Provide a “Refresh Docs” button or automatically poll the server if versions are suspected to have changed.

### UI Flow Example

1. User opens the extension panel → sees an empty list of tools.  
2. User picks “Add Tool → DrizzleKit.”  
3. The server spawns `drizzlekit -h`, stores output, returns doc data.  
4. UI displays doc text under a “DrizzleKit” heading.  
5. User sees changes if a new version of DrizzleKit is installed (e.g., manually triggers a refresh).

---

## 8. Documentation Fetch & Parse Logic

**Goal:** Convert raw `-h` output into a more readable or structured format for easy display.

### Steps

1. **Acquisition**  
   - The server runs `<toolName> -h` or `<toolName> --help`.  
   - Output typically includes usage instructions, flags, etc.

2. **Parsing**  
   - For an MVP, you can just show raw text.  
   - If you want structure (like a table of commands/flags), a simple parser can detect lines starting with a dash or parse usage blocks.  
   - Store in a format like:  
     ```json
     {
       "usage": "tool usage string",
       "options": [
         { "flag": "-v", "description": "Show version" },
         ...
       ]
     }
     ```
   - Or store as raw text if you don’t need advanced UI formatting.

3. **Caching Strategy**  
   - If no version changed, reuse previously fetched text.  
   - If a version update is detected, run the command again.

4. **Display**  
   - The UI can show structured data in a table or raw text in a code block.  
   - For an MVP, raw text is easiest.

---

## 9. File Watching & Version Checking

**Goal:** Automatically detect if a tool’s version changes within the user’s project so the docs can be refreshed without manual user intervention.

### Approach

1. **Package File Monitoring**  
   - If the tool is Node-based, watch for changes in `package.json` or lock files.  
   - Use libraries like `chokidar` for file watching.  
   - If a relevant file changes, re-check the installed version of the tool (e.g., `npm list drizzlekit` or use a local bin approach).

2. **Direct Version Commands**  
   - Some CLI tools support a `--version` command. If you detect a version mismatch, re-run the `-h` command.

3. **Frequency**  
   - For an MVP, a quick approach is to run a version check every time the user opens the extension or triggers a refresh.  
   - Alternatively, keep a small watch process that triggers re-check.

4. **UI Notification**  
   - If a change is detected, the server can either automatically refresh the doc output or notify the UI that the version changed.

---

## 10. Testing & Validation

**Goal:** Confirm the extension, server, and UI work together without breaking. Minimal but essential tests.

### Types of Tests

1. **Integration Tests**  
   - Launch the server, use a test script to call the endpoints, and ensure doc text is returned.  
   - Add or remove tools, confirm the server updates its internal list accordingly.

2. **UI Tests**  
   - With React, you can do a quick smoke test to ensure the components render, or simply rely on manual testing for the MVP.

3. **Extension Tests**  
   - Test that commands in `extension.ts` are registered and actually start the server.  
   - Check that the extension can open the WebView panel (or external browser link if that’s the route).

4. **Manual Validation**  
   - Spin up the system in development mode, add a known tool, verify the doc text matches the real tool’s `-h` output.

---

## 11. Packaging & Distribution

**Goal:** Provide a straightforward way for others to install and run this extension.

### Steps

1. **Build the Server**  
   - In the `server/` folder, run your build (e.g., TypeScript compile) and produce an output in `dist/`.

2. **Build the UI**  
   - In the `ui/` folder, run `vite build`. You get a `dist/` folder with static files or a single bundle.

3. **Bundle the Extension**  
   - Copy or reference the UI’s built files so the extension can serve them or embed them in a WebView.  
   - Update the extension’s `package.json` to ensure `dist/index.html` (or your main UI file) is included in the final package.

4. **VSCode/Cursor Publishing**  
   - If using VSCode, you can generate a `.vsix` file with `vsce package` or similar.  
   - For Cursor, follow Cursor’s extension packaging guidelines.

5. **Installation**  
   - The user installs the extension.  
   - On activation, the extension spawns the server, or you can instruct the user to run `npm install` in the server folder to get dependencies before first use.

---

## Final Notes

- This MVP focuses on **straightforward** functionality with minimal overhead.  
- **Security** and **accessibility** considerations are omitted for simplicity.  
- If advanced features are needed (e.g., real-time doc parsing or heavy caching), refactor the server and UI as required.

**Done!** You now have all the key details for implementing an MCP-connected command-line documentation server with a React UI, Node.js backend, and a VSCode/Cursor extension.