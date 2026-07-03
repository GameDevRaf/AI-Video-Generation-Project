# AI SaaS Development Action Plan

## Phase 1 — Lock the Scope

1. Define the MVP as script → scene split → image → audio → video → export.
2. Decide the first supported providers for each generation type.
3. Decide the first login method and whether Supabase Auth will be used.
4. Decide the first model-selection behavior for each step.
5. Freeze the first version of the user flow.

## Phase 2 — Set Up the Foundation

6. Create the Nuxt project in TypeScript.
7. Set up the UI system and shared layout components.
8. Set up Supabase project, auth, storage, and base database.
9. Create the initial app structure:

   * Home page
   * Auth pages
   * Dashboard
   * Project workspace
   * Settings page
10. Add environment variable handling.

## Phase 3 — Build the Database Skeleton

11. Create core tables:
* users
* projects
* jobs
* job\_outputs
* api\_keys
* connected\_accounts
* scenes
* scene assets
* project\_settings
12. Add enums/constraints.
13. Add indexes.
14. Add row-level security.

## Phase 4 — Authentication and Dashboard

15. Implement sign-up and login.
16. Create user profile/settings records.
17. Build projects overview page.
18. Build project CRUD.
19. Build settings page.

## Phase 5 — Project Workspace Shell

20. Build main creation workspace layout.
21. Add top-right model selector.
22. Add bottom timeline playback bar.
23. Add expandable timeline panel.
24. Add provider/API-key popup panel.
25. Add seamless vertical generation-stage flow.

## Phase 6 — Job System

26. Implement job creation.
27. Implement worker job claiming.
28. Implement job state transitions.
29. Add retry logic.
30. Add job event logging.
31. Add output storage.

## Phase 7 — Script Stage

32. Build script idea input.
33. Generate multiple scripts.
34. Allow script selection.
35. Add script editing.
36. Persist active script.

## Phase 8 — Scene Splitting

37. Split script into scenes.
38. Generate timestamps.
39. Display scenes in timeline.
40. Allow scene editing.
41. Recalculate timestamps.
42. Persist active scene plan.

## Phase 9 — Image Generation

43. Generate image prompts.
44. Respect prompt-edit settings.
45. Support prompt editing.
46. Generate images.
47. Store image outputs.
48. Prepare for future multiple-image support.

## Phase 10 — Audio Generation

49. Add voice selection.
50. Generate audio.
51. Add playback with script highlighting.
52. Display scene image during playback.
53. Allow minor audio edits.
54. Regenerate audio when needed.

## Phase 11 — Video Generation

55. Generate video prompts.
56. Combine image, prompt, and timestamps.
57. Generate video segments.
58. Display timeline review.
59. Add review controls.
60. Support segment regeneration.

## Phase 12 — Music Generation

61. Add optional music stage.
62. Support generated or existing music.
63. Generate tracks.
64. Add full-video preview.
65. Add volume controls.
66. Support track replacement/regeneration.

## Phase 13 — Export and Publishing

67. Build final video assembly.
68. Add MP4 export.
69. Add YouTube publishing.
70. Store export records.
71. Mark project completion.

## Phase 14 — Provider Integration

72. Build API-key validation/storage.
73. Build connected-account management.
74. Add provider selection.
75. Isolate provider adapters.
76. Add account-based generation support.

## Phase 15 — Reliability and Scale

77. Add Redis after worker stability.
78. Move queueing to Redis if needed.
79. Add caching.
80. Add rate limiting.
81. Add monitoring and logging.
82. Add cleanup policies.

## Phase 16 — Polish and Harden

83. Improve loading/progress states.
84. Add autosave.
85. Add undo/redo.
86. Add validation.
87. Test end-to-end.
88. Fix edge cases.

## Recommended Build Order

1. Auth
2. Projects
3. Database schema
4. Job system
5. Script generation
6. Scene splitting
7. Image generation
8. Audio generation
9. Video generation
10. Music generation
11. Export/publish
12. Redis optimization
13. Hardening and polish

## Critical Rule

Do not build the media-generation stages before the job system, and do not build the job system before the project, scene, and output schema.

