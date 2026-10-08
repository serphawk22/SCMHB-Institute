# Task Progress Breakdown

This is a scope snapshot of implementation visible in the current working tree. The checkboxes indicate that code or UI for the item is present; they do not certify that the item has passed acceptance testing. The repository contains many existing uncommitted changes, so this document does not claim every change was made in one session.

## Task 1: Lead Pipeline and Conversion

- [x] Update lead list and detail workflows.
- [x] Add lead-to-student conversion from the lead list.
- [x] Connect converted student profiles back to their source leads.
- [x] Add course-plan and course-interest links to lead/student workflows.
- [x] Add lead demo-session scheduling and status tracking UI/API.

## Task 2: Student Profiles and Lifecycle

- [x] Add student list and individual profile pages.
- [x] Display academic background, education level, GPA, and career goals.
- [x] Show enrollment, course progress, attendance, lead attribution, and salesperson details.
- [x] Add student notes, file uploads, and file downloads.
- [x] Add drop/reactivation workflow with required reason and improvement plan.

## Task 3: Course Catalog and Batches

- [x] Add course catalog and course detail pages.
- [x] Support course create, update, and delete through the API.
- [x] Add batch listing, filtering, detail, and roster views.
- [x] Support batch scheduling, seat capacity, course association, and status.
- [x] Add instructor assignment strategies and validation for batch creation.

## Task 4: Instructor and Learning Portals

- [x] Add instructor list and profile pages.
- [x] Display instructor expertise, qualifications, workload, and feedback ratings.
- [x] Add instructor feedback submission support.
- [x] Add role-specific teaching and learning portal routes.
- [x] Add a shared institution portal shell with role-aware navigation and sign-out.

## Task 5: Enrollment and Academic Operations

- [x] Add enrollment management screens and connect enrollments to students, courses, and batches.
- [x] Show enrollment payment status and student admission information.
- [x] Add institute session and student progress data structures/API workflows.
- [x] Track attendance and course completion metrics on student profiles.
- [x] Restrict student, instructor, and batch data based on role/access checks in the API.

## Task 6: Institute Analytics and Demo Setup

- [x] Add institute analytics route and page.
- [x] Add student, instructor, course, batch, and enrollment management routes.
- [x] Add instructor and student portal entry points to the application layout/navigation.
- [x] Add a seed script for institute demo data.
- [x] Add supporting institute login and student lifecycle components.

## Task 7: CRM Client and Competitor Workflows

- [x] Update client detail views and client overview pages.
- [x] Update client tabs for tasks, notes, files, conversations, tickets, timeline, and health.
- [x] Update AI copilot panels and client/lead header or sidebar components.
- [x] Update competitor radar pages, maps, and competitor table views.
- [x] Update related admin agent, marketplace, service, and radar pages.

## Task 8: Application-Wide UI and Navigation

- [x] Update shared sidebar, role context, footer, and application layout.
- [x] Update authentication and onboarding pages, including login and signup flows.
- [x] Update CRM and operations pages across clients, contacts, tasks, projects, billing, and reports.
- [x] Update administrative settings, telemetry, requests, and database-management pages.
- [x] Update global application styling and supporting API/database integration files.

## Verification Status

- [x] Frontend development server started successfully from the `frontend` directory on port `3000`.
- [x] Browser automation targeting `/login` completed with exit code `0`.
- [ ] Review the browser automation output/screenshots to confirm page behavior and visual rendering.
- [ ] Run focused frontend lint, typecheck, and build checks.
- [ ] Run focused backend tests for lead conversion, student lifecycle, enrollment, and role access.
