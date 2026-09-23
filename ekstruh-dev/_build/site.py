"""EKSTRUH.dev — static site generator.

Run from the ekstruh-dev/ directory:   python3 -m _build.site

Reads _build/brand.py, _build/hero_visuals.py and _build/content.py and writes
the whole site into site/. HTML + one CSS + one small vanilla-JS file + PHP for
Contact only. No frameworks, no web fonts, no extra requests.

It also runs a validation pass (contrast, duplicate ids, internal links,
canonical/sitemap consistency) and exits non-zero on failure, so the generated
site and the generators cannot drift silently.
"""
import json
import os
import re
import sys
from html import escape as _e

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _build import brand as B, hero_visuals as HV, content as CT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site")
C, T, S = B.COLOR, B.TYPE, B.SPACE

# ================================================================ helpers
def e(s):
    return _e(str(s), quote=False)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rel_lum(h):
    r, g, b = (v / 255 for v in hex_rgb(h))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    l1, l2 = rel_lum(a), rel_lum(b)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# Text/background pairs actually used for copy; AA requires >= 4.5 (normal).
CONTRAST_PAIRS = [
    ("body on white", C["body"], C["bg_white"]),
    ("muted on white", C["muted"], C["bg_white"]),
    ("body on light", C["body"], C["bg_light"]),
    ("muted on light", C["muted"], C["bg_light"]),
    ("green link on white", C["green"], C["bg_white"]),
    ("green link on light", C["green"], C["bg_light"]),
    ("white on green button", "#ffffff", C["green_strong"]),
    ("deep text on deep green", C["green_deep_text"], C["green_deep"]),
    ("accent on deep green", C["green_link_dark"], C["green_deep"]),
    ("near-black text on near-black", C["near_black_text"], C["near_black"]),
    ("accent on near-black", C["green_link_dark"], C["near_black"]),
    ("white on deep green CTA", "#ffffff", C["green_deep"]),
]

# ================================================================ chrome
def header_html(active_path):
    def is_active(href):
        return active_path == href or (href != "/" and active_path.startswith(href))
    items = []
    for nav in B.NAV:
        dd = nav.get("dropdown")
        if dd:
            links = "".join(
                f'<a class="dd__link" href="{d["href"]}">{e(d["label"])}</a>' for d in dd)
            items.append(
                f'<div class="nav__item">'
                f'<button type="button" class="nav__btn" aria-haspopup="true" '
                f'aria-expanded="false" data-dd="{nav["label"]}">{e(nav["label"])} '
                f'<span class="caret" aria-hidden="true"></span></button>'
                f'<div class="dd" role="menu" aria-label="{e(nav["label"])}">{links}</div>'
                f'</div>')
        else:
            items.append(f'<a class="nav__link" href="{nav["href"]}">{e(nav["label"])}</a>')
    nav_html = "".join(items)
    cta = f'<a class="btn btn--solid nav__cta" href="{B.NAV_CTA["href"]}">{e(B.NAV_CTA["label"])}</a>'
    mobile_links = []
    for nav in B.NAV:
        mobile_links.append(f'<a class="mnav__top" href="{nav["href"]}">{e(nav["label"])}</a>')
        for d in nav.get("dropdown", []):
            mobile_links.append(f'<a class="mnav__sub" href="{d["href"]}">{e(d["label"])}</a>')
    mobile = "".join(mobile_links) + f'<a class="btn btn--solid mnav__cta" href="{B.NAV_CTA["href"]}">{e(B.NAV_CTA["label"])}</a>'
    return (
        '<header class="site-header"><div class="container header__in">'
        f'<a class="brand" href="/" aria-label="EKSTRUH home">'
        f'<span class="brand__logo">{B.LOGO_SVG}</span>'
        f'<span class="brand__tag">{e(B.TAGLINE)}</span></a>'
        f'<nav class="nav" aria-label="Primary"><div class="nav__items">{nav_html}</div>{cta}'
        f'<button type="button" class="nav__burger" aria-label="Open menu" aria-expanded="false" '
        f'aria-controls="mnav"><span></span><span></span><span></span></button></nav>'
        f'</div><nav id="mnav" class="mnav" aria-label="Mobile">{mobile}</nav></header>'
    )


def footer_html():
    cols = []
    for col in B.FOOTER:
        links = "".join(f'<li><a href="{h}">{e(l)}</a></li>' for l, h in col["links"])
        cols.append(f'<div class="footer__col"><h3>{e(col["title"])}</h3><ul>{links}</ul></div>')
    legal = "".join(f'<a href="{h}">{e(l)}</a>' for l, h in B.FOOTER_LEGAL)
    return (
        '<footer class="site-footer"><div class="container">'
        f'<div class="footer__grid">{"".join(cols)}</div>'
        f'<div class="footer__legal">{legal}</div>'
        '<div class="footer__bar">'
        f'<p>{e(B.COPYRIGHT_LINE)}</p><p>{e(B.COMPANY_LINE)}</p>'
        '</div></div></footer>'
    )


def head_html(title, desc, canonical, crumbs, extra_schema=None):
    org = {
        "@context": "https://schema.org", "@type": "Organization",
        "name": "EKSTRUH", "url": f"https://{B.SITE_DOMAIN}/",
        "email": B.CONTACT_EMAIL, "slogan": B.TAGLINE,
        "parentOrganization": {"@type": "Organization", "name": "EKSTRUH LTD"},
    }
    web = {"@context": "https://schema.org", "@type": "WebSite",
           "name": "EKSTRUH", "url": f"https://{B.SITE_DOMAIN}/"}
    bc = {"@context": "https://schema.org", "@type": "BreadcrumbList",
          "itemListElement": [
              {"@type": "ListItem", "position": i + 1, "name": l,
               "item": f"https://{B.SITE_DOMAIN}{h}"}
              for i, (l, h) in enumerate(crumbs)]}
    schemas = "".join(
        f'<script type="application/ld+json">{json.dumps(s, separators=(",", ":"))}</script>'
        for s in ([org, web] if canonical == "/" else []) + [bc] + ([extra_schema] if extra_schema else []))
    return (
        "<head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>{e(title)}</title>"
        f"<meta name=\"description\" content=\"{e(desc)}\">"
        f"<link rel=\"canonical\" href=\"https://{B.SITE_DOMAIN}{canonical}\">"
        "<meta name=\"robots\" content=\"index, follow\">"
        f"<meta property=\"og:title\" content=\"{e(title)}\">"
        f"<meta property=\"og:description\" content=\"{e(desc)}\">"
        f"<meta property=\"og:url\" content=\"https://{B.SITE_DOMAIN}{canonical}\">"
        "<meta property=\"og:type\" content=\"website\">"
        "<link rel=\"stylesheet\" href=\"/assets/css/main.css\">"
        f"{schemas}</head>"
    )


def page_shell(title, desc, canonical, crumbs, body, active=None):
    active = active or canonical
    return (
        "<!doctype html><html lang=\"en-GB\">"
        + head_html(title, desc, canonical, crumbs)
        + "<body>" + header_html(active)
        + f"<main id=\"main\">{body}</main>" + footer_html()
        + "<script src=\"/assets/js/main.js\" defer></script></body></html>"
    )


# ================================================================ blocks
def sec(eyebrow, h2, sub, inner, theme="light", cls=""):
    th = {"light": "", "offwhite": " sec--offwhite", "deep": " sec--deep",
          "dark": " sec--dark"}[theme]
    ey = f'<p class="eyebrow{ " eyebrow--on-dark" if theme in ("deep","dark") else ""}">{e(eyebrow)}</p>' if eyebrow else ""
    sub = f'<p class="sec__sub{ " sec__sub--on-dark" if theme in ("deep","dark") else ""}">{sub}</p>' if sub else ""
    return f'<section class="sec{th} {cls}"><div class="container">{ey}<h2>{h2}</h2>{sub}{inner}</div></section>'


def service_cards():
    cards = []
    for i, sv in enumerate(CT.SERVICES):
        lead = " svc-card--lead" if i < 2 else ""
        chips = "".join(f'<li class="chip">{e(c)}</li>' for c in sv["chips"])
        cards.append(
            f'<article class="svc-card{lead}"><p class="num">{sv["num"]}</p>'
            f'<h3>{e(sv["title"])}</h3><p class="card__body">{e(sv["card"])}</p>'
            f'<ul class="chips chips--light">{chips}</ul>'
            f'<a class="textlink" href="{sv["path"]}">Explore service <span aria-hidden="true">&rarr;</span></a>'
            f'</article>')
    return f'<div class="svc-grid">{"".join(cards)}</div>'


def framework_cards():
    cards = []
    for fw in CT.FRAMEWORKS:
        bullets = "".join(f'<li class="tick">{e(b)}</li>' for b in CT.FW_BULLETS)
        cards.append(
            f'<article class="fw-card"><p class="num num--on-dark">{fw["num"]}</p>'
            f'<h3>{e(fw["title"])}</h3><p class="card__body card__body--on-dark">{e(fw["card"])}</p>'
            f'<ul class="fw-list">{bullets}</ul>'
            f'<a class="textlink textlink--on-dark" href="{fw["path"]}">View {e(fw["title"])} '
            f'<span aria-hidden="true">&rarr;</span></a></article>')
    return f'<div class="fw-grid">{"".join(cards)}</div>'


def ai_items():
    items = [
        ("AI Assistants", "Purpose-built conversational and task-oriented assistants."),
        ("Document & Knowledge Search", "Make internal information easier to find and use across the business."),
        ("Workflow Automation", "Automate repetitive manual steps across tools and systems."),
        ("Data Extraction & Structuring", "Turn unstructured documents into usable structured data."),
        ("Lead / Enquiry Processing", "Route, summarise and qualify incoming enquiries."),
        ("AI Features in Existing Apps", "Add capability without rebuilding what already works."),
    ]
    left = "".join(
        f'<div class="ai-item"><span class="ai-item__mark" aria-hidden="true">&rarr;</span>'
        f'<div><h3>{e(t)}</h3><p>{e(s)}</p></div></div>' for t, s in items)
    return f'<div class="ai-grid"><div class="ai-list">{left}</div>{HV.ai_diagram()}</div>'


def value_blocks():
    blocks = [
        ("Focused Engineering", "Solutions designed around actual requirements rather than unnecessary technology."),
        ("Specialist Framework Experience", "Practical experience working with ASP.NET Core, ASP.NET Zero, ABP.IO and Angular."),
        ("Modernisation Mindset", "We use mature, proven systems where they fit and modern tools where they add real value. The goal is long-term value, not new builds for their own sake. Read <a class=\"textlink\" href=\"/about/\">how we work</a>."),
        ("Long-Term Support", "Development doesn't have to stop when the initial project goes live."),
    ]
    return '<div class="value-grid">' + "".join(
        f'<div class="value-block"><h3>{e(t)}</h3><p>{s}</p></div>' for t, s in blocks) + "</div>"


def cta_band():
    return (
        '<section class="sec sec--deep sec--cta"><div class="container cta__in">'
        '<div><h2>Have a Software Project in Mind?</h2>'
        "<p class=\"sec__sub sec__sub--on-dark\">Whether you're building something new, modernising an existing "
        "application or need specialist development support, let's discuss what you need.</p></div>"
        f'<div class="cta__btns"><a class="btn btn--white" href="/contact/">Start a Project '
        f'<span aria-hidden="true">&rarr;</span></a>'
        f'<a class="btn btn--outline-light" href="mailto:{B.CONTACT_EMAIL}">{B.CONTACT_EMAIL}</a></div>'
        '</div></section>'
    )


def hero(title_html, intro, visual, primary=("/contact/", "Start a Project"), secondary=("/services/", "Explore Our Services")):
    btns = (f'<div class="hero__btns"><a class="btn btn--solid" href="{primary[0]}">{e(primary[1])} '
            f'<span aria-hidden="true">&rarr;</span></a>'
            f'<a class="btn btn--ghost" href="{secondary[0]}">{e(secondary[1])} '
            f'<span aria-hidden="true">&rarr;</span></a></div>')
    return (
        '<section class="hero"><div class="container hero__in">'
        f'<div class="hero__copy"><h1>{title_html}</h1><p class="hero__lede">{intro}</p>{btns}</div>'
        f'{visual}</div></section>'
    )


def inner_hero(num, title, intro, visual=None):
    vis = visual or HV.service_visual(num, title.split(" ")[0])
    return (
        '<section class="hero hero--inner"><div class="container hero__in">'
        f'<div class="hero__copy"><h1>{e(title)}</h1><p class="hero__lede">{intro}</p>'
        f'<div class="hero__btns"><a class="btn btn--solid" href="/contact/">Start a Project '
        f'<span aria-hidden="true">&rarr;</span></a>'
        f'<a class="btn btn--ghost" href="/services/">Explore Our Services '
        f'<span aria-hidden="true">&rarr;</span></a></div></div>{vis}</div></section>'
    )


def crumb_links(crumbs):
    return f'<nav class="crumbs" aria-label="Breadcrumb"><ol>' + "".join(
        f'<li><a href="{h}">{e(l)}</a></li>' for l, h in crumbs) + "</ol></nav>"


def detail_body(points, blurb=None, chips=None, extra=None):
    out = ""
    if blurb:
        out += f'<section class="sec"><div class="container narrow"><p class="lead">{blurb}</p></div></section>'
    if points:
        cards = "".join(
            f'<article class="pt-card"><h3>{e(t)}</h3><p>{e(s)}</p></article>' for t, s in points)
        out += f'<section class="sec sec--offwhite sec--tight"><div class="container"><div class="pt-grid">{cards}</div></div></section>'
    if chips:
        out += (f'<section class="sec sec--tight"><div class="container narrow">'
                f'<ul class="chips chips--light">{"".join(f"<li class=chip>{e(c)}</li>" for c in chips)}</ul>'
                f'</div></section>')
    if extra:
        out += extra
    out += cta_band()
    return out


# ================================================================ pages
def build_pages():
    pages = {}

    # ---- home
    home = (
        hero(
            "Software Development &amp; <span class=\"hl\">AI Integration</span> for Growing Businesses",
            "We design and develop custom software, digital products and intelligent automation that help "
            "businesses modernise, connect systems and work more efficiently.",
            HV.hero_visual())
        + sec(None, "What We Build &amp; Improve",
              "From new digital products to modernising existing applications, we help businesses build, "
              "connect and maintain the technology they depend on.",
              service_cards(), theme="offwhite")
        + sec(None, "Deep Expertise in the Frameworks Your Application Already Depends On",
              "We help organisations maintain, upgrade and modernise applications built with ASP.NET Core, "
              "ASP.NET Zero, ABP.IO and Angular.",
              framework_cards(), theme="deep")
        + sec("AI &amp; Automation", "Bring AI Into the Work Your Business Already Does",
              "We integrate established AI capabilities into websites, applications and business workflows to "
              "automate repetitive tasks, improve access to information and support day-to-day operations.",
              ai_items(), theme="dark")
        + sec("How We Work", "From Requirement to Reliable Software", None, HV.timeline())
        + sec(None, "Technology Expertise",
              "We choose technologies around the requirements of the product rather than forcing every project "
              "into the same stack.", HV.tech_chips(), theme="dark")
        + sec(None, "Built Around the Work, Not the Hype", None, value_blocks())
        + cta_band()
    )
    pages["/"] = dict(
        title="EKSTRUH — Software, Web & AI Solutions",
        desc="EKSTRUH designs and develops custom software, digital products and AI integration for growing businesses, with deep expertise in ASP.NET Core, ASP.NET Zero, ABP.IO and Angular.",
        crumbs=[("Home", "/")], body=home)

    # ---- services landing
    pages["/services/"] = dict(
        title="Services — EKSTRUH", desc="What we build and improve: web & digital products, AI integration & automation, business systems & integrations, application modernisation and managed support.",
        crumbs=[("Home", "/"), ("Services", "/services/")],
        body=inner_hero("01", "Services", "From new digital products to modernising existing applications, we help businesses build, connect and maintain the technology they depend on.", HV.service_visual("01", "Services"))
        + sec(None, "What We Build &amp; Improve", None, service_cards(), theme="offwhite")
        + cta_band())

    for sv in CT.SERVICES:
        pages[sv["path"]] = dict(
            title=f"{sv['title']} — EKSTRUH", desc=sv["card"],
            crumbs=[("Home", "/"), ("Services", "/services/"), (sv["title"], sv["path"])],
            body=inner_hero(sv["num"], sv["title"], sv["intro"])
            + detail_body(sv["points"], blurb=sv["intro"], chips=sv["chips"]))

    # ---- technologies landing
    pages["/technologies/"] = dict(
        title="Framework Expertise — EKSTRUH", desc="Deep expertise in ASP.NET Zero, ABP.IO, Angular and ASP.NET Core: upgrades, migration & modernisation, support & maintenance and dedicated engineers.",
        crumbs=[("Home", "/"), ("Framework", "/technologies/")],
        body=inner_hero("02", "Framework Expertise", "We help organisations maintain, upgrade and modernise applications built with ASP.NET Core, ASP.NET Zero, ABP.IO and Angular.", HV.service_visual("02", "Frameworks"))
        + sec(None, "The Frameworks We Work In", None, framework_cards(), theme="deep")
        + cta_band())

    for fw in CT.FRAMEWORKS:
        pages[fw["path"]] = dict(
            title=f"{fw['title']} — EKSTRUH", desc=fw["card"],
            crumbs=[("Home", "/"), ("Framework", "/technologies/"), (fw["title"], fw["path"])],
            body=inner_hero(fw["num"], fw["title"], fw["intro"])
            + detail_body([(b, "Structured, specialist support as part of an ongoing engineering engagement.") for b in CT.FW_BULLETS],
                          blurb=fw["blurb"]))

    # ---- staff aug landing
    pages["/staff-augmentation/"] = dict(
        title="Staff Augmentation — EKSTRUH", desc="Engineering delivery capacity: dedicated engineers, specialized AI talent, cloud & DevOps experts and QA & test engineers who work as part of your team.",
        crumbs=[("Home", "/"), ("Staff Augmentation", "/staff-augmentation/")],
        body=inner_hero("03", "Staff Augmentation", "Engineering delivery capacity for your team — experienced engineers who join your delivery and work as part of it.", HV.service_visual("03", "Staff Augmentation"))
        + sec(None, "Four Approved Categories", None,
              '<div class="pt-grid">' + "".join(
                  f'<article class="pt-card"><p class="num">{st["num"]}</p><h3>{e(st["title"])}</h3><p>{e(st["card"])}</p>'
                  f'<a class="textlink" href="{st["path"]}">View category <span aria-hidden="true">&rarr;</span></a></article>'
                  for st in CT.STAFF) + "</div>", theme="offwhite")
        + sec(None, "How We Work With Your Team", None,
              '<div class="pt-grid">' + "".join(
                  f'<article class="pt-card"><h3>{e(t)}</h3><p>{e(s)}</p></article>' for t, s in CT.STAFF_PRINCIPLES) + "</div>")
        + cta_band())

    for st in CT.STAFF:
        pages[st["path"]] = dict(
            title=f"{st['title']} — EKSTRUH", desc=st["card"],
            crumbs=[("Home", "/"), ("Staff Augmentation", "/staff-augmentation/"), (st["title"], st["path"])],
            body=inner_hero(st["num"], st["title"], st["intro"])
            + detail_body([(t, s) for t, s in CT.STAFF_PRINCIPLES], blurb=st["blurb"]))

    # ---- our work / about / contact
    pages["/our-work/"] = dict(
        title="Our Work — EKSTRUH", desc="How EKSTRUH approaches delivery: focused engineering, specialist framework experience and long-term support.",
        crumbs=[("Home", "/"), ("Our Work", "/our-work/")],
        body=inner_hero("04", "Our Work", "We let the work speak. Here is how we approach delivery and the standards we hold ourselves to.", HV.service_visual("04", "Our Work"))
        + sec(None, "Built Around the Work, Not the Hype", None, value_blocks())
        + cta_band())

    pages["/about/"] = dict(
        title="About — EKSTRUH", desc=f"{B.COMPANY_LINE} Focused engineering, specialist framework experience and long-term support.",
        crumbs=[("Home", "/"), ("About", "/about/")],
        body=inner_hero("05", "About EKSTRUH", B.COMPANY_LINE, HV.service_visual("05", "About"))
        + sec(None, "How We Work", "From requirement to reliable software.", HV.timeline())
        + sec(None, "What We Value", None, value_blocks())
        + cta_band())

    contact_form = (
        '<section class="sec sec--offwhite"><div class="container narrow">'
        '<form class="contact" method="post" action="/contact/send.php" novalidate>'
        '<input type="hidden" name="csrf_token" value="">'
        '<p class="form__row"><label for="f-name">Name</label>'
        '<input id="f-name" name="name" type="text" autocomplete="name" required></p>'
        '<p class="form__row"><label for="f-email">Email</label>'
        '<input id="f-email" name="email" type="email" autocomplete="email" required></p>'
        '<p class="form__row"><label for="f-subject">Subject</label>'
        '<select id="f-subject" name="subject" required>'
        '<option value="new-project">New project</option>'
        '<option value="modernisation">Application modernisation</option>'
        '<option value="support">Support & maintenance</option>'
        '<option value="staff-augmentation">Staff augmentation</option>'
        '<option value="other">Other</option></select></p>'
        '<p class="form__row form__hp" aria-hidden="true"><label for="f-company">Company (leave blank)</label>'
        '<input id="f-company" name="company" type="text" tabindex="-1" autocomplete="off"></p>'
        '<p class="form__row"><label for="f-message">Message</label>'
        '<textarea id="f-message" name="message" rows="6" required></textarea></p>'
        '<p class="form__row"><button class="btn btn--solid" type="submit">Send enquiry '
        '<span aria-hidden="true">&rarr;</span></button></p>'
        '</form></div></section>')
    pages["/contact/"] = dict(
        title="Contact — EKSTRUH", desc="Start a project with EKSTRUH. Tell us what you are building, modernising or supporting and we will respond.",
        crumbs=[("Home", "/"), ("Contact", "/contact/")],
        body=inner_hero("06", "Start a Project", "Tell us what you are building, modernising or supporting. We respond to every enquiry.", HV.service_visual("06", "Contact"))
        + contact_form)

    for lg in CT.LEGAL:
        secs = "".join(
            f'<section class="sec sec--tight"><div class="container narrow"><h2 class="h3">{e(h)}</h2><p>{e(p)}</p></div></section>'
            for h, p in lg["sections"])
        pages[lg["path"]] = dict(
            title=f"{lg['title']} — EKSTRUH", desc=lg["intro"],
            crumbs=[("Home", "/"), (lg["title"], lg["path"])],
            body=inner_hero("", lg["title"], lg["intro"], HV.service_visual("§", lg["title"])) + secs)

    return pages


# ================================================================ assets
CSS = """
:root{
 --ink:%(ink)s;--body:%(body)s;--muted:%(muted)s;--green:%(green)s;--green-strong:%(green_strong)s;
 --green-link-dark:%(green_link_dark)s;--deep:%(green_deep)s;--deep-border:%(green_deep_border)s;--deep-text:%(green_deep_text)s;
 --nb:%(near_black)s;--nb-border:%(near_black_border)s;--nb-text:%(near_black_text)s;
 --bg:%(bg_light)s;--white:%(bg_white)s;--border:%(border)s;--chip-dark:%(chip_bg_dark)s;
 --container:%(container)s;--gutter:%(gutter)s;--sy:%(section_y)s;--sym:%(section_y_mobile)s;
 --r:%(card_radius)s;--br:%(btn_radius)s;--pad:%(card_pad)s;--gap:%(grid_gap)s;--hh:%(header_h)s;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:%(stack)s;color:var(--body);background:var(--white);font-size:%(body)s;line-height:%(body_lh)s;-webkit-font-smoothing:antialiased}
img,svg{display:block;max-width:100%%}
a{color:var(--green);text-decoration:none}
h1,h2,h3{color:var(--ink);font-weight:700}
h1{font-size:%(h1)s;line-height:%(h1_lh)s;letter-spacing:-0.01em}
h2{font-size:%(h2)s;line-height:%(h2_lh)s}
h3,.h3{font-size:%(h3)s;line-height:%(h3_lh)s}
.container{max-width:var(--container);margin:0 auto;padding:0 var(--gutter)}
.narrow{max-width:760px}
.hl{color:var(--green)}
:focus-visible{outline:2px solid var(--green);outline-offset:2px;border-radius:2px}
.skip{position:absolute;left:-9999px}
.skip:focus{left:8px;top:8px;background:var(--white);padding:8px 12px;z-index:100}
/* header */
.site-header{position:sticky;top:0;z-index:50;background:var(--white);border-bottom:1px solid var(--border)}
.header__in{display:flex;align-items:center;justify-content:space-between;height:var(--hh)}
.brand{display:flex;flex-direction:column;gap:2px;align-items:flex-start}
.brand__tag{font-size:var(--micro);color:var(--muted);letter-spacing:.02em}
.nav{display:flex;align-items:center;gap:20px}
.nav__items{display:flex;align-items:center;gap:6px}
.nav__btn,.nav__link{background:none;border:0;font-family:inherit;font-size:%(nav)s;color:var(--ink);padding:8px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.nav__link:hover,.nav__btn:hover{color:var(--green)}
.caret{width:8px;height:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px)}
.nav__item{position:relative}
.dd{display:none;position:absolute;top:calc(100%% + 6px);left:0;min-width:240px;background:var(--white);border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 24px rgba(20,32,26,.08);padding:8px;flex-direction:column}
.nav__item.open .dd{display:flex}
.dd__link{padding:8px 10px;font-size:%(nav)s;color:var(--ink);border-radius:6px}
.dd__link:hover{background:var(--bg);color:var(--green)}
.nav__cta{margin-left:6px}
.nav__burger{display:none;background:none;border:0;flex-direction:column;gap:4px;padding:8px;cursor:pointer}
.nav__burger span{width:20px;height:2px;background:var(--ink)}
.mnav{display:none;flex-direction:column;padding:12px var(--gutter) 20px;border-top:1px solid var(--border);background:var(--white)}
.mnav.open{display:flex}
.mnav__top{padding:10px 0;font-weight:600;color:var(--ink)}
.mnav__sub{padding:8px 0 8px 14px;font-size:%(nav)s;color:var(--muted)}
.mnav__cta{margin-top:12px;align-self:flex-start}
/* buttons */
.btn{display:inline-flex;align-items:center;gap:8px;font-family:inherit;font-size:%(nav)s;font-weight:600;padding:11px 18px;border-radius:var(--br);border:1px solid transparent;cursor:pointer}
.btn--solid{background:var(--green-strong);color:#fff}
.btn--solid:hover{background:var(--green)}
.btn--ghost{background:var(--white);color:var(--ink);border-color:var(--border)}
.btn--ghost:hover{border-color:var(--green);color:var(--green)}
.btn--white{background:#fff;color:var(--deep)}
.btn--outline-light{background:transparent;color:#fff;border-color:var(--deep-border)}
.btn--outline-light:hover{border-color:#fff}
.textlink{font-size:%(nav)s;font-weight:600;color:var(--green)}
.textlink--on-dark{color:var(--green-link-dark)}
/* hero */
.hero{background:linear-gradient(180deg,#fbfcfb, var(--bg));padding:calc(var(--sy)*0.8) 0 var(--sy)}
.hero--inner{padding:calc(var(--sy)*0.6) 0}
.hero__in{display:grid;grid-template-columns:1.15fr .85fr;gap:calc(var(--gap)*2);align-items:center}
.hero__lede{margin:18px 0 26px;max-width:52ch;font-size:1rem}
.hero__btns{display:flex;gap:12px;flex-wrap:wrap}
.hero-visual{display:flex;flex-direction:column;gap:12px}
.hero-visual__row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.plate{background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;box-shadow:0 1px 2px rgba(20,32,26,.05)}
.plate--hi{border-color:var(--green);background:#f3f8f4}
.plate__t{font-weight:600;color:var(--ink);font-size:%(small)s}
.plate__s{color:var(--muted);font-size:var(--micro);margin-top:2px}
.plate--sm{padding:10px 12px}
.page-visual{display:flex;flex-direction:column;gap:12px}
/* sections */
.sec{padding:var(--sy) 0}
.sec--tight{padding:calc(var(--sy)*0.55) 0}
.sec--offwhite{background:var(--bg)}
.sec--deep{background:var(--deep)}
.sec--dark{background:var(--nb)}
.sec h2{max-width:26ch}
.sec--deep h2,.sec--dark h2{color:#fff}
.sec__sub{margin-top:12px;max-width:64ch;color:var(--muted)}
.sec__sub--on-dark{color:var(--deep-text)}
.sec--dark .sec__sub{color:var(--nb-text)}
.eyebrow{font-size:var(--micro);letter-spacing:.14em;text-transform:uppercase;color:var(--green);font-weight:700;display:flex;align-items:center;gap:10px;margin-bottom:14px}
.eyebrow::before{content:"";width:26px;height:1px;background:currentColor}
.eyebrow--on-dark{color:var(--green-link-dark)}
.lead{font-size:1.0625rem;color:var(--body)}
/* service cards */
.svc-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:var(--gap);margin-top:36px}
.svc-card{grid-column:span 2;background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:var(--pad);display:flex;flex-direction:column;gap:12px}
.svc-card--lead{grid-column:span 3;border-top:2px solid var(--green)}
.num{font-size:var(--micro);font-weight:700;color:var(--muted);letter-spacing:.08em}
.num--on-dark{color:var(--green-link-dark)}
.card__body{font-size:%(small)s;color:var(--muted)}
.card__body--on-dark{color:var(--deep-text)}
.chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px}
.chip{font-size:var(--micro);color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:4px 10px;background:var(--white)}
.chips--light .chip{background:var(--white)}
.chip--dark{background:var(--chip-dark);border-color:var(--nb-border);color:var(--nb-text)}
/* frameworks */
.fw-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap);margin-top:36px}
.fw-card{background:rgba(255,255,255,.02);border:1px solid var(--deep-border);border-radius:var(--r);padding:var(--pad);display:flex;flex-direction:column;gap:12px}
.fw-card h3{color:#fff}
.fw-list{list-style:none;display:flex;flex-direction:column;gap:8px}
.tick{font-size:%(small)s;color:var(--deep-text);display:flex;gap:8px;align-items:baseline}
.tick::before{content:"";width:5px;height:5px;border-radius:50%%;background:var(--green-link-dark)}
/* ai */
.ai-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:calc(var(--gap)*1.5);margin-top:36px;align-items:start}
.ai-list{display:grid;grid-template-columns:1fr 1fr;gap:22px 26px}
.ai-item{display:flex;gap:10px}
.ai-item h3{color:#fff;font-size:1rem}
.ai-item p{font-size:%(small)s;color:var(--nb-text);margin-top:4px}
.ai-item__mark{color:var(--green-link-dark)}
.dia{border:1px solid var(--nb-border);border-radius:var(--r);padding:18px;display:flex;flex-direction:column;gap:12px}
.dia__head{font-size:var(--micro);letter-spacing:.12em;text-transform:uppercase;color:var(--nb-text)}
.dia__row{display:flex;gap:12px;border:1px solid var(--nb-border);border-radius:8px;padding:10px 12px}
.dia__num{font-size:var(--micro);color:var(--green-link-dark);font-weight:700}
.dia__t{font-size:%(small)s;color:#fff;font-weight:600}
.dia__s{font-size:var(--micro);color:var(--nb-text)}
/* steps */
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap);margin-top:44px;position:relative}
.steps::before{content:"";position:absolute;top:5px;left:4%%;right:4%%;height:1px;background:var(--border)}
.step{position:relative;padding-top:22px}
.step__dot{position:absolute;top:0;left:0;width:11px;height:11px;border-radius:50%%;background:var(--white);border:2px solid var(--green)}
.step__num{font-size:var(--micro);color:var(--muted);font-weight:700}
.step__t{margin-top:6px}
.step__s{font-size:%(small)s;color:var(--muted);margin-top:6px}
/* tech */
.tech{display:grid;grid-template-columns:1fr 1fr;gap:30px 40px;margin-top:36px}
.tech__group{display:flex;flex-direction:column;gap:12px}
/* value */
.value-grid{display:grid;grid-template-columns:1fr 1fr;gap:34px 48px;margin-top:36px}
.value-block h3{margin-bottom:8px}
.value-block p{font-size:%(small)s;color:var(--muted)}
/* cta */
.sec--cta{padding:calc(var(--sy)*0.7) 0}
.cta__in{display:flex;align-items:center;justify-content:space-between;gap:30px;flex-wrap:wrap}
.cta__btns{display:flex;gap:12px;flex-wrap:wrap}
/* points / detail */
.pt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap)}
.pt-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:var(--pad)}
.sec--offwhite .pt-card{background:var(--white)}
.pt-card h3{margin-bottom:8px}
.pt-card p{font-size:%(small)s;color:var(--muted)}
.crumbs{padding:14px 0 0}
.crumbs ol{list-style:none;display:flex;gap:8px;flex-wrap:wrap;font-size:var(--micro);color:var(--muted)}
.crumbs a{color:var(--muted)}
.crumbs li+li::before{content:"/";margin-right:8px;color:var(--border)}
/* footer */
.site-footer{background:var(--bg);border-top:1px solid var(--border);padding:calc(var(--sy)*0.6) 0 24px}
.footer__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:30px}
.footer__col h3{font-size:%(small)s;margin-bottom:14px}
.footer__col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
.footer__col a{font-size:%(small)s;color:var(--muted)}
.footer__col a:hover{color:var(--green)}
.footer__legal{display:flex;gap:18px;flex-wrap:wrap;margin:30px 0 18px}
.footer__legal a{font-size:var(--micro);color:var(--muted)}
.footer__bar{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:18px}
.footer__bar p{font-size:var(--micro);color:var(--muted)}
/* contact form */
.contact{background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:var(--pad);display:flex;flex-direction:column;gap:16px}
.form__row{display:flex;flex-direction:column;gap:6px}
.form__row label{font-size:%(small)s;font-weight:600;color:var(--ink)}
.form__row input,.form__row select,.form__row textarea{font-family:inherit;font-size:%(small)s;padding:10px 12px;border:1px solid var(--border);border-radius:8px;color:var(--ink);background:var(--white)}
.form__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
/* responsive */
@media (max-width:1180px){.svc-card--lead{grid-column:span 3}.svc-card{grid-column:span 2}}
@media (max-width:992px){
 .hero__in{grid-template-columns:1fr}
 .ai-grid{grid-template-columns:1fr}
 .steps{grid-template-columns:repeat(2,1fr)}
 .steps::before{display:none}
 .footer__grid{grid-template-columns:repeat(2,1fr)}
 .nav__items,.nav__cta{display:none}
 .nav__burger{display:flex}
 .svc-card--lead{grid-column:span 6}.svc-card{grid-column:span 3}
 .pt-grid{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:768px){
 .sec{padding:var(--sym) 0}
 .fw-grid,.value-grid,.tech,.ai-list{grid-template-columns:1fr}
 .svc-card,.svc-card--lead{grid-column:span 6}
 .pt-grid{grid-template-columns:1fr}
 .hero-visual__row{grid-template-columns:repeat(3,1fr)}
}
@media (max-width:430px){
 .steps{grid-template-columns:1fr}
 .footer__grid{grid-template-columns:1fr}
 .hero-visual__row{grid-template-columns:1fr}
 .cta__in{flex-direction:column;align-items:flex-start}
}
""" % {**{k: v for k, v in C.items()}, **{k: v for k, v in T.items()}, **{k: v for k, v in S.items()}}

JS = """
(function(){
  var d=document;
  d.addEventListener('click',function(ev){
    var btn=ev.target.closest('.nav__btn');
    d.querySelectorAll('.nav__item.open').forEach(function(it){
      if(!btn||it!==btn.parentElement){it.classList.remove('open');it.querySelector('.nav__btn').setAttribute('aria-expanded','false');}
    });
    if(btn){var item=btn.parentElement;var open=item.classList.toggle('open');btn.setAttribute('aria-expanded',open?'true':'false');ev.stopPropagation();}
  });
  var burger=d.querySelector('.nav__burger');var mnav=d.getElementById('mnav');
  if(burger&&mnav){burger.addEventListener('click',function(){var o=mnav.classList.toggle('open');burger.setAttribute('aria-expanded',o?'true':'false');});}
})();
"""


# ================================================================ emit
def write(path, text):
    full = os.path.join(OUT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full) or OUT, exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(text)


def validate(pages):
    errs = []
    # contrast AA
    print("\n-- contrast (AA >= 4.5) --")
    for name, fg, bg in CONTRAST_PAIRS:
        r = contrast(fg, bg)
        print(f"{name:34s} {r:5.2f}  {'OK' if r >= 4.5 else 'FAIL'}")
        if r < 4.5:
            errs.append(f"contrast {name} = {r:.2f}")
    # duplicate ids + internal links per page
    all_paths = set(pages.keys()) | {"/assets/css/main.css", "/assets/js/main.js", "/contact/send.php", "/contact/index.php"}
    for path, pg in pages.items():
        html = pg["html"]
        ids = re.findall(r'id="([^"]+)"', html)
        dup = {i for i in ids if ids.count(i) > 1}
        if dup:
            errs.append(f"{path} duplicate ids {dup}")
        for href in re.findall(r'href="(/[^"]*)"', html):
            if href.startswith(("/assets", "mailto:", "/#", "/contact/send.php")):
                continue
            href = href.split("#")[0] or "/"
            target = href if href.endswith("/") or "." in href.split("/")[-1] else href + "/"
            if target not in all_paths:
                errs.append(f"{path} broken link {href}")
    # canonical/sitemap consistency
    for path, pg in pages.items():
        if f'canonical" href="https://{B.SITE_DOMAIN}{path}' not in pg["html"] and f'href="https://{B.SITE_DOMAIN}{path}">' not in pg["html"]:
            errs.append(f"{path} canonical mismatch")
    return errs


def main():
    pages = build_pages()
    for path, pg in pages.items():
        pg["html"] = page_shell(pg["title"], pg["desc"], path, pg["crumbs"], pg["body"])
        if path == "/contact/":
            prologue = ("<?php session_start(); "
                        "if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = bin2hex(random_bytes(16)); } ?>\n")
            html = pg["html"].replace('<input type="hidden" name="csrf_token" value="">',
                                      '<input type="hidden" name="csrf_token" '
                                      "value=\"<?php echo htmlspecialchars($_SESSION['csrf'], ENT_QUOTES); ?>\">")
            write("/contact/index.php", prologue + html)
        else:
            write(path + "index.html", pg["html"])
    write("/assets/css/main.css", CSS)
    write("/assets/js/main.js", JS)
    # sitemap + robots
    urls = "".join(
        f"<url><loc>https://{B.SITE_DOMAIN}{p}</loc></url>" for p in sorted(pages))
    write("/sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>")
    write("/robots.txt", f"User-agent: *\nAllow: /\nSitemap: https://{B.SITE_DOMAIN}/sitemap.xml\n")
    # 404 (noindex)
    nf = page_shell("Page not found — EKSTRUH", "The page you requested does not exist.", "/404.html",
                    [("Home", "/")],
                    '<section class="sec"><div class="container narrow"><h1>Page not found</h1>'
                    '<p class="hero__lede">The page you are looking for does not exist or has moved. '
                    '<a class="textlink" href="/">Return to the homepage</a>.</p></div></section>')
    nf = nf.replace('content="index, follow"', 'content="noindex"')
    write("/404.html", nf)
    # htaccess with 301s + 404
    redir = "\n".join(f"Redirect 301 {src} {dst}" for src, dst in B.REDIRECTS_301)
    write("/.htaccess", "ErrorDocument 404 /404.html\n" + redir + "\n")
    # contact send (secure PHP)
    write("/contact/send.php", CONTACT_PHP)
    errs = validate(pages)
    print(f"\n{len(pages)} pages generated.")
    if errs:
        print("VALIDATION ERRORS:")
        for er in sorted(set(errs)):
            print(" -", er)
        sys.exit(1)
    print("validation: OK")


CONTACT_PHP = """<?php
// EKSTRUH contact handler. Fixed recipient, allowlisted subjects, CSRF token,
// honeypot, rate limiting, sanitisation and CRLF protection. Test mode OFF.
define('CONTACT_TEST_MODE', false);
session_start();
$RECIPIENT = 'info@ekstruh.dev';
$SUBJECTS = ['new-project','modernisation','support','staff-augmentation','other'];
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
// CSRF
if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], (string)($_POST['csrf_token'] ?? ''))) { http_response_code(403); exit('Bad token'); }
// Honeypot
if (!empty($_POST['company'])) { http_response_code(200); exit(''); }
// Rate limit: max 3 submissions per 10 minutes per session
$now = time();
$_SESSION['rl'] = array_filter($_SESSION['rl'] ?? [], fn($t) => $now - $t < 600);
if (count($_SESSION['rl']) >= 3) { http_response_code(429); exit('Too many requests'); }
$_SESSION['rl'][] = $now;
// Sanitise + validate
$name = trim(preg_replace('/\\s+/', ' ', substr((string)($_POST['name'] ?? ''), 0, 80)));
$email = filter_var((string)($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$subject = (string)($_POST['subject'] ?? '');
$message = trim(substr((string)($_POST['message'] ?? ''), 0, 4000));
if ($name === '' || !$email || $message === '' || !in_array($subject, $SUBJECTS, true)) { http_response_code(422); exit('Invalid input'); }
// CRLF protection
$clean = fn($v) => str_replace(["\\r", "\\n"], ' ', $v);
$name = $clean($name); $message = $clean($message);
$label = array_combine($SUBJECTS, ['New project','Application modernisation','Support & maintenance','Staff augmentation','Other'])[$subject];
$body = "Name: $name\\nEmail: $email\\nSubject: $label\\n\\n$message\\n";
$headers = 'From: website@' . $_SERVER['SERVER_NAME'] . "\\r\\n"
         . 'Reply-To: website@' . $_SERVER['SERVER_NAME'] . "\\r\\n"
         . 'X-Contact-Email: ' . $email . "\\r\\n"
         . 'Content-Type: text/plain; charset=utf-8';
if (CONTACT_TEST_MODE) { http_response_code(200); exit('test'); }
mail($RECIPIENT, 'EKSTRUH enquiry: ' . $label, $body, $headers);
http_response_code(200); exit('sent');
"""

if __name__ == "__main__":
    main()
