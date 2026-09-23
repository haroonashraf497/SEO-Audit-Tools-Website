"""EKSTRUH.dev — single source of truth for the brand + design system.

Derived from the approved homepage screenshot (the visual benchmark).
Everything here is a token; page generators must not hard-code these values.
The palette is checked for WCAG AA in _build/site.py validation (see CONTRAST).
"""

# ---------------------------------------------------------------- brand copy
BRAND_NAME = "EKSTRUH"
SITE_DOMAIN = "ekstruh.dev"
TAGLINE = "Software, Web & AI Solutions"          # exact approved tagline
COMPANY_LINE = "EKSTRUH is a software development brand operated by EKSTRUH LTD."
COPYRIGHT_LINE = "© 2026 EKSTRUH LTD. All rights reserved."
CONTACT_EMAIL = "info@ekstruh.dev"

# ---------------------------------------------------------------- palette
# Verified against the screenshot; AA contrast enforced in site.py.
COLOR = {
    "ink": "#182420",          # near-black headings / body emphasis
    "body": "#4d5852",         # body copy on light (AA on white & --bg-light)
    "muted": "#5f6a64",        # secondary / small text on light (AA)
    "faint": "#8a948d",        # footer micro-copy only (large/normal on light)
    "green": "#226b33",        # brand accent, links, small text on light (AA)
    "green_strong": "#1e5f2d", # solid button background (white text AA)
    "green_link_dark": "#7fc492",  # accent text on dark sections (AA)
    "green_deep": "#1c4527",   # framework / CTA section background
    "green_deep_border": "#35603f",  # card borders on deep green
    "green_deep_text": "#cfe0d2",    # body copy on deep green (AA)
    "near_black": "#0d1712",   # technical section background
    "near_black_border": "#2b3a30",  # chips / panel borders on near-black
    "near_black_text": "#c7d2ca",    # body copy on near-black (AA)
    "bg_light": "#f5f6f4",     # off-white section band
    "bg_white": "#ffffff",
    "border": "#e2e6e1",       # card / hairline borders on light
    "chip_bg_dark": "#14201a", # chip fill on near-black
}

# ---------------------------------------------------------------- type scale
# System-font stack only (no web fonts), controlled corporate hierarchy.
TYPE = {
    "stack": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "h1": "clamp(2rem, 1.2rem + 2.6vw, 2.75rem)",     # ~32–44px, controlled
    "h1_lh": "1.15",
    "h2": "clamp(1.5rem, 1.15rem + 1.2vw, 2rem)",     # ~24–32px
    "h2_lh": "1.25",
    "h3": "1.125rem",                                 # card / section h3
    "h3_lh": "1.35",
    "body": "0.9375rem",                              # 15px
    "body_lh": "1.65",
    "small": "0.8125rem",                             # 13px
    "micro": "0.75rem",                               # 12px labels / eyebrow
    "nav": "0.8438rem",                               # ~13.5px
}

# ---------------------------------------------------------------- spacing
SPACE = {
    "container": "1160px",
    "gutter": "24px",
    "section_y": "88px",
    "section_y_mobile": "56px",
    "card_radius": "10px",
    "btn_radius": "8px",
    "card_pad": "24px",
    "grid_gap": "24px",
    "header_h": "64px",
}

# ---------------------------------------------------------------- logo
LOGO_SVG = (
    '<svg viewBox="0 0 118 26" width="118" height="26" role="img" '
    'aria-label="EKSTRUH" focusable="false">'
    '<rect x="0" y="3" width="7" height="7" rx="1.5" fill="{green}"/>'
    '<rect x="0" y="13" width="7" height="7" rx="1.5" fill="{green_deep}"/>'
    '<text x="13" y="19" font-family="{stack}" font-size="17" font-weight="700" '
    'letter-spacing="0.5" fill="{ink}">ekstruh<tspan fill="{green}" '
    'font-size="10" dy="-6">.dev</tspan></text>'
    "</svg>"
).replace("{stack}", TYPE["stack"]).replace("{green}", COLOR["green"]) \
 .replace("{green_deep}", COLOR["green_deep"]).replace("{ink}", COLOR["ink"])

# ---------------------------------------------------------------- navigation
# Primary nav: three items + CTA. Dropdowns as approved. About/Our Work/Contact
# stay out of the top nav (footer/contextual only).
NAV = [
    {"label": "Services", "href": "/services/", "dropdown": [
        {"label": "Web & Digital Product Development", "href": "/services/web-digital-products/"},
        {"label": "AI Integration & Automation", "href": "/services/ai-integration-automation/"},
        {"label": "Business Systems & Integrations", "href": "/services/business-systems-integrations/"},
        {"label": "Application Modernisation", "href": "/services/application-modernisation/"},
        {"label": "Managed Support & Maintenance", "href": "/services/managed-support-maintenance/"},
    ]},
    {"label": "Framework", "href": "/technologies/", "dropdown": [
        {"label": "ASP.NET Zero", "href": "/technologies/aspnet-zero/"},
        {"label": "ABP.IO", "href": "/technologies/abp-io/"},
        {"label": "Angular", "href": "/technologies/angular/"},
        {"label": "ASP.NET Core", "href": "/technologies/aspnet-core/"},
    ]},
    {"label": "Staff Augmentation", "href": "/staff-augmentation/", "dropdown": [
        {"label": "Dedicated Engineers", "href": "/staff-augmentation/dedicated-engineers/"},
        {"label": "Specialized AI Talent", "href": "/staff-augmentation/specialized-ai-talent/"},
        {"label": "Cloud & DevOps Experts", "href": "/staff-augmentation/cloud-devops-experts/"},
        {"label": "QA & Test Engineers", "href": "/staff-augmentation/qa-test-engineers/"},
    ]},
]
NAV_CTA = {"label": "Start a Project", "href": "/contact/"}

# ---------------------------------------------------------------- footer
FOOTER = [
    {"title": "Services", "links": [
        ("Web & Digital Products", "/services/web-digital-products/"),
        ("AI Integration & Automation", "/services/ai-integration-automation/"),
        ("Business Systems & Integrations", "/services/business-systems-integrations/"),
        ("Application Modernisation", "/services/application-modernisation/"),
        ("Managed Support & Maintenance", "/services/managed-support-maintenance/"),
    ]},
    {"title": "Framework Expertise", "links": [
        ("ASP.NET Core", "/technologies/aspnet-core/"),
        ("ASP.NET Zero", "/technologies/aspnet-zero/"),
        ("ABP.IO", "/technologies/abp-io/"),
        ("Angular", "/technologies/angular/"),
    ]},
    {"title": "Staff Augmentation", "links": [
        ("Overview", "/staff-augmentation/"),
        ("Dedicated Engineers", "/staff-augmentation/dedicated-engineers/"),
        ("Specialized AI Talent", "/staff-augmentation/specialized-ai-talent/"),
        ("Cloud & DevOps Experts", "/staff-augmentation/cloud-devops-experts/"),
        ("QA & Test Engineers", "/staff-augmentation/qa-test-engineers/"),
    ]},
    {"title": "Company", "links": [
        ("Our Work", "/our-work/"),
        ("About", "/about/"),
        ("Contact", "/contact/"),
    ]},
]
FOOTER_LEGAL = [
    ("Privacy Policy", "/privacy-policy/"),
    ("Cookie Policy", "/cookie-policy/"),
    ("Terms", "/terms/"),
]

# Old Hire Developers URLs keep working via 301 (SEO preserved).
REDIRECTS_301 = [
    ("/hire-developers", "/staff-augmentation/"),
    ("/hire-developers/", "/staff-augmentation/"),
    ("/hire-dot-net-developers", "/staff-augmentation/dedicated-engineers/"),
    ("/hire-angular-developers", "/staff-augmentation/dedicated-engineers/"),
]
