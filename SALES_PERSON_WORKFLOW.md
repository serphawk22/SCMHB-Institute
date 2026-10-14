# Salesperson Workflow

## Identity and scoping

A signed-in salesperson is resolved from the request context by reading `X-User-ID` (or JWT fallback), then the backend maps that ID to the current user and normalizes the role before any ownership checks.

The key parts are:

- `current_salesperson_id` is set in the request middleware before the route runs.
- `_normalize_role()` strips spaces, underscores, and hyphens before comparing roles.
- Student and enrollment ownership checks use `assigned_salesperson_id` or `lead.owner_id` as the salesperson boundary.

This avoids false negatives for legacy values such as `Sales Manager` or `sales-manager`.

## Student listing

Salespeople see only students that are assigned to them or linked through their owned lead.

The filter in `/students` is effectively:

- `Student.assigned_salesperson_id == actor.id`
- OR `Student.lead_id IN (SELECT Lead.id WHERE Lead.owner_id == actor.id)`

This keeps the salesperson workspace scoped to the signed-in account instead of exposing the full directory.

## Student profile access

The student detail route enforces access through `_require_student_profile_access()`.

- `Student` accounts can only open their own profile.
- `SalesManager`, `Employee`, `Sales`, and `Demo` users can only open a student when the student belongs to their assignment chain.
- `Instructor` accounts can only open students in batches assigned to their instructor record.

## Enrollment and payment access

Enrollments are scoped in `/enrollments` the same way:

- Students see only their own enrollments.
- Salespeople see only enrollments for their assigned students.
- Admin/Employee/Demo continue to see all valid enrollments.

Payments also validate the remaining balance:

- a payment must be greater than zero
- a payment must not exceed `amount_due`

## Student workspace actions

The student profile includes the enrollment actions panel for authorized roles.

Roles currently allowed to create enrollments or record payments:

- Admin
- Employee
- SalesManager
- Demo
- SuperAdmin

This panel gives sales staff a direct path to:

1. choose an open batch
2. create the enrollment record
3. record follow-up payments against that enrollment

## Verification commands

Use these checks after startup:

```bash
cd /Users/apple/Desktop/scmhub_isntane
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
curl -sS -H 'X-User-ID: 8' 'http://127.0.0.1:8000/students'
curl -sS -H 'X-User-ID: 8' 'http://127.0.0.1:8000/enrollments'
curl -sS -H 'X-User-ID: 8' 'http://127.0.0.1:8000/work-queue?date_filter=week'
```

The API should respond with the signed-in salesperson’s scoped resources, not the global pool of all students.
