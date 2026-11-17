# README for Agents

## Overview

This repo is a collection of userscripts for various websites.

## Guidelines

- Every userscript should be in a separate file.
- Utility functions should be in the `utils` folder.
  - All userscripts should use the logger from /utils.
  - Each utility function should be in a separate file.
- Naming convention for userscripts: `<website_name>-<userscript_name>.js`
- Edit only one userscript only unless explicitly stated otherwise.
- All userscripts should have a downloadURL and updateURL. Except for utility functions.
- npm packages can be used through a CDN such as jsDelivr with `@require`. Pin an exact version and use a browser-ready build (UMD/IIFE), e.g. `// @require https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js`.
- Do NOT add a `@license` field to userscripts unless explicitly asked to do so.
- All userscripts inside `archive` folder should be archived and not updated.
