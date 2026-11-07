"""Comprehensive Seed Script for SerpHawk CRM & Training Institute.
Seeds a complete, realistic, interconnected dataset with:
- 1 Tenant & Client Statuses
- 13 Users (SuperAdmin, Admin, SalesManager, 4 Salesmen, 5 Instructors, 2 Student users)
- 5 Professional Instructors & Profiles
- 5 Industry-grade Courses with complete syllabi
- 8 Batches (Active, Upcoming, Completed)
- 165 Diverse Leads with realistic academic profiles & AI course plans
- 58 Students (Active, Completed, Dropped with recovery plans)
- 58 Enrollments with tuition fees, payments, balances & slip numbers
- 80 Payment Transactions with receipts
- 36 Batch Sessions (past completed & upcoming scheduled)
- 160 Attendance Records
- 120 Student Session Progress & Assessment Records
- 45 Student Reviews & Instructor Feedback
- 35 Academic Advising Notes
- 60 Scheduled & Completed Meetings (Demos, Discovery, Counselling)
- 90 Follow-ups (Overdue, Due Today, Upcoming, Completed)
- 45 Lead Demo Sessions
- 40 Lead Follow-ups
- 15 Lead Walk-in Branch Visits
- 12 Lead Webinars
- 65 Lead Notes
- 75 Call Logs with durations & dispositions
- 40 Salesmen Daily Task Sheet Entries
- 130 Activity Logs
"""
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import hashlib
import os
import random
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv(override=True)

from sqlmodel import Session, select
from database import (
    ActivityLog, Attendance, Batch, CallLog, ClientStatus, Course,
    Enrollment, FollowUp, InstituteSession, Instructor, InstructorFeedback,
    Lead, LeadDemoSession, LeadFollowUp, LeadNote, LeadWalkIn, LeadWebinar,
    Meeting, PaymentRecord, Student, StudentNote, StudentSessionProgress,
    StudentUpload, TaskSheetEntry, Tenant, User, engine
)

def sha256_hash(val: str) -> str:
    return hashlib.sha256(val.encode("utf-8")).hexdigest()

def main():
    print("=" * 70)
    print("STARTING COMPREHENSIVE CRM & INSTITUTE DEMO SEED")
    print(f"Target Database Engine: {engine.url}")
    print("=" * 70)

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0, tzinfo=None)
    today = now.date()

    with Session(engine) as session:
        # 1. Tenant
        tenant = session.exec(select(Tenant).where(Tenant.id == 1)).first()
        if not tenant:
            tenant = Tenant(
                id=1,
                name="HawkTech",
                business_name="Hawk Institute of Technology & AI Academy",
                email="admissions@hawktech.edu",
                phone="+1 (555) 789-0100",
                is_trial=False,
                limit_clients=1000,
                limit_emails=50000,
                limit_searches=5000,
                limit_projects=500,
                limit_calls=10000,
                usage_clients=58,
                usage_emails=340,
                usage_searches=85,
                usage_projects=12,
                usage_calls=195,
            )
            session.add(tenant)
            session.flush()
        print(f"✓ Tenant initialized: {tenant.business_name} (ID: {tenant.id})")

        # 2. Client Statuses
        statuses = [
            ("Active", "bg-emerald-500"),
            ("Hold", "bg-amber-500"),
            ("Pending", "bg-slate-400"),
            ("Enrolled", "bg-blue-500"),
            ("Completed", "bg-purple-500"),
            ("Dropped", "bg-rose-500"),
        ]
        for name, color in statuses:
            st = session.exec(select(ClientStatus).where(ClientStatus.name == name)).first()
            if not st:
                session.add(ClientStatus(name=name, color=color))
        session.flush()
        print("✓ Client statuses initialized")

        # 3. Users: Admin, Sales Manager, 4 Salesmen, 5 Instructors, 2 Student users
        user_specs = [
            # Admins
            ("admin@serphawk.com", "Admin!2026", "Super Administrator", "SuperAdmin", "+1 555-0101"),
            ("institute.admin@hawktech.edu", "HawkAdmin!2026", "Dr. Vikram Seth", "Admin", "+1 555-0102"),
            # Sales Manager
            ("marcus.vance@hawktech.edu", "HawkSales!2026", "Marcus Vance", "SalesManager", "+1 555-0110"),
            # Salesmen / Advisors
            ("alex.chen@hawktech.edu", "HawkSales!2026", "Alex Chen", "Employee", "+1 555-0121"),
            ("sarah.jenkins@hawktech.edu", "HawkSales!2026", "Sarah Jenkins", "Employee", "+1 555-0122"),
            ("david.kumar@hawktech.edu", "HawkSales!2026", "David Kumar", "Employee", "+1 555-0123"),
            ("emily.watson@hawktech.edu", "HawkSales!2026", "Emily Watson", "Employee", "+1 555-0124"),
            # Instructors
            ("rajesh.sharma@hawktech.edu", "HawkTeach!2026", "Dr. Rajesh Sharma", "Instructor", "+1 555-0131"),
            ("ananya.verma@hawktech.edu", "HawkTeach!2026", "Ananya Verma", "Instructor", "+1 555-0132"),
            ("kevin.miller@hawktech.edu", "HawkTeach!2026", "Kevin Miller", "Instructor", "+1 555-0133"),
            ("priya.sundaram@hawktech.edu", "HawkTeach!2026", "Priya Sundaram", "Instructor", "+1 555-0134"),
            ("vikram.malhotra@hawktech.edu", "HawkTeach!2026", "Vikram Malhotra", "Instructor", "+1 555-0135"),
            # Student Logins
            ("student@hawktech.edu", "HawkLearn!2026", "Asha Patel", "Student", "+1 555-0151"),
            ("student2@hawktech.edu", "HawkLearn!2026", "Mateo Rivera", "Student", "+1 555-0152"),
        ]

        users = {}
        for email, pwd, name, role, phone in user_specs:
            u = session.exec(select(User).where(User.email == email)).first()
            hashed = sha256_hash(pwd)
            if not u:
                u = User(
                    tenant_id=tenant.id,
                    email=email,
                    password=hashed,
                    hashed_password=hashed,
                    name=name,
                    phone=phone,
                    role=role,
                    is_active=True,
                    status="Active",
                )
                session.add(u)
                session.flush()
            else:
                u.name = name
                u.role = role
                u.password = hashed
                u.hashed_password = hashed
                u.phone = phone
                session.add(u)
                session.flush()
            users[email] = u

        salesmen = [
            users["alex.chen@hawktech.edu"],
            users["sarah.jenkins@hawktech.edu"],
            users["david.kumar@hawktech.edu"],
            users["emily.watson@hawktech.edu"],
        ]
        sales_manager = users["marcus.vance@hawktech.edu"]
        print(f"✓ Users seeded: {len(users)} staff, salesmen, instructors, and demo accounts")

        # 4. Courses (5 comprehensive courses)
        course_specs = [
            {
                "title": "Full Stack Web & Cloud Development",
                "slug": "full-stack-web-cloud",
                "category": "Web Development",
                "description": "Comprehensive engineering curriculum spanning modern TypeScript, React, Next.js, FastAPI, Node.js, PostgreSQL, Docker, and AWS deployment.",
                "duration_weeks": 16,
                "duration_hours": 96,
                "price": 52000.0,
                "advance_amount": 12000.0,
                "prerequisites": "Basic programming fundamentals; familiarity with HTML/CSS is helpful.",
                "is_active": True,
                "syllabus": {
                    "modules": [
                        "Modern HTML5, Semantic Web & CSS Grid/Flexbox",
                        "TypeScript Foundations & React 19 State Patterns",
                        "Server-side Rendering & Next.js App Router Architecture",
                        "Backend APIs with FastAPI and Node.js Microservices",
                        "Relational Database Design with PostgreSQL & ORM",
                        "Docker Containerization & CI/CD Pipelines",
                        "AWS Cloud Architecture (ECS, S3, RDS) & Serverless",
                        "Full-Stack Capstone Project & Production Deployment"
                    ],
                    "outcomes": [
                        "Architect, build, and deploy production-grade web applications",
                        "Design scalable relational database schemas with high concurrency",
                        "Master end-to-end full stack development for junior-to-mid engineering roles"
                    ]
                }
            },
            {
                "title": "Applied Data Science, AI & Machine Learning",
                "slug": "applied-data-science-ai",
                "category": "Data Science",
                "description": "Hands-on data analytics and applied machine learning program covering SQL querying, Python scientific stack, Tableau dashboards, predictive modeling, and LLM orchestration.",
                "duration_weeks": 14,
                "duration_hours": 84,
                "price": 56000.0,
                "advance_amount": 14000.0,
                "prerequisites": "Foundational arithmetic and familiarity with spreadsheets.",
                "is_active": True,
                "syllabus": {
                    "modules": [
                        "Advanced Excel Modeling & Statistical Foundations",
                        "Complex SQL Querying, Window Functions & CTEs",
                        "Python Data Cleaning with Pandas, NumPy & Polars",
                        "Exploratory Data Analysis & Business Intelligence with Tableau",
                        "Applied Machine Learning (Regression, Classification, Clustering)",
                        "Natural Language Processing & LLM Prompt Engineering",
                        "Time Series Forecasting & Anomaly Detection",
                        "Enterprise Analytics Portfolio Case Study"
                    ],
                    "outcomes": [
                        "Derive executive insights and construct live KPI dashboards",
                        "Train, evaluate, and operationalize machine learning models",
                        "Build AI-augmented analytics workflows using state-of-the-art LLMs"
                    ]
                }
            },
            {
                "title": "UI/UX Product Design & User Research",
                "slug": "ui-ux-product-design",
                "category": "Design",
                "description": "Master user-centric digital product design, interactive wireframing, WCAG accessibility systems, and design systems in Figma.",
                "duration_weeks": 10,
                "duration_hours": 60,
                "price": 38000.0,
                "advance_amount": 8000.0,
                "prerequisites": "No prior design software experience required; empathy and analytical curiosity.",
                "is_active": True,
                "syllabus": {
                    "modules": [
                        "User Research Methodologies, Interviews & Empathy Maps",
                        "Information Architecture, User Journey Mapping & Sitemaps",
                        "Low-fidelity Wireframing & Rapid Iterative Prototyping",
                        "Advanced Figma Masterclass: Auto-layout, Variants & Tokens",
                        "Design Systems, Micro-interactions & Motion Principles",
                        "Accessibility (WCAG 2.2 AAA standards) & Design Audits",
                        "Usability Testing, Heatmaps & Stakeholder Presentation",
                        "Complete Product Design Portfolio Case Study"
                    ],
                    "outcomes": [
                        "Execute rigorous end-to-end user experience research and synthesis",
                        "Create polished, interactive prototypes ready for engineer handoff",
                        "Build a compelling product design portfolio ready for recruiter review"
                    ]
                }
            },
            {
                "title": "Cloud DevOps & Kubernetes Engineering",
                "slug": "cloud-devops-kubernetes",
                "category": "DevOps & Cloud",
                "description": "Master continuous integration, infrastructure as code, container orchestration, and multi-region cloud operations.",
                "duration_weeks": 12,
                "duration_hours": 72,
                "price": 48000.0,
                "advance_amount": 10000.0,
                "prerequisites": "Basic Linux command line and networking concepts.",
                "is_active": True,
                "syllabus": {
                    "modules": [
                        "Linux Administration, Shell Scripting & Network Troubleshooting",
                        "Version Control Strategies, GitOps & Trunk-based Development",
                        "CI/CD Pipelines with GitHub Actions & GitLab CI",
                        "Docker Containerization & Image Security Scanning",
                        "Kubernetes Cluster Architecture, Helm & Ingress Controllers",
                        "Infrastructure as Code with Terraform & AWS Provider",
                        "Observability, Prometheus, Grafana & Distributed Tracing",
                        "Enterprise Production Release Automation Capstone"
                    ],
                    "outcomes": [
                        "Automate deployment pipelines with zero-downtime rollouts",
                        "Manage production Kubernetes clusters on AWS/GCP with high availability",
                        "Implement security, monitoring, and alerting across distributed microservices"
                    ]
                }
            },
            {
                "title": "Cybersecurity & Ethical Hacking",
                "slug": "cybersecurity-ethical-hacking",
                "category": "Cybersecurity",
                "description": "Real-world network security, offensive security, vulnerability assessment, web exploitation, and incident response fundamentals.",
                "duration_weeks": 12,
                "duration_hours": 72,
                "price": 46000.0,
                "advance_amount": 10000.0,
                "prerequisites": "Networking basics (TCP/IP, DNS) and operating system essentials.",
                "is_active": True,
                "syllabus": {
                    "modules": [
                        "Network Protocols, Packet Inspection with Wireshark & Nmap",
                        "Web Application Penetration Testing & OWASP Top 10",
                        "Vulnerability Scanning & Exploit Analysis with Metasploit",
                        "Privilege Escalation on Linux & Windows Systems",
                        "Cryptography, PKI, SSL/TLS & Identity Protection",
                        "Security Operations Center (SOC) Workflows & SIEM Tools",
                        "Defensive Hardening, Firewalls & Threat Modeling",
                        "Live Penetration Testing Lab Capstone"
                    ],
                    "outcomes": [
                        "Conduct systematic web and network security penetration tests",
                        "Remediate OWASP Top 10 vulnerabilities in modern web applications",
                        "Prepare for industry certifications like CEH, Security+, and eJPT"
                    ]
                }
            }
        ]

        courses = []
        for cspec in course_specs:
            course = session.exec(select(Course).where(Course.slug == cspec["slug"])).first()
            if not course:
                course = Course(tenant_id=tenant.id, **cspec)
                session.add(course)
                session.flush()
            courses.append(course)
        print(f"✓ Courses seeded: {len(courses)} active courses")

        # 5. Instructors (5 profiles)
        instructor_specs = [
            (users["rajesh.sharma@hawktech.edu"], "Dr. Rajesh Sharma", "rajesh.sharma@hawktech.edu", "+1 555-0131",
             "Full Stack Development, Distributed Systems, Python, React, Next.js", "Ph.D. Computer Engineering", 10,
             "Senior engineering instructor with 10+ years of industrial full-stack and systems engineering experience.", 4.92, 145, 6),
            (users["ananya.verma@hawktech.edu"], "Ananya Verma", "ananya.verma@hawktech.edu", "+1 555-0132",
             "Data Science, Machine Learning, Generative AI, SQL, Statistical Analytics", "M.Tech Data Science (IIT)", 8,
             "Former lead AI data scientist turned educator with deep expertise in machine learning and data engineering.", 4.88, 120, 5),
            (users["kevin.miller@hawktech.edu"], "Kevin Miller", "kevin.miller@hawktech.edu", "+1 555-0133",
             "UI/UX Architecture, Interaction Design, Figma Design Systems, Accessibility", "M.Des Interaction Design", 7,
             "Product design director specializing in accessible design systems, user research, and portfolio acceleration.", 4.95, 95, 4),
            (users["priya.sundaram@hawktech.edu"], "Priya Sundaram", "priya.sundaram@hawktech.edu", "+1 555-0134",
             "Cloud Architecture, AWS, Kubernetes, Terraform, CI/CD", "AWS Certified Solutions Architect Pro", 9,
             "Cloud infrastructure consultant focused on modern container orchestration and DevOps culture.", 4.80, 85, 4),
            (users["vikram.malhotra@hawktech.edu"], "Vikram Malhotra", "vikram.malhotra@hawktech.edu", "+1 555-0135",
             "Ethical Hacking, Network Security, Pen Testing, OWASP, SOC Analysis", "CISSP, CEH Certified", 8,
             "Cybersecurity consultant and defensive security specialist training future SOC analysts and penetration testers.", 4.86, 75, 3),
        ]

        instructors = []
        for u, iname, iemail, iphone, exp, qual, yrs, bio, rating, st_count, bt_count in instructor_specs:
            inst = session.exec(select(Instructor).where(Instructor.email == iemail)).first()
            if not inst:
                inst = Instructor(
                    tenant_id=tenant.id,
                    user_id=u.id,
                    name=iname,
                    email=iemail,
                    phone=iphone,
                    expertise=exp,
                    qualification=qual,
                    experience_years=yrs,
                    bio=bio,
                    is_active=True,
                    avg_rating=rating,
                    total_students=st_count,
                    total_batches=bt_count,
                )
                session.add(inst)
                session.flush()
            instructors.append(inst)
        print(f"✓ Instructors seeded: {len(instructors)} faculty members")

        # 6. Batches (8 batches: 4 Active, 3 Upcoming, 1 Completed)
        batch_specs = [
            # Active Batches
            {
                "course_id": courses[0].id,
                "instructor_id": instructors[0].id,
                "batch_name": "Full Stack · Fall Alpha 2026",
                "batch_code": "FS-2026-F1",
                "start_date": now - timedelta(days=35),
                "end_date": now + timedelta(days=75),
                "schedule": "Mon-Wed-Fri 18:30–20:30",
                "session_duration_hours": 2,
                "assignment_strategy": "round_robin",
                "mode": "Hybrid",
                "max_seats": 25,
                "status": "Active",
                "room_or_link": "Lab 102 / https://meet.hawktech.edu/fs-fall-alpha",
                "notes": "Fast-paced evening cohort with high practical commitment.",
            },
            {
                "course_id": courses[1].id,
                "instructor_id": instructors[1].id,
                "batch_name": "Applied AI · Weekend Morning",
                "batch_code": "AI-2026-W1",
                "start_date": now - timedelta(days=28),
                "end_date": now + timedelta(days=70),
                "schedule": "Sat-Sun 10:00–13:00",
                "session_duration_hours": 3,
                "assignment_strategy": "performance",
                "mode": "Online",
                "max_seats": 25,
                "status": "Active",
                "room_or_link": "https://meet.hawktech.edu/ai-weekend-morning",
                "notes": "Weekend executive & working professional cohort.",
            },
            {
                "course_id": courses[2].id,
                "instructor_id": instructors[2].id,
                "batch_name": "UI/UX Design · Evening Studio",
                "batch_code": "UX-2026-E1",
                "start_date": now - timedelta(days=21),
                "end_date": now + timedelta(days=49),
                "schedule": "Tue-Thu 17:00–19:00",
                "session_duration_hours": 2,
                "assignment_strategy": "round_robin",
                "mode": "Offline",
                "max_seats": 20,
                "status": "Active",
                "room_or_link": "Studio 301 (Main Campus)",
                "notes": "Studio critique and hands-on Figma lab sessions.",
            },
            {
                "course_id": courses[3].id,
                "instructor_id": instructors[3].id,
                "batch_name": "DevOps & Cloud · Fast Track",
                "batch_code": "DO-2026-FT1",
                "start_date": now - timedelta(days=14),
                "end_date": now + timedelta(days=70),
                "schedule": "Mon-Wed 19:00–21:00",
                "session_duration_hours": 2,
                "assignment_strategy": "performance",
                "mode": "Online",
                "max_seats": 22,
                "status": "Active",
                "room_or_link": "https://meet.hawktech.edu/devops-fasttrack",
                "notes": "Cloud infrastructure automation track.",
            },
            # Upcoming Batches
            {
                "course_id": courses[4].id,
                "instructor_id": instructors[4].id,
                "batch_name": "Cybersecurity · Winter Bootcamp",
                "batch_code": "CS-2026-W1",
                "start_date": now + timedelta(days=10),
                "end_date": now + timedelta(days=94),
                "schedule": "Sat-Sun 14:00–17:00",
                "session_duration_hours": 3,
                "assignment_strategy": "round_robin",
                "mode": "Hybrid",
                "max_seats": 25,
                "status": "Upcoming",
                "room_or_link": "Cyber Lab 4 / https://meet.hawktech.edu/cyber-winter",
                "notes": "Hands-on offensive & defensive security boot camp.",
            },
            {
                "course_id": courses[0].id,
                "instructor_id": instructors[0].id,
                "batch_name": "Full Stack · Winter Cohort",
                "batch_code": "FS-2026-W2",
                "start_date": now + timedelta(days=18),
                "end_date": now + timedelta(days=130),
                "schedule": "Tue-Thu 18:30–20:30",
                "session_duration_hours": 2,
                "assignment_strategy": "round_robin",
                "mode": "Online",
                "max_seats": 25,
                "status": "Upcoming",
                "room_or_link": "https://meet.hawktech.edu/fs-winter-2",
                "notes": "Online evening cohort for Q4.",
            },
            {
                "course_id": courses[1].id,
                "instructor_id": instructors[1].id,
                "batch_name": "Data Science · Winter Intensive",
                "batch_code": "AI-2026-W2",
                "start_date": now + timedelta(days=25),
                "end_date": now + timedelta(days=123),
                "schedule": "Mon-Wed 18:00–20:30",
                "session_duration_hours": 2,
                "assignment_strategy": "round_robin",
                "mode": "Hybrid",
                "max_seats": 20,
                "status": "Upcoming",
                "room_or_link": "Room 205 / https://meet.hawktech.edu/ai-winter-intensive",
                "notes": "Advanced ML applications & LLM deployment.",
            },
            # Completed Batch
            {
                "course_id": courses[0].id,
                "instructor_id": instructors[0].id,
                "batch_name": "Full Stack · Summer 2026 Intensive",
                "batch_code": "FS-2026-SUM",
                "start_date": now - timedelta(days=120),
                "end_date": now - timedelta(days=8),
                "schedule": "Mon-Fri 10:00–12:00",
                "session_duration_hours": 2,
                "assignment_strategy": "performance",
                "mode": "Offline",
                "max_seats": 18,
                "status": "Completed",
                "room_or_link": "Hall A",
                "notes": "Graduated summer cohort with 92% portfolio completion.",
            }
        ]

        batches = []
        for bspec in batch_specs:
            b = session.exec(select(Batch).where(Batch.batch_code == bspec["batch_code"])).first()
            if not b:
                b = Batch(tenant_id=tenant.id, **bspec)
                session.add(b)
                session.flush()
            batches.append(b)
        print(f"✓ Batches seeded: {len(batches)} batches across active, upcoming, and completed states")

        # 7. Generate 165 Realistic Leads
        # Distribution: 58 Enrolled/Converted, 32 Demo, 35 Interested, 20 Contacted, 12 New, 8 Lost
        random.seed(42)

        first_names = [
            "Aarav", "Aditi", "Aishwarya", "Akash", "Ananya", "Aniket", "Ankita", "Arjun", "Deepak",
            "Divya", "Gaurav", "Harsh", "Isha", "Karan", "Kavita", "Kiran", "Madhav", "Manish",
            "Meera", "Neha", "Nikhil", "Nisha", "Pooja", "Pranav", "Prateek", "Priya", "Rahul",
            "Rakesh", "Rhea", "Rohan", "Rohit", "Ruchi", "Sachin", "Sameer", "Sandhya", "Sanjay",
            "Saurabh", "Shreya", "Siddharth", "Sneha", "Sonali", "Tanvi", "Tarun", "Umesh", "Varun",
            "Vidya", "Vikram", "Vikas", "Vinay", "Yash", "Zoya", "Alexander", "Chloe", "Daniel",
            "Elena", "Gabriel", "Hannah", "James", "Laura", "Lucas", "Maya", "Nathan", "Olivia",
            "Samuel", "Sophia", "Thomas", "Victoria", "William", "Zoe", "Amir", "Farhan", "Fatima",
            "Imran", "Layla", "Tariq", "Yasmin", "Zain"
        ]
        last_names = [
            "Sharma", "Verma", "Gupta", "Patel", "Reddy", "Nair", "Iyer", "Choudhury", "Bose", "Mehta",
            "Joshi", "Kulkarni", "Deshmukh", "Singhania", "Aggarwal", "Kapoor", "Malhotra", "Khanna",
            "Bhatia", "Saxena", "Trivedi", "Mishra", "Pandey", "Shukla", "Bhardwaj", "Goswami",
            "Menon", "Pillai", "Rao", "Hegde", "Shetty", "Kamath", "Shenoy", "Fernandes", "D'Souza",
            "Taylor", "Smith", "Johnson", "Davis", "Wilson", "Anderson", "Martinez", "Clark", "Lewis",
            "Walker", "Hall", "Young", "King", "Wright", "Lopez", "Hill", "Green", "Adams", "Baker"
        ]

        academic_majors = [
            ("B.Tech Computer Science", "Engineering graduate seeking career acceleration in cloud web architecture.", "Bachelor's"),
            ("BCA (Computer Applications)", "Computer applications student wanting full-stack production skills.", "Bachelor's"),
            ("B.Sc Information Technology", "IT graduate with solid scripting foundation looking for modern web engineering.", "Bachelor's"),
            ("B.Tech Electronics & Comm.", "Hardware/networking background transitioning into software & cloud services.", "Bachelor's"),
            ("B.Sc Statistics & Math", "Strong quantitative background looking to build end-to-end data science pipelines.", "Bachelor's"),
            ("B.Com (Finance & Accounting)", "Financial analyst transitioning to business intelligence and predictive modeling.", "Bachelor's"),
            ("B.Tech Mechanical Engg.", "Engineering professional switching to high-demand cloud DevOps roles.", "Bachelor's"),
            ("B.A. Graphic Design & Media", "Visual designer transitioning into digital UI/UX product design systems.", "Bachelor's"),
            ("M.Sc Data Analytics", "Postgraduate wanting hands-on LLM fine-tuning and enterprise AI architecture.", "Master's"),
            ("MCA (Computer Applications)", "Postgraduate seeking senior full-stack development and cloud engineering roles.", "Master's"),
            ("High School (Grade 12)", "Tech enthusiast seeking vocational intensive path into software engineering.", "High school"),
            ("Diploma in Computer Engg.", "Polytechnic diploma holder wanting industry project portfolio.", "Diploma"),
            ("BBA (Business Administration)", "Product operations coordinator aiming for UI/UX product design management.", "Bachelor's"),
            ("B.Tech Electrical Engg.", "Transitioning to cybersecurity, penetration testing, and SOC analysis.", "Bachelor's"),
        ]

        career_goals = [
            "Secure an entry-level Full Stack Web Developer position at a product startup",
            "Transition into an Applied Data Scientist or Analytics Consultant role",
            "Build an industry-standard UI/UX portfolio and join a product design team",
            "Advance from Junior Sysadmin to Cloud DevOps Engineer on AWS/Kubernetes",
            "Pass CEH certification and land a position in a Security Operations Center (SOC)",
            "Promote from QA manual tester to automated full-stack software engineer",
            "Transition from commercial sales reporting to BI Analytics Engineer",
            "Lead accessibility-compliant user experience redesigns for enterprise SaaS"
        ]

        sources = ["Website", "Referral", "Google Ads", "LinkedIn", "Campus Event", "Walk-in", "Webinar", "Social Media", "Open Day"]

        lead_records = []
        lead_counter = 0

        # We will create 165 leads total:
        # 58 Enrolled/Converted
        # 32 Demo (18 Demo Scheduled, 14 Demo Completed)
        # 35 Interested
        # 20 Contacted
        # 12 New
        # 8 Lost
        statuses_plan = (
            ["Enrolled"] * 58 +
            ["Demo Scheduled"] * 18 +
            ["Demo Completed"] * 14 +
            ["Interested"] * 35 +
            ["Contacted"] * 20 +
            ["New"] * 12 +
            ["Lost"] * 8
        )

        used_emails = set()

        for idx, target_status in enumerate(statuses_plan):
            lead_counter += 1
            fname = first_names[(idx * 7 + 3) % len(first_names)]
            lname = last_names[(idx * 11 + 5) % len(last_names)]
            full_name = f"{fname} {lname}"

            # Special designated demo students
            if idx == 0:
                full_name = "Asha Patel"
                email = "student@hawktech.edu"
            elif idx == 1:
                full_name = "Mateo Rivera"
                email = "student2@hawktech.edu"
            else:
                email = f"{fname.lower()}.{lname.lower()}{lead_counter}@learner.hawktech.test"

            used_emails.add(email)

            # Assign to course & salesman
            course = courses[idx % len(courses)]
            salesman = salesmen[idx % len(salesmen)]
            source = sources[(idx * 3) % len(sources)]
            major_info, background_desc, edu_level = academic_majors[idx % len(academic_majors)]
            goal = career_goals[(idx * 2) % len(career_goals)]
            gpa = round(6.5 + (idx % 33) * 0.1, 1)

            # Lead created date spread over last 75 days
            created_days_ago = max(1, 75 - (idx * 73 // len(statuses_plan)))
            lead_created_at = now - timedelta(days=created_days_ago, hours=(idx % 12) + 8)

            # AI Course Plan
            course_plan = {
                "course_id": course.id,
                "course_title": course.title,
                "category": course.category,
                "duration_weeks": course.duration_weeks,
                "fit_score_percent": min(98, 75 + (idx % 22)),
                "fit_dimensions": {
                    "interest_match": 95 if (idx % 2 == 0) else 85,
                    "career_goal_alignment": 90,
                    "background_relevance": 82,
                    "academic_readiness": round(gpa * 10),
                },
                "profile_completeness_percent": 100,
                "learning_roadmap": [
                    {"phase": "Foundations", "weeks": "1-4", "focus": "Core principles & lab environment setup"},
                    {"phase": "Deep Dive", "weeks": "5-10", "focus": "Practical architecture & weekly milestone reviews"},
                    {"phase": "Portfolio Capstone", "weeks": "11-16", "focus": "Live deployable project & mock interviews"},
                ],
                "fit_reason": f"Strong alignment between candidate background ({major_info}) and curriculum outcomes for {course.title}.",
                "generated_by": "HawkAI Engine v2",
            }

            swot_text = (
                f"STRENGTHS: Solid foundation in {major_info}; high motivation for {goal}.\n"
                f"WEAKNESSES: Needs disciplined structure for real-world project deadlines.\n"
                f"OPPORTUNITIES: High market demand for certified graduates in {course.category}.\n"
                f"THREATS: Time balance with current employment or university commitments."
            )

            lead = Lead(
                tenant_id=tenant.id,
                company_name=full_name,
                email=email,
                phone=f"+1 555-0{(idx % 800) + 100:03d}",
                website=f"https://github.com/{fname.lower()}{lead_counter}",
                address=f"{100 + idx} College Ave, Suite {idx % 20 + 1}",
                source=source,
                owner_id=salesman.id,
                status=target_status,
                industry=course.category,
                course_interest_id=course.id,
                gpa=gpa,
                education_level=edu_level,
                academic_background=background_desc,
                background_details={
                    "degree": major_info,
                    "education_level": edu_level,
                    "target_role": goal,
                    "availability": "15-20 hours per week",
                    "laptop_available": True,
                },
                career_goal=goal,
                course_plan=course_plan,
                swot_analysis=swot_text,
                notes=f"Initial discovery notes: Lead expressed keen interest during {source} inquiry. Advised by {salesman.name}.",
                created_at=lead_created_at,
                last_activity=f"Status: {target_status} as of {today.strftime('%b %d')}",
            )
            session.add(lead)
            session.flush()
            lead_records.append((lead, course, salesman, gpa, edu_level, major_info, goal, target_status))

        print(f"✓ Leads seeded: {len(lead_records)} leads created across all sales stages")

        # 8. Convert 58 Leads into Students with Enrollments, Fees & Payments
        converted_leads = lead_records[:58]
        students = []
        enrollments = []
        payments = []

        # Batches mapping:
        # Active: FS Fall Alpha (0), AI Weekend (1), UX Evening (2), DevOps FastTrack (3)
        # Upcoming: Cyber Bootcamp (4), FS Winter (5), AI Winter (6)
        # Completed: FS Summer (7)
        batch_map_by_course = {
            courses[0].id: [batches[0], batches[5], batches[7]],  # FS
            courses[1].id: [batches[1], batches[6]],              # AI
            courses[2].id: [batches[2]],                          # UX
            courses[3].id: [batches[3]],                          # DevOps
            courses[4].id: [batches[4]],                          # Cyber
        }

        payment_modes = ["UPI", "Credit Card", "Bank Transfer", "Net Banking"]

        for s_idx, (lead, course, salesman, gpa, edu_level, major_info, goal, _) in enumerate(converted_leads):
            # Student status: 48 Active, 5 Completed, 5 Dropped
            if s_idx < 48:
                st_status = "Active"
                target_batch = batch_map_by_course[course.id][0]
                drop_reason = None
                drop_plan = None
                dropped_at = None
                dropped_by = None
            elif s_idx < 53:
                st_status = "Completed"
                target_batch = batches[7] if course.id == courses[0].id else batch_map_by_course[course.id][0]
                drop_reason = None
                drop_plan = None
                dropped_at = None
                dropped_by = None
            else:
                st_status = "Dropped"
                target_batch = batch_map_by_course[course.id][0]
                drop_reason = "Relocated for family obligations / unexpected work schedule change."
                drop_plan = "Offer transfer to asynchronous online cohort or next semester weekend schedule."
                dropped_at = now - timedelta(days=5 + s_idx)
                dropped_by = salesman.id

            user_account_id = None
            if lead.email == "student@hawktech.edu":
                user_account_id = users["student@hawktech.edu"].id
            elif lead.email == "student2@hawktech.edu":
                user_account_id = users["student2@hawktech.edu"].id

            student = Student(
                tenant_id=tenant.id,
                user_id=user_account_id,
                name=lead.company_name,
                email=lead.email,
                phone=lead.phone,
                address=lead.address,
                course_interest=course.title,
                course_interest_id=course.id,
                gpa=gpa,
                education_level=edu_level,
                academic_background=lead.academic_background,
                background_details=lead.background_details,
                career_goal=goal,
                qualification=edu_level,
                source=lead.source,
                lead_id=lead.id,
                assigned_salesperson_id=salesman.id,
                status=st_status,
                drop_reason=drop_reason,
                improvement_plan=drop_plan,
                dropped_at=dropped_at,
                dropped_by=dropped_by,
                course_plan=lead.course_plan,
                notes=f"Student enrolled via {salesman.name}. Admission confirmed.",
                created_at=lead.created_at + timedelta(days=2),
            )
            session.add(student)
            session.flush()

            # Mark Lead as converted
            lead.is_converted = True
            lead.converted_student_id = student.id
            lead.status = "Enrolled"
            session.add(lead)

            # Financials for Enrollment
            total_fee = course.price
            advance_req = course.advance_amount

            # Fee payment statuses
            if st_status == "Completed":
                amount_paid = total_fee
                amount_due = 0.0
                pay_status = "Paid"
            elif s_idx % 3 == 0:
                amount_paid = total_fee
                amount_due = 0.0
                pay_status = "Paid"
            else:
                amount_paid = advance_req
                amount_due = total_fee - advance_req
                pay_status = "Partial"

            pmode = payment_modes[s_idx % len(payment_modes)]
            slip_no = f"HAWK-ADM-2026-{(s_idx + 1):03d}"

            enrollment = Enrollment(
                tenant_id=tenant.id,
                student_id=student.id,
                batch_id=target_batch.id,
                course_id=course.id,
                enrollment_date=student.created_at,
                total_fee=total_fee,
                amount_paid=amount_paid,
                amount_due=amount_due,
                payment_mode=pmode,
                payment_status=pay_status,
                status=st_status if st_status != "Dropped" else "Dropped",
                admission_slip_generated=True,
                advance_slip_generated=True,
                slip_number=slip_no,
                enrolled_by=salesman.id,
                notes=f"Admission processed by {salesman.name}. Slip #{slip_no}.",
                created_at=student.created_at,
            )
            session.add(enrollment)
            session.flush()
            enrollments.append(enrollment)
            target_batch.enrolled_count += 1
            session.add(target_batch)

            # Add Payment Record 1: Advance
            rec_no1 = f"HAWK-REC-2026-{(len(payments) + 1):04d}"
            p1 = PaymentRecord(
                tenant_id=tenant.id,
                enrollment_id=enrollment.id,
                student_id=student.id,
                amount=advance_req,
                payment_mode=pmode,
                payment_date=student.created_at,
                receipt_number=rec_no1,
                notes=f"Admission advance payment for {course.title}.",
                recorded_by=salesman.id,
                created_at=student.created_at,
            )
            session.add(p1)
            payments.append(p1)

            # Add Payment Record 2 if fully paid
            if pay_status == "Paid" and amount_paid > advance_req:
                rec_no2 = f"HAWK-REC-2026-{(len(payments) + 1):04d}"
                p2 = PaymentRecord(
                    tenant_id=tenant.id,
                    enrollment_id=enrollment.id,
                    student_id=student.id,
                    amount=total_fee - advance_req,
                    payment_mode=pmode,
                    payment_date=student.created_at + timedelta(days=14),
                    receipt_number=rec_no2,
                    notes=f"Second fee installment & full balance clearance.",
                    recorded_by=salesman.id,
                    created_at=student.created_at + timedelta(days=14),
                )
                session.add(p2)
                payments.append(p2)

            students.append(student)

        session.flush()
        print(f"✓ Students seeded: {len(students)} learners enrolled (48 Active, 5 Alumni, 5 Dropped)")
        print(f"✓ Enrollments seeded: {len(enrollments)} records with tuition & admission slips")
        print(f"✓ Payment records seeded: {len(payments)} transaction receipts")

        # 9. Class Sessions, Attendance, Progress & Instructor Feedback
        session_topics = {
            courses[0].id: [
                "HTML5 Semantics, Modern CSS Grid & Accessibility",
                "Advanced TypeScript Types, Generics & Linting",
                "React 19 Hooks, Custom Context & State Architecture",
                "Next.js App Router, Server Components & Dynamic Routing",
                "FastAPI REST Endpoints, Pydantic V2 & Auth Middleware",
                "PostgreSQL Schema Design, Relational Indexes & Migrations",
                "Docker Containers, Multi-stage Builds & Compose",
                "Full-stack Capstone Project Review & Portfolio Deployment"
            ],
            courses[1].id: [
                "Statistical Foundations, Distributions & Hypothesis Testing",
                "Complex SQL Aggregations, Window Functions & CTE Queries",
                "Data Cleaning & Feature Engineering with Pandas & NumPy",
                "Exploratory Analysis & Executive Dashboards with Tableau",
                "Supervised Machine Learning: Regression & Classification",
                "Unsupervised ML: Customer Segmentation & K-Means",
                "LLM Prompt Engineering, RAG Architectures & Vector DBs",
                "Production Analytics Capstone & Model Evaluation Presentation"
            ],
            courses[2].id: [
                "User Research Methodologies, User Interviews & Journey Maps",
                "Information Architecture, Card Sorting & Sitemap Creation",
                "Figma Component Architecture, Auto-layout & Design Tokens",
                "Interactive Prototyping, Micro-interactions & Motion",
                "Usability Testing Sessions, Accessibility & Design Audits",
                "Comprehensive Product Design Portfolio Case Study Review"
            ],
            courses[3].id: [
                "Linux Kernel Tuning, Bash Automation & SSH Key Management",
                "GitOps Principles & GitHub Actions Automated CI/CD",
                "Docker Microservices Orchestration & Security Hardening",
                "Kubernetes Deployments, StatefulSets & Ingress Routing",
                "Infrastructure as Code with Terraform & AWS Provider",
                "Prometheus Monitoring, Grafana Alerts & Incident Runbooks"
            ],
            courses[4].id: [
                "TCP/IP Networking, Wireshark Packet Analysis & Port Scans",
                "Web Vulnerability Exploitation: SQLi, XSS, CSRF & SSRF",
                "Metasploit Framework, Buffer Overflows & Exploit Analysis",
                "Linux/Windows Privilege Escalation & Active Directory Basics",
                "SOC Incident Response Workflows & Splunk Log Analysis",
                "Live Fire Penetration Testing Lab Capstone Defense"
            ]
        }

        sessions_created = []
        feedback_created = []
        attendance_created = []
        progress_created = []

        # Populate sessions for the 4 active batches and 1 completed batch
        active_and_completed_batches = [batches[0], batches[1], batches[2], batches[3], batches[7]]
        for batch in active_and_completed_batches:
            course = next(c for c in courses if c.id == batch.course_id)
            topics = session_topics.get(course.id, session_topics[courses[0].id])
            instructor = next(inst for inst in instructors if inst.id == batch.instructor_id)

            batch_start = batch.start_date
            is_completed_batch = (batch.status == "Completed")

            for s_num, topic_title in enumerate(topics, start=1):
                # Calculate session date
                if is_completed_batch:
                    session_time = batch_start + timedelta(days=(s_num - 1) * 3)
                    sess_status = "Completed"
                else:
                    session_time = batch_start + timedelta(days=(s_num - 1) * 4)
                    sess_status = "Completed" if session_time < now else "Scheduled"

                inst_session = InstituteSession(
                    tenant_id=tenant.id,
                    batch_id=batch.id,
                    session_number=s_num,
                    title=f"Session {s_num}: {topic_title}",
                    topic=topic_title,
                    scheduled_start=session_time,
                    scheduled_end=session_time + timedelta(hours=batch.session_duration_hours or 2),
                    status=sess_status,
                    meeting_url=batch.room_or_link,
                    notes=f"Class syllabus lecture {s_num} conducted by {instructor.name}.",
                    created_at=batch_start,
                )
                session.add(inst_session)
                session.flush()
                sessions_created.append((inst_session, batch, instructor))

                # Attendance and progress for completed sessions
                if sess_status == "Completed":
                    # Get enrolled students in this batch
                    batch_enrollments = [e for e in enrollments if e.batch_id == batch.id and e.status in ("Active", "Completed")]
                    for e_idx, benroll in enumerate(batch_enrollments):
                        att_status = "Present" if (e_idx + s_num) % 11 != 0 else "Absent"
                        if (e_idx + s_num) % 17 == 0:
                            att_status = "Late"

                        att = Attendance(
                            tenant_id=tenant.id,
                            batch_id=batch.id,
                            student_id=benroll.student_id,
                            session_id=inst_session.id,
                            date=session_time,
                            status=att_status,
                            marked_by=instructor.user_id,
                            notes="Attended live class session and completed in-class lab exercises." if att_status == "Present" else "Absent with prior notice.",
                            created_at=session_time,
                        )
                        session.add(att)
                        attendance_created.append(att)

                        score_val = 82 + ((e_idx * 7 + s_num * 3) % 16)
                        prog = StudentSessionProgress(
                            tenant_id=tenant.id,
                            student_id=benroll.student_id,
                            batch_id=batch.id,
                            session_id=inst_session.id,
                            status="Completed" if att_status == "Present" else "Pending Review",
                            completion_percent=100 if att_status == "Present" else 45,
                            score=score_val if att_status == "Present" else None,
                            notes=f"Practical lab submission score: {score_val}/100. Instructor feedback provided.",
                        )
                        session.add(prog)
                        progress_created.append(prog)

        session.flush()
        print(f"✓ Institute sessions seeded: {len(sessions_created)} lectures")
        print(f"✓ Attendance records seeded: {len(attendance_created)} daily logs")
        print(f"✓ Student session progress seeded: {len(progress_created)} evaluations")

        # 10. Instructor Feedback (45 realistic learner reviews)
        feedback_texts = [
            "Dr. Rajesh makes complex backend concurrency and database tuning exceptionally easy to follow. Best coding instructor I've ever had!",
            "Ananya is brilliant at explaining ML intuition before diving into Python code. The real-world case studies made all the difference.",
            "Kevin's Figma design system lectures and live critique sessions gave me the confidence to build my full design portfolio.",
            "Priya breaks down Kubernetes cluster orchestration into intuitive mental models. The hands-on terminal labs were phenomenal.",
            "Vikram's offensive security labs gave us hands-on experience with live CTFs and vulnerability analysis. Highly recommended!",
            "Patient mentor who answers every question and provides actionable code review on Git pull requests.",
            "The curriculum pacing is intense but the instructor's support and practical feedback ensure nobody falls behind.",
            "Super engaging lectures with relevant industry tips that helped me ace technical screening questions."
        ]

        for f_idx, (inst_session, batch, instructor) in enumerate(sessions_created[:45]):
            batch_enrollments = [e for e in enrollments if e.batch_id == batch.id]
            if not batch_enrollments:
                continue
            student_id = batch_enrollments[f_idx % len(batch_enrollments)].student_id
            rating = 5 if f_idx % 4 != 0 else 4
            fb = InstructorFeedback(
                tenant_id=tenant.id,
                instructor_id=instructor.id,
                batch_id=batch.id,
                student_id=student_id,
                rating=rating,
                teaching_quality=5 if rating == 5 else 4,
                punctuality=5,
                communication=5 if rating == 5 else 4,
                feedback_text=feedback_texts[f_idx % len(feedback_texts)],
                created_at=inst_session.scheduled_start + timedelta(days=1),
            )
            session.add(fb)
            feedback_created.append(fb)

        session.flush()
        print(f"✓ Instructor feedback seeded: {len(feedback_created)} verified student reviews")

        # 11. Student Notes (35 staff advising & mentoring entries)
        student_notes = []
        note_templates = [
            "Conducted academic 1-on-1 check-in. Student is performing well in practical assignments and staying on track with milestones.",
            "Discussed capstone project proposal. Recommended focusing on enterprise SaaS architecture with multi-tenant database support.",
            "Followed up regarding weekend study group. Student confirmed they formed a peer review group for weekly coding labs.",
            "Scholarship & fee schedule review: Student confirmed timely clearance of final fee installment.",
            "Career advising session: Reviewed resume structure, GitHub portfolio highlights, and LinkedIn headline optimization."
        ]
        for n_idx, student in enumerate(students[:35]):
            sn = StudentNote(
                tenant_id=tenant.id,
                student_id=student.id,
                author_id=student.assigned_salesperson_id or salesmen[0].id,
                content=note_templates[n_idx % len(note_templates)],
                created_at=now - timedelta(days=(n_idx % 30) + 1),
            )
            session.add(sn)
            student_notes.append(sn)
        session.flush()
        print(f"✓ Student notes seeded: {len(student_notes)} advising notes")

        # 12. Meetings (60 Scheduled & Completed Meetings)
        # Types: Demo, Discovery, Admissions Counselling, Follow-up
        meetings_created = []
        meeting_types = ["Demo", "Discovery", "Admissions Counselling", "Follow-up", "Portfolio Review"]

        for m_idx in range(60):
            lead_idx = m_idx % len(lead_records)
            lead, course, salesman, _, _, _, _, _ = lead_records[lead_idx]
            mtype = meeting_types[m_idx % len(meeting_types)]

            # Days offset: past 35 days, today, or next 14 days
            day_offset = (m_idx % 45) - 30
            m_time = now + timedelta(days=day_offset, hours=(m_idx % 8) + 10)
            is_past = m_time < now
            status = "Completed" if is_past else "Scheduled"
            if is_past and m_idx % 13 == 0:
                status = "No-show"

            meeting = Meeting(
                tenant_id=tenant.id,
                title=f"{mtype}: {course.title} with {lead.company_name}",
                description=f"{mtype} session discussing curriculum fit, schedule availability, and career outcomes for {course.title}.",
                location=f"https://meet.hawktech.edu/consult-{m_idx + 100}",
                meeting_type=mtype,
                status=status,
                scheduled_at=m_time,
                duration_minutes=45 if mtype == "Demo" else 30,
                host_id=salesman.id,
                lead_id=lead.id,
                attendees=[lead.email, salesman.email],
                notes=f"Meeting agenda: {mtype} for prospective student {lead.company_name}. Host: {salesman.name}.",
                outcome=f"Session {status.lower()}. Candidate showed enthusiasm for {course.title}." if is_past else None,
                created_at=m_time - timedelta(days=3),
            )
            session.add(meeting)
            meetings_created.append(meeting)

        session.flush()
        print(f"✓ Meetings seeded: {len(meetings_created)} sessions across Demos, Discovery, and Counselling")

        # 13. Follow-ups (90 records in crm_follow_ups)
        # Channels: call, email, meeting, whatsapp
        # Statuses: Completed (past), Pending (due today, overdue, upcoming)
        followups_created = []
        channels = ["call", "email", "meeting", "whatsapp"]
        priorities = ["high", "medium", "low"]

        followup_titles = [
            "Follow up on course curriculum brochure and syllabus review",
            "Check in after weekend AI & ML demo session",
            "Discuss installment payment plan & early bird discount",
            "Review academic prerequisite readiness for upcoming cohort",
            "Confirm seat reservation before batch registration closes",
            "Send alumni placement report and salary benchmark survey",
            "Answer questions regarding weekend lab schedule and timings",
            "Call prospective learner to confirm enrollment documentation"
        ]

        for f_idx in range(90):
            lead_idx = f_idx % len(lead_records)
            lead, course, salesman, _, _, _, _, _ = lead_records[lead_idx]

            # Distribution of due dates:
            # 30 Overdue (past 1-10 days, Pending)
            # 15 Due Today (Pending)
            # 20 Upcoming (next 1-14 days, Pending)
            # 25 Completed (past, Completed)
            if f_idx < 30:
                f_status = "Pending"
                f_due = now - timedelta(days=(f_idx % 10) + 1, hours=3)
                completed_at = None
                outcome = None
            elif f_idx < 45:
                f_status = "Pending"
                f_due = now.replace(hour=14, minute=0)
                completed_at = None
                outcome = None
            elif f_idx < 65:
                f_status = "Pending"
                f_due = now + timedelta(days=(f_idx % 14) + 1, hours=2)
                completed_at = None
                outcome = None
            else:
                f_status = "Completed"
                f_due = now - timedelta(days=(f_idx % 25) + 3)
                completed_at = f_due + timedelta(hours=1)
                outcome = "Spoke with candidate. Addressed schedule queries and shared enrollment link."

            channel = channels[f_idx % len(channels)]
            priority = priorities[f_idx % len(priorities)]
            title = followup_titles[f_idx % len(followup_titles)]

            fu = FollowUp(
                tenant_id=tenant.id,
                lead_id=lead.id,
                student_id=lead.converted_student_id,
                contact_name=lead.company_name,
                contact_email=lead.email,
                company_name="Prospective Learner",
                title=f"{title} - {lead.company_name}",
                notes=f"Sales reminder for {salesman.name}: {title} for {course.title}.",
                channel=channel,
                due_at=f_due,
                remind_at=f_due,
                status=f_status,
                priority=priority,
                source="manual",
                assigned_to=salesman.id,
                created_by=salesman.id,
                email_subject=f"Next Steps for Your {course.title} Journey" if channel == "email" else None,
                email_body=f"Hi {lead.company_name.split()[0]},\n\nFollowing up on our recent conversation regarding {course.title}. Let me know if you would like to reserve your seat for the upcoming cohort!\n\nBest regards,\n{salesman.name}" if channel == "email" else None,
                completed_at=completed_at,
                completed_by=salesman.id if completed_at else None,
                outcome=outcome,
            )
            session.add(fu)
            followups_created.append(fu)

        session.flush()
        print(f"✓ Follow-ups seeded: {len(followups_created)} tasks (Overdue, Due Today, Upcoming & Completed)")

        # 14. Lead Interactive Sessions: LeadDemoSession, LeadFollowUp, LeadWalkIn, LeadWebinar, LeadNote
        demos_created = []
        lead_followups_created = []
        walkins_created = []
        webinars_created = []
        lead_notes_created = []

        # Demos: 45 records
        for d_idx in range(45):
            lead, course, salesman, _, _, _, _, _ = lead_records[d_idx % len(lead_records)]
            is_done = d_idx < 28
            sched_time = now - timedelta(days=28 - d_idx) if is_done else now + timedelta(days=d_idx - 25)
            demo = LeadDemoSession(
                tenant_id=tenant.id,
                lead_id=lead.id,
                scheduled_at=sched_time,
                status="Completed" if is_done else "Scheduled",
                meeting_url=f"https://meet.hawktech.edu/demo-{d_idx + 1}",
                notes=f"Interactive 1-on-1 demo on {course.title} architecture and live coding preview.",
                created_by=salesman.id,
                created_at=sched_time - timedelta(days=2),
            )
            session.add(demo)
            demos_created.append(demo)

        # LeadFollowUps: 40 records
        for lf_idx in range(40):
            lead, course, salesman, _, _, _, _, _ = lead_records[lf_idx % len(lead_records)]
            is_done = lf_idx < 25
            l_fu = LeadFollowUp(
                tenant_id=tenant.id,
                lead_id=lead.id,
                scheduled_at=now - timedelta(days=25 - lf_idx) if is_done else now + timedelta(days=lf_idx - 20),
                status="Done" if is_done else "Pending",
                notes=f"Advising follow-up for {course.title}. Action taken by {salesman.name}.",
                created_by=salesman.id,
            )
            session.add(l_fu)
            lead_followups_created.append(l_fu)

        # Walk-ins: 15 records
        for w_idx in range(15):
            lead, course, salesman, _, _, _, _, _ = lead_records[w_idx * 3]
            is_done = w_idx < 10
            wi = LeadWalkIn(
                tenant_id=tenant.id,
                lead_id=lead.id,
                scheduled_at=now - timedelta(days=10 - w_idx) if is_done else now + timedelta(days=w_idx - 8),
                status="Attended" if is_done else "Scheduled",
                location="Main Campus - Admissions Center, 2nd Floor",
                notes=f"In-person campus visit and lab tour for {course.title}.",
                created_by=salesman.id,
            )
            session.add(wi)
            walkins_created.append(wi)

        # Webinars: 12 records
        for web_idx in range(12):
            lead, course, salesman, _, _, _, _, _ = lead_records[web_idx * 4]
            is_done = web_idx < 8
            wb = LeadWebinar(
                tenant_id=tenant.id,
                lead_id=lead.id,
                scheduled_at=now - timedelta(days=8 - web_idx) if is_done else now + timedelta(days=web_idx - 6),
                status="Attended" if is_done else "Scheduled",
                meeting_url=f"https://meet.hawktech.edu/webinar-series-{web_idx + 1}",
                notes=f"Live Industry Masterclass: Future of {course.category} in 2026.",
                created_by=salesman.id,
            )
            session.add(wb)
            webinars_created.append(wb)

        # LeadNotes: 65 records
        for ln_idx in range(65):
            lead, course, salesman, _, _, _, _, _ = lead_records[ln_idx % len(lead_records)]
            lnote = LeadNote(
                tenant_id=tenant.id,
                lead_id=lead.id,
                author_id=salesman.id,
                content=f"Consultation Note: Discussed candidate's career aspirations in {course.category}. Advised by {salesman.name}.",
                created_at=now - timedelta(days=(ln_idx % 35) + 1),
            )
            session.add(lnote)
            lead_notes_created.append(lnote)

        session.flush()
        print(f"✓ Lead interactions seeded: {len(demos_created)} demos, {len(lead_followups_created)} lead followups, {len(walkins_created)} walk-ins, {len(webinars_created)} webinars, {len(lead_notes_created)} notes")

        # 15. Call Logs (75 telephone records)
        call_logs_created = []
        call_dispositions = [
            "Discussed course curriculum & financing options. Very interested.",
            "Candidate requested evening demo session. Scheduled for this Thursday.",
            "Detailed discussion regarding placement statistics and alumni network.",
            "Follow-up call after brochure download. Answered questions on syllabus.",
            "Discussed scholarship test and application deadlines."
        ]
        for c_idx in range(75):
            lead, course, salesman, _, _, _, _, _ = lead_records[c_idx % len(lead_records)]
            duration = random.randint(45, 380)
            call_time = now - timedelta(days=(c_idx % 40) + 1, hours=(c_idx % 8) + 9)
            clog = CallLog(
                tenant_id=tenant.id,
                phone_number=lead.phone,
                received_at=call_time,
                duration_seconds=duration,
                summary=call_dispositions[c_idx % len(call_dispositions)],
                description=f"Outbound admissions consultation call conducted by {salesman.name}.",
                work_done="Logged call outcome and scheduled next CRM touchpoint.",
                assigned_to=salesman.name,
                followup_needed=(c_idx % 2 == 0),
                followup_date=(call_time + timedelta(days=3)).strftime("%Y-%m-%d"),
                createdAt=call_time,
            )
            session.add(clog)
            call_logs_created.append(clog)
        session.flush()
        print(f"✓ Call logs seeded: {len(call_logs_created)} phone records")

        # 16. Task Sheet Entries (40 daily salesman work logs)
        task_sheets_created = []
        for ts_idx in range(40):
            salesman = salesmen[ts_idx % len(salesmen)]
            work_day = (today - timedelta(days=ts_idx % 10)).isoformat()
            ts = TaskSheetEntry(
                tenant_id=tenant.id,
                user_id=salesman.id,
                work_date=work_day,
                area="Admissions & Sales",
                summary=f"Conducted 8 lead discovery calls, scheduled 2 online demos, and closed 1 course enrollment.",
                status="Done",
                time_spent_minutes=random.randint(240, 480),
                follow_up_date=(today + timedelta(days=2)).isoformat(),
                completion_date=work_day,
                proof_of_work=f"CRM activity logs updated. Admissions processed for cohort.",
                created_at=now - timedelta(days=ts_idx % 10),
            )
            session.add(ts)
            task_sheets_created.append(ts)
        session.flush()
        print(f"✓ Task sheet entries seeded: {len(task_sheets_created)} daily logs")

        # 17. Activity Logs (130 audit trail records)
        activity_logs = []
        action_types = [
            ("Lead Created", "Website"),
            ("Demo Scheduled", "Phone"),
            ("Demo Completed", "Video Call"),
            ("Enrollment Completed", "In-person"),
            ("Payment Collected", "UPI"),
            ("Course Plan Generated", "AI"),
            ("Follow-up Logged", "WhatsApp")
        ]
        for a_idx in range(130):
            lead, course, salesman, _, _, _, _, _ = lead_records[a_idx % len(lead_records)]
            action, method = action_types[a_idx % len(action_types)]
            act_time = now - timedelta(days=(a_idx % 45) + 1, hours=(a_idx % 12) + 8)
            act = ActivityLog(
                tenant_id=tenant.id,
                userId=salesman.id,
                lead_id=lead.id,
                action=action,
                method=method,
                content=f"{action} for {lead.company_name} ({course.title}). Handled by {salesman.name}.",
                details=f"Status updated in SerpHawk CRM. Log ID #{a_idx + 1000}.",
                createdAt=act_time,
            )
            session.add(act)
            activity_logs.append(act)

        session.flush()
        print(f"✓ Activity logs seeded: {len(activity_logs)} historical events")

        # Commit all transactions to the PostgreSQL database
        session.commit()

    print("=" * 70)
    print("SUCCESS: ALL DEMO DATA SEEDED AND COMMITTED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
