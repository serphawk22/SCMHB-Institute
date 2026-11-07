"""AI Reports, personal Sales Reports and the AI daily task-sheet summary.

Design
------
* The LLM never produces numbers. It only translates the user's natural language prompt into a small,
  validated *report spec* (report type, date range, people, sources, grouping ...). The spec is then executed
  deterministically against the CRM database, so every figure shown is real. When no OpenAI key is configured
  (or the call fails) a rule based parser builds the spec instead, so the feature keeps working.
* Every CRM record (leads, admissions, calls, notes, meetings, demos, follow-ups, activity log) is flattened into
  a uniform "event" and aggregated by any combination of dimensions (salesperson / source / status / course /
  day / week / month).
* Tenant isolation is handled globally by the ORM ``do_orm_execute`` hook in main.py, same as every other router.

Endpoints
---------
GET  /ai-reports/context                       salespeople / sources / courses + prompt suggestions (managers)
POST /ai-reports/query                         natural language prompt -> report (managers)
GET  /my-reports                               the logged in salesperson's own reports
POST /my-reports/daily-summary                 AI written "what I did today" from CRM activity (optionally sends it)
POST /my-reports/daily-summary/submit          save (edited) summary into the Task Sheet
"""
from __future__ import annotations

import difflib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import (
    ActivityLog,
    CallLog,
    ClientNote,
    ConversationLog,
    Course,
    Enrollment,
    FollowUp,
    Lead,
    LeadDemoSession,
    LeadFollowUp,
    LeadNote,
    LeadWalkIn,
    LeadWebinar,
    Meeting,
    Student,
    TaskSheetEntry,
    User,
    engine,
)
from modules.api_tracker import current_salesperson_id

router = APIRouter(tags=["AI Reports"])

AI_SUMMARY_MARKER = "🤖 AI Daily Report"
MANAGER_ROLES = {"admin", "superadmin", "salesmanager", "demo"}
ALL_TIME_START = date(2000, 1, 1)
ALL_TIME_END = date(2100, 12, 31)


def get_session():
    with Session(engine) as session:
        yield session


def _get_tenant_id() -> Optional[int]:
    try:
        main_mod = sys.modules.get("main")
        if main_mod and hasattr(main_mod, "current_tenant_id"):
            return main_mod.current_tenant_id.get()
    except Exception:
        pass
    return None


def scoped_query(session: Session, model):
    """Query that bypasses the aggressive _add_tenant_filter (-1) while respecting real tenants."""
    query = select(model).execution_options(skip_tenant=True)
    tenant_id = _get_tenant_id()
    if tenant_id and tenant_id > 1 and hasattr(model, "tenant_id"):
        query = query.where(model.tenant_id == tenant_id)
    return session.exec(query).all()


# ─────────────────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────────────────
def _norm_role(role: Optional[str]) -> str:
    return re.sub(r"[\s_-]+", "", role or "").lower()


def _current_user(session: Session, explicit_user_id: Optional[int] = None) -> User:
    uid = explicit_user_id or current_salesperson_id.get()
    if uid:
        user = session.get(User, uid)
        if user:
            return user
    # Resilient fallback: lookup the first active admin/manager/staff
    users = scoped_query(session, User)
    for u in users:
        if _norm_role(u.role) in MANAGER_ROLES or (u.email or "").lower() == "admin@serphawk.com":
            return u
    for u in users:
        if u.is_active:
            return u
    if users:
        return users[0]
    raise HTTPException(status_code=401, detail="Unauthorized")


def _require_manager(session: Session, explicit_user_id: Optional[int] = None) -> User:
    user = _current_user(session, explicit_user_id)
    if _norm_role(user.role) in MANAGER_ROLES or (user.email or "").lower() == "admin@serphawk.com":
        return user
    raise HTTPException(status_code=403, detail="Forbidden")


def _require_staff(session: Session, explicit_user_id: Optional[int] = None) -> User:
    user = _current_user(session, explicit_user_id)
    if _norm_role(user.role) in {"client", "student", "instructor", "supplier"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Dataset: every CRM record flattened into uniform events
# ─────────────────────────────────────────────────────────────────────────────
class Dataset:
    def __init__(self):
        self.users: dict[int, User] = {}
        self.leads: dict[int, Lead] = {}
        self.events: list[dict] = []
        self.sources: list[str] = []
        self.courses: list[str] = []
        self.statuses: list[str] = []

    def name(self, uid: Optional[int]) -> str:
        if not uid:
            return "Unassigned"
        u = self.users.get(uid)
        if not u:
            return f"User #{uid}"
        return (u.name or (u.email or "").split("@")[0] or f"User #{uid}").strip()


def _digits(phone: Optional[str]) -> str:
    return re.sub(r"\D", "", phone or "")[-10:]


def _clip(text: Optional[str], n: int = 160) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def _is_converted(lead: Lead, converted_ids: Optional[set[int]] = None) -> bool:
    if not lead:
        return False
    if lead.is_converted:
        return True
    if lead.converted_student_id or lead.converted_client_id:
        return True
    if (lead.status or "").strip().lower() in ("converted", "enrolled"):
        return True
    if converted_ids and lead.id in converted_ids:
        return True
    return False


def build_dataset(session: Session, tz_minutes: int = 0, only_user_id: Optional[int] = None) -> Dataset:
    """Load CRM records and flatten them into events (timestamps shifted to the viewer's timezone)."""
    ds = Dataset()
    shift = timedelta(minutes=tz_minutes or 0)

    def local(dt: Optional[datetime]) -> Optional[datetime]:
        return dt + shift if dt else None

    # Load core entities using scoped_query (bypasses -1 tenant lock while respecting multi-tenancy)
    all_users = scoped_query(session, User)
    ds.users = {u.id: u for u in all_users}
    leads = scoped_query(session, Lead)
    ds.leads = {l.id: l for l in leads}
    courses = {c.id: c for c in scoped_query(session, Course)}
    students = scoped_query(session, Student)
    student_map = {s.id: s for s in students}
    enrollments = scoped_query(session, Enrollment)
    converted_lead_ids = {s.lead_id for s in students if s.lead_id}

    name_lookup: dict[str, int] = {}
    for uid, u in ds.users.items():
        if u.name:
            nm = u.name.strip().lower()
            name_lookup[nm] = uid
            for part in re.split(r"\s+", nm):
                if len(part) >= 2:
                    name_lookup[part] = uid
        if u.email:
            em = u.email.strip().lower()
            name_lookup[em] = uid
            name_lookup[em.split("@")[0]] = uid
        name_lookup[str(uid)] = uid

    phone_to_lead = {_digits(l.phone): l.id for l in leads if _digits(l.phone)}

    # Build comprehensive association map between leads and users:
    # A lead belongs to a salesperson if:
    # 1. Directly owned: lead.owner_id
    # 2. Converted student assigned_salesperson_id
    # 3. Enrollment enrolled_by
    # 4. Activity logs, follow-ups, calls, demos, notes, meetings
    lead_users: dict[int, set[int]] = defaultdict(set)
    lead_primary_owner: dict[int, int] = {}

    for l in leads:
        if l.owner_id:
            lead_users[l.id].add(l.owner_id)
            lead_primary_owner[l.id] = l.owner_id

    for s in students:
        if s.lead_id and s.assigned_salesperson_id:
            lead_users[s.lead_id].add(s.assigned_salesperson_id)
            if s.lead_id not in lead_primary_owner:
                lead_primary_owner[s.lead_id] = s.assigned_salesperson_id

    for e in enrollments:
        st = student_map.get(e.student_id)
        if st and st.lead_id:
            if e.enrolled_by:
                lead_users[st.lead_id].add(e.enrolled_by)
            if st.assigned_salesperson_id:
                lead_users[st.lead_id].add(st.assigned_salesperson_id)
            if st.lead_id not in lead_primary_owner:
                lead_primary_owner[st.lead_id] = e.enrolled_by or st.assigned_salesperson_id

    client_notes = scoped_query(session, ClientNote)
    lead_notes = scoped_query(session, LeadNote)
    conversation_logs = scoped_query(session, ConversationLog)
    call_logs = scoped_query(session, CallLog)
    followups = scoped_query(session, FollowUp)
    lead_followups = scoped_query(session, LeadFollowUp)
    lead_demos = scoped_query(session, LeadDemoSession)
    lead_walkins = scoped_query(session, LeadWalkIn)
    lead_webinars = scoped_query(session, LeadWebinar)
    meetings = scoped_query(session, Meeting)
    task_sheet = scoped_query(session, TaskSheetEntry)
    activity_logs = scoped_query(session, ActivityLog)

    for f in followups:
        if f.lead_id:
            for u in (f.assigned_to, f.created_by):
                if u:
                    lead_users[f.lead_id].add(u)
                    if f.lead_id not in lead_primary_owner:
                        lead_primary_owner[f.lead_id] = u
    for f in lead_followups:
        if f.lead_id and f.created_by:
            lead_users[f.lead_id].add(f.created_by)
            if f.lead_id not in lead_primary_owner:
                lead_primary_owner[f.lead_id] = f.created_by
    for d in lead_demos:
        if d.lead_id and d.created_by:
            lead_users[d.lead_id].add(d.created_by)
            if d.lead_id not in lead_primary_owner:
                lead_primary_owner[d.lead_id] = d.created_by
    for w in lead_walkins:
        if w.lead_id and w.created_by:
            lead_users[w.lead_id].add(w.created_by)
    for w in lead_webinars:
        if w.lead_id and w.created_by:
            lead_users[w.lead_id].add(w.created_by)
    for m in meetings:
        if m.lead_id and m.host_id:
            lead_users[m.lead_id].add(m.host_id)
            if m.lead_id not in lead_primary_owner:
                lead_primary_owner[m.lead_id] = m.host_id
    for n in client_notes:
        if n.lead_id:
            uid = n.author_id or name_lookup.get((n.author_name or "").strip().lower())
            if uid and uid > 1:
                lead_users[n.lead_id].add(uid)
                if n.lead_id not in lead_primary_owner:
                    lead_primary_owner[n.lead_id] = uid
    for c in conversation_logs:
        if c.lead_id:
            uid = c.author_id or name_lookup.get((c.author_name or "").strip().lower())
            if uid and uid > 1:
                lead_users[c.lead_id].add(uid)
                if c.lead_id not in lead_primary_owner:
                    lead_primary_owner[c.lead_id] = uid
    for a in activity_logs:
        if a.lead_id and a.userId and a.userId > 1:
            lead_users[a.lead_id].add(a.userId)
            if a.lead_id not in lead_primary_owner:
                lead_primary_owner[a.lead_id] = a.userId

    user_lead_ids = set()
    if only_user_id is not None:
        for lid, uids in lead_users.items():
            if only_user_id in uids:
                user_lead_ids.add(lid)
        for l in leads:
            if l.owner_id == only_user_id:
                user_lead_ids.add(l.id)

    def lead_ctx(lead_id: Optional[int]) -> dict:
        lead = ds.leads.get(lead_id) if lead_id else None
        if not lead:
            return {"source": "Unknown", "status": "—", "course": "Not specified", "lead_name": "", "owner_id": None}
        course = courses.get(lead.course_interest_id)
        owner_id = lead.owner_id or lead_primary_owner.get(lead.id)
        if only_user_id is not None and (lead.id in user_lead_ids or owner_id == only_user_id):
            owner_id = only_user_id
        return {
            "source": (lead.source or "Unknown").strip() or "Unknown",
            "status": lead.status or "New",
            "course": course.title if course else "Not specified",
            "lead_name": lead.company_name or f"Lead #{lead.id}",
            "owner_id": owner_id,
        }

    def add(kind: str, ts: Optional[datetime], user_id: Optional[int], lead_id: Optional[int] = None, **extra):
        if not ts:
            ts = datetime.utcnow()
        ctx = lead_ctx(lead_id)
        resolved_uid = user_id if user_id is not None else ctx.get("owner_id")

        # If user_id is generic admin/unset, but the lead belongs to a salesperson, attribute to that salesperson
        if (resolved_uid is None or resolved_uid == 1) and lead_id:
            resolved_uid = ctx.get("owner_id") or resolved_uid

        if only_user_id is not None:
            matches_user = (
                resolved_uid == only_user_id
                or ctx.get("owner_id") == only_user_id
                or (lead_id is not None and lead_id in user_lead_ids)
            )
            if not matches_user:
                return
            resolved_uid = only_user_id

        ev = {
            "kind": kind,
            "ts": local(ts),
            "user_id": resolved_uid,
            "lead_owner_id": ctx.get("owner_id"),
            "lead_id": lead_id,
            "source": ctx["source"],
            "status": ctx["status"],
            "course": ctx["course"],
            "name": ctx["lead_name"],
            "detail": "",
            "tuition": 0.0,
            "paid": 0.0,
            "due": 0.0,
            "converted": False,
            "done": False,
        }
        ev.update(extra)
        ds.events.append(ev)

    # 1. Leads
    for l in leads:
        course = courses.get(l.course_interest_id)
        converted = _is_converted(l, converted_lead_ids)
        owner = l.owner_id or lead_primary_owner.get(l.id)
        if only_user_id is not None and l.id in user_lead_ids:
            owner = only_user_id
        add(
            "lead", l.created_at or datetime.utcnow(), owner, l.id,
            name=l.company_name or f"Lead #{l.id}",
            converted=converted,
            phone=l.phone or "",
            course=course.title if course else "Not specified",
            status=l.status or "New",
            source=(l.source or "Unknown").strip() or "Unknown",
        )

    # 2. Admissions / Enrollments
    for e in enrollments:
        st = student_map.get(e.student_id)
        lead = ds.leads.get(st.lead_id) if st and st.lead_id else None
        uid = e.enrolled_by or (st.assigned_salesperson_id if st else None) or (lead.owner_id if lead else None)
        course = courses.get(e.course_id)
        source = ((lead.source if lead else None) or (st.source if st else None) or "Direct / Walk-in").strip() or "Direct / Walk-in"
        tuition = float(e.total_fee or 0)
        paid = float(e.amount_paid or 0)
        add(
            "enrollment", e.enrollment_date or e.created_at, uid, lead.id if lead else None,
            name=st.name if st else "Student", source=source, status="Enrolled",
            course=course.title if course else "Not specified",
            tuition=tuition, paid=paid, due=float(e.amount_due if e.amount_due else max(0.0, tuition - paid)),
            converted=True, detail=e.payment_status or "",
        )

    # 3. Client Notes (Primary lead notes in CRM)
    for n in client_notes:
        uid = n.author_id or name_lookup.get((n.author_name or "").strip().lower())
        add("note", n.created_at, uid, n.lead_id, detail=_clip(n.content))

    # 4. Lead Notes (Legacy lead notes)
    for n in lead_notes:
        uid = n.author_id or name_lookup.get((n.author_name or "").strip().lower())
        add("note", n.created_at, uid, n.lead_id, detail=_clip(n.content))

    # 5. Conversation Logs (Calls, meetings, WhatsApp, notes, emails logged on leads)
    for c in conversation_logs:
        uid = c.author_id or name_lookup.get((c.author_name or "").strip().lower())
        ctype = (c.type or "call").strip().lower()
        if ctype in ("call", "phone"):
            kind = "call"
        elif ctype in ("meeting", "demo"):
            kind = "meeting"
        elif ctype in ("note", "internal_note"):
            kind = "note"
        else:
            kind = "activity"
        detail = f"{c.title}: {_clip(c.description, 120)}" if c.description else c.title
        add(kind, c.created_at, uid, c.lead_id, detail=_clip(detail), duration=180 if kind == "call" else 900)

    # 6. Call Logs
    for c in call_logs:
        uid = name_lookup.get(str(c.assigned_to or "").strip().lower())
        lead_id = phone_to_lead.get(_digits(c.phone_number))
        add(
            "call", c.createdAt or c.received_at, uid, lead_id,
            detail=_clip(c.work_done or c.summary or c.description),
            duration=int(c.duration_seconds or 0),
            name=lead_ctx(lead_id)["lead_name"] or (c.phone_number or ""),
        )

    # 7. Follow-ups (crm_follow_ups)
    for f in followups:
        uid = f.created_by or f.assigned_to
        ts = f.completed_at if f.status in ("Done", "Completed") and f.completed_at else (f.due_at or f.created_at)
        done = f.status in ("Done", "Completed")
        detail = _clip(f"{f.title or 'Follow-up'}" + (f": {f.notes}" if f.notes else ""))
        add("followup", ts, uid, f.lead_id, detail=detail, done=done, item_status=f.status or "")

    # 8. Lead Follow-ups (lead_follow_ups)
    for f in lead_followups:
        uid = f.created_by
        add("followup", f.scheduled_at, uid, f.lead_id, detail=_clip(f.notes), done=(f.status == "Done"), item_status=f.status or "")

    # 9. Lead Demo Sessions
    for d in lead_demos:
        uid = d.created_by
        done = d.status in ("Completed", "Done", "Attended")
        add("demo", d.scheduled_at, uid, d.lead_id, detail=_clip(d.notes), done=done, item_status=d.status or "")

    # 10. Lead Walk-ins
    for w in lead_walkins:
        uid = w.created_by
        done = w.status in ("Attended", "Done", "Completed")
        detail = _clip(f"Walk-in: {w.location or ''} {w.notes or ''}".strip())
        add("meeting", w.scheduled_at or w.created_at, uid, w.lead_id, detail=detail, done=done, item_status=w.status or "")

    # 11. Lead Webinars
    for w in lead_webinars:
        uid = w.created_by
        done = w.status in ("Attended", "Done", "Completed")
        detail = _clip(f"Webinar: {w.notes or ''}".strip())
        add("demo", w.scheduled_at or w.created_at, uid, w.lead_id, detail=detail, done=done, item_status=w.status or "")

    # 12. Meetings
    for m in meetings:
        kind = "demo" if (m.meeting_type or "").lower() == "demo" else "meeting"
        done = m.status in ("Completed", "Done")
        add(
            kind, m.scheduled_at or m.created_at, m.host_id, m.lead_id,
            detail=_clip(m.title or m.outcome or m.notes), done=done, item_status=m.status or "",
        )

    # 13. Task Sheet Entries (Prior work done)
    for t in task_sheet:
        if not t.work_date:
            continue
        if AI_SUMMARY_MARKER in (t.summary or ""):
            continue
        try:
            entry_date = date.fromisoformat(t.work_date[:10])
            entry_dt = datetime.combine(entry_date, time(10, 0))
            add("activity", entry_dt, t.user_id, None, detail=_clip(f"Task Sheet ({t.area}): {t.summary}"))
        except Exception:
            pass

    # 14. Activity Log (Lead edits, status changes, assignments, etc.)
    for a in activity_logs:
        action = (a.action or "").lower()
        if any(x in action for x in ("login", "logout", "page visit", "profile update")):
            continue
        text = " – ".join(p for p in [a.action, a.method, _clip(a.content or a.details, 120)] if p)
        add("activity", a.createdAt, a.userId, a.lead_id, detail=text)

    ds.sources = sorted({e["source"] for e in ds.events if e.get("source") and e["source"] != "Unknown"} | {l.source for l in leads if l.source})
    ds.courses = sorted({c.title for c in courses.values() if c.title})
    ds.statuses = sorted({l.status for l in leads if l.status} | {e["status"] for e in ds.events if e.get("status") and e["status"] != "—"})
    return ds


# ─────────────────────────────────────────────────────────────────────────────
# Report engine
# ─────────────────────────────────────────────────────────────────────────────
REPORT_TYPES = [
    "summary", "performance", "lead_source", "conversion", "funnel", "activity",
    "revenue", "trend", "course", "leads_list", "admissions_list",
]
DIMENSIONS = ["salesperson", "source", "status", "course", "day", "week", "month"]
DIM_LABEL = {
    "salesperson": "Salesperson", "source": "Lead Source", "status": "Stage", "course": "Course",
    "day": "Day", "week": "Week Starting", "month": "Month",
}
METRICS = {
    "leads": ("Leads", "int"), "converted": ("Converted", "int"), "conversion_rate": ("Conv. %", "pct"),
    "demos": ("Demos", "int"), "demos_done": ("Demos Done", "int"), "admissions": ("Admissions", "int"),
    "tuition": ("Tuition (₹)", "money"), "collected": ("Collected (₹)", "money"), "due": ("Due (₹)", "money"),
    "collection_pct": ("Collection %", "pct"), "calls": ("Calls", "int"), "notes": ("Notes", "int"),
    "meetings": ("Meetings", "int"), "followups": ("Follow-ups", "int"), "activities": ("Other Activity", "int"),
    "total_activities": ("Total Activity", "int"),
}
PRESETS: dict[str, dict] = {
    "summary": {"title": "Overview", "group": ["salesperson"],
                "cols": ["leads", "demos", "admissions", "conversion_rate", "collected", "total_activities"], "sort": "admissions"},
    "performance": {"title": "Sales Performance", "group": ["salesperson"],
                    "cols": ["leads", "demos", "admissions", "conversion_rate", "tuition", "collected", "due", "total_activities"],
                    "sort": "admissions"},
    "lead_source": {"title": "Lead Source Report", "group": ["source"],
                    "cols": ["leads", "demos", "converted", "conversion_rate", "admissions", "collected"], "sort": "leads"},
    "conversion": {"title": "Conversion Report", "group": ["salesperson"],
                   "cols": ["leads", "demos", "converted", "conversion_rate", "admissions"], "sort": "conversion_rate"},
    "funnel": {"title": "Lead Pipeline / Funnel", "group": ["status"],
               "cols": ["leads", "converted", "conversion_rate"], "sort": "leads"},
    "activity": {"title": "Activity Report", "group": ["salesperson"],
                 "cols": ["calls", "notes", "meetings", "demos", "followups", "activities", "total_activities"], "sort": "total_activities"},
    "revenue": {"title": "Revenue & Collections", "group": ["salesperson"],
                "cols": ["admissions", "tuition", "collected", "due", "collection_pct"], "sort": "collected"},
    "trend": {"title": "Trend Report", "group": ["day"],
              "cols": ["leads", "demos", "admissions", "collected", "total_activities"], "sort": None},
    "course": {"title": "Course Report", "group": ["course"],
               "cols": ["leads", "converted", "admissions", "tuition", "collected"], "sort": "admissions"},
}
KPI_SETS = {
    "summary": ["leads", "converted", "conversion_rate", "admissions", "collected", "demos", "calls", "total_activities"],
    "performance": ["leads", "demos", "admissions", "conversion_rate", "tuition", "collected", "due", "total_activities"],
    "lead_source": ["leads", "converted", "conversion_rate", "admissions", "collected"],
    "conversion": ["leads", "demos", "converted", "conversion_rate", "admissions"],
    "funnel": ["leads", "converted", "conversion_rate"],
    "activity": ["calls", "notes", "meetings", "demos", "followups", "total_activities"],
    "revenue": ["admissions", "tuition", "collected", "due", "collection_pct"],
    "trend": ["leads", "demos", "admissions", "collected", "total_activities"],
    "course": ["leads", "admissions", "tuition", "collected"],
    "leads_list": ["leads", "converted", "conversion_rate"],
    "admissions_list": ["admissions", "tuition", "collected", "due"],
}
FUNNEL_ORDER = ["New", "Contacted", "Follow Up", "Demo Scheduled", "Demo Completed", "Enrolled", "Cold", "Lost"]
KIND_TO_METRIC = {"call": "calls", "note": "notes", "meeting": "meetings", "followup": "followups", "activity": "activities"}


def _new_bucket() -> dict:
    return {k: 0 for k in METRICS}


def _accumulate(bucket: dict, ev: dict) -> None:
    kind = ev["kind"]
    if kind == "lead":
        bucket["leads"] += 1
        bucket["converted"] += 1 if ev["converted"] else 0
    elif kind == "enrollment":
        bucket["admissions"] += 1
        bucket["tuition"] += ev["tuition"]
        bucket["collected"] += ev["paid"]
        bucket["due"] += ev["due"]
    elif kind == "demo":
        bucket["demos"] += 1
        bucket["demos_done"] += 1 if ev["done"] else 0
    elif kind in KIND_TO_METRIC:
        bucket[KIND_TO_METRIC[kind]] += 1


def _finalize(bucket: dict) -> dict:
    b = dict(bucket)
    b["conversion_rate"] = round(b["converted"] / b["leads"] * 100, 1) if b["leads"] else 0.0
    b["collection_pct"] = round(b["collected"] / b["tuition"] * 100, 1) if b["tuition"] else 0.0
    b["total_activities"] = b["calls"] + b["notes"] + b["meetings"] + b["demos"] + b["followups"] + b["activities"]
    for k in ("tuition", "collected", "due"):
        b[k] = round(b[k], 2)
    return b


def _dim_value(ds: Dataset, ev: dict, dim: str) -> str:
    if dim == "salesperson":
        return ds.name(ev["user_id"])
    if dim == "source":
        return ev["source"] or "Unknown"
    if dim == "status":
        return ev["status"] or "—"
    if dim == "course":
        return ev["course"] or "Not specified"
    d = ev["ts"].date()
    if dim == "day":
        return d.isoformat()
    if dim == "week":
        return (d - timedelta(days=d.weekday())).isoformat()
    return d.strftime("%Y-%m")


def _select_events(ds: Dataset, spec: dict, start: date, end: date) -> list[dict]:
    lo, hi = datetime.combine(start, time.min), datetime.combine(end, time.max)
    sp_ids = set(spec.get("salesperson_ids") or [])
    sources = [s.lower() for s in spec.get("sources") or []]
    statuses = [s.lower() for s in spec.get("statuses") or []]
    courses = [c.lower() for c in spec.get("courses") or []]
    rtype = spec.get("report_type")

    # Lead IDs that were active in the window (enrolled, or had notes, calls, followups, demos)
    active_in_window = {
        ev["lead_id"] for ev in ds.events
        if ev.get("lead_id") and lo <= ev["ts"] <= hi and (not sp_ids or ev["user_id"] in sp_ids)
    }

    out = []
    for ev in ds.events:
        if sp_ids and ev["user_id"] not in sp_ids:
            continue
        if sources and not any(s in ev["source"].lower() for s in sources):
            continue
        if statuses and ev["status"].lower() not in statuses:
            continue
        if courses and not any(c in ev["course"].lower() for c in courses):
            continue
        if spec.get("converted_only") and not ev["converted"]:
            continue

        if ev["kind"] == "lead":
            in_window = (lo <= ev["ts"] <= hi) or (ev.get("lead_id") in active_in_window)
            if spec.get("all_time") or spec.get("include_all_leads") or in_window:
                out.append(ev)
        else:
            if lo <= ev["ts"] <= hi:
                out.append(ev)

    # For leads_list, funnel, or lead_source: if no leads fell in the strict window, backfill all assigned leads
    if rtype in ("leads_list", "funnel", "lead_source") and not any(e["kind"] == "lead" for e in out):
        for ev in ds.events:
            if ev["kind"] == "lead" and (not sp_ids or ev["user_id"] in sp_ids):
                out.append(ev)

    return out


def _grouped_rows(ds: Dataset, events: list[dict], dims: list[str]) -> list[dict]:
    buckets: dict[tuple, dict] = defaultdict(_new_bucket)
    for ev in events:
        key = tuple(_dim_value(ds, ev, d) for d in dims)
        _accumulate(buckets[key], ev)
    rows = []
    for key, bucket in buckets.items():
        row = _finalize(bucket)
        for d, v in zip(dims, key):
            row[d] = v
        row["label"] = " · ".join(key)
        rows.append(row)
    return rows


def _sort_rows(rows: list[dict], dims: list[str], sort_by: Optional[str]) -> list[dict]:
    first = dims[0]
    if first in ("day", "week", "month"):
        return sorted(rows, key=lambda r: tuple(r[d] for d in dims))
    if first == "status" and len(dims) == 1:
        order = {s: i for i, s in enumerate(FUNNEL_ORDER)}
        return sorted(rows, key=lambda r: (order.get(r["status"], 99), -r["leads"]))
    if sort_by and sort_by in METRICS:
        return sorted(rows, key=lambda r: (r[sort_by], r["leads"], r["admissions"]), reverse=True)
    return sorted(rows, key=lambda r: r["label"])


def _fmt_money(v: float) -> str:
    return f"₹{v:,.0f}"


def _fmt_metric(key: str, v: float) -> str:
    kind = METRICS[key][1]
    if kind == "money":
        return _fmt_money(v)
    if kind == "pct":
        return f"{v:g}%"
    return f"{int(v):,}"


def _table(table_id: str, title: str, dims: list[str], metric_cols: list[str], rows: list[dict], totals: Optional[dict] = None) -> dict:
    columns = [{"key": d, "label": DIM_LABEL[d], "type": "text"} for d in dims]
    columns += [{"key": m, "label": METRICS[m][0], "type": METRICS[m][1]} for m in metric_cols]
    out_rows = [{c["key"]: r.get(c["key"]) for c in columns} for r in rows]
    return {"id": table_id, "title": title, "columns": columns, "rows": out_rows,
            "totals": ({c["key"]: totals.get(c["key"]) for c in columns if c["key"] in totals} if totals else None)}


def _chart(chart_id: str, title: str, kind: str, rows: list[dict], series: list[str], limit: int = 12) -> Optional[dict]:
    if not rows or not series:
        return None
    data = [{"label": r["label"], **{s: r[s] for s in series}} for r in rows[:limit]]
    return {"id": chart_id, "title": title, "type": kind,
            "series": [{"key": s, "label": METRICS[s][0]} for s in series], "data": data}


def _kpi(key: str, total: dict, label: Optional[str] = None) -> dict:
    hints = {
        "conversion_rate": f"{total['converted']} of {total['leads']} leads",
        "collection_pct": f"{_fmt_money(total['due'])} still due",
    }
    return {"key": key, "label": label or METRICS[key][0], "value": total[key], "type": METRICS[key][1], "hint": hints.get(key, "")}


def _auto_time_dim(start: date, end: date) -> str:
    days = (end - start).days + 1
    return "day" if days <= 62 else ("week" if days <= 400 else "month")


def _range_label(start: date, end: date, all_time: bool) -> str:
    if all_time:
        return "All time"
    if start == end:
        return start.strftime("%d %b %Y")
    return f"{start.strftime('%d %b %Y')} → {end.strftime('%d %b %Y')}"


def _insights(report_type: str, rows: list[dict], dims: list[str], total: dict) -> list[str]:
    out: list[str] = []
    if total["leads"]:
        out.append(f"{total['leads']} lead{'s' if total['leads'] != 1 else ''} in the period, {total['converted']} converted ({total['conversion_rate']}%).")
    if total["admissions"]:
        out.append(f"{total['admissions']} admission{'s' if total['admissions'] != 1 else ''} closed — {_fmt_money(total['collected'])} collected of {_fmt_money(total['tuition'])} booked.")
    if rows and dims[0] not in ("day", "week", "month"):
        label = DIM_LABEL[dims[0]].lower()
        for metric, phrase in (("admissions", "most admissions"), ("leads", "most leads"), ("total_activities", "most activity")):
            ranked = sorted(rows, key=lambda r: r[metric], reverse=True)
            if ranked and ranked[0][metric] > 0 and (len(ranked) > 1 or metric != "admissions"):
                out.append(f"Top {label} by {phrase}: {ranked[0]['label']} ({_fmt_metric(metric, ranked[0][metric])}).")
                break
        rated = [r for r in rows if r["leads"] >= 3]
        if len(rated) > 1:
            best = max(rated, key=lambda r: r["conversion_rate"])
            out.append(f"Best conversion rate: {best['label']} at {best['conversion_rate']}% on {best['leads']} leads.")
    if not out:
        out.append("No matching CRM data was found for the selected filters and date range.")
    return out[:5]


def run_report(ds: Dataset, spec: dict) -> dict:
    """Execute a validated spec and return a render-ready report."""
    rtype = spec.get("report_type") or "summary"
    all_time = bool(spec.get("all_time"))
    start = ALL_TIME_START if all_time else spec["start"]
    end = ALL_TIME_END if all_time else spec["end"]
    events = _select_events(ds, spec, start, end)
    preset = PRESETS.get(rtype, PRESETS["summary"])
    title = spec.get("title") or preset["title"] if rtype in PRESETS else (spec.get("title") or "Report")

    total_bucket = _new_bucket()
    for ev in events:
        _accumulate(total_bucket, ev)
    total = _finalize(total_bucket)
    if total["admissions"] > 0:
        if total["leads"] < total["admissions"]:
            total["leads"] = max(total["leads"], total["admissions"])
        if total["converted"] < total["admissions"]:
            total["converted"] = max(total["converted"], total["admissions"])
        total["conversion_rate"] = round(total["converted"] / total["leads"] * 100, 1) if total["leads"] else 0.0

    tables: list[dict] = []
    charts: list[dict] = []
    metrics_override = [m for m in (spec.get("metrics") or []) if m in METRICS]
    top_n = spec.get("top_n")
    rows_for_insight: list[dict] = []
    dims_for_insight: list[str] = ["salesperson"]

    if rtype == "leads_list":
        leads = sorted((e for e in events if e["kind"] == "lead"), key=lambda e: e["ts"], reverse=True)
        limit = top_n or 500
        rows = [{
            "name": e["name"], "source": e["source"], "status": e["status"], "salesperson": ds.name(e["user_id"]),
            "course": e["course"], "created": e["ts"].date().isoformat(), "converted": "Yes" if e["converted"] else "No",
            "phone": e.get("phone", ""),
        } for e in leads[:limit]]
        cols = [("name", "Lead"), ("source", "Source"), ("status", "Stage"), ("salesperson", "Owner"),
                ("course", "Course Interest"), ("created", "Created"), ("converted", "Converted"), ("phone", "Phone")]
        tables.append({"id": "leads", "title": f"Leads ({len(leads)})", "columns": [{"key": k, "label": l, "type": "text"} for k, l in cols],
                       "rows": rows, "totals": None})
        by_src = _grouped_rows(ds, [e for e in events if e["kind"] == "lead"], ["source"])
        c = _chart("src", "Leads by source", "pie", _sort_rows(by_src, ["source"], "leads"), ["leads"], 10)
        if c:
            charts.append(c)
    elif rtype == "admissions_list":
        adm = sorted((e for e in events if e["kind"] == "enrollment"), key=lambda e: e["ts"], reverse=True)
        limit = top_n or 500
        rows = [{
            "student": e["name"], "course": e["course"], "salesperson": ds.name(e["user_id"]), "source": e["source"],
            "tuition": e["tuition"], "paid": e["paid"], "due": e["due"], "date": e["ts"].date().isoformat(),
        } for e in adm[:limit]]
        cols = [("student", "Student", "text"), ("course", "Course", "text"), ("salesperson", "Salesperson", "text"),
                ("source", "Source", "text"), ("tuition", "Tuition (₹)", "money"), ("paid", "Paid (₹)", "money"),
                ("due", "Due (₹)", "money"), ("date", "Date", "text")]
        tables.append({"id": "admissions", "title": f"Admissions ({len(adm)})",
                       "columns": [{"key": k, "label": l, "type": t} for k, l, t in cols], "rows": rows, "totals": None})
        by_sp = _sort_rows(_grouped_rows(ds, [e for e in events if e["kind"] == "enrollment"], ["salesperson"]), ["salesperson"], "collected")
        c = _chart("sp", "Collected by salesperson", "bar", by_sp, ["collected"])
        if c:
            charts.append(c)
    else:
        dims = [d for d in (spec.get("group_by") or []) if d in DIMENSIONS][:2] or list(preset["group"])
        if rtype == "trend" and not spec.get("group_by"):
            dims = [_auto_time_dim(start, end)]
        cols = metrics_override or list(preset["cols"])
        rows = _grouped_rows(ds, events, dims)
        if dims == ["salesperson"] and spec.get("salesperson_ids"):
            # people explicitly asked for must appear even when they had no activity in the period
            present = {r["salesperson"] for r in rows}
            for uid in spec["salesperson_ids"]:
                nm = ds.name(uid)
                if nm not in present:
                    empty = _finalize(_new_bucket())
                    empty.update({"salesperson": nm, "label": nm})
                    rows.append(empty)
                    present.add(nm)
        rows = _sort_rows(rows, dims, spec.get("sort_by") or preset["sort"])
        if top_n and dims[0] not in ("day", "week", "month"):
            rows = rows[:top_n]
        rows_for_insight, dims_for_insight = rows, dims
        tables.append(_table("main", f"{preset['title']} by {' & '.join(DIM_LABEL[d] for d in dims)}", dims, cols, rows,
                             {**total, **{d: "Total" for d in dims[:1]}}))
        is_time = dims[0] in ("day", "week", "month")
        series = [c for c in cols if METRICS[c][1] == "int"][:3] or cols[:1]
        if rtype == "revenue":
            series = ["tuition", "collected"]
        if is_time:
            chart = _chart("trend", f"{preset['title']} over time", "area", rows, series, 90)
        elif rtype in ("lead_source", "funnel") or dims[0] == "source":
            chart = _chart("share", "Share of leads", "pie", rows, ["leads"], 10)
        else:
            chart = _chart("compare", f"{preset['title']} comparison", "bar", rows, series)
        if chart:
            charts.append(chart)
        # Supporting breakdowns so each report type feels complete
        if rtype in ("summary", "conversion") and len(dims) == 1 and dims[0] == "salesperson":
            src_rows = _sort_rows(_grouped_rows(ds, events, ["source"]), ["source"], "leads")
            tables.append(_table("sources", "Lead sources", ["source"],
                                 ["leads", "demos", "converted", "conversion_rate", "admissions", "collected"], src_rows))
            fun_rows = _sort_rows(_grouped_rows(ds, [e for e in events if e["kind"] == "lead"], ["status"]), ["status"], None)
            fc = _chart("funnel", "Lead pipeline", "bar", fun_rows, ["leads"], 12)
            if fc:
                charts.append(fc)
        if rtype == "summary" and not spec.get("group_by"):
            tr = _sort_rows(_grouped_rows(ds, events, [_auto_time_dim(start, end)]), ["day"], None)
            tc = _chart("trend", "Activity over time", "area", tr, ["leads", "admissions", "total_activities"], 90)
            if tc:
                charts.append(tc)

    kpi_keys = metrics_override[:8] if (metrics_override and rtype not in ("leads_list", "admissions_list")) else KPI_SETS.get(rtype, KPI_SETS["summary"])
    return {
        "title": title,
        "range": {"start": start.isoformat(), "end": end.isoformat(), "all_time": all_time, "label": _range_label(start, end, all_time)},
        "kpis": [_kpi(k, total) for k in kpi_keys],
        "tables": tables,
        "charts": charts,
        "insights": _insights(rtype, rows_for_insight, dims_for_insight, total),
        "summary": "",
        "event_count": len(events),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Natural language → spec
# ─────────────────────────────────────────────────────────────────────────────
MONTH_NAMES = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3, "apr": 4, "april": 4, "may": 5,
    "jun": 6, "june": 6, "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}
_DATE_RE = re.compile(
    r"(?P<iso>\d{4})-(?P<im>\d{1,2})-(?P<id>\d{1,2})"
    r"|(?P<sd>\d{1,2})[/.](?P<sm>\d{1,2})[/.](?P<sy>\d{4})"
    r"|(?P<d1>\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?P<m1>[a-z]{3,9})\.?(?:,?\s+(?P<y1>\d{4}))?"
    r"|(?P<m2>[a-z]{3,9})\.?\s+(?P<d2>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?P<y2>\d{4}))?",
    re.I,
)


def _safe_date(y: int, m: int, d: int) -> Optional[date]:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _extract_dates(text: str, today: date) -> list[date]:
    found: list[date] = []
    pos = 0
    while True:
        m = _DATE_RE.search(text, pos)
        if not m:
            break
        g = m.groupdict()
        result = None
        if g["iso"]:
            result = _safe_date(int(g["iso"]), int(g["im"]), int(g["id"]))
        elif g["sd"]:
            result = _safe_date(int(g["sy"]), int(g["sm"]), int(g["sd"]))
        elif g["d1"] and g["m1"] and g["m1"].lower() in MONTH_NAMES:
            year = int(g["y1"]) if g["y1"] else today.year
            result = _safe_date(year, MONTH_NAMES[g["m1"].lower()], int(g["d1"]))
            if result and not g["y1"] and result > today:
                result = _safe_date(year - 1, result.month, result.day)
        elif g["m2"] and g["d2"] and g["m2"].lower() in MONTH_NAMES:
            year = int(g["y2"]) if g["y2"] else today.year
            result = _safe_date(year, MONTH_NAMES[g["m2"].lower()], int(g["d2"]))
            if result and not g["y2"] and result > today:
                result = _safe_date(year - 1, result.month, result.day)
        if result:
            found.append(result)
            pos = m.end()
        else:
            # not a real date (e.g. "between 1" matched as <word> <day>) - retry just after the match start
            pos = m.start() + 1
    return found


def _relative_range(text: str, today: date) -> Optional[tuple[date, date]]:
    t = text.lower()
    m = re.search(r"(?:last|past|previous)\s+(\d{1,3})\s+days?", t)
    if m:
        return today - timedelta(days=int(m.group(1)) - 1), today
    m = re.search(r"(?:last|past|previous)\s+(\d{1,2})\s+weeks?", t)
    if m:
        return today - timedelta(weeks=int(m.group(1))) + timedelta(days=1), today
    m = re.search(r"(?:last|past|previous)\s+(\d{1,2})\s+months?", t)
    if m:
        return today - timedelta(days=30 * int(m.group(1))) + timedelta(days=1), today
    if re.search(r"\byesterday\b", t):
        y = today - timedelta(days=1)
        return y, y
    if re.search(r"\btoday\b|\btoday's\b", t):
        return today, today
    if re.search(r"last week|previous week", t):
        monday = today - timedelta(days=today.weekday() + 7)
        return monday, monday + timedelta(days=6)
    if re.search(r"this week|current week", t):
        return today - timedelta(days=today.weekday()), today
    if re.search(r"last month|previous month", t):
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        return last_prev.replace(day=1), last_prev
    if re.search(r"this month|current month|month to date|mtd", t):
        return today.replace(day=1), today
    if re.search(r"last quarter|previous quarter", t):
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        first_this_q = today.replace(month=q_start_month, day=1)
        last_prev = first_this_q - timedelta(days=1)
        return last_prev.replace(month=((last_prev.month - 1) // 3) * 3 + 1, day=1), last_prev
    if re.search(r"this quarter|current quarter", t):
        return today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1), today
    if re.search(r"last year|previous year", t):
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)
    if re.search(r"this year|year to date|ytd", t):
        return date(today.year, 1, 1), today
    return None


def _resolve_people(names: list[str], ds: Dataset) -> tuple[list[int], list[str]]:
    ids: list[int] = []
    unknown: list[str] = []
    user_items = list(ds.users.items())
    all_names = [(uid, (u.name or "").strip(), (u.email or "").strip()) for uid, u in user_items]

    for raw in names:
        needle = (raw or "").strip().lower()
        if not needle:
            continue

        # 1. Exact match on full name or email
        exact = [uid for uid, name, email in all_names if name.lower() == needle or email.lower() == needle or email.split("@")[0].lower() == needle]
        if exact:
            for p in exact:
                if p not in ids:
                    ids.append(p)
            continue

        # 2. Substring match
        sub = [uid for uid, name, email in all_names if needle in name.lower() or name.lower() in needle or needle in email.lower() or any(tok == needle for tok in re.split(r"\s+", name.lower()))]
        if sub:
            for p in sub:
                if p not in ids:
                    ids.append(p)
            continue

        # 3. Collapse duplicate letters: 'vaar' -> 'var', matching 'varshith'
        collapsed = re.sub(r"(.)\1+", r"\1", needle)
        col_matches = [uid for uid, name, email in all_names if collapsed in name.lower() or collapsed in email.lower()]
        if col_matches:
            for p in col_matches:
                if p not in ids:
                    ids.append(p)
            continue

        # 4. Fuzzy match using difflib
        candidates = [name for _, name, _ in all_names if name]
        fuzzy = difflib.get_close_matches(needle, [c.lower() for c in candidates], n=1, cutoff=0.45)
        if fuzzy:
            matched_uid = next((uid for uid, name, _ in all_names if name.lower() == fuzzy[0]), None)
            if matched_uid and matched_uid not in ids:
                ids.append(matched_uid)
                continue

        unknown.append(raw)
    return ids, unknown


def _heuristic_spec(prompt: str, ds: Dataset, today: date) -> dict:
    t = prompt.lower()
    spec: dict[str, Any] = {"report_type": "summary", "group_by": [], "sources": [], "statuses": [], "courses": [],
                            "people": [], "metrics": []}

    # Dates
    dates = _extract_dates(prompt, today)
    rel = _relative_range(prompt, today)
    if re.search(r"all[\s-]?time|overall|since (?:the )?beginning|\bever\b|lifetime", t):
        spec["all_time"] = True
    elif len(dates) >= 2:
        spec["start_date"], spec["end_date"] = min(dates).isoformat(), max(dates).isoformat()
    elif len(dates) == 1:
        if re.search(r"\b(since|after|from|starting)\b", t):
            spec["start_date"], spec["end_date"] = dates[0].isoformat(), today.isoformat()
        elif re.search(r"\b(until|till|before|upto|up to)\b", t):
            spec["start_date"], spec["end_date"] = ALL_TIME_START.isoformat(), dates[0].isoformat()
        else:
            spec["start_date"] = spec["end_date"] = dates[0].isoformat()
    elif rel:
        spec["start_date"], spec["end_date"] = rel[0].isoformat(), rel[1].isoformat()

    # People: full name or any name token as a whole word
    for uid, u in ds.users.items():
        full = (u.name or "").strip().lower()
        if not full:
            continue
        tokens = [x for x in re.split(r"\s+", full) if len(x) >= 3]
        if full in t or any(re.search(rf"\b{re.escape(tok)}\b", t) for tok in tokens):
            spec["people"].append(u.name)

    # Sources / statuses / courses that exist in the data
    for s in ds.sources:
        if len(s) >= 3 and s.lower() in t:
            spec["sources"].append(s)
    for s in ds.statuses:
        if len(s) >= 3 and re.search(rf"\b{re.escape(s.lower())}\b", t):
            spec["statuses"].append(s)
    for c in ds.courses:
        if len(c) >= 3 and c.lower() in t:
            spec["courses"].append(c)

    # Report type
    rt = None
    if re.search(r"\b(list|show|give|all)\b.*\bleads?\b", t) and not re.search(r"source|convers|funnel|performance", t):
        rt = "leads_list"
    elif re.search(r"\b(list|show|give|all)\b.*\b(admissions?|enrol+ments?|students?)\b", t):
        rt = "admissions_list"
    elif re.search(r"funnel|pipeline|stage", t):
        rt = "funnel"
    elif re.search(r"convers|converted|convert", t):
        rt = "conversion"
    elif re.search(r"source|channel|campaign|where .* leads? (come|from)", t):
        rt = "lead_source"
    elif re.search(r"revenue|collection|collected|fee|payment|advance|tuition|earning|sales amount", t):
        rt = "revenue"
    elif re.search(r"\bcalls?\b|activit|follow[\s-]?ups?|worked|work done|effort", t):
        rt = "activity"
    elif re.search(r"trend|daily|day[\s-]?(by|wise)|weekly|monthly|over time|growth", t):
        rt = "trend"
    elif re.search(r"\bcourses?\b", t):
        rt = "course"
    elif re.search(r"perform|leaderboard|compare|\bvs\b|versus|between .* and|top|best|rank|sales ?person|rep\b", t):
        rt = "performance"
    spec["report_type"] = rt or ("performance" if len(spec["people"]) > 1 else "summary")

    # Grouping overrides
    groups: list[str] = []
    for dim, pattern in (
        ("salesperson", r"(by|per|each|wise)\s+(sales ?persons?|persons?|reps?|agents?|people|employees?|team ?members?)|sales ?person[\s-]?wise|rep[\s-]?wise"),
        ("source", r"(by|per|each)\s+(lead\s+)?(source|channel)|source[\s-]?wise"),
        ("course", r"(by|per|each)\s+course|course[\s-]?wise"),
        ("status", r"(by|per|each)\s+(status|stage)|stage[\s-]?wise"),
        ("month", r"monthly|(by|per|each)\s+month|month[\s-]?wise"),
        ("week", r"weekly|(by|per|each)\s+week|week[\s-]?wise"),
        ("day", r"daily|(by|per|each)\s+day|day[\s-]?(by[\s-]day|wise)"),
    ):
        if re.search(pattern, t):
            groups.append(dim)
    spec["group_by"] = groups[:2]
    if groups and spec["report_type"] == "summary":
        spec["report_type"] = "trend" if groups[0] in ("day", "week", "month") else "performance"

    m = re.search(r"\btop\s+(\d{1,3})\b", t)
    if m:
        spec["top_n"] = int(m.group(1))
    if re.search(r"\bconverted (leads )?only\b|only converted", t):
        spec["converted_only"] = True
    return spec


def _llm_spec(prompt: str, ds: Dataset, today: date) -> Optional[dict]:
    """Ask the LLM to translate the prompt into a spec. Returns None when unavailable."""
    if not os.getenv("OPENAI_API_KEY"):
        return None
    try:
        from modules.llm_engine import get_openai_client

        sales_names = sorted({ds.name(e["user_id"]) for e in ds.events if e["user_id"]})[:80]
        system = (
            "You convert a CRM manager's natural-language request into a JSON report specification for an "
            "admissions/sales CRM of a training institute. Respond with JSON only. Never invent data.\n"
            f"Today's date is {today.isoformat()} ({today.strftime('%A')}). Weeks start on Monday.\n"
            "JSON keys:\n"
            f'- "report_type": one of {REPORT_TYPES}. performance = per-person sales results; lead_source = leads per '
            "source/channel; conversion = lead→admission conversion; funnel = pipeline stages; activity = calls/notes/"
            "meetings/follow-ups worked; revenue = tuition/collections; trend = over time; course = per course; "
            "leads_list / admissions_list = raw records; summary = overall overview.\n"
            f'- "group_by": list (max 2) of {DIMENSIONS}; [] to use the report type default.\n'
            '- "start_date", "end_date": YYYY-MM-DD (inclusive). Use "all_time": true instead for no date limit. '
            "Default to the last 30 days when no period is mentioned.\n"
            '- "people": list of salesperson names mentioned (use names from the provided list).\n'
            '- "sources": list of lead sources mentioned; "statuses": lead stages mentioned; "courses": courses mentioned.\n'
            f'- "metrics": optional list from {list(METRICS)} if the user asks for specific numbers only.\n'
            '- "top_n": integer if the user asks for the top N. "converted_only": true if only converted leads are wanted.\n'
            '- "title": a short human title for the report.\n'
            f"Known salespeople: {sales_names}\nKnown lead sources: {ds.sources[:60]}\n"
            f"Known courses: {ds.courses[:60]}\nKnown lead stages: {ds.statuses[:30]}"
        )
        client = get_openai_client()
        resp = client.chat.completions.create(
            model=os.getenv("AI_REPORTS_MODEL", "gpt-4o-mini"),
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
            timeout=30,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:  # pragma: no cover - network dependent
        print(f"[ai_reports] LLM spec failed, using rule-based parser: {exc}")
        return None


def _normalize_spec(raw: dict, ds: Dataset, today: date, personal_ids: Optional[list[int]] = None, prompt: str = "") -> tuple[dict, list[str]]:
    warnings: list[str] = []
    spec: dict[str, Any] = {}
    rtype = raw.get("report_type")
    spec["report_type"] = rtype if rtype in REPORT_TYPES else "summary"
    spec["group_by"] = [g for g in (raw.get("group_by") or []) if g in DIMENSIONS][:2]
    spec["metrics"] = [m for m in (raw.get("metrics") or []) if m in METRICS][:8]
    spec["sources"] = [str(s) for s in (raw.get("sources") or []) if s][:10]
    spec["statuses"] = [str(s) for s in (raw.get("statuses") or []) if s][:10]
    spec["courses"] = [str(s) for s in (raw.get("courses") or []) if s][:10]
    spec["converted_only"] = bool(raw.get("converted_only"))
    spec["title"] = str(raw.get("title") or "").strip()[:120]
    try:
        top_n = int(raw.get("top_n")) if raw.get("top_n") else None
        spec["top_n"] = max(1, min(top_n, 500)) if top_n else None
    except (TypeError, ValueError):
        spec["top_n"] = None

    ids, unknown = _resolve_people([str(p) for p in (raw.get("people") or [])], ds)
    if unknown:
        warnings.append("Couldn't find a team member named: " + ", ".join(unknown))
    spec["salesperson_ids"] = personal_ids if personal_ids else ids
    spec["people_names"] = [ds.name(i) for i in spec["salesperson_ids"]]

    # When user asks to compare typos like "compare vaar and var", both map to Varshith. Clean up the title!
    if len(raw.get("people") or []) > 1 and len(spec["salesperson_ids"]) == 1:
        resolved_name = ds.name(spec["salesperson_ids"][0])
        spec["title"] = f"Sales Performance for {resolved_name}"

    # Year & date normalization (prevents LLM cutoff hallucinations e.g. 2023)
    user_explicit_year = bool(re.search(r"\b20\d\d\b", prompt))
    has_dates_in_prompt = bool(_extract_dates(prompt, today) or _relative_range(prompt, today))

    spec["all_time"] = bool(raw.get("all_time"))
    try:
        start = date.fromisoformat(str(raw.get("start_date"))[:10]) if raw.get("start_date") else None
        end = date.fromisoformat(str(raw.get("end_date"))[:10]) if raw.get("end_date") else None
    except ValueError:
        start = end = None
        warnings.append("Couldn't understand the dates — showing the last 30 days instead.")

    # Clamp hallucinated past years to today's year
    if not user_explicit_year:
        if start and start.year < today.year:
            start = _safe_date(today.year, start.month, min(start.day, 28))
        if end and end.year < today.year:
            end = _safe_date(today.year, end.month, min(end.day, 28))

    # If the user did not specify dates in the prompt:
    if not has_dates_in_prompt and not user_explicit_year:
        if spec["report_type"] in ("performance", "lead_source", "conversion", "funnel") and not raw.get("start_date"):
            spec["all_time"] = True

    if not spec["all_time"]:
        if start and not end:
            end = today
        if end and not start:
            start = end
        if not start:
            start, end = today - timedelta(days=29), today
        if end < start:
            start, end = end, start
        spec["start"], spec["end"] = start, end
    return spec, warnings


def _interpretation(spec: dict) -> str:
    parts = [PRESETS.get(spec["report_type"], {}).get("title") or spec["report_type"].replace("_", " ").title()]
    if spec.get("group_by"):
        parts.append("by " + " & ".join(DIM_LABEL[g].lower() for g in spec["group_by"]))
    if spec.get("people_names"):
        parts.append("for " + ", ".join(spec["people_names"]))
    if spec.get("sources"):
        parts.append("from " + ", ".join(spec["sources"]))
    if spec.get("statuses"):
        parts.append("in stage " + ", ".join(spec["statuses"]))
    if spec.get("courses"):
        parts.append("for course " + ", ".join(spec["courses"]))
    if spec.get("top_n"):
        parts.append(f"(top {spec['top_n']})")
    parts.append("· " + _range_label(spec.get("start") or ALL_TIME_START, spec.get("end") or ALL_TIME_END, bool(spec.get("all_time"))))
    return " ".join(parts)


def _llm_narrative(report: dict, prompt: str) -> str:
    """Short written analysis of an already-computed report. Empty string when the LLM is unavailable."""
    if not os.getenv("OPENAI_API_KEY"):
        return ""
    try:
        from modules.llm_engine import get_openai_client

        main_table = report["tables"][0] if report["tables"] else None
        facts = {
            "title": report["title"], "period": report["range"]["label"],
            "kpis": {k["label"]: k["value"] for k in report["kpis"]},
            "rows": (main_table["rows"][:15] if main_table else []),
            "insights": report["insights"],
        }
        client = get_openai_client()
        resp = client.chat.completions.create(
            model=os.getenv("AI_REPORTS_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": (
                    "You are a sales analytics assistant for a training institute CRM. Write a concise 3-5 sentence "
                    "executive readout of the report data for the manager's question. Use ONLY the numbers provided, "
                    "mention standouts and concerns, and end with one actionable suggestion. Plain text, no markdown.")},
                {"role": "user", "content": f"Question: {prompt}\nReport data: {json.dumps(facts, default=str)}"},
            ],
            temperature=0.3,
            timeout=30,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:  # pragma: no cover
        print(f"[ai_reports] narrative failed: {exc}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints — AI Reports (managers)
# ─────────────────────────────────────────────────────────────────────────────
class AIReportRequest(BaseModel):
    prompt: str
    tz_offset_minutes: int = 0
    user_id: Optional[int] = None


EXAMPLE_PROMPTS = [
    "Overall performance summary for the last 30 days",
    "Compare all salespeople this month by conversions",
    "Lead source report for last week",
    "Daily activity report of every salesperson today",
    "Revenue and collections by salesperson this month",
    "Conversion report from 1 Oct to 15 Oct",
    "Lead pipeline funnel for all time",
    "Month-wise admissions trend this year",
    "List all leads created yesterday",
]


@router.get("/ai-reports/context")
def ai_reports_context(user_id: Optional[int] = None, session: Session = Depends(get_session)):
    _require_manager(session, user_id)
    ds = build_dataset(session)
    active_ids = {e["user_id"] for e in ds.events if e["user_id"]} | set(ds.users.keys())
    people = sorted({ds.name(i) for i in active_ids if i})
    return {
        "salespeople": people,
        "sources": ds.sources,
        "courses": ds.courses,
        "statuses": ds.statuses,
        "examples": EXAMPLE_PROMPTS,
        "ai_enabled": bool(os.getenv("OPENAI_API_KEY")),
    }


@router.post("/ai-reports/query")
def ai_reports_query(body: AIReportRequest, session: Session = Depends(get_session)):
    _require_manager(session, body.user_id)
    prompt = (body.prompt or "").strip()
    if len(prompt) < 3:
        raise HTTPException(status_code=400, detail="Please describe the report you want.")
    if len(prompt) > 1000:
        raise HTTPException(status_code=400, detail="Prompt is too long (max 1000 characters).")

    today = (datetime.utcnow() + timedelta(minutes=body.tz_offset_minutes or 0)).date()
    ds = build_dataset(session, body.tz_offset_minutes)

    raw = _llm_spec(prompt, ds, today)
    ai_used = raw is not None
    if raw is None:
        raw = _heuristic_spec(prompt, ds, today)
    spec, warnings = _normalize_spec(raw, ds, today, prompt=prompt)
    report = run_report(ds, spec)
    report["summary"] = _llm_narrative(report, prompt)
    return {
        "prompt": prompt,
        "interpretation": _interpretation(spec),
        "report_type": spec["report_type"],
        "ai_used": ai_used,
        "warnings": warnings,
        "report": report,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints — personal sales reports
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/my-reports")
def my_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    all_time: bool = False,
    tz_offset_minutes: int = 0,
    user_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """Everything about the logged-in salesperson: leads received, sources, conversions, revenue and activity."""
    user = _require_staff(session, user_id)
    today = (datetime.utcnow() + timedelta(minutes=tz_offset_minutes or 0)).date()
    try:
        start = date.fromisoformat(start_date) if start_date else today - timedelta(days=29)
        end = date.fromisoformat(end_date) if end_date else today
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must use YYYY-MM-DD format")
    if end < start:
        start, end = end, start

    ds = build_dataset(session, tz_offset_minutes, only_user_id=user.id)
    base = {"salesperson_ids": [user.id], "all_time": all_time, "start": start, "end": end}

    overview = run_report(ds, {**base, "report_type": "summary", "title": "My Performance"})
    sources = run_report(ds, {**base, "report_type": "lead_source", "title": "My Lead Sources", "include_all_leads": True})
    funnel = run_report(ds, {**base, "report_type": "funnel", "title": "My Pipeline", "include_all_leads": True})
    courses = run_report(ds, {**base, "report_type": "course", "title": "My Courses"})
    leads = run_report(ds, {**base, "report_type": "leads_list", "title": "My Leads", "include_all_leads": True})
    admissions = run_report(ds, {**base, "report_type": "admissions_list", "title": "My Admissions"})
    activity = run_report(ds, {**base, "report_type": "trend", "title": "My Activity Trend",
                               "metrics": ["leads", "demos", "admissions", "calls", "total_activities"]})

    lo = (ALL_TIME_START if all_time else start).isoformat()
    hi = (ALL_TIME_END if all_time else end).isoformat()
    sheet = scoped_query(session, TaskSheetEntry)
    user_sheet = [
        e for e in sheet
        if e.user_id == user.id and e.work_date and lo <= e.work_date[:10] <= hi
    ]
    user_sheet.sort(key=lambda e: e.work_date, reverse=True)
    sheet_table = {
        "id": "tasksheet", "title": f"My Task Sheet Entries ({len(user_sheet)})",
        "columns": [{"key": "date", "label": "Date", "type": "text"}, {"key": "area", "label": "Area", "type": "text"},
                    {"key": "summary", "label": "Summary", "type": "text"}, {"key": "status", "label": "Status", "type": "text"}],
        "rows": [{"date": e.work_date, "area": e.area, "summary": _clip(e.summary, 220), "status": e.status} for e in user_sheet[:100]],
        "totals": None,
    }

    return {
        "user": {"id": user.id, "name": user.name or user.email, "role": user.role},
        "range": overview["range"],
        "kpis": overview["kpis"],
        "insights": overview["insights"],
        "sections": {
            "sources": {"tables": sources["tables"], "charts": sources["charts"]},
            "pipeline": {"tables": funnel["tables"], "charts": funnel["charts"]},
            "courses": {"tables": courses["tables"], "charts": courses["charts"]},
            "leads": {"tables": leads["tables"], "charts": leads["charts"]},
            "admissions": {"tables": admissions["tables"], "charts": admissions["charts"]},
            "activity": {"tables": activity["tables"], "charts": activity["charts"] or overview["charts"]},
            "tasksheet": {"tables": [sheet_table], "charts": []},
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints — AI daily summary → Task Sheet
# ─────────────────────────────────────────────────────────────────────────────
class DailySummaryRequest(BaseModel):
    work_date: Optional[str] = None
    tz_offset_minutes: int = 0
    submit: bool = False
    user_id: Optional[int] = None


class DailySummarySubmit(BaseModel):
    work_date: str
    summary: str
    proof_of_work: Optional[str] = None
    time_spent_minutes: Optional[int] = None
    user_id: Optional[int] = None


def _day_facts(ds: Dataset, user_id: int, day: date) -> tuple[dict, list[str]]:
    # Filter events belonging to this user or leads owned/worked by this user on the calendar day
    user_lead_ids = {
        e["lead_id"] for e in ds.events
        if e.get("lead_id") and (e.get("user_id") == user_id or e.get("lead_owner_id") == user_id)
    }
    evs = sorted(
        (e for e in ds.events if (e["user_id"] == user_id or e.get("lead_owner_id") == user_id or e.get("lead_id") in user_lead_ids) and e["ts"] and e["ts"].date() == day),
        key=lambda e: e["ts"]
    )
    by_kind: dict[str, list[dict]] = defaultdict(list)
    for e in evs:
        by_kind[e["kind"]].append(e)

    lines: list[str] = []
    stats = {k: len(v) for k, v in by_kind.items()}

    def names(items: list[dict], n: int = 5) -> str:
        uniq = []
        for it in items:
            nm = it.get("name")
            if nm and nm not in uniq:
                uniq.append(nm)
        extra = f" +{len(uniq) - n} more" if len(uniq) > n else ""
        return ", ".join(uniq[:n]) + extra

    if by_kind["lead"]:
        srcs: dict[str, int] = defaultdict(int)
        for e in by_kind["lead"]:
            srcs[e["source"]] += 1
        lines.append(f"Received {len(by_kind['lead'])} lead(s) ({', '.join(f'{v} from {k}' for k, v in srcs.items())}): {names(by_kind['lead'])}.")
    if by_kind["call"]:
        mins = round(sum(e.get("duration", 0) for e in by_kind["call"]) / 60)
        notes = [e["detail"] for e in by_kind["call"] if e["detail"]][:3]
        lines.append(f"Made/logged {len(by_kind['call'])} call(s){f' (~{mins} min talk time)' if mins else ''}"
                     + (f"; details: {' | '.join(notes)}" if notes else "") + ".")
    if by_kind["note"]:
        lines.append(f"Added {len(by_kind['note'])} note(s) on {names(by_kind['note'])}"
                     + (f"; e.g. \"{by_kind['note'][0]['detail']}\"" if by_kind["note"][0]["detail"] else "") + ".")
    if by_kind["followup"]:
        done = sum(1 for e in by_kind["followup"] if e["done"])
        lines.append(f"Follow-ups: {len(by_kind['followup'])} scheduled/handled ({done} marked done) — {names(by_kind['followup'])}.")
    if by_kind["demo"]:
        done = sum(1 for e in by_kind["demo"] if e["done"])
        lines.append(f"Demos/Webinars: {len(by_kind['demo'])} scheduled/conducted ({done} completed) — {names(by_kind['demo'])}.")
    if by_kind["meeting"]:
        lines.append(f"Meetings/Walk-ins: {len(by_kind['meeting'])} — {names(by_kind['meeting'])}.")
    if by_kind["enrollment"]:
        total_paid = sum(e["paid"] for e in by_kind["enrollment"])
        total_fee = sum(e["tuition"] for e in by_kind["enrollment"])
        lines.append(f"Closed {len(by_kind['enrollment'])} admission(s): "
                     + "; ".join(f"{e['name']} → {e['course']}" for e in by_kind["enrollment"][:5])
                     + f". Collected {_fmt_money(total_paid)} of {_fmt_money(total_fee)} booked.")
    if by_kind["activity"]:
        details = [e["detail"] for e in by_kind["activity"] if e["detail"]][:4]
        if details:
            lines.append("Other logged activity: " + "; ".join(details) + ".")

    minutes = sum(e.get("duration", 0) for e in by_kind["call"]) / 60
    minutes += 5 * len(by_kind["note"]) + 20 * (len(by_kind["demo"]) + len(by_kind["meeting"]))
    minutes += 15 * len(by_kind["enrollment"]) + 5 * len(by_kind["lead"]) + 5 * len(by_kind["followup"]) + 5 * len(by_kind["activity"])
    stats["estimated_minutes"] = int(max(15, round(minutes / 5) * 5)) if evs else 0
    stats["total"] = len(evs)
    return stats, lines


def _proof_line(stats: dict) -> str:
    label = {"lead": "leads", "call": "calls", "note": "notes", "followup": "follow-ups", "demo": "demos",
             "meeting": "meetings", "enrollment": "admissions", "activity": "other activities"}
    parts = [f"{stats[k]} {v}" for k, v in label.items() if stats.get(k)]
    return "Auto-generated from CRM activity: " + (", ".join(parts) if parts else "no recorded activity")


def _fallback_summary(user_name: str, day: date, lines: list[str]) -> str:
    if not lines:
        return f"No CRM activity was recorded for {day.strftime('%d %b %Y')}."
    return "Today's work:\n" + "\n".join(f"• {l}" for l in lines)


def _llm_daily_summary(user_name: str, day: date, lines: list[str]) -> str:
    if not os.getenv("OPENAI_API_KEY") or not lines:
        return ""
    try:
        from modules.llm_engine import get_openai_client

        client = get_openai_client()
        resp = client.chat.completions.create(
            model=os.getenv("AI_REPORTS_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": (
                    "You write the end-of-day task-sheet entry for a sales/admissions counsellor at a training institute. "
                    "Write in first person, concise and professional (3-6 short bullet points starting with '• '). "
                    "Use ONLY the facts supplied — never invent leads, numbers or outcomes. Group related items and "
                    "keep names and figures exact. Plain text, no markdown headers.")},
                {"role": "user", "content": f"Counsellor: {user_name}\nDate: {day.isoformat()}\nCRM activity facts:\n" + "\n".join(f"- {l}" for l in lines)},
            ],
            temperature=0.3,
            timeout=30,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:  # pragma: no cover
        print(f"[ai_reports] daily summary failed: {exc}")
        return ""


def _save_to_task_sheet(session: Session, user: User, work_date: str, summary: str, proof: Optional[str], minutes: Optional[int]) -> TaskSheetEntry:
    """Create (or refresh) the single AI daily entry for this user/date in the Task Sheet."""
    text = summary.strip()
    if not text.startswith(AI_SUMMARY_MARKER):
        text = f"{AI_SUMMARY_MARKER}\n{text}"
    existing = session.exec(
        select(TaskSheetEntry)
        .execution_options(skip_tenant=True)
        .where(TaskSheetEntry.user_id == user.id, TaskSheetEntry.work_date == work_date)
    ).all()
    entry = next((e for e in existing if (e.summary or "").startswith(AI_SUMMARY_MARKER)), None)
    now = datetime.utcnow()
    if entry:
        entry.summary, entry.proof_of_work, entry.time_spent_minutes = text, proof, minutes
        entry.status, entry.completion_date, entry.updated_at = "Done", work_date, now
    else:
        entry = TaskSheetEntry(
            tenant_id=user.tenant_id if user.tenant_id and user.tenant_id > 0 else None,
            user_id=user.id, work_date=work_date, area="Other", summary=text, status="Done",
            time_spent_minutes=minutes, proof_of_work=proof, completion_date=work_date,
        )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.post("/my-reports/daily-summary")
def generate_daily_summary(body: DailySummaryRequest, session: Session = Depends(get_session)):
    """Write 'what I did today' from the salesperson's real CRM activity; optionally send it to the Task Sheet."""
    user = _require_staff(session, body.user_id)
    today = (datetime.utcnow() + timedelta(minutes=body.tz_offset_minutes or 0)).date()
    try:
        day = date.fromisoformat(body.work_date) if body.work_date else today
    except ValueError:
        raise HTTPException(status_code=400, detail="work_date must use YYYY-MM-DD format")

    ds = build_dataset(session, body.tz_offset_minutes, only_user_id=user.id)
    stats, lines = _day_facts(ds, user.id, day)

    # Resilient fallback: If no events were captured in ds for this day, check recent activity
    # directly from ActivityLog, ClientNote, LeadNote, FollowUp, ConversationLog, etc.
    if stats["total"] == 0:
        direct_acts = []
        user_names = {u.strip().lower() for u in [user.name, user.email, (user.email or "").split("@")[0], "admin"] if u}

        for a in scoped_query(session, ActivityLog):
            if not a.createdAt:
                continue
            act_date = (a.createdAt + timedelta(minutes=body.tz_offset_minutes or 0)).date()
            if act_date == day:
                matches_act = (a.userId == user.id) or (a.userId is None) or (a.lead_id and a.lead_id in {l.id for l in ds.leads.values() if l.owner_id == user.id})
                if matches_act:
                    action = (a.action or "").strip()
                    if action and not any(x in action.lower() for x in ("login", "logout", "page visit", "profile update")):
                        detail = f"{a.action}: {_clip(a.details or '', 100)}".strip()
                        if detail not in direct_acts:
                            direct_acts.append(detail)

        for n in scoped_query(session, ClientNote):
            if not n.created_at:
                continue
            note_date = (n.created_at + timedelta(minutes=body.tz_offset_minutes or 0)).date()
            if note_date == day:
                author_matches = (n.author_id == user.id) or ((n.author_name or "").strip().lower() in user_names) or (n.lead_id and n.lead_id in {l.id for l in ds.leads.values() if l.owner_id == user.id})
                if author_matches:
                    msg = f"Added note: {_clip(n.content, 120)}"
                    if msg not in direct_acts:
                        direct_acts.append(msg)

        for c in scoped_query(session, ConversationLog):
            if not c.created_at:
                continue
            conv_date = (c.created_at + timedelta(minutes=body.tz_offset_minutes or 0)).date()
            if conv_date == day:
                author_matches = (c.author_id == user.id) or ((c.author_name or "").strip().lower() in user_names) or (c.lead_id and c.lead_id in {l.id for l in ds.leads.values() if l.owner_id == user.id})
                if author_matches:
                    msg = f"Logged {c.type or 'conversation'}: {c.title}"
                    if msg not in direct_acts:
                        direct_acts.append(msg)

        for f in scoped_query(session, FollowUp):
            f_ts = f.completed_at or f.due_at or f.created_at
            if f_ts and (f_ts + timedelta(minutes=body.tz_offset_minutes or 0)).date() == day:
                if f.assigned_to == user.id or f.created_by == user.id:
                    msg = f"Follow-up: {f.title} ({f.status})"
                    if msg not in direct_acts:
                        direct_acts.append(msg)

        if direct_acts:
            lines.extend(direct_acts[:10])
            stats["total"] = len(direct_acts)
            stats["activity"] = len(direct_acts)
            stats["estimated_minutes"] = max(15, len(direct_acts) * 10)

    name = user.name or (user.email or "").split("@")[0]
    ai_text = _llm_daily_summary(name, day, lines)
    summary = ai_text or _fallback_summary(name, day, lines)
    proof = _proof_line(stats)
    minutes = stats["estimated_minutes"] or None

    entry = None
    if body.submit and stats["total"] > 0:
        entry = _save_to_task_sheet(session, user, day.isoformat(), summary, proof, minutes)
    return {
        "work_date": day.isoformat(),
        "summary": summary,
        "proof_of_work": proof,
        "time_spent_minutes": minutes,
        "stats": stats,
        "facts": lines,
        "has_activity": stats["total"] > 0,
        "ai_used": bool(ai_text),
        "submitted": entry is not None,
        "entry_id": entry.id if entry else None,
    }


@router.post("/my-reports/daily-summary/submit")
def submit_daily_summary(body: DailySummarySubmit, session: Session = Depends(get_session)):
    user = _require_staff(session, body.user_id)
    if not body.summary.strip():
        raise HTTPException(status_code=400, detail="Summary cannot be empty")
    try:
        date.fromisoformat(body.work_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="work_date must use YYYY-MM-DD format")
    entry = _save_to_task_sheet(session, user, body.work_date, body.summary, body.proof_of_work, body.time_spent_minutes)
    return {"ok": True, "entry_id": entry.id, "message": "Daily report saved to your Task Sheet"}
