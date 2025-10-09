# Theory Module Page Architecture

## Overview
The TheoryModulePage orchestrates lesson presentation, progress tracking, quiz readiness, notes management, and accessibility/interaction shortcuts for the Signature-Based Detection course.

## Core Pieces
- **Hooks**
  - `useLessonProgress` (existing): local completion tracking
  - `useServerModuleProgress` (existing): server-synced progress
  - `useMergedProgress`: merges local + server into a unified progress object
  - `useSyncedLessonIndex`: synchronizes current lesson index with URL + localStorage
- **Components**
  - `LessonSkeleton`: loading placeholder
  - `LessonNotesPanel`: notes with autosave, export, exit navigation
  - `HighContrastToggle`: accessibility contrast boost
  - `StatsPanel`, `SidebarNav`, `ActivityPanel` (existing)

## Data Flow
1. Module + lessons seed from signature module registry
2. `useSyncedLessonIndex` establishes the current lesson index
3. Markdown for lessons lazy-loads; once imported it is cached in the in-memory lesson object
4. Progress is merged via `useMergedProgress`; completion marking updates both local and server hooks
5. Quiz readiness banner checks per-module completion vs quiz pass state (localStorage)

## Storage Keys (Current)
- Lesson index: `theory:<moduleTitle>:last:lesson`
- Notes: `notes:<moduleTitle>:<lessonTitle>`
- Quiz pass: `signatureQuiz:<moduleCode>:passed`

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| ← / → | Previous / Next lesson |
| Home / End | First / Last lesson |
| Alt + Q | Open unlocked module quiz |
| Ctrl + Shift + N | Open notes panel |
| ? | Show help toast |

## Extensibility Targets
- Replace localStorage quiz state with server authoritative state
- Add analytics layer to capture dwell + scroll depth
- Internationalization of static strings
- Prefetch next lesson on idle (planned)

## Planned Enhancements (Next)
- Prefetch next lesson markdown
- Offline queue for completion events
- Refactor hero header into independent component file

## Testing Recommendations
- Render with mocked progress hooks and simulate lesson completion
- Verify URL updates on lesson change
- Simulate Alt+Q only when quiz unlocked
- Snapshot of quiz banner visibility logic

---
Created automatically to document current refactor state.
