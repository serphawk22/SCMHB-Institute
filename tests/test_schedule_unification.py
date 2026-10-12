"""
D2: the institute's own lead follow-ups (lead_follow_ups, the leads list "Follow-up" action, Important
Dates) unified on the ported Follow-ups system, plus the institute's roles on /followups.
Runs main.app in-process (real middleware and tenant listener) on in-memory SQLite.

    venv\\Scripts\\python -m unittest discover -s tests -t . -v
"""
import unittest
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from database import ActivityLog, FollowUp, Lead, LeadFollowUp, LeadWalkIn, Notification, Student, Tenant, User
from tests._support import ENGINE, main_client, reset_db, use_engine

ADMIN, SALES, OTHER_SALES, INTERN, SALES_REP, STUDENT, INSTRUCTOR, ADMIN_T2 = 1, 2, 3, 4, 5, 6, 7, 8


def naive_utc(**delta):
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0) + timedelta(**delta)


class UnificationTestCase(unittest.TestCase):
    def setUp(self):
        use_engine(self)
        reset_db()
        self.client = main_client(self)
        with Session(ENGINE) as s:
            s.add_all([Tenant(id=1, name="Institute", business_name="SCM HB Institute"), Tenant(id=2, name="Other")])
            s.add_all([
                User(id=ADMIN, tenant_id=1, email="admin@institute.test", password="x", name="Ada Admin", role="Admin"),
                User(id=SALES, tenant_id=1, email="sam@institute.test", password="x", name="Sam Sales", role="SalesManager"),
                User(id=OTHER_SALES, tenant_id=1, email="olga@institute.test", password="x", name="Olga", role="SalesManager"),
                User(id=INTERN, tenant_id=1, email="ian@institute.test", password="x", name="Ian", role="Intern"),
                User(id=SALES_REP, tenant_id=1, email="raj@institute.test", password="x", name="Raj", role="Sales"),
                User(id=STUDENT, tenant_id=1, email="stu@institute.test", password="x", name="Stu", role="Student"),
                User(id=INSTRUCTOR, tenant_id=1, email="ines@institute.test", password="x", name="Ines", role="instructor"),
                User(id=ADMIN_T2, tenant_id=2, email="admin@other.test", password="x", name="Other", role="Admin"),
            ])
            s.add(Lead(id=1, tenant_id=1, company_name="Asha Rao", email="asha@example.test", phone="+91 90000 11111",
                       owner_id=SALES, status="New"))
            s.add(Lead(id=2, tenant_id=1, company_name="Bina Das", email="bina@example.test", owner_id=OTHER_SALES))
            s.add(Lead(id=3, tenant_id=2, company_name="Other tenant lead", owner_id=ADMIN_T2))
            s.commit()

    def req(self, method, url, user=ADMIN, **kw):
        return self.client.request(method, url, headers={"X-User-ID": str(user)}, **kw)


class LeadFollowUpEndpointTests(UnificationTestCase):
    def test_schedules_a_unified_follow_up_with_the_same_response_shape(self):
        r = self.req("POST", "/leads/1/follow-ups", user=SALES,
                     json={"scheduled_at": "2026-11-02T10:00", "notes": "Asked about weekend batches", "tz_offset": -330})
        self.assertEqual(r.status_code, 200, r.text)
        fu = r.json()["follow_up"]
        self.assertEqual(set(fu), {"id", "lead_id", "scheduled_at", "status", "notes", "created_at", "source"})
        self.assertEqual((fu["lead_id"], fu["status"], fu["notes"], fu["source"]),
                         (1, "Pending", "Asked about weekend batches", "followups"))
        self.assertEqual(fu["scheduled_at"], "2026-11-02T04:30:00+00:00")  # 10:00 in the browser's IST
        with Session(ENGINE) as s:
            row = s.get(FollowUp, fu["id"])
            self.assertEqual((row.channel, row.assigned_to, row.created_by, row.tenant_id, row.source),
                             ("call", SALES, SALES, 1, "manual"))
            self.assertEqual((row.contact_email, row.company_name), ("asha@example.test", "Asha Rao"))
            self.assertEqual(s.get(Lead, 1).status, "Follow-up")
            self.assertEqual(s.exec(select(LeadFollowUp)).all(), [])  # nothing new in the old table
            self.assertEqual(s.exec(select(ActivityLog).where(ActivityLog.lead_id == 1)).one().action, "Follow-up scheduled")
        # It is a normal follow-up from then on.
        listed = self.req("GET", "/followups?view=pending&lead_id=1", user=SALES).json()["items"]
        self.assertEqual([i["id"] for i in listed], [fu["id"]])

    def test_without_a_browser_offset_the_default_institute_time_zone_is_used(self):
        fu = self.req("POST", "/leads/1/follow-ups", user=SALES, json={"scheduled_at": "2026-11-02T10:00"}).json()["follow_up"]
        self.assertEqual(fu["scheduled_at"], "2026-11-02T04:30:00+00:00")
        aware = self.req("POST", "/leads/1/follow-ups", user=SALES, json={"scheduled_at": "2026-11-02T10:00:00Z"}).json()["follow_up"]
        self.assertEqual(aware["scheduled_at"], "2026-11-02T10:00:00+00:00")

    def test_admin_scheduling_assigns_the_lead_owner_and_notifies_them(self):
        fu = self.req("POST", "/leads/1/follow-ups", json={"scheduled_at": "2026-11-02T10:00"}).json()["follow_up"]
        with Session(ENGINE) as s:
            self.assertEqual((s.get(FollowUp, fu["id"]).assigned_to, s.get(FollowUp, fu["id"]).created_by), (SALES, ADMIN))
            note = s.exec(select(Notification)).one()
            self.assertEqual((note.user_id, note.link), (SALES, "/leads/1?tab=followups"))

    def test_access_is_unchanged(self):
        body = {"scheduled_at": "2026-11-02T10:00"}
        self.assertEqual(self.req("POST", "/leads/2/follow-ups", user=SALES, json=body).status_code, 403)  # not their lead
        self.assertEqual(self.req("POST", "/leads/3/follow-ups", json=body).status_code, 404)  # other tenant
        self.assertEqual(self.req("POST", "/leads/1/follow-ups", user=STUDENT, json=body).status_code, 403)

    def test_marking_a_lead_lost_cancels_both_kinds_of_follow_up(self):
        self.req("POST", "/leads/1/follow-ups", user=SALES, json={"scheduled_at": "2026-11-02T10:00"})
        with Session(ENGINE) as s:
            s.add(LeadFollowUp(id=9, tenant_id=1, lead_id=1, scheduled_at=naive_utc(days=1), created_by=SALES))
            s.commit()
        self.assertEqual(self.req("PATCH", "/leads/1/status", user=SALES, json={"status": "Lost"}).status_code, 200)
        with Session(ENGINE) as s:
            self.assertEqual(s.get(LeadFollowUp, 9).status, "Cancelled")
            fu = s.exec(select(FollowUp)).one()
            self.assertEqual((fu.status, fu.completed_by), ("Cancelled", SALES))


class ImportantDatesTests(UnificationTestCase):
    def setUp(self):
        super().setUp()
        with Session(ENGINE) as s:
            s.add(LeadFollowUp(id=5, tenant_id=1, lead_id=1, scheduled_at=naive_utc(days=3), notes="Old-style follow-up",
                               created_by=SALES))
            s.add(LeadWalkIn(id=6, tenant_id=1, lead_id=1, scheduled_at=naive_utc(days=2), status="Scheduled",
                             location="Front desk", created_by=SALES))
            s.add(FollowUp(id=5, tenant_id=1, lead_id=1, title="Call Asha about fees", channel="call",
                           due_at=datetime.now(timezone.utc) + timedelta(days=1), assigned_to=SALES, created_by=SALES))
            s.add(FollowUp(id=7, tenant_id=1, lead_id=1, title="Done already", status="Completed",
                           due_at=datetime.now(timezone.utc) - timedelta(days=1), assigned_to=SALES, created_by=SALES))
            s.add(FollowUp(id=8, tenant_id=1, lead_id=2, title="Bina's", due_at=datetime.now(timezone.utc) + timedelta(days=1),
                           assigned_to=OTHER_SALES, created_by=OTHER_SALES))
            s.commit()

    def items(self, user=ADMIN, **params):
        r = self.req("GET", "/schedule/upcoming", user=user, params=params)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["items"]

    def test_lists_old_and_new_follow_ups_tagged_by_source_nearest_first(self):
        mine = self.items(user=SALES)
        self.assertEqual([(i["type"], i.get("source"), i["id"]) for i in mine],
                         [("followup", "followups", 5), ("walkin", None, 6), ("followup", "legacy", 5)])
        new = mine[0]
        self.assertEqual((new["title"], new["channel"], new["lead_name"], new["status"]), ("Call Asha about fees", "call", "Asha Rao", "Pending"))
        self.assertTrue(new["scheduled_at"].endswith("+00:00"))
        self.assertEqual(len(self.items()), 4)  # admin: Bina's too
        self.assertEqual(len(self.items(user=SALES, kind="followup")), 2)
        self.assertEqual({i["id"] for i in self.items(user=SALES, kind="followup", include_done=True) if i.get("source") == "followups"}, {5, 7})

    def test_student_client_and_contact_follow_ups_show_up_with_their_record(self):
        with Session(ENGINE) as s:
            s.add(Student(id=1, tenant_id=1, name="Ravi Kumar", phone="+91 90000 22222", assigned_salesperson_id=SALES,
                          course_interest="Logistics Diploma"))
            s.add(FollowUp(id=20, tenant_id=1, student_id=1, title="Confirm Ravi's batch", assigned_to=SALES, created_by=SALES,
                           due_at=datetime.now(timezone.utc) + timedelta(days=2)))
            s.add(FollowUp(id=21, tenant_id=1, contact_name="Walk-in enquiry", contact_email="enq@example.test",
                           title="Send the brochure", assigned_to=SALES, created_by=SALES,
                           due_at=datetime.now(timezone.utc) + timedelta(days=4)))
            s.commit()
        rows = {i["id"]: i for i in self.items(user=SALES) if i.get("source") == "followups"}
        self.assertEqual(set(rows), {5, 20, 21})
        self.assertEqual((rows[20]["record"], rows[20]["lead_name"], rows[20]["phone"], rows[20]["course"], rows[20]["owner_name"]),
                         ({"type": "student", "id": 1, "name": "Ravi Kumar"}, "Ravi Kumar", "+91 90000 22222",
                          "Logistics Diploma", "Sam Sales"))
        self.assertEqual((rows[21]["record"], rows[21]["lead_name"], rows[21]["email"]), (None, "Walk-in enquiry", "enq@example.test"))
        self.assertEqual(rows[5]["record"], {"type": "lead", "id": 1, "name": "Asha Rao"})
        others = {i["id"] for i in self.items(user=OTHER_SALES) if i.get("source") == "followups"}
        self.assertEqual(others, {8})  # nothing of Sam's
        self.assertEqual({20, 21} & {i["id"] for i in self.items(user=SALES, kind="walkin")}, set())

    def test_each_source_is_updated_through_its_own_api(self):
        # legacy rows: PATCH /lead-follow-ups/{id} keeps working
        r = self.req("PATCH", "/lead-follow-ups/5", user=SALES, json={"status": "Done"})
        self.assertEqual((r.status_code, r.json()["follow_up"]["status"]), (200, "Done"))
        # new rows: /followups/{id}/complete, PATCH /followups/{id} (reschedule / cancel)
        self.assertEqual(self.req("PATCH", "/followups/5", user=SALES, json={"due_at": "2026-12-01T09:30", "tz_offset": -330}).json()["item"]["due_at"],
                         "2026-12-01T04:00:00+00:00")
        self.assertEqual(self.req("POST", "/followups/5/complete", user=SALES, json={"tz_offset": -330}).json()["item"]["status"], "Completed")
        self.assertEqual(self.req("PATCH", "/followups/8", user=OTHER_SALES, json={"status": "Cancelled"}).json()["item"]["status"], "Cancelled")
        self.assertEqual([i["id"] for i in self.items(user=SALES)], [6])


class InstituteRoleTests(UnificationTestCase):
    def test_follow_ups_follow_the_institute_roles(self):
        self.req("POST", "/leads/1/follow-ups", user=SALES, json={"scheduled_at": "2026-11-02T10:00"})
        for user in (STUDENT, INSTRUCTOR):  # "instructor" is stored lower-case
            self.assertEqual(self.req("GET", "/followups", user=user).status_code, 403, user)
            self.assertEqual(self.req("GET", "/followups/summary", user=user).status_code, 403, user)
        for user in (INTERN, SALES_REP):  # scoped: their own leads / follow-ups only
            r = self.req("GET", "/followups?view=all", user=user)
            self.assertEqual((r.status_code, r.json()["total"]), (200, 0), user)
        self.assertEqual(self.req("GET", "/followups?view=all", user=ADMIN).json()["total"], 1)
        with Session(ENGINE) as s:
            lead = s.get(Lead, 2)
            lead.owner_id = SALES_REP
            s.add(lead)
            s.commit()
        created = self.req("POST", "/followups", user=SALES_REP,
                           json={"lead_id": 2, "title": "Call Bina", "due_at": "2026-11-05", "tz_offset": -330})
        self.assertEqual(created.status_code, 200, created.text)
        self.assertEqual(self.req("GET", "/followups?view=all", user=SALES_REP).json()["total"], 1)
        assignees = {u["id"] for u in self.req("GET", "/followups/assignees").json()["users"]}
        self.assertTrue({ADMIN, SALES, INTERN, SALES_REP} <= assignees)
        self.assertFalse({STUDENT, INSTRUCTOR} & assignees)


if __name__ == "__main__":
    unittest.main()
