# Notebook Plugin Architecture

**Status:** Approved  
**Last Updated:** 2026-09-16

## Problem

trex-notebook integrates Jupyter notebooks into Data2Evidence. The plugin must sync notebook state with trex services, handle cell execution, and manage kernel connections transparently.

## Approach

React-based UI plugin running in trex context:
- Embed Jupyter frontend (JupyterLab) in the trex notebook plugin
- Notebook cells send execution requests to d2e-enterprise-gateway (Jupyter kernel gateway)
- Cell outputs and state sync back to trex plugin UI
- Plugin state is persisted in trex's notebook cache

## Components

- `plugins/notebook/` — React plugin entry point
- `plugins/notebook/components/NotebookEditor.tsx` — cell editor and renderer
- `plugins/notebook/hooks/useKernel.ts` — kernel connection and execution
- `plugins/notebook/state/notebookStore.ts` — notebook state management
- Backend: `d2e-enterprise-gateway` (external service)

## Acceptance Criteria

- Notebook cells execute via kernel gateway
- Cell outputs display in plugin UI
- Notebook state persists across plugin loads
- Kernel connection errors are handled gracefully
- Multi-language execution (Python, R) supported

## Trade-offs & Alternatives

**Embed Jupyter directly** — chosen for UI consistency and tight integration.  
**iframe-based isolation** — more isolated but harder to sync state.

## Notes & Context

- Trex plugin system is in `plugins/ui/`
- Kernel gateway runs at `http://d2e-enterprise-gateway:8888` (local dev)
- See related spec: [[trex-plugin-system]]
