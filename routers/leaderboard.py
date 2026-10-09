from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel
from database import engine, User, Deal, ConversationLog, Lead, LeadDemoSession, Student, Enrollment, ClientProfile, ProjectTicket
from modules.api_tracker import current_salesperson_id

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

def get_session():
    with Session(engine) as session:
        yield session

class LeaderboardEntry(BaseModel):
    user_id: int
    name: str
    role: str
    deals_closed: int
    revenue_closed: float
    meetings_booked: int
    calls_made: int
    leads_managed: int = 0
    clients_managed: int = 0
    tickets_assigned: int = 0
    tickets_in_production: int = 0
    tickets_completed: int = 0
    leads_assigned: int = 0
    students_converted: int = 0
    demos_held: int = 0
    demos_scheduled: int = 0
    total_business: float = 0.0
    advance_collected: float = 0.0
    amount_due: float = 0.0

@router.get("", response_model=List[LeaderboardEntry])
def get_leaderboard(kind: str = "all", session: Session = Depends(get_session)):
    roles = ["Employee", "SalesManager"] if kind in ("sales", "institute") else ["ProjectMember", "Intern"] if kind == "tickets" else ["Employee", "SalesManager", "ProjectMember", "Intern"]
    query = select(User).where(User.role.in_(roles))
    requester_id = current_salesperson_id.get()
    if requester_id:
        requester = session.get(User, requester_id)
        if requester and requester.tenant_id:
            query = query.where(User.tenant_id == requester.tenant_id)
    users = session.exec(query).all()

    if kind == "institute":
        leads = session.exec(select(Lead)).all()
        leads_by_id = {lead.id: lead for lead in leads}
        leads_by_owner = {user.id: [] for user in users}
        for lead in leads:
            if lead.owner_id in leads_by_owner:
                leads_by_owner[lead.owner_id].append(lead)

        students_by_id = {student.id: student for student in session.exec(select(Student)).all()}
        demos_by_lead = {}
        for demo in session.exec(select(LeadDemoSession)).all():
            demos_by_lead.setdefault(demo.lead_id, []).append(demo)

        metrics = {
            user.id: {
                "total_business": 0.0,
                "advance_collected": 0.0,
                "amount_due": 0.0,
            }
            for user in users
        }
        for enrollment in session.exec(select(Enrollment)).all():
            student = students_by_id.get(enrollment.student_id)
            lead = leads_by_id.get(student.lead_id) if student and student.lead_id else None
            owner_id = (student.assigned_salesperson_id if student else None) or (lead.owner_id if lead else None) or enrollment.enrolled_by
            if owner_id not in metrics:
                continue
            amount_paid = enrollment.amount_paid or 0
            amount_due = enrollment.amount_due or 0
            metrics[owner_id]["advance_collected"] += amount_paid
            metrics[owner_id]["amount_due"] += amount_due
            metrics[owner_id]["total_business"] += amount_paid + amount_due

        leaderboard = []
        for user in users:
            assigned_leads = leads_by_owner.get(user.id, [])
            lead_ids = {lead.id for lead in assigned_leads}
            demos = [demo for lead_id in lead_ids for demo in demos_by_lead.get(lead_id, [])]
            converted_student_ids = {lead.converted_student_id for lead in assigned_leads if lead.converted_student_id is not None}
            user_metrics = metrics[user.id]
            leaderboard.append(LeaderboardEntry(
                user_id=user.id,
                name=user.name or user.email.split("@")[0],
                role=user.role,
                deals_closed=0,
                revenue_closed=user_metrics["advance_collected"],
                meetings_booked=0,
                calls_made=0,
                leads_managed=len(assigned_leads),
                leads_assigned=len(assigned_leads),
                students_converted=len(converted_student_ids),
                demos_held=sum(1 for demo in demos if demo.status == "Attended"),
                demos_scheduled=sum(1 for demo in demos if demo.status == "Scheduled"),
                total_business=user_metrics["total_business"],
                advance_collected=user_metrics["advance_collected"],
                amount_due=user_metrics["amount_due"],
            ))
        leaderboard.sort(key=lambda entry: (entry.total_business, entry.advance_collected, entry.students_converted), reverse=True)
        return leaderboard
    
    leaderboard = []
    
    for user in users:
        # Get deals closed (Closed Won)
        deals = session.exec(select(Deal).where(Deal.assigned_to == user.id, Deal.stage == "Closed Won")).all()
        deals_closed = len(deals)
        revenue_closed = sum(deal.value for deal in deals)
        
        # Get meetings booked
        meetings = session.exec(select(ConversationLog).where(ConversationLog.author_id == user.id, ConversationLog.type == "meeting")).all()
        meetings_booked = len(meetings)
        
        # Get calls made
        calls = session.exec(select(ConversationLog).where(ConversationLog.author_id == user.id, ConversationLog.type == "call")).all()
        calls_made = len(calls)
        leads_managed = len(session.exec(select(Lead).where(Lead.owner_id == user.id)).all())
        clients_managed = len(session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).all())
        all_tickets = session.exec(select(ProjectTicket)).all()
        owner_name = (user.name or "").strip().lower()
        assigned_tickets = [ticket for ticket in all_tickets if owner_name and (ticket.current_owner or "").strip().lower() == owner_name]
        tickets_in_production = sum(1 for ticket in assigned_tickets if ticket.current_state == "Prod Release")
        tickets_completed = sum(1 for ticket in assigned_tickets if ticket.date_release_prod or ticket.current_state == "Prod Release")

        leaderboard.append(LeaderboardEntry(
            user_id=user.id,
            name=user.name or user.email.split('@')[0],
            role=user.role,
            deals_closed=deals_closed,
            revenue_closed=revenue_closed,
            meetings_booked=meetings_booked,
            calls_made=calls_made
            , leads_managed=leads_managed
            , clients_managed=clients_managed
            , tickets_assigned=len(assigned_tickets)
            , tickets_in_production=tickets_in_production
            , tickets_completed=tickets_completed
        ))
        
    # Sort by revenue as primary metric
    leaderboard.sort(key=lambda x: x.revenue_closed, reverse=True)
    
    return leaderboard
