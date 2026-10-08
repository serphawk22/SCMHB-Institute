"""Create a repeatable, synthetic institute CRM/LMS demo workspace.

Run with INSTITUTE_DEMO_SEED=1 and an explicitly selected SQLite DATABASE_URL.
"""
import hashlib
import os
from datetime import datetime, timedelta

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, select

from database import (
    Attendance,
    Batch,
    Course,
    Enrollment,
    Instructor,
    InstructorFeedback,
    InstituteSession,
    Lead,
    PaymentRecord,
    Student,
    StudentNote,
    StudentSessionProgress,
    StudentUpload,
    User,
    engine,
    DATABASE_URL,
)


PASSWORDS = {
    "admin": "HawkAdmin!2026",
    "sales": "HawkSales!2026",
    "advisor": "HawkAdvisor!2026",
    "instructor": "HawkTeach!2026",
    "instructor_two": "HawkTeach2!2026",
    "student": "HawkLearn!2026",
}


def password_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def ensure_user(session, email, name, role, password):
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        user = User(email=email, name=name, role=role, password=password_hash(password), is_active=True)
    else:
        user.name = name
        user.role = role
        user.password = password_hash(password)
        user.is_active = True
    session.add(user)
    session.flush()
    return user


def ensure_course(session, values):
    course = session.exec(select(Course).where(Course.slug == values["slug"])).first()
    if not course:
        course = Course(**values)
    else:
        for key, value in values.items():
            setattr(course, key, value)
    session.add(course)
    session.flush()
    return course


def ensure_instructor(session, user, name, email, expertise, qualification, years, bio):
    instructor = session.exec(select(Instructor).where(Instructor.email == email)).first()
    values = {
        "user_id": user.id if user else None,
        "name": name,
        "email": email,
        "phone": "+1 555 010 20",
        "expertise": expertise,
        "qualification": qualification,
        "experience_years": years,
        "bio": bio,
        "is_active": True,
    }
    if not instructor:
        instructor = Instructor(**values)
    else:
        for key, value in values.items():
            setattr(instructor, key, value)
    session.add(instructor)
    session.flush()
    return instructor


def ensure_lead(session, values):
    lead = session.exec(select(Lead).where(Lead.email == values["email"])).first()
    if not lead:
        lead = Lead(**values)
    else:
        for key, value in values.items():
            setattr(lead, key, value)
    session.add(lead)
    session.flush()
    return lead


def ensure_student(session, values):
    student = session.exec(select(Student).where(Student.email == values["email"])).first()
    if not student:
        student = Student(**values)
    else:
        for key, value in values.items():
            setattr(student, key, value)
    session.add(student)
    session.flush()
    return student


def ensure_batch(session, values):
    batch = session.exec(select(Batch).where(Batch.batch_code == values["batch_code"])).first()
    if not batch:
        batch = Batch(**values)
    else:
        for key, value in values.items():
            setattr(batch, key, value)
    session.add(batch)
    session.flush()
    return batch


def ensure_enrollment(session, values):
    enrollment = session.exec(
        select(Enrollment).where(
            Enrollment.student_id == values["student_id"],
            Enrollment.batch_id == values["batch_id"],
        )
    ).first()
    if not enrollment:
        enrollment = Enrollment(**values)
    else:
        for key, value in values.items():
            setattr(enrollment, key, value)
    session.add(enrollment)
    session.flush()
    return enrollment


def main():
    if os.getenv("INSTITUTE_DEMO_SEED") != "1":
        raise SystemExit("Refusing to seed: set INSTITUTE_DEMO_SEED=1 explicitly.")
    if not DATABASE_URL.startswith("sqlite:") and os.getenv("INSTITUTE_DEMO_SEED_ALLOW_NON_SQLITE") != "1":
        raise SystemExit("Refusing to seed a non-SQLite database. Set INSTITUTE_DEMO_SEED_ALLOW_NON_SQLITE=1 only for an intentional demo database.")

    SQLModel.metadata.create_all(engine)
    if "students" in inspect(engine).get_table_names():
        student_columns = {column["name"] for column in inspect(engine).get_columns("students")}
        if "assigned_salesperson_id" not in student_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE students ADD COLUMN assigned_salesperson_id INTEGER REFERENCES users(id)"))
    now = datetime.utcnow().replace(second=0, microsecond=0)
    with Session(engine) as session:
        admin = ensure_user(session, "institute.admin@example.test", "Demo Institute Admin", "Admin", PASSWORDS["admin"])
        sales = ensure_user(session, "institute.sales@example.test", "Demo Sales Manager", "SalesManager", PASSWORDS["sales"])
        advisor = ensure_user(session, "institute.advisor@example.test", "Demo Admissions Advisor", "Employee", PASSWORDS["advisor"])
        instructor_user = ensure_user(session, "institute.instructor@example.test", "Demo Instructor One", "Instructor", PASSWORDS["instructor"])
        instructor_two_user = ensure_user(session, "institute.instructor2@example.test", "Demo Instructor Two", "Instructor", PASSWORDS["instructor_two"])
        student_user = ensure_user(session, "institute.student@example.test", "Demo Student One", "Student", PASSWORDS["student"])

        courses = [
            ensure_course(session, {
                "title": "Full Stack Web Development", "slug": "demo-full-stack-web", "category": "Web Development",
                "description": "Build responsive web applications, APIs, and a portfolio project with instructor feedback.",
                "duration_weeks": 16, "duration_hours": 96, "price": 48000, "advance_amount": 8000,
                "prerequisites": "Basic computer literacy; no professional experience required.", "is_active": True,
                "syllabus": {"modules": ["HTML and accessibility", "CSS and responsive layouts", "JavaScript and APIs", "React application patterns", "Backend services", "Portfolio project"], "outcomes": ["Build and deploy a responsive full-stack application", "Explain core web development decisions"]},
            }),
            ensure_course(session, {
                "title": "Applied Data Analytics", "slug": "demo-applied-data-analytics", "category": "Data Science",
                "description": "Work with spreadsheets, SQL, Python, and practical dashboards using real-world exercises.",
                "duration_weeks": 12, "duration_hours": 72, "price": 42000, "advance_amount": 7000,
                "prerequisites": "Comfort with arithmetic and spreadsheets is helpful.", "is_active": True,
                "syllabus": {"modules": ["Spreadsheet analysis", "SQL querying", "Python data cleaning", "Exploratory analysis", "Dashboard design", "Analytics case study"], "outcomes": ["Clean and analyze a practical dataset", "Present findings with a clear dashboard"]},
            }),
            ensure_course(session, {
                "title": "UI/UX Product Design", "slug": "demo-ui-ux-product-design", "category": "Design",
                "description": "Practice research, prototyping, accessibility, and portfolio storytelling for digital products.",
                "duration_weeks": 10, "duration_hours": 60, "price": 36000, "advance_amount": 6000,
                "prerequisites": "No design software experience required.", "is_active": True,
                "syllabus": {"modules": ["User research", "Information architecture", "Wireframing", "Accessible visual systems", "Interactive prototyping", "Portfolio case study"], "outcomes": ["Plan and test a user-centered flow", "Present an accessible product-design portfolio case study"]},
            }),
        ]
        web_course, data_course, design_course = courses

        instructor_one = ensure_instructor(session, instructor_user, instructor_user.name, instructor_user.email, "Web Development, Python, JavaScript", "M.Sc. Computer Science", 8, "Project-based web development instructor focused on portfolio-ready practice.")
        instructor_two = ensure_instructor(session, instructor_two_user, instructor_two_user.name, instructor_two_user.email, "Data Analytics, SQL, Python", "M.Sc. Applied Statistics", 6, "Data instructor focused on accessible explanations and career-oriented projects.")
        instructor_three = ensure_instructor(session, None, "Demo Instructor Three", "design.instructor@example.test", "UI/UX, Prototyping, Accessibility", "B.Des. Interaction Design", 5, "Product designer and mentor for portfolio development.")

        seed_leads = [
            ("Asha Patel", "asha.patel@example.test", web_course, 8.2, "Bachelor's", "Commerce graduate with customer support experience and basic HTML practice.", "Move into junior frontend development.", "Website", "Interested"),
            ("Mateo Rivera", "mateo.rivera@example.test", data_course, 7.4, "Bachelor's", "Business graduate who manages weekly sales reports in spreadsheets.", "Become a data analyst.", "Referral", "Contacted"),
            ("Lina Chen", "lina.chen@example.test", design_course, 8.8, "Diploma", "Visual arts background, freelance illustration, and accessibility interest.", "Design digital products for healthcare.", "Open Day", "Demo Scheduled"),
            ("Noah Williams", "noah.williams@example.test", web_course, 6.9, "High school", "Self-taught computer repair and small WordPress sites.", "Find an entry-level web role.", "Social Media", "New"),
            ("Priya Nair", "priya.nair@example.test", data_course, 9.1, "Master's", "Life sciences research and laboratory data cleaning.", "Move into health data analytics.", "Website", "Interested"),
            ("Jordan Brooks", "jordan.brooks@example.test", design_course, 7.8, "Bachelor's", "Retail operations and strong visual communication skills.", "Build a UX portfolio.", "Walk-in", "Contacted"),
            ("Samira Khan", "samira.khan@example.test", web_course, 8.6, "Diploma", "IT support experience with JavaScript practice and a small portfolio.", "Prepare for frontend interviews.", "Referral", "Enrolled"),
            ("Ethan Park", "ethan.park@example.test", data_course, 7.9, "Bachelor's", "Finance student who enjoys explaining trends to non-technical teams.", "Build reporting and SQL skills.", "Campus Event", "New"),
        ]
        leads = []
        for index, (name, email, course, gpa, level, background, goal, source, status) in enumerate(seed_leads):
            lead = ensure_lead(session, {
                "tenant_id": admin.tenant_id,
                "company_name": name,
                "email": email,
                "phone": f"+1 555 010 {index + 30:02d}",
                "source": source,
                "owner_id": sales.id if index % 2 == 0 else advisor.id,
                "status": status,
                "industry": course.category,
                "course_interest_id": course.id,
                "gpa": gpa,
                "education_level": level,
                "academic_background": background,
                "background_details": {
                    "Study / work history": background,
                    "Current education": level,
                    "Career direction": goal,
                    "Learning preference": "Project-based practice with regular instructor feedback.",
                },
                "career_goal": goal,
                "notes": "Synthetic demo profile. Confirm schedule, support needs, and goals during the next conversation.",
            })
            leads.append(lead)

        base_plan = {
            "fit_reason": "The catalog course aligns with the learner's stated goal and provides guided practice for their current background.",
            "pain_points": ["Needs a clear path from current experience to job-ready practice", "Needs regular feedback and a realistic schedule"],
            "pitch": "Start with the learner's own background, connect each module to a practical project, and agree on a weekly study plan.",
            "opportunities": ["Build a portfolio project", "Practice role-specific interviews", "Explore internships and entry-level opportunities without promising placement"],
            "next_questions": ["What weekly study time is realistic?", "Which project would feel relevant to the target role?"],
            "generated_by": "demo",
        }

        def make_demo_course_plan(lead, course):
            dimensions = {
                "interest_match": 100 if lead.industry == course.category else 55,
                "career_goal_alignment": 85,
                "background_relevance": 80,
                "academic_readiness_evidence": round(min(100, max(0, (lead.gpa or 5) * 10))),
            }
            fit_score = round(
                dimensions["interest_match"] * 0.3
                + dimensions["career_goal_alignment"] * 0.3
                + dimensions["background_relevance"] * 0.25
                + dimensions["academic_readiness_evidence"] * 0.15
            )
            duration = course.duration_weeks or 12
            first_end = max(1, round(duration / 3))
            second_end = max(first_end + 1, round(duration * 2 / 3))
            profile_fields = [lead.education_level, lead.gpa, lead.academic_background, lead.career_goal, lead.industry]
            completeness = round(sum(value is not None and str(value).strip() != "" for value in profile_fields) / len(profile_fields) * 100)
            recommendation = {
                "course_id": course.id,
                "course_title": course.title,
                "category": course.category,
                "duration_weeks": course.duration_weeks,
                "duration_hours": course.duration_hours,
                "prerequisites": course.prerequisites,
                "fit_score_percent": fit_score,
                "fit_dimensions": dimensions,
            }
            return {
                **base_plan,
                "course_id": course.id,
                "course_title": course.title,
                "fit_score_percent": fit_score,
                "fit_dimensions": dimensions,
                "profile_completeness_percent": completeness,
                "profile_evidence": {
                    "education_level": lead.education_level,
                    "gpa": lead.gpa,
                    "academic_background": lead.academic_background,
                    "career_goal": lead.career_goal,
                    "course_interest": lead.industry,
                },
                "recommended_courses": [recommendation],
                "learning_roadmap": [
                    {"phase": "Foundations and diagnostic", "weeks": f"1-{first_end}", "focus": "Confirm prerequisites, set a baseline, and close essential knowledge gaps."},
                    {"phase": "Guided practice", "weeks": f"{first_end + 1}-{second_end}", "focus": "Practice core skills with feedback and realistic exercises."},
                    {"phase": "Portfolio and next steps", "weeks": f"{second_end + 1}-{duration}", "focus": "Complete a course-relevant project and review next learning steps."},
                ],
                "readiness_gaps": [],
            }

        student_specs = [
            ("Asha Patel", "asha.patel@example.test", leads[0], "Active", web_course, 8.2),
            ("Mateo Rivera", "mateo.rivera@example.test", leads[1], "Active", data_course, 7.4),
            ("Lina Chen", "lina.chen@example.test", leads[2], "Active", design_course, 8.8),
            ("Samira Khan", student_user.email, leads[6], "Active", web_course, 8.6),
            ("Noah Williams", "noah.williams@example.test", leads[3], "Dropped", web_course, 6.9),
            ("Ethan Park", "ethan.park@example.test", leads[7], "Active", data_course, 7.9),
        ]
        students = []
        for index, (name, email, lead, status, course, gpa) in enumerate(student_specs):
            course_plan = make_demo_course_plan(lead, course)
            student = ensure_student(session, {
                "tenant_id": admin.tenant_id,
                "user_id": student_user.id if email == student_user.email else None,
                "name": name,
                "email": email,
                "phone": f"+1 555 011 {index + 30:02d}",
                "course_interest": course.title,
                "course_interest_id": course.id,
                "gpa": gpa,
                "education_level": lead.education_level,
                "academic_background": lead.academic_background,
                "background_details": lead.background_details or {},
                "career_goal": lead.career_goal,
                "qualification": lead.education_level,
                "source": lead.source,
                "lead_id": lead.id,
                "assigned_salesperson_id": lead.owner_id,
                "status": status,
                "course_plan": course_plan,
                "drop_reason": "Work schedule conflicted with the evening class timetable." if status == "Dropped" else None,
                "improvement_plan": "Offer a weekend cohort, schedule a check-in with the learner, and confirm affordability before re-enrollment." if status == "Dropped" else None,
                "dropped_at": now if status == "Dropped" else None,
                "dropped_by": advisor.id if status == "Dropped" else None,
                "notes": "Synthetic demo learner record. Contact and education details are fictional.",
            })
            student_user_id = student_user.id if email == student_user.email else None
            if student.user_id != student_user_id:
                student.user_id = student_user_id
                session.add(student)
            lead.converted_student_id = student.id
            lead.is_converted = True
            lead.status = "Enrolled" if status == "Active" else "Lost"
            lead.course_plan = course_plan
            session.add(lead)
            students.append(student)

        current_start = now - timedelta(days=14)
        active_batch = ensure_batch(session, {
            "tenant_id": admin.tenant_id,
            "course_id": web_course.id,
            "instructor_id": instructor_one.id,
            "batch_name": "Full Stack · October Evening",
            "batch_code": "DEMO-FS-OCT",
            "start_date": current_start,
            "end_date": now + timedelta(days=70),
            "schedule": "Mon-Wed 18:00–20:00",
            "session_duration_hours": 2,
            "assignment_strategy": "round_robin",
            "mode": "Hybrid",
            "max_seats": 18,
            "status": "Active",
            "room_or_link": "Room 2 / https://example.test/demo-class",
            "notes": "Synthetic batch for instructor/student portal testing.",
        })
        data_batch = ensure_batch(session, {
            "tenant_id": admin.tenant_id,
            "course_id": data_course.id,
            "instructor_id": instructor_two.id,
            "batch_name": "Applied Analytics · Weekend",
            "batch_code": "DEMO-DA-WKND",
            "start_date": now + timedelta(days=8),
            "end_date": now + timedelta(days=92),
            "schedule": "Sat 10:00–13:00",
            "session_duration_hours": 3,
            "assignment_strategy": "performance",
            "mode": "Online",
            "max_seats": 16,
            "status": "Upcoming",
            "room_or_link": "https://example.test/analytics-class",
            "notes": "Synthetic upcoming cohort.",
        })
        design_batch = ensure_batch(session, {
            "tenant_id": admin.tenant_id,
            "course_id": design_course.id,
            "instructor_id": instructor_three.id,
            "batch_name": "Product Design · Foundations",
            "batch_code": "DEMO-UX-FOUND",
            "start_date": now + timedelta(days=21),
            "end_date": now + timedelta(days=91),
            "schedule": "Tue-Thu 17:00–18:00",
            "session_duration_hours": 1,
            "assignment_strategy": "round_robin",
            "mode": "Offline",
            "max_seats": 14,
            "status": "Upcoming",
            "room_or_link": "Design Studio 1",
            "notes": "Synthetic upcoming cohort.",
        })
        enrollments = []
        for index, student in enumerate(students[:4]):
            course = web_course if student.course_interest_id == web_course.id else data_course
            batch = active_batch if course.id == web_course.id else data_batch
            if batch is data_batch:
                batch.status = "Active"
                batch.start_date = current_start
                session.add(batch)
            enrollment = ensure_enrollment(session, {
                "tenant_id": admin.tenant_id,
                "student_id": student.id,
                "batch_id": batch.id,
                "course_id": course.id,
                "total_fee": course.price,
                "amount_paid": course.advance_amount,
                "amount_due": course.price - course.advance_amount,
                "payment_mode": "UPI",
                "payment_status": "Partial",
                "status": "Active",
                "discount": 0,
                "enrolled_by": student.assigned_salesperson_id or sales.id,
                "slip_number": f"DEMO-ADM-{index + 1:03d}",
                "notes": "Synthetic demo enrollment.",
            })
            enrollments.append(enrollment)
            if course.advance_amount and not session.exec(select(PaymentRecord.id).where(PaymentRecord.enrollment_id == enrollment.id)).first():
                session.add(PaymentRecord(
                    tenant_id=admin.tenant_id,
                    enrollment_id=enrollment.id,
                    student_id=student.id,
                    amount=course.advance_amount,
                    payment_mode="UPI",
                    receipt_number=f"DEMO-REC-{index + 1:03d}",
                    recorded_by=student.assigned_salesperson_id or sales.id,
                    notes="Synthetic demo payment.",
                ))

        sessions = []
        for index, (title, starts, ends, status) in enumerate([
            ("HTML and semantic structure", now - timedelta(days=7), now - timedelta(days=7) + timedelta(hours=2), "Completed"),
            ("Responsive layout lab", now - timedelta(days=1), now - timedelta(days=1) + timedelta(hours=2), "Completed"),
            ("JavaScript state and events", now + timedelta(days=1), now + timedelta(days=1, hours=2), "Scheduled"),
            ("Portfolio workshop", now + timedelta(days=4), now + timedelta(days=4, hours=2), "Scheduled"),
        ], start=1):
            class_session = session.exec(select(InstituteSession).where(InstituteSession.batch_id == active_batch.id, InstituteSession.session_number == index)).first()
            if not class_session:
                class_session = InstituteSession(batch_id=active_batch.id, session_number=index, title=title, topic=title, scheduled_start=starts, scheduled_end=ends, status=status, meeting_url=active_batch.room_or_link, notes="Synthetic demo class session.")
                session.add(class_session)
                session.flush()
            else:
                class_session.title = title
                class_session.topic = title
                class_session.scheduled_start = starts
                class_session.scheduled_end = ends
                class_session.status = status
                session.add(class_session)
            sessions.append(class_session)

        for index, enrollment in enumerate(enrollments):
            for class_session in sessions[:2]:
                present_status = "Absent" if index == 3 and class_session.session_number == 2 else "Present"
                attendance = session.exec(select(Attendance).where(Attendance.session_id == class_session.id, Attendance.student_id == enrollment.student_id)).first()
                if not attendance:
                    session.add(Attendance(batch_id=active_batch.id, student_id=enrollment.student_id, session_id=class_session.id, date=class_session.scheduled_start, status=present_status, marked_by=instructor_user.id, notes="Synthetic attendance record."))
                else:
                    attendance.status = present_status
                    session.add(attendance)
            progress_value = 75 if index == 0 else 48 + index * 7
            progress = session.exec(select(StudentSessionProgress).where(StudentSessionProgress.session_id == sessions[1].id, StudentSessionProgress.student_id == enrollment.student_id)).first()
            if not progress:
                session.add(StudentSessionProgress(student_id=enrollment.student_id, batch_id=active_batch.id, session_id=sessions[1].id, status="In Progress", completion_percent=progress_value, score=80 + index * 3, notes="Synthetic instructor feedback."))
            else:
                progress.completion_percent = progress_value
                progress.score = 80 + index * 3
                session.add(progress)

        for instructor, batch, rating in [(instructor_one, active_batch, 5), (instructor_two, data_batch, 4), (instructor_three, design_batch, 5)]:
            if not session.exec(select(InstructorFeedback.id).where(InstructorFeedback.instructor_id == instructor.id, InstructorFeedback.batch_id == batch.id)).first():
                session.add(InstructorFeedback(instructor_id=instructor.id, batch_id=batch.id, student_id=students[0].id, rating=rating, teaching_quality=rating, punctuality=5, communication=rating, feedback_text="Synthetic learner feedback for instructor performance demo."))

        note_content = "Demo advising note: confirm the learner's weekly availability and preferred project before the next check-in."
        for student in students[:2]:
            if not session.exec(select(StudentNote.id).where(StudentNote.student_id == student.id, StudentNote.content == note_content)).first():
                session.add(StudentNote(student_id=student.id, author_id=advisor.id, content=note_content))

        demo_file_key = "demo-academic-record.txt"
        upload_root = os.path.join(os.path.dirname(__file__), "uploads", "students")
        os.makedirs(upload_root, exist_ok=True)
        with open(os.path.join(upload_root, demo_file_key), "w", encoding="utf-8") as demo_file:
            demo_file.write("Synthetic demo document. No real student data.\nAcademic interest: applied learning and portfolio projects.\n")
        if not session.exec(select(StudentUpload.id).where(StudentUpload.student_id == students[0].id, StudentUpload.storage_key == demo_file_key)).first():
            session.add(StudentUpload(student_id=students[0].id, uploaded_by=advisor.id, filename="demo-academic-record.txt", storage_key=demo_file_key, content_type="text/plain", size_bytes=os.path.getsize(os.path.join(upload_root, demo_file_key)), description="Synthetic uploaded document for file workflow testing."))

        session.commit()
        print("Institute demo seed complete. Synthetic records created or refreshed.")
        print("Role login credentials:")
        for role, email, password in [
            ("Admin", admin.email, PASSWORDS["admin"]),
            ("Sales Manager", sales.email, PASSWORDS["sales"]),
            ("Admissions Advisor", advisor.email, PASSWORDS["advisor"]),
            ("Instructor One", instructor_user.email, PASSWORDS["instructor"]),
            ("Instructor Two", instructor_two_user.email, PASSWORDS["instructor_two"]),
            ("Student", student_user.email, PASSWORDS["student"]),
        ]:
            print(f"{role}: {email} / {password}")
        print("Demo course catalog: " + ", ".join(course.title for course in courses))


if __name__ == "__main__":
    main()