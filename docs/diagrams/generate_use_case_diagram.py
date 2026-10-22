"""Render the ReMember use case overview as PNG, editable SVG, PDF and PlantUML."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Ellipse, Rectangle


OUTPUT = Path(__file__).resolve().parent
STEM = "remember-use-case-diagram"
WIDTH, HEIGHT = 2200, 2000

# IDs are stable so the exported PlantUML source remains easy to extend.
SHARED = [
    ("S1", "Register an account\n(email or Google)"),
    ("S2", "Sign in / sign out\n(email or Google sign-in)"),
    ("S3", "Verify email / resend code"),
    ("S4", "Reset forgotten password"),
    ("S5", "Edit personal profile\nand notification preferences"),
    ("S6", "Discover organisations\nand view membership tiers"),
    ("S7", "Create an organisation\nwith initial membership tiers"),
    ("S8", "Select / switch\norganisation portal"),
]
MEMBER = [
    ("M1", "View membership dashboard\n(status, tier and expiry)"),
    ("M2", "Join an organisation\nand select a tier"),
    ("M3", "Activate / renew membership\nthrough test checkout"),
    ("M4", "Browse events, RSVP\nand cancel RSVP"),
    ("M5", "View, save and sync\nGoogle Wallet membership pass"),
    ("M6", "View, download and\nprint invoices"),
    ("M7", "Receive welcome, renewal,\npayment and RSVP emails"),
]
ADMIN = [
    ("A1", "View organisation dashboard\nand member analytics"),
    ("A2", "Edit / delete organisation\nand set public / private visibility"),
    ("A3", "Search and filter\nmember directory"),
    ("A4", "Activate, suspend or\nrevoke memberships"),
    ("A5", "Assign / change\nmember tiers"),
    ("A6", "Manage membership tiers,\nprices, benefits and capacity"),
    ("A7", "Manage events\nand inspect attendees"),
    ("A8", "View financial metrics\nand payment transactions"),
    ("A9", "Export filtered\nmember data as CSV"),
    ("A10", "Customise / preview welcome emails\nand configure renewal reminders"),
    ("A11", "View and filter\naudit activity logs"),
]


def render():
    matplotlib.rcParams.update({
        "font.family": "DejaVu Sans",
        "svg.fonttype": "none",
        "pdf.fonttype": 42,
    })
    figure, axes = plt.subplots(figsize=(22, 20), dpi=100)
    figure.subplots_adjust(left=0, right=1, top=1, bottom=0)
    axes.set_xlim(0, WIDTH)
    axes.set_ylim(HEIGHT, 0)
    axes.axis("off")
    figure.patch.set_facecolor("white")

    ink, muted, line = "#172332", "#586575", "#8b96a2"
    axes.text(1100, 53, "ReMember", ha="center", va="center", color=ink,
              fontsize=27, fontweight="bold")
    axes.text(1100, 93, "UML USE CASE DIAGRAM  |  MEMBER & ADMIN", ha="center",
              va="center", color=muted, fontsize=12)

    axes.add_patch(Rectangle((270, 130), 1660, 1770, facecolor="white",
                             edgecolor=ink, linewidth=1.5, zorder=0))
    axes.text(1100, 161, "ReMember Membership Management System", ha="center",
              va="center", color=ink, fontsize=16, fontweight="bold")

    # Group backgrounds are visual guides, not separate system boundaries.
    axes.add_patch(Rectangle((750, 192), 700, 647, facecolor="#f6f8fa",
                             edgecolor="none", zorder=0))
    axes.text(1100, 213, "SHARED ACCOUNT & ORGANISATION FUNCTIONS", ha="center",
              va="center", color=muted, fontsize=10, fontweight="bold")
    axes.add_patch(Rectangle((370, 862), 670, 934, facecolor="#f5f9ff",
                             edgecolor="none", zorder=0))
    axes.add_patch(Rectangle((1160, 862), 680, 934, facecolor="#fffbed",
                             edgecolor="none", zorder=0))
    axes.text(700, 886, "MEMBER FUNCTIONS", ha="center", va="center",
              color=muted, fontsize=11, fontweight="bold")
    axes.text(1500, 886, "ADMIN FUNCTIONS", ha="center", va="center",
              color=muted, fontsize=11, fontweight="bold")

    left_anchor, right_anchor = (155, 470), (2045, 470)

    def association(start, end):
        axes.plot([start[0], end[0]], [start[1], end[1]], color=line,
                  linewidth=0.85, solid_capstyle="round", zorder=1)

    def use_case(x, y, label, width=590, height=62):
        axes.add_patch(Ellipse((x, y), width, height, facecolor="white",
                              edgecolor="#344352", linewidth=1.05, zorder=3))
        axes.text(x, y, label, ha="center", va="center", color=ink,
                  fontsize=11.1, linespacing=1.25, zorder=4)

    for index, (_, label) in enumerate(SHARED):
        y = 267 + index * 77
        association(left_anchor, (805, y))
        association(right_anchor, (1395, y))
        use_case(1100, y, label)

    for index, (_, label) in enumerate(MEMBER):
        y = 971 + index * 128
        association(left_anchor, (405, y))
        use_case(700, y, label, height=73)

    for index, (_, label) in enumerate(ADMIN):
        y = 950 + index * 80
        association(right_anchor, (1795, y))
        use_case(1500, y, label, height=64)

    def actor(x, name):
        axes.add_patch(Circle((x, 419), 19, facecolor="white", edgecolor=ink,
                              linewidth=1.7, zorder=5))
        for xs, ys in [([x, x], [438, 500]),
                       ([x - 45, x + 45], [470, 470]),
                       ([x, x - 36], [500, 546]),
                       ([x, x + 36], [500, 546])]:
            axes.plot(xs, ys, color=ink, linewidth=1.7, zorder=5)
        axes.text(x, 575, name, ha="center", va="center", color=ink,
                  fontsize=17, fontweight="bold", zorder=6,
                  bbox={"facecolor": "white", "edgecolor": "none", "pad": 3})

    actor(110, "Member")
    actor(2090, "Admin")

    axes.plot([320, 1880], [1816, 1816], color="#d9dfe6", linewidth=0.9)
    axes.text(1100, 1844, "Admin = owner of the selected organisation. One account may have different roles in different organisations.",
              ha="center", va="center", color=muted, fontsize=10)
    axes.text(1100, 1873, "Welcome emails: first membership activation. Renewal reminders: X days before expiry, based on organisation settings.",
              ha="center", va="center", color=muted, fontsize=10)
    axes.text(1100, 1940, "Solid lines show actor participation. Checkout simulates payment. Events and digital passes require active membership.",
              ha="center", va="center", color=muted, fontsize=10)

    figure.savefig(OUTPUT / f"{STEM}.png", dpi=160, facecolor="white")
    figure.savefig(OUTPUT / f"{STEM}.svg", facecolor="white")
    figure.savefig(OUTPUT / f"{STEM}.pdf", facecolor="white")
    plt.close(figure)


def plantuml():
    lines = [
        "@startuml",
        "title ReMember - Use Case Diagram",
        "left to right direction",
        "skinparam shadowing false",
        "skinparam packageStyle rectangle",
        "skinparam usecaseBackgroundColor White",
        "skinparam usecaseBorderColor #344352",
        'actor "Member" as Member',
        'actor "Admin" as Admin',
        'rectangle "ReMember Membership Management System" {',
    ]
    for name, entries in [("Shared account and organisation functions", SHARED),
                          ("Member functions", MEMBER), ("Admin functions", ADMIN)]:
        lines.append(f'  package "{name}" {{')
        for case_id, label in entries:
            escaped = label.replace("\n", r"\n")
            lines.append(f'    usecase "{escaped}" as {case_id}')
        lines.append("  }")
    lines.append("}")
    for case_id, _ in SHARED:
        lines.extend([f"Member -- {case_id}", f"Admin -- {case_id}"])
    for case_id, _ in MEMBER:
        lines.append(f"Member -- {case_id}")
    for case_id, _ in ADMIN:
        lines.append(f"Admin -- {case_id}")
    lines.extend([
        'note bottom of Admin',
        '  Admin means owner of the selected organisation.',
        '  The same account can be a Member in another organisation.',
        'end note',
        'note bottom of M3',
        '  Checkout currently simulates payment.',
        'end note',
        'note bottom of A10',
        '  Welcome: first membership activation.',
        '  Renewal: X days before membership expiry.',
        '  Subject, message, preview and enable/disable settings',
        '  belong to the individual organisation.',
        'end note',
        '@enduml',
        '',
    ])
    (OUTPUT / f"{STEM}.puml").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    render()
    plantuml()
    print("Created PNG, SVG, PDF and PlantUML use case diagram artifacts.")
