"""EKSTRUH.dev — page content model (single source of truth for copy).

Copy is taken from the approved homepage screenshot and the approved
architecture brief. No client numbers, team sizes, years, testimonials,
bench sizes, placement times or certifications are invented anywhere.
"""

FW_BULLETS = ["Framework Upgrades", "Migration & Modernisation", "Support & Maintenance", "Dedicated Engineers"]


# ---------------------------------------------------------------- services
SERVICES = [
    dict(
        num="01", slug="web-digital-products", path="/services/web-digital-products/",
        title="Web & Digital Product Development",
        card="Custom websites, web applications, business portals, dashboards and SaaS products designed around real business requirements.",
        chips=["Custom Websites", "Web Applications", "Business Portals"],
        intro="We design and build custom websites, web applications, business portals, dashboards and SaaS products around the way your business actually works.",
        points=[
            ("Custom websites & web applications", "Built on a modern, maintainable stack with clean URLs, fast load times and room to grow."),
            ("Business portals & dashboards", "Give teams and customers secure, focused access to the data and workflows they need."),
            ("SaaS products", "From the first release to ongoing iteration, we build products you can operate and extend."),
        ],
    ),
    dict(
        num="02", slug="ai-integration-automation", path="/services/ai-integration-automation/",
        title="AI Integration & Automation",
        card="Practical AI integrations and automated workflows that reduce repetitive work and bring intelligent capabilities into existing business processes.",
        chips=["AI Assistants", "AI Adoption", "Workflow Automation"],
        intro="We integrate established AI capabilities into the websites, applications and workflows you already rely on, so repetitive work is reduced and information is easier to use.",
        points=[
            ("AI assistants & knowledge search", "Purpose-built assistants that make internal information easier to find and use across the business."),
            ("Workflow automation", "Automate repetitive manual steps across tools and systems, with human review where it matters."),
            ("Data extraction & structuring", "Turn unstructured documents into usable, structured data your systems can act on."),
        ],
    ),
    dict(
        num="03", slug="business-systems-integrations", path="/services/business-systems-integrations/",
        title="Business Systems & Integrations",
        card="Connect applications, APIs, databases and third-party platforms so information moves reliably across the business.",
        chips=["API Integration", "CRM / ERP Integration", "Business Systems"],
        intro="We connect applications, APIs, databases and third-party platforms so information moves reliably across the business instead of living in silos.",
        points=[
            ("API & systems integration", "Connect the tools you already use with clean, well-documented integration points."),
            ("CRM / ERP integration", "Keep customer and operational data consistent across the systems your teams depend on."),
            ("Reliable data flow", "Design integrations that fail loudly, recover gracefully and are easy to monitor."),
        ],
    ),
    dict(
        num="04", slug="application-modernisation", path="/services/application-modernisation/",
        title="Application Modernisation",
        card="Upgrade legacy applications and websites with modern technologies, improved interfaces and maintainable architecture.",
        chips=["Legacy Modernisation", "UI/UX Improvements", "Framework Upgrades", "Technology Migration"],
        intro="We upgrade legacy applications and websites with modern technologies, improved interfaces and an architecture your team can maintain.",
        points=[
            ("Legacy modernisation", "Move ageing applications forward without stopping the business they support."),
            ("Framework upgrades & migration", "Structured upgrades for ASP.NET Core, ASP.NET Zero, ABP.IO and Angular applications."),
            ("UI/UX improvements", "Modernise interfaces so existing products feel current and stay usable."),
        ],
    ),
    dict(
        num="05", slug="managed-support-maintenance", path="/services/managed-support-maintenance/",
        title="Managed Support & Maintenance",
        card="Ongoing technical support, maintenance and development for business-critical websites and applications.",
        chips=["Application Support", "Monitoring", "Ongoing Development"],
        intro="We provide ongoing technical support, maintenance and development for business-critical websites and applications, so they stay secure and keep improving.",
        points=[
            ("Application support", "A reliable route to a developer who knows your system, not a ticket queue."),
            ("Monitoring & maintenance", "Keep applications healthy, patched and performant over time."),
            ("Ongoing development", "Development doesn't have to stop when the initial project goes live."),
        ],
    ),
]

# ---------------------------------------------------------------- frameworks
FRAMEWORKS = [
    dict(
        num="01", slug="aspnet-zero", path="/technologies/aspnet-zero/",
        title="ASP.NET Zero",
        card="Specialist support for existing ASP.NET Zero applications, from framework upgrades and modernisation to ongoing development.",
        intro="Specialist support for existing ASP.NET Zero applications, from framework upgrades and modernisation to ongoing development.",
        blurb="ASP.NET Zero gives teams a strong application foundation. We help you keep that foundation current and extend it as requirements change, without losing the structure the framework provides.",
    ),
    dict(
        num="02", slug="abp-io", path="/technologies/abp-io/",
        title="ABP.IO",
        card="Development, migrations, upgrades and ongoing technical support for applications built on the ABP.IO framework.",
        intro="Development, migrations, upgrades and ongoing technical support for applications built on the ABP.IO framework.",
        blurb="ABP.IO's modular architecture rewards disciplined development. We build, migrate and maintain ABP applications so modules stay clean and upgrades stay routine.",
    ),
    dict(
        num="03", slug="angular", path="/technologies/angular/",
        title="Angular",
        card="Upgrade, modernise and maintain Angular applications with structured frontend development support.",
        intro="Upgrade, modernise and maintain Angular applications with structured frontend development support.",
        blurb="Long-lived Angular applications need careful version management and a consistent component architecture. We upgrade and maintain them without disruptive rewrites.",
    ),
    dict(
        num="04", slug="aspnet-core", path="/technologies/aspnet-core/",
        title="ASP.NET Core",
        card="Build, modernise and maintain the APIs, services and web applications that sit at the core of your operations.",
        intro="Build, modernise and maintain the APIs, services and web applications that sit at the core of your operations.",
        blurb="ASP.NET Core powers the APIs and services at the centre of many businesses. We build and maintain them for reliability, performance and long-term maintainability.",
    ),
]

# ---------------------------------------------------------------- staff aug
STAFF = [
    dict(
        num="01", slug="dedicated-engineers", path="/staff-augmentation/dedicated-engineers/",
        title="Dedicated Engineers",
        card="Experienced .NET and full-stack engineers who join your team and deliver as part of it.",
        intro="Experienced engineers who join your delivery team and work as part of it, under your processes and standards.",
        blurb="Staff augmentation at EKSTRUH is engineering delivery capacity: engineers who plug into your team, take ownership of real work and hand over knowledge as they go. It is not a recruitment marketplace and there are no CV mills.",
    ),
    dict(
        num="02", slug="specialized-ai-talent", path="/staff-augmentation/specialized-ai-talent/",
        title="Specialized AI Talent",
        card="Practical AI engineering support for integrations, assistants and automation inside real products.",
        intro="AI engineering support for teams adding assistants, automation and intelligent features to real products.",
        blurb="We provide engineers with practical experience integrating established AI capabilities into production systems, so AI work is grounded in your product rather than a research detour.",
    ),
    dict(
        num="03", slug="cloud-devops-experts", path="/staff-augmentation/cloud-devops-experts/",
        title="Cloud & DevOps Experts",
        card="Engineering support for reliable builds, deployments, monitoring and infrastructure.",
        intro="Engineering support for reliable builds, deployments, monitoring and the infrastructure your applications run on.",
        blurb="Our cloud and DevOps engineers help teams ship consistently and operate confidently, with pipelines, monitoring and infrastructure that stay maintainable.",
    ),
    dict(
        num="04", slug="qa-test-engineers", path="/staff-augmentation/qa-test-engineers/",
        title="QA & Test Engineers",
        card="Test engineering that protects releases and keeps quality visible as products evolve.",
        intro="Test engineers who protect releases and keep quality visible while your product continues to evolve.",
        blurb="We embed QA engineers who build pragmatic test coverage around the flows that matter, so quality is measured and releases are predictable.",
    ),
]

STAFF_PRINCIPLES = [
    ("Engineering delivery capacity", "Staff augmentation at EKSTRUH reads as delivery capacity for your team, not a recruitment marketplace."),
    ("Four approved categories", "Dedicated Engineers, Specialized AI Talent, Cloud & DevOps Experts and QA & Test Engineers."),
    ("Works inside your process", "Augmented engineers follow your standards, tooling and review culture from day one."),
]

# ---------------------------------------------------------------- legal
LEGAL = [
    dict(slug="privacy-policy", path="/privacy-policy/", title="Privacy Policy",
         intro="How EKSTRUH collects, uses and protects personal information.",
         sections=[
             ("What we collect", "We collect only the information needed to respond to enquiries you send us, such as your name, email address and the details of your message. Contact submissions are processed by our own server and are not sold or shared."),
             ("How we use it", "Enquiry details are used solely to respond to you and to follow up on the project you describe. We do not use them for unrelated marketing."),
             ("Your rights", "You may request a copy or deletion of the information you have sent us at any time by contacting info@ekstruh.dev."),
         ]),
    dict(slug="cookie-policy", path="/cookie-policy/", title="Cookie Policy",
         intro="What cookies this site uses and why.",
         sections=[
             ("Essential cookies", "A small number of cookies are required for the site to work, such as keeping the contact form secure. These cannot be switched off."),
             ("No advertising cookies", "This site does not set advertising or cross-site tracking cookies."),
         ]),
    dict(slug="terms", path="/terms/", title="Terms",
         intro="The terms on which this website and its content are provided.",
         sections=[
             ("Use of the site", "You may use this website and its content for lawful purposes. Content is provided for general information about our services."),
             ("Agreements", "Any project work is governed by a separate written agreement between you and EKSTRUH LTD."),
             ("Liability", "To the extent permitted by law, EKSTRUH LTD is not liable for losses arising from use of this website."),
         ]),
]
