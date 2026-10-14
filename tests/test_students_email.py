"""
Students as a third record kind (D1): the student Email tab (/students/{id}/email-composer/*), inbound
mail linked to students, the Inbox "Students" filter, and follow-ups / AI note scanning on students.
Runs main.app in-process on in-memory SQLite with a fake SMTP sender and no OpenAI key.

    venv\\Scripts\\python -m unittest discover -s tests -t . -v
"""
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from sqlmodel import Session, select

from database import (
    Batch, ConversationLog, Course, EmailCampaignRecipient, EmailSettings, Enrollment, FollowUp, InboxMessage, Lead,
    LeadNote, Notification, PaymentRecord, SentEmail, Student, StudentNote, Task, Tenant, User,
)
from modules import email_ai, email_sender, followups_core as core, inbox_sync
from tests._support import ENGINE, main_client, reset_db, use_engine

ADMIN, SALES, OTHER, LEAD_OWNER, PORTAL, INSTRUCTOR, ADMIN_T2 = 1, 2, 3, 4, 5, 6, 7
NOW = datetime.now(timezone.utc)


def naive(dt):
    return dt.replace(tzinfo=None)


class StudentTestCase(unittest.TestCase):
    def setUp(self):
        use_engine(self)
        reset_db()
        self.client = main_client(self)
        p = mock.patch.dict(os.environ, {"EMAIL_CREDENTIAL_ENCRYPTION_KEY": "dGVzdC1rZXktZm9yLXVuaXQtdGVzdHMtMzJieXRlcyE="})
        p.start()
        self.addCleanup(p.stop)
        with Session(ENGINE) as s:
            s.add_all([Tenant(id=1, name="Institute", business_name="SCM HB Institute"), Tenant(id=2, name="Other")])
            s.add_all([
                User(id=ADMIN, tenant_id=1, email="admin@institute.test", password="x", name="Ada Admin", role="Admin"),
                User(id=SALES, tenant_id=1, email="sam@institute.test", password="x", name="Sam Sales", role="SalesManager"),
                User(id=OTHER, tenant_id=1, email="olga@institute.test", password="x", name="Olga", role="SalesManager"),
                User(id=LEAD_OWNER, tenant_id=1, email="lee@institute.test", password="x", name="Lee", role="Employee"),
                User(id=PORTAL, tenant_id=1, email="asha.portal@institute.test", password="x", name="Asha Rao", role="Student"),
                User(id=INSTRUCTOR, tenant_id=1, email="ines@institute.test", password="x", name="Ines", role="Instructor"),
                User(id=ADMIN_T2, tenant_id=2, email="admin@other.test", password="x", name="Other", role="Admin"),
            ])
            s.add(Lead(id=10, tenant_id=1, company_name="Asha Rao", email="asha.lead@example.test", owner_id=LEAD_OWNER,
                       status="Converted", is_converted=True, converted_student_id=1))
            s.add(Student(id=1, tenant_id=1, name="Asha Rao", email="asha@student.test", phone="+91 90000 11111",
                          user_id=PORTAL, lead_id=10, assigned_salesperson_id=SALES, course_interest="Logistics Diploma"))
            s.add(Student(id=2, tenant_id=1, name="Bina Das", email="bina@student.test", assigned_salesperson_id=OTHER))
            s.add(Student(id=3, tenant_id=2, name="Other tenant student", email="x@other.test"))
            s.add(Course(id=1, tenant_id=1, title="Logistics Diploma", price=50000))
            s.add(Batch(id=1, tenant_id=1, course_id=1, batch_name="Weekend batch"))
            s.add(Enrollment(id=1, tenant_id=1, student_id=1, batch_id=1, course_id=1, total_fee=50000, amount_paid=20000,
                             amount_due=30000, payment_status="Partial"))
            s.add(PaymentRecord(id=1, tenant_id=1, enrollment_id=1, student_id=1, amount=20000, payment_mode="UPI",
                                receipt_number="R-1"))
            s.add(Task(id=1, tenant_id=1, student_id=1, title="Collect pending documents", status="Todo"))
            s.add(Task(id=2, tenant_id=1, student_id=1, title="Old finished task", status="Done"))
            s.add(StudentNote(id=1, tenant_id=1, student_id=1, author_id=SALES,
                              content="Asked whether the weekend batch timings can change", created_at=naive(NOW - timedelta(days=2))))
            s.add(LeadNote(id=1, tenant_id=1, lead_id=10, content="Came via the open day", author_name="Lee"))
            s.add(ConversationLog(id=1, tenant_id=1, lead_id=10, title="Counselling call", type="call",
                                  description="Discussed fees and instalments"))
            s.add(SentEmail(id=1, tenant_id=1, lead_id=10, to_email="asha.lead@example.test", subject="Course brochure",
                            english_body="Here is the brochure", status="Opened", sent_at=naive(NOW - timedelta(days=5))))
            s.add(InboxMessage(id=1, tenant_id=1, mailbox="crm@institute.test", message_id="<s1@x>", from_name="Asha",
                               from_address="asha@student.test", subject="Batch timings", snippet="Can I switch to weekdays?",
                               body_text="Can I switch to weekdays?", received_at=NOW - timedelta(hours=3), student_id=1))
            s.add(EmailSettings(tenant_id=1, smtp_host="mail.institute.test", smtp_port=587, smtp_user="crm@institute.test",
                                smtp_pass="tenant-pw", from_name="SCM HB Admissions", from_email="crm@institute.test"))
            s.commit()

    def req(self, method, url, user=ADMIN, **kw):
        return self.client.request(method, url, headers={"X-User-ID": str(user)}, **kw)


class StudentEmailTabTests(StudentTestCase):
    def test_access_follows_the_students_list_rule(self):
        url = "/students/1/email-composer/context"
        for user, code in ((ADMIN, 200), (SALES, 200), (LEAD_OWNER, 200), (OTHER, 403), (PORTAL, 403), (INSTRUCTOR, 403)):
            self.assertEqual(self.req("GET", url, user=user).status_code, code, user)
        self.assertEqual(self.req("GET", "/students/99/email-composer/context").status_code, 404)
        self.assertEqual(self.req("GET", "/students/3/email-composer/context").status_code, 404)  # other tenant
        self.assertEqual(self.req("GET", "/students/3/email-composer/context", user=ADMIN_T2).status_code, 200)

    def test_context_has_recipients_enrollments_payments_tasks_notes_and_lead_history(self):
        data = self.req("GET", "/students/1/email-composer/context", user=SALES).json()
        self.assertEqual((data["record"]["type"], data["record"]["name"], data["record"]["owner"]["id"]), ("student", "Asha Rao", SALES))
        self.assertEqual([(r["email"], r["source"]) for r in data["recipients"]], [
            ("asha@student.test", "Student email"), ("asha.portal@institute.test", "Student portal login"),
            ("asha.lead@example.test", "Original lead")])
        ctx = data["context"]
        deals = {d["kind"]: d for d in ctx["deals"]}
        self.assertEqual((deals["Enrollment"]["title"], deals["Enrollment"]["status"]), ("Logistics Diploma", "Active, fees Partial"))
        self.assertIn("due 30,000.00", deals["Enrollment"]["detail"])
        self.assertEqual(deals["Payment"]["title"], "R-1")
        self.assertEqual([f["title"] for f in ctx["followups"]], ["Collect pending documents"])
        self.assertEqual({n["key"] for n in ctx["notes"]}, {"studentnote-1", "leadnote-1"})
        self.assertEqual([c["title"] for c in ctx["conversations"]], ["Counselling call"])
        self.assertEqual([e["key"] for e in ctx["emails"]], ["in-1", "out-1"])  # the student's mail + their lead's
        self.assertEqual(data["suggested_purpose"], "follow_up")

    def test_draft_prompt_is_grounded_in_the_student_record(self):
        with mock.patch.object(email_ai, "_chat_json", return_value={"subject": "Weekday batches", "body": "Hi Asha,\n\n…"}) as chat:
            r = self.req("POST", "/students/1/email-composer/draft", user=SALES, json={"purpose": "follow_up", "to": "asha@student.test"})
        self.assertEqual(r.status_code, 200, r.text)
        prompt = chat.call_args.args[1]
        for expected in ('Student "Asha Rao"', "Enrollments and payments", "due 30,000.00", "Collect pending documents",
                         "weekend batch timings", "Counselling call"):
            self.assertIn(expected, prompt)
        self.assertNotIn("Old finished task", prompt)
        self.assertIn("Recipient: Asha", prompt)

    def test_send_records_the_student_link_and_a_student_note(self):
        with mock.patch.object(email_sender, "send_email_outlook") as send:
            r = self.req("POST", "/students/1/email-composer/send", user=SALES,
                         json={"to": "asha@student.test", "subject": "Weekday batches", "body": "Hi Asha, yes you can switch."})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(send.call_args.kwargs["sender_email"], "crm@institute.test")
        key = r.json()["item"]["key"]
        self.assertEqual(r.json()["item"]["student"], {"id": 1, "name": "Asha Rao"})
        with Session(ENGINE) as s:
            sent = s.get(SentEmail, int(key[4:]))
            self.assertEqual((sent.student_id, sent.lead_id, sent.status, sent.tenant_id), (1, None, "Sent", 1))
            note = s.exec(select(StudentNote).where(StudentNote.student_id == 1).order_by(StudentNote.id.desc())).first()
            self.assertTrue(note.content.startswith("Email sent to asha@student.test: Weekday batches"))
            self.assertEqual(len(s.exec(select(ConversationLog)).all()), 1)  # nothing logged on a lead
        history = self.req("GET", "/students/1/email-composer/history", user=SALES).json()
        self.assertEqual(history["items"][0]["key"], key)
        self.assertEqual(history["stats"], {"sent": 2, "opened": 1, "replied": 0, "received": 1})
        self.assertEqual(self.req("POST", "/students/2/email-composer/send", user=SALES,
                                  json={"to": "bina@student.test", "subject": "x", "body": "y"}).status_code, 403)


class StudentInboxTests(StudentTestCase):
    def test_inbound_mail_links_by_student_email_portal_login_and_converted_lead(self):
        with Session(ENGINE) as s:
            self.assertEqual(inbox_sync.match_address(s, "ASHA@student.test", 1)["student_id"], 1)
            self.assertEqual(inbox_sync.match_address(s, "asha.portal@institute.test", 1)["student_id"], 1)
            by_lead = inbox_sync.match_address(s, "asha.lead@example.test", 1)
            self.assertEqual((by_lead["lead_id"], by_lead["student_id"]), (10, 1))
            self.assertIsNone(inbox_sync.match_address(s, "asha@student.test", 2)["student_id"])  # other tenant
            s.add(SentEmail(id=7, tenant_id=1, student_id=2, to_email="bina@student.test", subject="Hi", status="Sent",
                            sent_at=naive(NOW)))
            s.commit()
            cfg = inbox_sync.MailboxConfig("crm@institute.test", "crm@institute.test", "pw", "imap.institute.test", 1, True)
            links = inbox_sync.link_inbound(s, cfg, {"from_address": "bina@student.test", "message_id": "<r@x>"})
            self.assertEqual((links["student_id"], links["sent_email_id"]), (2, 7))

    def test_relink_picks_up_senders_who_became_students(self):
        with Session(ENGINE) as s:
            s.add(InboxMessage(id=5, tenant_id=1, mailbox="m", message_id="<n@x>", from_address="new@student.test",
                               received_at=NOW))
            s.commit()
            s.add(Student(id=9, tenant_id=1, name="New Student", email="new@student.test"))
            s.commit()
        self.assertEqual(inbox_sync.relink_unlinked(ENGINE), 1)
        with Session(ENGINE) as s:
            self.assertEqual(s.get(InboxMessage, 5).student_id, 9)

    def test_students_filter_counts_and_scoping(self):
        def keys(user=ADMIN, **params):
            return [i["key"] for i in self.req("GET", "/inbox/messages", user=user, params=params).json()["items"]]
        self.assertEqual(keys(linked="student"), ["in-1"])
        self.assertEqual(self.req("GET", "/inbox/messages").json()["items"][0]["student"], {"id": 1, "name": "Asha Rao"})
        self.assertEqual(self.req("GET", "/inbox/counts").json()["linked"]["student"], 1)
        self.assertEqual(self.req("GET", "/inbox/counts").json()["linked"]["unlinked"], 0)
        self.assertEqual(keys(user=SALES), ["in-1"])          # assigned salesperson of the student
        self.assertEqual(keys(user=LEAD_OWNER), ["in-1", "out-1"])  # owner of the lead the student came from
        self.assertEqual(keys(user=OTHER), [])
        self.assertEqual(self.req("GET", "/inbox/messages/in-1", user=OTHER).status_code, 404)

    def test_reply_from_the_inbox_keeps_the_student_link(self):
        with mock.patch.object(email_sender, "send_email_outlook"):
            r = self.req("POST", "/inbox/messages/in-1/reply", user=SALES, json={"subject": "Re: Batch timings", "body": "Yes."})
        self.assertEqual(r.status_code, 200, r.text)
        with Session(ENGINE) as s:
            self.assertEqual(s.get(SentEmail, int(r.json()["item"]["key"][4:])).student_id, 1)


class StudentFollowUpTests(StudentTestCase):
    def create(self, user=SALES, **body):
        payload = {"student_id": 1, "title": "Confirm the batch", "due_at": "2026-11-02", "tz_offset": -330}
        payload.update(body)
        return self.req("POST", "/followups", user=user, json=payload)

    def test_create_list_and_history(self):
        r = self.create(notes="Wants weekday batch")
        self.assertEqual(r.status_code, 200, r.text)
        item = r.json()["item"]
        self.assertEqual((item["student"], item["contact_email"], item["company_name"], item["assigned_to"]["id"]),
                         ({"id": 1, "name": "Asha Rao"}, "asha@student.test", "Asha Rao", SALES))
        self.assertEqual([i["id"] for i in self.req("GET", "/followups?view=all&student_id=1", user=SALES).json()["items"]], [item["id"]])
        hist = self.req("GET", "/followups/history?student_id=1", user=SALES).json()
        self.assertEqual((hist["record"]["type"], hist["record"]["name"], hist["record"]["owner_id"]), ("student", "Asha Rao", SALES))
        types = {e["type"] for e in hist["timeline"]}
        self.assertTrue({"note", "call", "email_in", "email_out", "followup"} <= types, types)
        self.assertEqual(self.create(user=OTHER).status_code, 403)
        self.assertEqual(self.create(user=PORTAL).status_code, 403)
        self.assertEqual(self.create(student_id=3, user=ADMIN).status_code, 404)  # other tenant
        self.assertEqual(self.create(lead_id=10).status_code, 400)  # one record only
        self.assertEqual(self.req("GET", "/followups?view=all", user=LEAD_OWNER).json()["total"], 1)  # lead owner's student

    def test_reminder_links_to_the_student_page(self):
        fid = self.create().json()["item"]["id"]
        with Session(ENGINE) as s:
            fu = s.get(FollowUp, fid)
            fu.due_at = fu.remind_at = NOW - timedelta(minutes=1)
            s.add(fu)
            s.commit()
        calls = []
        self.assertEqual(core.process_due_reminders(send_email=lambda acc, **kw: calls.append(kw)), 1)
        self.assertIn("/students/1?tab=followups", calls[0]["body"])
        with Session(ENGINE) as s:
            self.assertEqual(s.exec(select(Notification)).one().link, "/students/1?tab=followups")

    def test_follow_up_email_is_recorded_on_the_student(self):
        fid = self.create().json()["item"]["id"]
        with mock.patch.object(email_sender, "send_email_outlook") as send:
            r = self.req("POST", f"/followups/{fid}/send-email", user=SALES, json={"subject": "Your batch", "body": "Hi Asha"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(send.call_args.kwargs["to_email"], "asha@student.test")
        with Session(ENGINE) as s:
            sent = s.get(SentEmail, r.json()["sent_email_id"])
            self.assertEqual((sent.student_id, sent.lead_id), (1, None))
            self.assertEqual(json.loads(sent.draft_json)["source"], "follow_up")
            notes = [n.content for n in s.exec(select(StudentNote).where(StudentNote.student_id == 1)).all()]
            self.assertTrue(any(n.startswith("Follow-up email sent to asha@student.test: Your batch") for n in notes))
            self.assertEqual(s.get(FollowUp, fid).status, "Completed")

    def test_ai_scan_reads_student_notes_but_not_the_crms_own_email_notes(self):
        with Session(ENGINE) as s:
            s.add(StudentNote(id=7, tenant_id=1, student_id=1, author_id=SALES, created_at=naive(NOW),
                              content="Her father will confirm the batch and respond next week."))
            s.add(StudentNote(id=8, tenant_id=1, student_id=1, created_at=naive(NOW),
                              content="Email sent to asha@student.test: Fees\n\nPlease reply next week with your choice."))
            s.commit()
        result = core.scan_notes()
        self.assertEqual(len(result["created"]), 1)
        with Session(ENGINE) as s:
            fu = s.get(FollowUp, result["created"][0])
            self.assertEqual((fu.student_id, fu.lead_id, fu.source_ref, fu.assigned_to, fu.contact_email),
                             (1, None, "studentnote-7", SALES, "asha@student.test"))
        r = self.req("POST", "/followups/scan", user=SALES, json={"student_id": 1})
        self.assertEqual((r.status_code, r.json()["scanned"]), (200, 0))  # each note is read once


class StudentCampaignTests(StudentTestCase):
    def test_a_campaign_to_a_student_links_them_instead_of_creating_a_lead(self):
        from modules import email_campaign_worker as worker
        body = {"columns": ["Name", "Email"], "rows": [{"Name": "Asha Rao", "Email": "asha@student.test"}],
                "mapping": {"email": "Email", "name": "Name"}, "subject": "Open day", "body": "Hi {{first_name}}",
                "name": "Open day", "create_leads": True, "followup_days": 2}
        with mock.patch.object(worker, "start_campaign"):
            cid = self.req("POST", "/email-campaigns", user=SALES, json=body).json()["campaign"]["id"]
        calls = []
        worker.run_campaign(cid, sender=lambda acc, **kw: calls.append(kw), delay=0, ai=False)
        self.assertEqual(len(calls), 1)
        with Session(ENGINE) as s:
            self.assertEqual(len(s.exec(select(Lead)).all()), 1)  # no new lead for an enrolled student
            sent = s.exec(select(SentEmail).where(SentEmail.subject == "Open day")).one()
            self.assertEqual(sent.student_id, 1)
            fu = s.exec(select(FollowUp)).one()
            self.assertEqual((fu.student_id, fu.assigned_to), (1, SALES))
            self.assertEqual(s.exec(select(EmailCampaignRecipient)).one().status, "Sent")


if __name__ == "__main__":
    unittest.main()
