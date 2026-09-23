"""EKSTRUH.dev — hero / diagram visual plates.

Pure HTML+CSS+inline-SVG (no images, no libraries, no extra requests), matching
the approved homepage screenshot's plate language: white cards, thin borders,
modest radius, one green-highlighted plate.
"""
from . import brand as B

C = B.COLOR


def _plate(title, sub, highlight=False, small=False):
    cls = "plate" + (" plate--hi" if highlight else "") + (" plate--sm" if small else "")
    return (
        f'<div class="{cls}">'
        f'<p class="plate__t">{title}</p>'
        f'<p class="plate__s">{sub}</p>'
        f"</div>"
    )


def hero_visual():
    """The stacked product plates on the right of the homepage hero."""
    return (
        '<div class="hero-visual" aria-hidden="true">'
        + _plate("Digital Product", "Web apps, portals &amp; dashboards")
        + _plate("API &amp; Integration Layer", "The business everything rests on", highlight=True)
        + '<div class="hero-visual__row">'
        + _plate("AI Assistants", "", small=True)
        + _plate("Data Strategy", "", small=True)
        + _plate("Systems Check 2026", "", small=True)
        + "</div></div>"
    )


def _diagram_row(num, title, sub):
    return (
        f'<div class="dia__row"><span class="dia__num">{num}</span>'
        f'<div><p class="dia__t">{title}</p><p class="dia__s">{sub}</p></div></div>'
    )


def ai_diagram():
    """The numbered technical panel in the AI & Automation section."""
    return (
        '<div class="dia" aria-hidden="true">'
        '<p class="dia__head">How an AI integration typically sits together</p>'
        + _diagram_row("01", "Business Application", "Where your team already works")
        + _diagram_row("02", "API / Workflow", "The connective tissue")
        + _diagram_row("03", "AI Capability", "The intelligence behind the interaction")
        + _diagram_row("04", "Business System / Human Review", "Results land where they can be used")
        + "</div>"
    )


def service_visual(num, label):
    """A compact, restrained hero plate for inner pages (same language)."""
    return (
        f'<div class="page-visual" aria-hidden="true">'
        + _plate(f"{num} — {label}", "EKSTRUH engineering delivery", highlight=True)
        + '<div class="hero-visual__row">'
        + _plate("Discover", "", small=True)
        + _plate("Build", "", small=True)
        + _plate("Support", "", small=True)
        + "</div></div>"
    )


def timeline():
    """How we work: four-step horizontal timeline."""
    steps = [
        ("01", "Discover", "Understand the business problem, existing systems and technical requirements."),
        ("02", "Plan", "Define the right technical approach, scope and delivery priorities."),
        ("03", "Build", "Develop, test and integrate the solution using appropriate technologies."),
        ("04", "Improve", "Support, maintain and evolve the product as requirements change."),
    ]
    items = "".join(
        f'<div class="step"><span class="step__dot" aria-hidden="true"></span>'
        f'<p class="step__num">{n}</p><h3 class="step__t">{t}</h3>'
        f'<p class="step__s">{s}</p></div>'
        for n, t, s in steps
    )
    return f'<div class="steps">{items}</div>'


def tech_chips():
    """Technology Expertise groups + chips (near-black section)."""
    groups = [
        ("Microsoft & Application Development", [".NET", "ASP.NET Core", "ASP.NET Zero", "ABP.IO"]),
        ("Frontend", ["Angular", "TypeScript", "JavaScript", "HTML5", "CSS3"]),
        ("Web & CMS", ["WordPress", "PHP"]),
        ("Data & Integration", ["SQL Server", "MySQL / MariaDB", "REST APIs", "Webhooks"]),
        ("AI & Automation", ["AI API Integration", "Workflow Automation"]),
    ]
    out = '<div class="tech">'
    for label, chips in groups:
        out += (
            f'<div class="tech__group"><p class="eyebrow eyebrow--on-dark">{label}</p>'
            '<ul class="chips">'
            + "".join(f'<li class="chip chip--dark">{c}</li>' for c in chips)
            + "</ul></div>"
        )
    return out + "</div>"
