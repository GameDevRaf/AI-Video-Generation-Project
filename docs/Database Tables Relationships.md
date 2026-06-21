# Database Tables and Relationships

## 1\. Purpose

This document defines the core database tables and relationships for the AI SaaS platform. The schema is optimized for a job-based generation workflow using Supabase Postgres.

## 2\. Design Principles

* Use normalized core entities for users, projects, jobs, and outputs.
* Store generation inputs and outputs in structured form.
* Track every generation stage as a job.
* Support multiple outputs per job.
* Keep provider credentials separate from generation data.
* Design for future expansion without rewriting the schema.

## 3\. Entity Overview

Core entities:

* users
* projects
* jobs
* job\_outputs
* api\_keys
* connected\_accounts
* generations by type as logical records or subtype tables

Recommended auxiliary entities:

* scenes
* scene\_assets
* project\_settings
* job\_events
* exports
* publishing\_targets

## 4\. Core Tables

### 4.1 users

Supabase Auth manages authentication, while this table stores app-specific user profile data.

#### Columns

* id UUID, primary key, references auth.users(id)
* username text, unique, nullable
* email text, nullable or mirrored from auth
* avatar\_url text, nullable
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One user can own many projects.
* One user can own many jobs.
* One user can store many API keys or connected accounts.

\---

### 4.2 projects

Represents a creation workspace or content project.

#### Columns

* id UUID, primary key
* user\_id UUID, foreign key to users.id
* name text
* description text, nullable
* status text
* current\_stage text
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One project belongs to one user.
* One project can contain many jobs.
* One project can contain many scenes.
* One project can contain many exports.

\---

### 4.3 jobs

Represents any asynchronous generation or processing task.

#### Columns

* id UUID, primary key
* user\_id UUID, foreign key to users.id
* project\_id UUID, foreign key to projects.id
* type text

  * script
  * scene\_split
  * image\_prompt
  * image
  * audio
  * video\_prompt
  * video
  * music
  * export
  * publish
* status text

  * queued
  * processing
  * waiting\_on\_provider
  * completed
  * failed
  * retrying
* provider text, nullable
* model text, nullable
* input jsonb
* output\_summary jsonb, nullable
* error\_message text, nullable
* retry\_count integer
* created\_at timestamp
* updated\_at timestamp
* started\_at timestamp, nullable
* completed\_at timestamp, nullable

#### Relationships

* One job belongs to one user.
* One job belongs to one project.
* One job can have many outputs.
* One job can generate many job events.
* One job can be linked to one or more scenes depending on type.

\---

### 4.4 job\_outputs

Stores generated artifacts or derived outputs from a job.

#### Columns

* id UUID, primary key
* job\_id UUID, foreign key to jobs.id
* project\_id UUID, foreign key to projects.id
* type text

  * text
  * image
  * audio
  * video
  * music
  * json
  * file
* label text, nullable
* storage\_url text, nullable
* storage\_path text, nullable
* mime\_type text, nullable
* metadata jsonb, nullable
* created\_at timestamp

#### Relationships

* One job can have many outputs.
* One output belongs to one job.
* One output may be attached to a scene, a project, or a final export depending on type.

\---

### 4.5 api\_keys

Stores encrypted API keys supplied by the user.

#### Columns

* id UUID, primary key
* user\_id UUID, foreign key to users.id
* provider text
* key\_name text, nullable
* encrypted\_secret text
* is\_active boolean
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One user can store many API keys.
* Each key belongs to one provider.

\---

### 4.6 connected\_accounts

Stores linked provider accounts used for browser-based or connected-account generation.

#### Columns

* id UUID, primary key
* user\_id UUID, foreign key to users.id
* provider text
* account\_label text, nullable
* auth\_type text
* connection\_status text
* session\_reference text, nullable
* metadata jsonb, nullable
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One user can have many connected accounts.
* A connected account may be used instead of an API key for generation.

## 5\. Recommended Support Tables

### 5.1 scenes

Represents the script broken into editable scene units.

#### Columns

* id UUID, primary key
* project\_id UUID, foreign key to projects.id
* job\_id UUID, nullable, foreign key to jobs.id
* scene\_index integer
* title text, nullable
* script\_text text
* start\_time numeric or integer
* end\_time numeric or integer
* duration numeric or integer
* order\_index integer
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One project has many scenes.
* One scene can be linked to many downstream assets.
* One scene may be generated from a scene-splitting job.

\---

### 5.2 scene\_assets

Stores the image, audio, video, or music assets attached to a scene.

#### Columns

* id UUID, primary key
* scene\_id UUID, foreign key to scenes.id
* job\_output\_id UUID, foreign key to job\_outputs.id
* asset\_type text
* role text

  * first\_frame
  * voice
  * generated\_video
  * music\_bed
* created\_at timestamp

#### Relationships

* One scene can have many assets.
* One asset record points to one job output.

\---

### 5.3 project\_settings

Stores workflow settings for a project.

#### Columns

* id UUID, primary key
* project\_id UUID, foreign key to projects.id
* prompt\_edit\_mode text

  * before\_generation
  * after\_generation
* default\_image\_model text, nullable
* default\_audio\_model text, nullable
* default\_video\_model text, nullable
* default\_music\_model text, nullable
* timeline\_density text, nullable
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One project has one settings row.

\---

### 5.4 job\_events

Optional audit trail for state changes.

#### Columns

* id UUID, primary key
* job\_id UUID, foreign key to jobs.id
* event\_type text
* event\_data jsonb
* created\_at timestamp

#### Relationships

* One job can have many events.

\---

### 5.5 exports

Represents final deliverables.

#### Columns

* id UUID, primary key
* project\_id UUID, foreign key to projects.id
* job\_id UUID, nullable, foreign key to jobs.id
* export\_type text

  * mp4
  * json
  * archive
* storage\_url text
* metadata jsonb, nullable
* created\_at timestamp

#### Relationships

* One project can have many exports.
* One export may come from one export job.

\---

### 5.6 publishing\_targets

Represents connected publishing destinations such as YouTube.

#### Columns

* id UUID, primary key
* user\_id UUID, foreign key to users.id
* provider text
* account\_name text, nullable
* connection\_status text
* metadata jsonb, nullable
* created\_at timestamp
* updated\_at timestamp

#### Relationships

* One user can have many publishing targets.
* One export can be published to one or more targets.

## 6\. Relationship Summary

### One-to-Many

* users → projects
* users → jobs
* users → api\_keys
* users → connected\_accounts
* users → publishing\_targets
* projects → jobs
* projects → scenes
* projects → exports
* jobs → job\_outputs
* jobs → job\_events
* scenes → scene\_assets

### One-to-One or Optional One-to-One

* projects → project\_settings
* projects → current active generation state, if modeled separately

### Many-to-One

* job\_outputs → jobs
* scene\_assets → job\_outputs

### Many-to-Many

If needed later, some relationships can become many-to-many through join tables:

* jobs ↔ scenes
* exports ↔ publishing\_targets
* projects ↔ connected\_accounts

## 7\. Recommended Enum-Like Values

### Job types

* script
* scene\_split
* image\_prompt
* image
* audio
* video\_prompt
* video
* music
* export
* publish

### Job statuses

* queued
* processing
* waiting\_on\_provider
* completed
* failed
* retrying

### Asset types

* text
* image
* audio
* video
* music
* json
* file

### Prompt edit modes

* before\_generation
* after\_generation

## 8\. Normalized vs Practical Storage

For a production-ready MVP, keep the following data in JSONB rather than creating too many tables too early:

* generation parameters
* provider response payloads
* model settings
* scene prompt metadata
* job retry diagnostics

This keeps the schema flexible while preserving structure where it matters.

## 9\. Recommended MVP Minimum

The smallest solid schema for the first version is:

* users
* projects
* jobs
* job\_outputs
* api\_keys
* connected\_accounts
* scenes
* scene\_assets
* project\_settings

Everything else can be added later.

## 10\. Summary

The database should revolve around projects, scenes, jobs, and outputs. Jobs act as the execution record, scenes act as the editable content structure, and outputs store the generated assets. This structure supports script, image, audio, video, and music workflows while leaving room for future expansion into teams, publishing, and advanced orchestration.

