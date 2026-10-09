from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List, Optional, Union
from pydantic import BaseModel
from database import engine, User, Deal, ConversationLog, Lead, LeadDemoSession, Student, Enrollment, ClientProfile, Instructor, Batch, InstructorFeedback
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

class InstructorLeaderboardEntry(BaseModel):
    id: int
    instructor_id: int
    name: str
    email: Optional[str] = None
    expertise: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: int = 0
    is_active: bool = True
    avg_rating: float = 0.0
    students_taught: int = 0
    batches_total: int = 0
    batches_active: int = 0
    batches_upcoming: int = 0
    batches_completed: int = 0
    feedback_count: int = 0

def _get_instructors_leaderboard(session: Session) -> List[InstructorLeaderboardEntry]:
    instructors = session.exec(select(Instructor).order_by(Instructor.name)).all()
    results = []
    for inst in instructors:
        batches = session.exec(select(Batch).where(Batch.instructor_id == inst.id)).all()
        students = set()
        for b in batches:
            active_students = session.exec(
                select(Enrollment.student_id).where(Enrollment.batch_id == b.id, Enrollment.status == "Active")
            ).all()
            students.update(active_students)
        feedback = session.exec(select(InstructorFeedback).where(InstructorFeedback.instructor_id == inst.id)).all()
        avg_rating = round(sum(f.rating for f in feedback) / len(feedback), 1) if feedback else (inst.avg_rating or 0.0)
        results.append(InstructorLeaderboardEntry(
            id=inst.id,
            instructor_id=inst.id,
            name=inst.name,
            email=inst.email,
            expertise=inst.expertise,
            qualification=inst.qualification,
            experience_years=inst.experience_years or 0,
            is_active=inst.is_active,
            avg_rating=avg_rating,
            students_taught=len(students) or inst.total_students or 0,
            batches_total=len(batches) or inst.total_batches or 0,
            batches_active=sum(1 for b in batches if b.status == "Active"),
            batches_upcoming=sum(1 for b in batches if b.status == "Upcoming"),
            batches_completed=sum(1 for b in batches if b.status == "Completed"),
            feedback_count=len(feedback),
        ))
    results.sort(key=lambda x: (x.avg_rating, x.students_taught, x.batches_active), reverse=True)
    return results

@router.get("/instructors", response_model=List[InstructorLeaderboardEntry])
def get_instructors_leaderboard_route(session: Session = Depends(get_session)):
    return _get_instructors_leaderboard(session)

@router.get("", response_model=Union[List[LeaderboardEntry], List[InstructorLeaderboardEntry]])
def get_leaderboard(kind: str = "all", session: Session = Depends(get_session)):
    if kind in ("instructors", "instructor"):
        return _get_instructors_leaderboard(session)

    if kind == "tickets":
        return []

    roles = ["Employee", "SalesManager"] if kind in ("sales", "institute") else ["Employee", "SalesManager", "ProjectMember", "Intern"]
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

        leaderboard.append(LeaderboardEntry(
            user_id=user.id,
            name=user.name or user.email.split('@')[0],
            role=user.role,
            deals_closed=deals_closed,
            revenue_closed=revenue_closed,
            meetings_booked=meetings_booked,
            calls_made=calls_made,
            leads_managed=leads_managed,
            clients_managed=clients_managed,
            tickets_assigned=0,
            tickets_in_production=0,
            tickets_completed=0,
        ))
        
    # Sort by revenue as primary metric
    leaderboard.sort(key=lambda x: x.revenue_closed, reverse=True)
    
    return leaderboard
