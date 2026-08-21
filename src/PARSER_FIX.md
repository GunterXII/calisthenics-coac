# Parser Fix

Fixed two missing `}` braces closing conditional JSX expressions:
- SetBlock inline "EDIT SET" panel.
- EMOM inline "EDIT MINUTE" panel.

These caused the Babel error:
"Adjacent JSX elements must be wrapped in an enclosing tag."
