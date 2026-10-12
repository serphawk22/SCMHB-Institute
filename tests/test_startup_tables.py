"""
The email-stack tables must appear on a database that already has the CRM's other tables: on such a
database database.create_db_and_tables() skips create_all() entirely, so main._ensure_email_tables()
(run on every startup) creates them, adds columns an older version of one of them lacks, and never
reuses an unrelated table that happens to be called "follow_ups".

    venv\\Scripts\\python -m unittest discover -s tests -t . -v
"""
import unittest
import warnings
from datetime import datetime, timezone
from unittest import mock

from sqlalchemy import inspect, text
from sqlalchemy.exc import SAWarning
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import database
from database import FollowUp, Lead, Tenant
from tests._support import load_main

EMAIL_TABLES = {"email_replies", "inbox_messages", "email_agent_profiles", "user_email_integrations", "crm_follow_ups",
                "crm_follow_up_note_scans", "email_campaigns", "email_campaign_recipients"}


class StartupTablesTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        existing = [t for name, t in SQLModel.metadata.tables.items() if name not in EMAIL_TABLES]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", SAWarning)  # leads <-> client_profiles <-> projects FK cycle
            SQLModel.metadata.create_all(self.engine, tables=existing)  # a deployed database before the port
        self.main = load_main()

    def tables(self):
        return set(inspect(self.engine).get_table_names())

    def test_existing_database_gets_the_email_tables_on_startup(self):
        with mock.patch.object(database, "engine", self.engine):
            database.create_db_and_tables()
        self.assertFalse(EMAIL_TABLES & self.tables(), "create_db_and_tables skips an existing schema")

        self.main._ensure_email_tables(self.engine)
        self.assertTrue(EMAIL_TABLES <= self.tables())
        self.assertEqual(self.main._ensure_email_tables(self.engine), [])  # idempotent on every boot
        uniques = {u["name"] for u in inspect(self.engine).get_unique_constraints("inbox_messages")}
        self.assertIn("uq_inbox_messages_mailbox_message_id", uniques)
        self.assertIn("student_id", {c["name"] for c in inspect(self.engine).get_columns("crm_follow_ups")})

    def test_an_unrelated_follow_ups_table_is_left_alone(self):
        # One SCM database already had a "follow_ups" table of a different shape; inserts used to fail on it.
        with self.engine.begin() as c:
            c.execute(text("CREATE TABLE follow_ups (id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL, note TEXT)"))
            c.execute(text("INSERT INTO follow_ups (id, lead_id, note) VALUES (1, 7, 'theirs')"))
        self.main._ensure_email_tables(self.engine)
        with Session(self.engine) as s:
            s.add(Tenant(id=1, name="Institute"))
            s.add(Lead(id=1, tenant_id=1, company_name="Asha"))
            s.add(FollowUp(tenant_id=1, lead_id=1, title="Call Asha", due_at=datetime.now(timezone.utc)))
            s.commit()
            self.assertEqual([f.title for f in s.exec(select(FollowUp)).all()], ["Call Asha"])
        with self.engine.connect() as c:
            self.assertEqual(c.execute(text("SELECT note FROM follow_ups")).scalars().all(), ["theirs"])
            self.assertEqual({r[1] for r in c.execute(text("PRAGMA table_info(follow_ups)"))}, {"id", "lead_id", "note"})

    def test_an_older_version_of_an_email_table_gets_its_missing_columns(self):
        with self.engine.begin() as c:  # inbox_messages as created before students existed
            c.execute(text("CREATE TABLE inbox_messages (id INTEGER PRIMARY KEY, tenant_id INTEGER, mailbox VARCHAR NOT NULL, "
                           "message_id VARCHAR NOT NULL, from_address VARCHAR NOT NULL, received_at DATETIME NOT NULL)"))
        added = self.main._ensure_email_tables(self.engine)
        self.assertIn("inbox_messages.student_id", added)
        self.assertIn("inbox_messages.ai_category", added)
        self.assertIn("student_id", {c["name"] for c in inspect(self.engine).get_columns("inbox_messages")})


if __name__ == "__main__":
    unittest.main()
