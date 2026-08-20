# V14.6 — Coach Core Hardening

## Implemented
- Role-aware app routing: coach accounts now open Coach Workspace.
- Profile self-promotion prevention: athletes cannot change their own `role` through the client profile update policy.
- Coach program publish/reset moved to atomic Supabase SECURITY DEFINER RPCs.
- Coach cannot directly mutate workout history, PRs, or audit history through normal table writes.
- Coach relationship UI now supports current coach display and disconnect.
- Linked athlete program sync treats the coach program as the source of truth and reconciles coach reset/deletion state.
- Coach workspace shows readiness signals, flags, latest note, and decision history.
- Front Touch: 3 free attempts, 8–12 sec.
- Assisted Front Touch: 3 assisted attempts, 5–8 sec, Purple loop first.
- Front Touch progression evaluator added.
- Common coach/history foreign-key indexes added.

## Intentionally deferred to the next slice
- Full add/remove/reorder program builder.
- Realtime program updates.
- Rich progression recommendation engine backed entirely by catalog rules.
- Version diff viewer.
- Background push notifications.
