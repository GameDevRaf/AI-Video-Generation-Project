# Professional User Flow Document

## 1. Purpose
This document describes the complete user journey for the AI SaaS product, from sign-up through final export or publishing. The flow is designed to support a continuous creation experience where each generation stage builds on the previous one.

## 2. Flow Principles
- The user should move through a single coherent creation workspace.
- Each stage should preserve the output of the previous stage.
- Generation steps should be editable before and after execution.
- The interface should support both quick prototyping and detailed refinement.
- The timeline should remain visible and consistent across generation stages.

## 3. Actors
### User Action (U)
An action performed directly by the user.

### App Action (M)
An action performed by the system in response to user input or state changes.

## 4. Entry and Authentication Flow

### 4.1 Landing on the Website Home Page
**U:** The user visits the website home page.

**M:** The app displays the product overview, platform value proposition, and login/sign-up entry points.

### 4.2 Sign Up or Login
**U:** The user selects either sign up or login.

**M:** The app opens the authentication form.

**U:** The user enters credentials or creates a new account.

**M:** The app authenticates the user and creates or loads the user profile.

### 4.3 Post-Login Landing
**M:** The app shows the Projects Overview page inside the user dashboard.

## 5. Project Overview Flow

### 5.1 View Projects
**M:** The dashboard displays all user projects with status, last updated time, and creation progress.

### 5.2 Create New Project
**U:** The user selects Create New Project.

**M:** The app opens the project creation workspace and initializes a new project record.

**U:** The user enters a project name and starting concept.

**M:** The app stores the project metadata and opens the Script Generation stage.

## 6. Script Generation Flow

### 6.1 Submit Idea and Tone
**U:** The user provides a script idea and tone.

**M:** The app sends the request for script generation.

### 6.2 Generate Multiple Scripts
**M:** The app generates multiple script candidates.

### 6.3 Review and Select
**U:** The user reviews the generated scripts.

**U:** The user selects one script.

**U:** The user edits the script if desired.

**U:** The user can make it (the Script LLM) refine the edited script if desired.

**M:** The app saves the chosen script as the active base script for downstream stages.

## 7. Scene Segmentation Flow

### 7.1 Generate Scenes
**M:** The app separates the script into scenes and assigns timestamps.

### 7.2 Review Scene Structure
**U:** The user reviews the scene breakdown.

### 7.3 Edit Scene Mapping
**U:** The user changes which parts of the script belong to which scenes.

**M:** The app recalculates timestamps and updates the scene structure.

### 7.4 Persist Updated Scene Plan
**M:** The revised scene plan becomes the active timeline for image, audio, and video generation.

## 8. Image Generation Flow

### 8.1 Start Image Generation
**U:** The user starts image generation.

**M:** The app generates an image prompt for each scene.

**M:** The app creates a first-frame image target per scene. The current design supports one image per scene, while preserving a future path for multiple images per scene.

### 8.2 Prompt Editing Behavior
The app supports two modes controlled by user setting:

- Mode A: The app generates the image prompt first, then the user edits the prompt before image generation.
- Mode B: The app generates the image first, then the user edits the prompt and regenerates if needed.

### 8.3 User Review
**U:** The user edits individual prompts or regenerates selected images.

**M:** The app stores the approved image assets and links them to their scenes.

## 9. Audio Generation Flow

### 9.1 Select Voice and Settings
**U:** The user selects voice and audio settings.

**M:** The app stores the selected voice profile and generation parameters.

### 9.2 Generate Audio
**U:** The user starts audio generation.

**M:** The app generates the audio track for the script.

### 9.3 Playback and Review
**M:** The app allows playback of the audio while highlighting the current script segment and displaying the image associated with the current timestamp.

### 9.4 Audio Refinement
**U:** The user edits minor details such as pause timing, tone, or pronunciation.

**U:** The user can also switch the voice if necessary.

**M:** The app regenerates the audio with the updated settings.

## 10. Video Generation Flow

### 10.1 Start Video Generation
**U:** The user starts video generation.

**M:** The app generates a video prompt for each scene or video segment.

### 10.2 Generate Scene Videos
**M:** The app combines the image, prompt, and scene duration to generate the corresponding video segment.

### 10.3 Review in Timeline
**M:** The app displays the videos in a sequential timeline with the script and audio context.

**U:** The user can mute audio or hide the highlighted script segment while reviewing.

### 10.4 Video Refinement
**U:** The user edits the prompt for a selected video segment.

**U:** The user regenerates the selected segment if needed.

**M:** The app updates the video output and keeps the timeline synchronized.

## 11. Music Generation Flow

### 11.1 Start Music Generation
**U:** The user starts music generation.

**M:** The app generates a single track or multiple tracks depending on the content length and tone.

**M:** The app may also allow the user to search for an existing music track instead of generating one.

### 11.2 Music Review
**M:** The app allows the user to preview the full video with the music track attached.

**M:** The app also allows playback of only the music track.

### 11.3 Music Editing
**U:** The user adjusts track volume globally or on a selected section.

**U:** The user may replace a track or regenerate a selected section.

**M:** The app updates the music layer and keeps the final mix in sync.

## 12. Final Review and Export Flow

### 12.1 View Final Video
**U:** The user selects the final video view.

**M:** The app displays the final video with all layers applied.

### 12.2 Export or Publish
**U:** The user chooses to export the video or publish it directly to YouTube.

**M:** The app packages the final video for export or sends it to the connected publishing account.

### 12.3 Completion
**M:** The app marks the project as completed and stores the final deliverables.

## 13. Global UI Behaviors

### 13.1 Model Selector
At the top right of the workspace, the user can change the active model used for the current generation stage.

Supported stages:
- Image
- Audio
- Video
- Music

### 13.2 Timeline
A thin minimal timeline remains visible at the bottom of the workspace for playback.

The timeline can expand when the user needs to:
- select a specific video segment
- select a specific music track
- inspect a segment for editing
- regenerate a specific output

### 13.3 Provider Connection Panel
An openable pop-up panel allows the user to:
- enter API keys
- connect provider accounts
- manage linked generation services

## 14. Settings and Provider Behavior
The app must respect user settings that affect generation order and editing behavior, including:
- whether to edit prompts before generation or after generation
- preferred provider for each generation type
- default voice profile
- default export or publishing preferences

## 15. End State
The flow ends when the user exports the final file or publishes it directly to the connected platform.

## 16. Summary
This user flow creates a seamless, guided creation workspace from script idea to final video delivery. It is designed to support iterative editing, timeline-based review, and provider flexibility while keeping the experience visually consistent and easy to understand.

