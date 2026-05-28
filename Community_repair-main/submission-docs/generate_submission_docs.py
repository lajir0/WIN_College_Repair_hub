from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape
import zipfile


BASE_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class ParagraphBlock:
    text: str
    size: int = 22
    bold: bool = False
    italic: bool = False
    align: str | None = None
    space_after: int = 120


@dataclass(frozen=True)
class BulletListBlock:
    items: tuple[str, ...]
    size: int = 22
    space_after: int = 60


@dataclass(frozen=True)
class PageBreakBlock:
    pass


Block = ParagraphBlock | BulletListBlock | PageBreakBlock


def paragraph(text: str, **kwargs) -> ParagraphBlock:
    return ParagraphBlock(text=text, **kwargs)


def bullets(items: Iterable[str], **kwargs) -> BulletListBlock:
    return BulletListBlock(items=tuple(items), **kwargs)


def page_break() -> PageBreakBlock:
    return PageBreakBlock()


def run_xml(text: str, *, size: int, bold: bool = False, italic: bool = False) -> str:
    fragments = []
    if bold:
        fragments.append("<w:b/>")
    if italic:
        fragments.append("<w:i/>")
    fragments.append(f'<w:sz w:val="{size}"/>')
    fragments.append(f'<w:szCs w:val="{size}"/>')
    props = f"<w:rPr>{''.join(fragments)}</w:rPr>"
    return f"{props}<w:t xml:space=\"preserve\">{escape(text)}</w:t>"


def paragraph_xml(block: ParagraphBlock) -> str:
    align_xml = f'<w:jc w:val="{block.align}"/>' if block.align else ""
    ppr = f'<w:pPr>{align_xml}<w:spacing w:after="{block.space_after}"/></w:pPr>'
    return f"<w:p>{ppr}<w:r>{run_xml(block.text, size=block.size, bold=block.bold, italic=block.italic)}</w:r></w:p>"


def bullets_xml(block: BulletListBlock) -> str:
    lines = []
    for item in block.items:
        text = f"• {item}"
        lines.append(
            f"<w:p><w:pPr><w:spacing w:after=\"{block.space_after}\"/></w:pPr><w:r>{run_xml(text, size=block.size)}</w:r></w:p>"
        )
    return "".join(lines)


def page_break_xml() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def blocks_to_document_xml(blocks: list[Block]) -> str:
    body = []
    for block in blocks:
        if isinstance(block, ParagraphBlock):
            body.append(paragraph_xml(block))
        elif isinstance(block, BulletListBlock):
            body.append(bullets_xml(block))
        else:
            body.append(page_break_xml())

    body.append(
        """
        <w:sectPr>
          <w:pgSz w:w="12240" w:h="15840"/>
          <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
        </w:sectPr>
        """
    )

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    {''.join(body)}
  </w:body>
</w:document>
"""


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""


def rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""


def core_xml(title: str) -> str:
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(title)}</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>
"""


def app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
"""


def write_docx(path: Path, title: str, blocks: list[Block]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml())
        archive.writestr("_rels/.rels", rels_xml())
        archive.writestr("docProps/core.xml", core_xml(title))
        archive.writestr("docProps/app.xml", app_xml())
        archive.writestr("word/document.xml", blocks_to_document_xml(blocks))


def cover(title: str, subtitle: str) -> list[Block]:
    return [
        paragraph("RepairHub", size=34, bold=True, align="center", space_after=180),
        paragraph(title, size=30, bold=True, align="center", space_after=180),
        paragraph(subtitle, size=22, italic=True, align="center", space_after=140),
        paragraph("Prepared from the current RepairHub implementation and aligned to the BIT ICT313 submission requirements PDF.", size=22, align="center", space_after=200),
        paragraph("Date: 16 May 2026", size=20, align="center", space_after=120),
        page_break(),
    ]


research_and_design_blocks = cover(
    "Research and Design Report",
    "Submission-aligned documentation package for the RepairHub MVP",
) + [
    paragraph("1. Introduction", size=28, bold=True),
    paragraph(
        "RepairHub is a repair marketplace and workflow platform for the Australian market. "
        "It connects customers with repairers for electronics, furniture, clothing, and bikes, "
        "supports AI-assisted repair analysis, and provides dedicated dashboards for customers, "
        "repairers, and administrators."
    ),
    paragraph("2. Problem Statement", size=28, bold=True),
    paragraph(
        "Consumers often replace repairable items because it is difficult to quickly find a suitable "
        "repairer, estimate cost and time, and track the repair lifecycle. Repair professionals also "
        "lack a lightweight platform that combines customer intake, matching, approval, job status, "
        "community content, and internal admin review in one system."
    ),
    paragraph("3. Project Objectives", size=28, bold=True),
    bullets(
        [
            "Provide a customer-friendly repair request workflow with AI-assisted triage and category-aware matching.",
            "Allow repairers to receive selected jobs, approve or reject them with reasons, and update live repair status.",
            "Allow internal administrators to approve store details, manage repairer visibility, and maintain platform data.",
            "Promote reuse, repair culture, and sustainability through tutorials, workshops, and discussion forums.",
        ]
    ),
    paragraph("4. Competitor Research", size=28, bold=True),
    paragraph("4.1 Airtasker", size=24, bold=True),
    paragraph(
        "Airtasker is a broad service marketplace with strong reach and flexible service listings. "
        "Its advantage is supply breadth. Its weakness for this project context is that it is not "
        "designed as a repair-specific operational workflow with item-level approval, repair status, "
        "community repair content, or admin-managed store activation."
    ),
    paragraph("Official reference: https://www.airtasker.com/au/services/", size=20, italic=True),
    paragraph("4.2 Oneflare", size=24, bold=True),
    paragraph(
        "Oneflare operates as a quote-generation marketplace for local service providers. It is useful "
        "for service discovery and lead capture, but it does not provide the same repair lifecycle, "
        "AI-assisted diagnosis, or customer-to-repairer status tracking that RepairHub targets."
    ),
    paragraph("Official reference: https://www.oneflare.com.au/", size=20, italic=True),
    paragraph("4.3 iFixit", size=24, bold=True),
    paragraph(
        "iFixit is a major repair knowledge platform focused on repair guides, parts, and the right-to-repair "
        "movement. It is a strong knowledge benchmark for tutorials and repair education, but it does not function "
        "as a local booking and repair management marketplace."
    ),
    paragraph("Official reference: https://www.ifixit.com/", size=20, italic=True),
    paragraph("4.4 Competitive Positioning for RepairHub", size=24, bold=True),
    bullets(
        [
            "Compared with Airtasker: RepairHub is narrower in market scope but stronger in repair-specific workflow control.",
            "Compared with Oneflare: RepairHub moves beyond quote discovery into approval, status, and completion management.",
            "Compared with iFixit: RepairHub combines repair education with local repair booking and administration.",
        ]
    ),
    paragraph("5. Technology and Software Research", size=28, bold=True),
    paragraph(
        "The delivered solution uses a modern split-stack architecture rather than a WordPress plugin model. "
        "The final technology decisions were driven by real-time workflow needs, role-based access, environment control, "
        "and the need to support both a public marketplace and an internal operations area."
    ),
    bullets(
        [
            "Frontend researched and selected: Vite + React 18 SPA with TypeScript strict mode for fast development, reliable typing, and route-level control.",
            "Backend researched and selected: Django 5 + Django REST Framework for secure role-based APIs and a maintainable business layer.",
            "Realtime researched and selected: Django Channels with WebSocket support for job status and notification flows.",
            "Styling researched and selected: Tailwind CSS v4 mapped to project design tokens for consistent UI implementation.",
            "Forms researched and selected: React Hook Form with Zod for validation and a low-boilerplate form model.",
            "Global and server state researched and selected: Zustand and TanStack Query for predictable local and remote data flows.",
            "Media researched and selected: Cloudinary for image storage and signed upload support.",
            "AI researched and selected: Google Gemini for repair analysis, with controlled fallback behaviour when remote AI is not available.",
            "Payments researched and selected: Stripe SDK for payment collection and payout ledger handling.",
            "Maps researched and selected: Leaflet with OpenStreetMap tiles in the current implementation because it is free and easy to integrate for MVP delivery.",
        ]
    ),
    paragraph("6. Final Selections and Justification", size=28, bold=True),
    bullets(
        [
            "React + TypeScript was selected because the UI requires role-specific navigation, interactive forms, and component reuse.",
            "Django was selected because the project needs strong authentication, structured models, admin extensibility, and quick business rule iteration.",
            "Separate web and API repositories were retained because frontend and backend deploy independently and have different toolchains.",
            "Admin-managed repairer activation was selected to maintain quality control over which repairers appear in customer matches.",
        ]
    ),
    paragraph("7. High-Level Design Outcomes", size=28, bold=True),
    bullets(
        [
            "Customers can create accounts, request repairs, analyze items, choose matched repairers, track status, and participate in community discussions.",
            "Repairers can create accounts, wait for store approval, review selected jobs, move approved jobs into active work, and mark work completed.",
            "Admins can add repairer store details, assign a repair category, and control which repairer profiles are visible in matching.",
            "Community features extend the product beyond transactions and support long-term engagement around repair culture.",
        ]
    ),
    paragraph("8. Risks and Mitigation", size=28, bold=True),
    bullets(
        [
            "AI dependency risk: mitigated by fallback analysis behaviour and clear error handling.",
            "Role confusion risk: mitigated by strict route guards and backend permission checks.",
            "Incorrect repairer matching risk: mitigated by category-aware service records and admin-managed store setup.",
            "SQLite local lock risk in OneDrive environments: mitigated in code by redirecting local database storage away from fragile repo-local paths.",
        ]
    ),
    paragraph("9. Conclusion", size=28, bold=True),
    paragraph(
        "The final selected solution is a repair-specific web platform with clear role separation, category-based matching, "
        "approval-controlled repair workflows, and a practical MVP architecture suitable for further academic submission and demonstration."
    ),
]


design_document_blocks = cover(
    "Design Document",
    "System architecture, workflows, and data design for the current RepairHub implementation",
) + [
    paragraph("1. System Overview", size=28, bold=True),
    paragraph(
        "RepairHub is implemented as two repositories: repairhub-web (React SPA) and repairhub-api (Django API). "
        "The web application contains the public interface, customer tools, repairer dashboard, community area, profile page, "
        "and internal admin surface. The backend provides REST endpoints, authentication, repair workflows, and data persistence."
    ),
    paragraph("2. Primary User Roles", size=28, bold=True),
    bullets(
        [
            "Customer: submits repair requests, chooses repairers, tracks repairs, pays after completion, joins community discussions.",
            "Repairer: registers, waits for store approval, reviews selected requests, updates job status, completes work.",
            "Admin: maintains repairer store details, assigns categories, manages which repairers are ready for matching, and can access Django admin at /admins/.",
        ]
    ),
    paragraph("3. Frontend Route Design", size=28, bold=True),
    bullets(
        [
            "/ — public home page",
            "/auth — sign in and public account creation",
            "/request/new — customer-only repair request flow",
            "/client — customer-only workspace",
            "/dashboard — repairer-only dashboard",
            "/community and /community/thread/:threadId — community content and discussion detail",
            "/events/:eventId — workshop/event detail",
            "/profile — shared self-service profile page",
            "/admin — admin SPA for repairer store setup",
            "/admins/* — redirect to default Django admin",
        ]
    ),
    paragraph("4. Backend App Structure", size=28, bold=True),
    bullets(
        [
            "accounts — authentication, profile updates, JWT handling",
            "repairers — repairer applications and repairer profile administration",
            "catalog — categories, services, and pricing rules",
            "repairs — repair requests, matches, bookings, jobs, reviews",
            "ai — damage analysis and audit records",
            "payments — booking payment and payout ledger support",
            "chat / notifications — real-time and messaging support",
            "community — tutorials, discussions, and workshops",
            "rewards / admin_ops — sustainability and operational controls",
        ]
    ),
    paragraph("5. Core Workflow Design", size=28, bold=True),
    paragraph("5.1 Customer Workflow", size=24, bold=True),
    bullets(
        [
            "Customer registers or signs in.",
            "Customer opens /request/new and submits category, item/model, issue description, and photos.",
            "System runs AI analysis and validation.",
            "System returns repairer matches for the selected category.",
            "Customer selects a repairer and submits a reason.",
            "Repairer approves or rejects the item.",
            "If approved, repairer moves the item into active work.",
            "When work is completed, customer pays and the job moves to completed status.",
        ]
    ),
    paragraph("5.2 Repairer Workflow", size=24, bold=True),
    bullets(
        [
            "Repairer creates an account.",
            "Repairer cannot operate until admin adds store details and repair category.",
            "After activation, repairer views selected items in the approval queue.",
            "Repairer approves or rejects the item with a reason.",
            "Repairer starts active work, adds customer-visible updates, and marks the item completed.",
        ]
    ),
    paragraph("5.3 Admin Workflow", size=24, bold=True),
    bullets(
        [
            "Admin signs in through /auth or uses Django admin through /admins/.",
            "Admin opens /admin and chooses a repairer account already present in the database.",
            "Admin enters store details and assigns a repair category.",
            "The approved store profile becomes visible for matching.",
        ]
    ),
    paragraph("6. Data Design Summary", size=28, bold=True),
    bullets(
        [
            "User stores role and profile status.",
            "RepairerProfile stores the shop-facing identity visible to customers.",
            "RepairerService links a repairer profile to a repair category and pricing logic.",
            "RepairRequest stores customer intake data, AI estimate fields, and repairer-selection state.",
            "RepairMatch stores the ranked candidates built for a repair request.",
            "Booking stores payment-related amounts and status.",
            "RepairJob stores live job progression and customer-visible updates.",
        ]
    ),
    paragraph("7. Job Lifecycle", size=28, bold=True),
    bullets(
        [
            "draft → submitted → analyzed → matching → matched",
            "matched + selected repairer → pending approval",
            "approved → booked → in_repair → ready → completed/collected",
            "rejected, disputed, and cancelled are supported alternative states",
        ]
    ),
    paragraph("8. Security and Permissions", size=28, bold=True),
    bullets(
        [
            "Frontend route guards prevent users from entering pages outside their role.",
            "Backend viewsets enforce permissions again at API level.",
            "Public registration does not allow admin accounts.",
            "Admin-only store setup prevents repairers from self-publishing unapproved stores.",
        ]
    ),
    paragraph("9. Design Notes and Constraints", size=28, bold=True),
    bullets(
        [
            "Current mapping uses Leaflet with OpenStreetMap rather than Google Maps.",
            "Customer payment happens after the repairer marks the item completed in the implemented workflow.",
            "The community area supports question creation, replies, and owner-only edit/delete controls.",
            "The current implementation is an MVP and still leaves room for richer deployment automation and media-rich documentation.",
        ]
    ),
]


installation_manual_blocks = cover(
    "Installation Manual",
    "Detailed environment setup and execution guide for RepairHub",
) + [
    paragraph("1. Purpose", size=28, bold=True),
    paragraph(
        "This document explains how to set up RepairHub from a blank project checkout. "
        "The original PDF references a blank WordPress shell, but this project is not a WordPress application. "
        "RepairHub is a React SPA plus Django API, so the installation process is repository-based and environment-based."
    ),
    paragraph("2. Repository Structure", size=28, bold=True),
    bullets(
        [
            "repairhub-web — Vite + React frontend",
            "repairhub-api — Django backend",
            ".github/workflows — CI automation",
            "submission-docs — generated documentation package",
        ]
    ),
    paragraph("3. Prerequisites", size=28, bold=True),
    bullets(
        [
            "Windows, macOS, or Linux development machine",
            "Node.js and npm installed",
            "Python 3.12 installed",
            "Git installed",
            "Optional external services configured: Cloudinary, Gemini, Stripe, Brevo",
        ]
    ),
    paragraph("4. Backend Installation", size=28, bold=True),
    bullets(
        [
            "Open a terminal and change into repairhub-api.",
            "Create a virtual environment if one does not already exist.",
            "Install backend dependencies using the project requirements or pyproject environment.",
            "Copy .env.example to .env and populate required values.",
            "Run database migrations.",
            "Start the Django development server.",
        ]
    ),
    paragraph("Suggested commands:", size=24, bold=True),
    bullets(
        [
            "cd repairhub-api",
            "python -m venv .venv",
            ".venv\\Scripts\\activate",
            "pip install -r requirements.txt",
            "Copy-Item .env.example .env",
            "python manage.py migrate",
            "python manage.py runserver",
        ]
    ),
    paragraph("5. Backend Environment Variables", size=28, bold=True),
    bullets(
        [
            "DEBUG, SECRET_KEY, ALLOWED_HOSTS",
            "DATABASE_URL",
            "CORS_ALLOWED_ORIGINS",
            "ACCESS_TOKEN_MINUTES, REFRESH_TOKEN_DAYS",
            "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET",
            "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET",
            "GEMINI_API_KEY",
            "BREVO_API_KEY",
            "ADMIN_EMAIL, ADMIN_PASSWORD",
        ]
    ),
    paragraph("6. Frontend Installation", size=28, bold=True),
    bullets(
        [
            "Open a second terminal and change into repairhub-web.",
            "Install frontend dependencies.",
            "Copy .env.example to .env.",
            "Start the Vite development server.",
        ]
    ),
    bullets(
        [
            "cd repairhub-web",
            "npm install",
            "Copy-Item .env.example .env",
            "npm run dev",
        ]
    ),
    paragraph("7. Frontend Environment Variables", size=28, bold=True),
    bullets(
        [
            "VITE_API_URL=http://localhost:8000/api",
            "VITE_WS_URL=ws://localhost:8000/ws",
            "VITE_STRIPE_PUBLISHABLE_KEY=<publishable key>",
        ]
    ),
    paragraph("8. Local URLs", size=28, bold=True),
    bullets(
        [
            "Frontend: http://localhost:5173",
            "Backend API root: http://localhost:8000/api/",
            "SPA admin surface: http://localhost:5173/admin",
            "Django admin: http://localhost:8000/admins/",
        ]
    ),
    paragraph("9. Special Local Database Note", size=28, bold=True),
    paragraph(
        "When the project is stored under OneDrive, the backend code redirects the local SQLite database away from the repo-local file "
        "to a stable local AppData path. This avoids database lock and journal issues that occur when SQLite writes inside synced directories."
    ),
    paragraph("10. Deployment Overview", size=28, bold=True),
    bullets(
        [
            "Frontend target: Vercel",
            "Backend target: Render",
            "Production database target: Neon PostgreSQL / PostGIS as per project stack plan",
            "Secrets must be configured separately in each hosting environment",
        ]
    ),
    paragraph("11. Troubleshooting", size=28, bold=True),
    bullets(
        [
            "If login shows Failed to fetch, confirm the backend is running on port 8000 and VITE_API_URL is correct.",
            "If Gemini is not configured, the system falls back to local analysis behaviour.",
            "If no repairer matches appear, confirm the admin has created shop details and assigned a category for the repairer.",
            "If a new repairer sees the dashboard waiting message, that is expected until admin store approval is completed.",
        ]
    ),
]


user_manual_blocks = cover(
    "User Manual",
    "Role-based operational guide for customers, repairers, and administrators",
) + [
    paragraph("1. Manual Scope", size=28, bold=True),
    paragraph(
        "This user manual describes how each user type interacts with the RepairHub MVP. "
        "The PDF requires screenshots; this generated version includes explicit screenshot placeholders so the team can replace them "
        "with final images from the deployed build before submission."
    ),
    paragraph("2. User Roles", size=28, bold=True),
    bullets(
        [
            "Customer/client",
            "Repairer",
            "Administrator",
        ]
    ),
    paragraph("3. Customer Instructions", size=28, bold=True),
    paragraph("3.1 Create an account or sign in", size=24, bold=True),
    bullets(
        [
            "Open /auth.",
            "Choose Create Account if you do not already have an account.",
            "Select customer/client.",
            "Enter first name, last name, email, password, and confirm password.",
            "Use the eye icon to show or hide password fields if required.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Customer registration form on /auth]", italic=True),
    paragraph("3.2 Submit a repair request", size=24, bold=True),
    bullets(
        [
            "After sign-in, open /request/new.",
            "Choose a repair category.",
            "Enter the item/model name and describe the problem.",
            "Upload one or more photos of the item.",
            "Run AI analysis.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Customer repair request form with uploaded image preview]", italic=True),
    paragraph("3.3 Select a repairer", size=24, bold=True),
    bullets(
        [
            "Review the matched repairers returned for the selected category.",
            "Choose one repairer.",
            "Enter a clear reason for selecting that repairer and submit the selection.",
            "Wait for repairer approval or rejection.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Matched repairer selection screen]", italic=True),
    paragraph("3.4 Track status and pay", size=24, bold=True),
    bullets(
        [
            "Open /client to see pending approval, active repairs, and completed items.",
            "When the repairer starts work, the status appears in Active repairs.",
            "When the repairer marks the item completed, pay from the client workspace.",
            "After payment, the item moves to completed status.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Customer client workspace with active and completed items]", italic=True),
    paragraph("3.5 Community and profile", size=24, bold=True),
    bullets(
        [
            "Open /community to ask questions, reply to threads, and view repair videos or workshops.",
            "Click your name in the header to open /profile and edit your own details.",
        ]
    ),
    paragraph("4. Repairer Instructions", size=28, bold=True),
    paragraph("4.1 Create an account", size=24, bold=True),
    bullets(
        [
            "Open /auth.",
            "Choose Create Account.",
            "Select repairer.",
            "Enter your details and submit the form.",
        ]
    ),
    paragraph("4.2 Wait for admin approval", size=24, bold=True),
    bullets(
        [
            "A newly created repairer cannot go live immediately.",
            "Until admin adds the store details and category, the repairer dashboard shows: Please wait until admin approves your store.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Repairer pending approval dashboard state]", italic=True),
    paragraph("4.3 Work from the repairer dashboard", size=24, bold=True),
    bullets(
        [
            "After admin approval, open /dashboard.",
            "Review selected repair items in the Approval queue.",
            "Approve or reject each selected item and provide a reason.",
            "For approved items, click Proceed to Active Work.",
            "While the item is in progress, add updates and click Completed when work is finished.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Repairer dashboard approval queue and live jobs]", italic=True),
    paragraph("5. Administrator Instructions", size=28, bold=True),
    paragraph("5.1 Sign in", size=24, bold=True),
    bullets(
        [
            "Sign in through /auth using the admin account.",
            "Use /admin for the internal SPA surface.",
            "Use /admins/ for the default Django admin panel if model-level inspection is needed.",
        ]
    ),
    paragraph("5.2 Approve repairer stores", size=24, bold=True),
    bullets(
        [
            "Open /admin.",
            "Choose a username from existing repairer accounts.",
            "Enter shop details and select the repair category.",
            "Save the form.",
            "The approved store becomes visible to customers in matching.",
        ]
    ),
    paragraph("[Screenshot Placeholder: Admin add shop details form]", italic=True),
    paragraph("6. General Notes", size=28, bold=True),
    bullets(
        [
            "Only the owner of a community question or reply can edit or delete it.",
            "Only customers can remove their own collected items from the client workspace.",
            "Role-based pages are hidden and guarded according to the signed-in user type.",
        ]
    ),
]


final_report_blocks = cover(
    "Final Project Report",
    "Submission-ready project summary aligned to the current RepairHub build",
) + [
    paragraph("1. Project Summary", size=28, bold=True),
    paragraph(
        "RepairHub is an Australia-focused repair marketplace MVP that combines repair request intake, AI-assisted analysis, "
        "repairer matching, admin-controlled store activation, role-based dashboards, community discussions, and sustainability messaging."
    ),
    paragraph("2. Delivered Solution Scope", size=28, bold=True),
    bullets(
        [
            "Customer-facing home, authentication, request flow, workspace, profile, community, and events pages",
            "Repairer-facing dashboard with approval queue, active work controls, and completed jobs view",
            "Admin-facing store setup flow that activates repairers for category-based matching",
            "Django admin access through /admins/",
            "Backend APIs for auth, repairs, matching, bookings, payments, community, and repairer administration",
        ]
    ),
    paragraph("3. Repository and Environment Summary", size=28, bold=True),
    bullets(
        [
            "Frontend repository/folder: repairhub-web",
            "Backend repository/folder: repairhub-api",
            "Current local frontend URL: http://localhost:5173",
            "Current local backend URL: http://localhost:8000/api/",
        ]
    ),
    paragraph("4. Submission Items Required by the PDF", size=28, bold=True),
    bullets(
        [
            "Site link provided by the school: [TO BE FILLED BY TEAM]",
            "Access details for markers: [TO BE FILLED BY TEAM]",
            "Figma file link: [TO BE FILLED BY TEAM]",
            "YouTube prototype recording link: [TO BE FILLED BY TEAM]",
        ]
    ),
    paragraph("5. Major Changes Made During the Project", size=28, bold=True),
    paragraph("5.1 Scope changes", size=24, bold=True),
    bullets(
        [
            "The repair workflow was tightened so the repairer must approve the item before active work can begin.",
            "Customer payment was moved to the end of the workflow after repair completion, rather than during initial booking.",
            "Community features were expanded to include question posting, replying, and owner-only moderation controls.",
            "Internal repairer activation was centralized under the admin SPA rather than self-service store publication.",
        ]
    ),
    paragraph("5.2 Technology changes", size=24, bold=True),
    bullets(
        [
            "Live request analysis was connected to the backend instead of remaining a frontend fixture-only flow.",
            "Local SQLite handling was adjusted to avoid OneDrive lock problems during development.",
            "Matching now depends on real database repairer services instead of seeding data during GET requests.",
            "The current map implementation remains Leaflet/OpenStreetMap. Google Maps was discussed but is not the active implementation.",
        ]
    ),
    paragraph("5.3 Timeline changes", size=24, bold=True),
    paragraph(
        "Team-specific milestone movement should be completed here before final submission. "
        "Suggested format: original plan, reason for change, impact on later milestones."
    ),
    paragraph("5.4 Human resource changes", size=24, bold=True),
    paragraph(
        "Team-specific staffing or responsibility changes should be completed here before final submission. "
        "Suggested format: member role, change made, reason, and impact on delivery."
    ),
    paragraph("6. Quality and Testing Summary", size=28, bold=True),
    bullets(
        [
            "Frontend verification uses TypeScript, ESLint, Vitest, and targeted interaction tests.",
            "Backend verification uses Django checks and pytest coverage on core flows.",
            "Role-based workflows, removal flows, approval messaging, and match-building regressions have targeted tests in the current codebase.",
        ]
    ),
    paragraph("7. Known Limitations", size=28, bold=True),
    bullets(
        [
            "Submission-specific screenshots, school site links, Figma links, and final video links still require manual team input.",
            "Several academic documents in the PDF are template-driven or individual submissions and were not auto-generated here.",
        ]
    ),
    paragraph("8. Documents Not Auto-Generated in This Pack", size=28, bold=True),
    bullets(
        [
            "Business case",
            "Scope statement",
            "Charter",
            "Weekly status reports",
            "Weekly stand-up documents",
            "Lessons-learnt report",
            "Project Libre plan",
        ]
    ),
    paragraph(
        "These were intentionally left out because the PDF identifies some as template-based and some as individual-only deliverables that require real team-specific information."
    ),
]


design_doc_filename = "RepairHub_Design_Document.docx"
docs = {
    "RepairHub_Research_and_Design_Report.docx": (
        "RepairHub Research and Design Report",
        research_and_design_blocks,
    ),
    design_doc_filename: (
        "RepairHub Design Document",
        design_document_blocks,
    ),
    "RepairHub_Installation_Manual.docx": (
        "RepairHub Installation Manual",
        installation_manual_blocks,
    ),
    "RepairHub_User_Manual.docx": (
        "RepairHub User Manual",
        user_manual_blocks,
    ),
    "RepairHub_Final_Project_Report.docx": (
        "RepairHub Final Project Report",
        final_report_blocks,
    ),
}


def main() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    for filename, (title, blocks) in docs.items():
        write_docx(BASE_DIR / filename, title, blocks)
    print("Generated:")
    for filename in docs:
        print(f"- {BASE_DIR / filename}")


if __name__ == "__main__":
    main()
