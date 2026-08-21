# V15.3

- Added atomic Coach Skill Promotion RPC.
- Added Review Promotion modal in Skill Graph.
- Added canonical `catalogExerciseId` to ExerciseBlock.
- Fixed Skill Intelligence to match remote block instances with historical logs using canonical catalog ids.
- Promotion creates a new block identity so historical logs remain attached to the old rung.
- Promotion writes a program decision and audit event atomically.
