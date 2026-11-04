"""Render one UML model as PNG, editable SVG, PDF and PlantUML source."""

from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Ellipse, FancyArrowPatch, Rectangle


OUTPUT = Path(__file__).resolve().parent
STEM = "remember-use-case-diagram"
WIDTH, HEIGHT = 3300, 3070


@dataclass(frozen=True)
class UseCase:
    id: str
    label: str
    x: int
    y: int
    width: int = 650
    height: int = 76
    actors: tuple = ()


SHARED = [
    UseCase("S1", "Register an account\n(email or Google)", 1650, 270, 800, actors=("Member", "Admin")),
    UseCase("S2", "Sign in / sign out\n(email or Google sign-in)", 1650, 354, 800, actors=("Member", "Admin")),
    UseCase("S3", "Verify email / resend code", 1650, 438, 800, actors=("Member", "Admin")),
    UseCase("S4", "Reset forgotten password", 1650, 522, 800, actors=("Member", "Admin")),
    UseCase("S5", "Edit personal profile\nand notification preferences", 1650, 606, 800, actors=("Member", "Admin")),
    UseCase("S6", "Discover organisations\nand view membership tiers", 1650, 690, 800, actors=("Member", "Admin")),
    UseCase("S7", "Create an organisation", 1650, 774, 800, actors=("Member", "Admin")),
    UseCase("S8", "Select / switch\norganisation portal", 1650, 858, 800, actors=("Member", "Admin")),
    UseCase("S9", "Define initial\nmembership tier(s)", 2600, 774, 550),
]

MEMBER = [
    UseCase("M1", "View membership dashboard\nand membership card", 770, 1110, actors=("Member",)),
    UseCase("M2", "Join an organisation", 770, 1285, actors=("Member",)),
    UseCase("M3", "Renew paid membership\nor upgrade tier", 770, 1460, actors=("Member",)),
    UseCase("M4", "Schedule / cancel downgrade;\ncancel / resume subscription", 770, 1635, actors=("Member",)),
    UseCase("M5", "Browse events\nand reservations", 770, 1810, actors=("Member",)),
    UseCase("M6", "RSVP to an event", 770, 1985, actors=("Member",)),
    UseCase("M7", "Cancel an event RSVP", 770, 2160, actors=("Member",)),
    UseCase("M8", "View invoices\nand receipt details", 770, 2335, actors=("Member",)),
    UseCase("M9", "Read organisation posts\nand view notifications", 770, 2510, actors=("Member",)),
    UseCase("M10", "Receive confirmation emails\nand renewal reminders", 770, 2685, actors=("Member",)),
    UseCase("M11", "Select membership tier", 1550, 1285, 500),
    UseCase("M12", "Complete demo checkout", 1550, 1460, 500),
    UseCase("M13", "Check membership / tier,\nregistration time and capacity", 1550, 1985, 500),
    UseCase("M14", "Download invoice", 1550, 2270, 500),
    UseCase("M15", "Print receipt", 1550, 2400, 500),
]

ADMIN = [
    UseCase("A1", "View organisation dashboard\nand member analytics", 2440, 1110, 840, actors=("Admin",)),
    UseCase("A2", "Edit / delete organisation;\nmanage visibility and branding", 2440, 1240, 840, actors=("Admin",)),
    UseCase("A3", "Search and filter\nmember directory", 2440, 1370, 840, actors=("Admin",)),
    UseCase("A4", "Activate, suspend or\nrevoke memberships", 2440, 1500, 840, actors=("Admin",)),
    UseCase("A5", "Assign / change\nmember tiers", 2440, 1630, 840, actors=("Admin",)),
    UseCase("A6", "Manage tiers, prices,\nbenefits and capacity", 2440, 1760, 840, actors=("Admin",)),
    UseCase("A7", "Create / edit / delete events\nand inspect attendees", 2440, 1890, 840, actors=("Admin",)),
    UseCase("A8", "View financial metrics\nand payment transactions", 2440, 2020, 840, actors=("Admin",)),
    UseCase("A9", "Export filtered\nmember data as CSV", 2440, 2150, 840, actors=("Admin",)),
    UseCase("A10", "Customise welcome emails\nand renewal reminder settings", 2440, 2280, 840, actors=("Admin",)),
    UseCase("A11", "View and filter\naudit activity logs", 2440, 2410, 840, actors=("Admin",)),
    UseCase("A12", "Create / edit / delete\norganisation posts", 2440, 2540, 840, actors=("Admin",)),
    UseCase("A13", "View demo payment methods\nand gateway information", 2440, 2670, 840, actors=("Admin",)),
]


@dataclass(frozen=True)
class Relationship:
    source: str
    target: str
    kind: str
    start: tuple
    end: tuple
    text_at: tuple
    condition: str = ""


# Dependencies point TO the included use case or the base being extended.
RELATIONSHIPS = [
    Relationship("S7", "S9", "include", (2050, 774), (2325, 774), (2185, 750)),
    Relationship("M2", "M11", "include", (1095, 1285), (1300, 1285), (1197, 1260)),
    Relationship("M3", "M12", "include", (1095, 1460), (1300, 1460), (1197, 1435)),
    Relationship("M6", "M13", "include", (1095, 1985), (1300, 1985), (1197, 1960)),
    Relationship("M12", "M2", "extend", (1360, 1435), (1025, 1309), (1190, 1360), "paid tier selected"),
    Relationship("M14", "M8", "extend", (1307, 2279), (1080, 2324), (1197, 2269), "download requested"),
    Relationship("M15", "M8", "extend", (1307, 2391), (1080, 2346), (1197, 2415), "print requested"),
]

CASES = {case.id: case for case in SHARED + MEMBER + ADMIN}
INK, MUTED = "#172332", "#586575"
INCLUDE, EXTEND = "#245a94", "#944920"


def validate_model():
    assert len(CASES) == len(SHARED + MEMBER + ADMIN), "Duplicate use case ID"
    assert {actor for case in CASES.values() for actor in case.actors} == {"Member", "Admin"}
    for relation in RELATIONSHIPS:
        assert relation.source in CASES and relation.target in CASES
        assert relation.kind in {"include", "extend"}
        assert relation.kind != "extend" or relation.condition


def render():
    matplotlib.rcParams.update({
        "font.family": "DejaVu Sans",
        "svg.fonttype": "none",
        "pdf.fonttype": 42,
    })
    figure, axes = plt.subplots(figsize=(33, 30.7), dpi=100)
    figure.subplots_adjust(left=0, right=1, top=1, bottom=0)
    axes.set_xlim(0, WIDTH)
    axes.set_ylim(HEIGHT, 0)
    axes.axis("off")
    figure.patch.set_facecolor("white")

    def label(x, y, text, size=12, color=INK, weight="normal", **kwargs):
        return axes.text(x, y, text, ha="center", va="center", fontsize=size,
                         color=color, fontweight=weight, zorder=6, **kwargs)

    label(1650, 55, "ReMember", 30, weight="bold")
    label(1650, 101, "USE CASE DIAGRAM  |  MEMBER & ADMIN", 13, MUTED)
    axes.add_patch(Rectangle((280, 140), 2740, 2690, facecolor="white",
                             edgecolor=INK, linewidth=1.5, zorder=0))
    label(1650, 171, "ReMember Membership Management System", 17, weight="bold")

    for x, y, w, h, color in [(1190, 206, 1720, 710, "#f6f8fa"),
                               (375, 1000, 1475, 1750, "#f3f8ff"),
                               (1940, 1000, 990, 1750, "#fff9ed")]:
        axes.add_patch(Rectangle((x, y), w, h, facecolor=color,
                                 edgecolor="none", zorder=0))
    label(1650, 217, "SHARED ACCOUNT & ORGANISATION FUNCTIONS", 11, MUTED, "bold")
    label(1100, 1030, "MEMBER FUNCTIONS", 12, MUTED, "bold")
    label(2440, 1030, "ADMIN FUNCTIONS", 12, MUTED, "bold")

    anchors = {"Member": (170, 510), "Admin": (3130, 510)}
    for case in CASES.values():
        for actor in case.actors:
            start = anchors[actor]
            side = -1 if actor == "Member" else 1
            end = (case.x + side * case.width / 2, case.y)
            # Keep this association clear of the initial-tier ellipse.
            route = [start, (2950, 940), (2150, 940), end] if actor == "Admin" and case.id == "S8" else [start, end]
            axes.plot([point[0] for point in route], [point[1] for point in route],
                      color="#a1aab4", linewidth=0.8, zorder=1)

    for case in CASES.values():
        axes.add_patch(Ellipse((case.x, case.y), case.width, case.height,
                              facecolor="white", edgecolor="#344352",
                              linewidth=1.1, zorder=3))
        label(case.x, case.y, case.label, 12.4, linespacing=1.3)

    for relation in RELATIONSHIPS:
        color = INCLUDE if relation.kind == "include" else EXTEND
        axes.add_patch(FancyArrowPatch(relation.start, relation.end,
                                       arrowstyle="->", mutation_scale=19,
                                       linewidth=1.5, linestyle=(0, (6, 4)),
                                       color=color, zorder=5,
                                       shrinkA=1, shrinkB=1))
        text = f"«{relation.kind}»"
        if relation.condition:
            text += f"\n[{relation.condition}]"
        label(*relation.text_at, text, 10.5, color, linespacing=1.35,
              bbox={"facecolor": "white", "edgecolor": "none", "pad": 2})

    def actor(x, name):
        axes.add_patch(Circle((x, 454), 21, facecolor="white", edgecolor=INK,
                              linewidth=1.8, zorder=7))
        for xs, ys in [([x, x], [475, 540]),
                       ([x - 50, x + 50], [510, 510]),
                       ([x, x - 38], [540, 593]),
                       ([x, x + 38], [540, 593])]:
            axes.plot(xs, ys, color=INK, linewidth=1.8, zorder=7)
        label(x, 625, name, 20, weight="bold",
              bbox={"facecolor": "white", "edgecolor": "none", "pad": 3})

    actor(120, "Member")
    actor(3180, "Admin")
    label(1650, 2792, "Admin = owner of the selected organisation. One account may hold different roles in different organisations.", 12, MUTED)

    axes.plot([400, 660], [2892, 2892], color="#8b96a2", linewidth=1.2)
    label(930, 2892, "Actor participation", 12, MUTED)
    for y, color, kind, description in [
        (2940, INCLUDE, "include", "Required behavior: base use case points to included use case"),
        (2988, EXTEND, "extend", "Conditional behavior: extension points to base use case"),
    ]:
        axes.add_patch(FancyArrowPatch((400, y), (660, y), arrowstyle="->",
                                       mutation_scale=19, linewidth=1.5,
                                       linestyle=(0, (6, 4)), color=color))
        label(530, y - 18, f"«{kind}»", 10.5, color)
        label(1650, y, description, 12, MUTED)

    figure.savefig(OUTPUT / f"{STEM}.png", dpi=140, facecolor="white")
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
        for case in entries:
            escaped = case.label.replace("\n", r"\n")
            lines.append(f'    usecase "{escaped}" as {case.id}')
        lines.append("  }")
    lines.append("}")
    for case in CASES.values():
        lines.extend(f"{actor} -- {case.id}" for actor in case.actors)
    for relation in RELATIONSHIPS:
        caption = f"<<{relation.kind}>>"
        if relation.condition:
            caption += rf"\n[{relation.condition}]"
        lines.append(f"{relation.source} ..> {relation.target} : {caption}")
    for target, note in [
        ("Admin", ["Admin means owner of the selected organisation.",
                   "The same account can be a Member in another organisation."]),
        ("M12", ["Checkout simulates payment; no money is charged.",
                  "Free-tier joining does not require checkout."]),
        ("M4", ["Scheduling a downgrade does not require checkout.",
                 "Paid cancellations retain access until expiry."]),
        ("M10", ["Emails depend on applicable preferences and organisation settings.",
                  "Renewal reminders run X days before membership expiry."]),
    ]:
        lines.extend([f"note bottom of {target}", *(f"  {line}" for line in note), "end note"])
    lines.extend(["@enduml", ""])
    (OUTPUT / f"{STEM}.puml").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    validate_model()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    render()
    plantuml()
    print(f"Created PNG, SVG, PDF and PlantUML: 2 actors, {len(CASES)} use cases, "
          f"{len(RELATIONSHIPS)} include/extend relationships.")
