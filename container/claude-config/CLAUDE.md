# Session Notes

You have a persistent notes directory at `/notes`. Use it to maintain context across sessions.

At the START of each session, read `/notes/summary.md` if it exists to pick up prior context.

At the END of each session (before your final response), write `/notes/summary.md` with:
- What was accomplished
- Current state of the project (what works, what's broken)
- If something went wrong: the error, what you tried, and where to pick up next
- Any open TODOs or decisions deferred

Keep notes concise. Overwrite the summary each session — it should reflect current state, not a log.
