import unittest

from sqlmodel import Session, select

from database import Batch, ConversationLog, Course, Enrollment, Invoice, Lead, LeadTransferHistory, PaymentRecord, Student, Tenant, User
from tests._support import ENGINE, main_client, reset_db, use_engine


ADMIN, SALES, ADMISSIONS_1, ADMISSIONS_2, SALES_2 = 1, 2, 3, 4, 5


class AdmissionsWorkflowTests(unittest.TestCase):
    def setUp(self):
        use_engine(self)
        reset_db()
        self.client = main_client(self)
        with Session(ENGINE) as session:
            session.add(Tenant(id=1, name="Institute"))
            session.add_all([
                User(id=ADMIN, tenant_id=1, email="admin@institute.test", password="x", name="Admin", role="Admin"),
                User(id=SALES, tenant_id=1, email="sales@institute.test", password="x", name="Sales", role="SalesManager"),
                User(id=SALES_2, tenant_id=1, email="sales2@institute.test", password="x", name="Sales Two", role="Employee"),
                User(id=ADMISSIONS_1, tenant_id=1, email="admissions1@institute.test", password="x", name="Admissions One", role="Admissions"),
                User(id=ADMISSIONS_2, tenant_id=1, email="admissions2@institute.test", password="x", name="Admissions Two", role="Admissions"),
            ])
            session.add_all([
                Lead(id=1, tenant_id=1, company_name="New Student", email="new@example.test", owner_id=SALES, status="New"),
                Student(id=1, tenant_id=1, name="Existing Student", admissions_assignee_id=ADMISSIONS_1),
                Student(id=2, tenant_id=1, name="Waiting Student"),
            ])
            course = Course(id=1, tenant_id=1, title="Web Development", price=1000)
            session.add(course)
            session.add(Batch(id=1, tenant_id=1, course_id=1, batch_name="Web Batch", max_seats=20, status="Active"))
            session.add(Enrollment(
                id=1,
                tenant_id=1,
                student_id=1,
                batch_id=1,
                course_id=1,
                total_fee=1000,
                amount_paid=200,
                amount_due=800,
                payment_status="Partial",
            ))
            session.commit()

    def req(self, method, url, user=ADMIN, **kwargs):
        return self.client.request(method, url, headers={"X-User-ID": str(user)}, **kwargs)

    def test_lead_conversion_assigns_student_to_least_loaded_admissions_user(self):
        response = self.req("POST", "/leads/1/convert-to-student", user=SALES)
        self.assertEqual(response.status_code, 200, response.text)
        student_id = response.json()["student_id"]
        with Session(ENGINE) as session:
            student = session.get(Student, student_id)
            self.assertEqual(student.admissions_assignee_id, ADMISSIONS_2)

    def test_auto_assign_distributes_unassigned_students_and_keeps_scope(self):
        response = self.req("POST", "/admissions/students/auto-assign")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["assigned"], 1)
        with Session(ENGINE) as session:
            self.assertEqual(session.get(Student, 2).admissions_assignee_id, ADMISSIONS_2)
        admissions_view = self.req("GET", "/admissions/students", user=ADMISSIONS_1)
        self.assertEqual(admissions_view.status_code, 200, admissions_view.text)
        self.assertEqual([row["id"] for row in admissions_view.json()["students"]], [1])

    def test_admissions_can_generate_invoice_and_record_a_payment(self):
        invoice_response = self.req(
            "POST",
            "/admissions/students/1/invoices",
            user=ADMISSIONS_1,
            json={"enrollment_id": 1},
        )
        self.assertEqual(invoice_response.status_code, 200, invoice_response.text)
        invoice_id = invoice_response.json()["invoice"]["id"]
        self.assertEqual(invoice_response.json()["invoice"]["status"], "Partial")
        payment_response = self.req(
            "POST",
            "/payments",
            user=ADMISSIONS_1,
            json={
                "enrollment_id": 1,
                "student_id": 1,
                "amount": 300,
                "payment_mode": "UPI",
            },
        )
        self.assertEqual(payment_response.status_code, 200, payment_response.text)
        with Session(ENGINE) as session:
            invoice = session.get(Invoice, invoice_id)
            enrollment = session.get(Enrollment, 1)
            payment = session.exec(
                select(PaymentRecord).where(PaymentRecord.enrollment_id == 1)
            ).first()
            self.assertEqual((invoice.status, enrollment.amount_paid, enrollment.amount_due), ("Partial", 500, 500))
            self.assertEqual(payment.recorded_by, ADMISSIONS_1)

    def test_lead_transfer_updates_linked_student_sales_owner(self):
        with Session(ENGINE) as session:
            lead = session.get(Lead, 1)
            lead.is_converted = True
            lead.converted_student_id = 1
            session.add(lead)
            session.commit()
        response = self.req(
            "POST",
            "/leads/transfer",
            json={
                "lead_ids": [1],
                "source_employee_id": SALES,
                "employee_id": SALES_2,
                "reason": "Account coverage change",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        with Session(ENGINE) as session:
            self.assertEqual(session.get(Lead, 1).owner_id, SALES_2)
            self.assertEqual(session.get(Student, 1).assigned_salesperson_id, SALES_2)

    def test_lead_transfer_records_reason_and_source_destination(self):
        response = self.req(
            "POST",
            "/leads/transfer",
            json={
                "lead_ids": [1],
                "source_employee_id": SALES,
                "employee_id": SALES_2,
                "reason": "Rebalancing workload",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        with Session(ENGINE) as session:
            lead = session.get(Lead, 1)
            history = session.exec(select(LeadTransferHistory)).first()
            self.assertEqual(lead.owner_id, SALES_2)
            self.assertEqual(
                (history.from_user_id, history.to_user_id, history.lead_stage, history.reason),
                (SALES, SALES_2, "New", "Rebalancing workload"),
            )
        report = self.req("GET", "/reports/lead-transfers?all_time=true")
        self.assertEqual(report.status_code, 200, report.text)
        self.assertEqual(report.json()["transfers"][0]["reason"], "Rebalancing workload")

    def test_salesperson_can_transfer_only_own_leads_and_reason_is_required(self):
        missing_reason = self.req(
            "POST",
            "/leads/transfer",
            user=SALES,
            json={"lead_ids": [1], "employee_id": SALES_2, "reason": "  "},
        )
        self.assertEqual(missing_reason.status_code, 422)
        response = self.req(
            "POST",
            "/leads/transfer",
            user=SALES,
            json={"lead_ids": [1], "employee_id": SALES_2, "reason": "Territory change"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        forbidden = self.req(
            "POST",
            "/leads/transfer",
            user=SALES_2,
            json={
                "lead_ids": [1],
                "source_employee_id": SALES,
                "employee_id": SALES,
                "reason": "Not my lead",
            },
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_sales_contribution_counts_logged_interactions_equally(self):
        with Session(ENGINE) as session:
            session.add_all([
                ConversationLog(tenant_id=1, lead_id=1, title="Call", type="call", author_id=SALES),
                ConversationLog(tenant_id=1, lead_id=1, title="Meeting", type="meeting", author_id=SALES_2),
            ])
            session.commit()
        response = self.req("GET", "/reports/sales-contribution?all_time=true")
        self.assertEqual(response.status_code, 200, response.text)
        rows = {item["user_id"]: item for item in response.json()["salespeople"]}
        self.assertEqual(response.json()["total_activities"], 2)
        self.assertEqual(rows[SALES]["contribution_percentage"], 50)
        self.assertEqual(rows[SALES_2]["contribution_percentage"], 50)


if __name__ == "__main__":
    unittest.main()
