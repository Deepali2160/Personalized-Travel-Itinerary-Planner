"""Create a printable PDF of an itinerary with ReportLab (pure Python)."""
from __future__ import annotations

import io
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from schemas import SLOTS, Itinerary, TripPreferences

BLUE = colors.HexColor("#2F6F9F")
SOFT = colors.HexColor("#EEF5FA")
GREY = colors.HexColor("#5B6770")


def clean(text: object) -> str:
    """Make text safe for ReportLab's built-in fonts (no emoji / rupee sign)."""
    s = str(text or "")
    s = s.replace("₹", "INR ")
    s = s.encode("cp1252", errors="replace").decode("cp1252")
    return escape(s)


def inr(value: int) -> str:
    return f"INR {int(value):,}"


def build_pdf(itin: Itinerary, prefs: Optional[TripPreferences] = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Itinerary - {itin.destination}", author="Personalized Travel Itinerary Planner",
    )
    base = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=base["Title"], textColor=BLUE, fontSize=22, alignment=0, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=base["Heading2"], textColor=BLUE, fontSize=14, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=base["BodyText"], fontSize=9.5, leading=13)
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=10.5, textColor=GREY)
    cell = ParagraphStyle("cell", parent=body, fontSize=9, leading=11.5)

    story: list = [Paragraph(clean(f"{itin.destination}, {itin.country}" if itin.country else itin.destination), h1)]
    if itin.days:
        first, last = itin.days[0].date, itin.days[-1].date
        if first and last:
            story.append(Paragraph(clean(f"{first:%d %b %Y} to {last:%d %b %Y}  |  {len(itin.days)} days"), small))
    story += [Spacer(1, 4), Paragraph(clean(itin.summary), body), Spacer(1, 6)]

    note = Table([[Paragraph(clean(itin.disclaimer), small)]], colWidths=[178 * mm])
    note.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF6E5")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E6B450")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(note)

    # Budget
    b = itin.budget
    story.append(Paragraph("Estimated budget (per person unless noted)", h2))
    rows = [
        ["Accommodation (" + str(b.nights) + " nights, first suggested stay)", inr(b.accommodation_inr)],
        ["Food and dining", inr(b.food_inr)],
        ["Activities and experiences", inr(b.activities_inr)],
        ["Local transport and extras (rough 12% allowance)", inr(b.transport_misc_inr)],
        ["Total per person", inr(b.total_per_person_inr)],
        [f"Total for {b.travelers} traveller(s)", inr(b.total_group_inr)],
    ]
    if b.cap_inr:
        rows.append([f"Your budget limit: {inr(b.cap_inr)}", "Within limit" if b.within_cap else "Over limit"])
    t = Table([[Paragraph(clean(a), cell), Paragraph(clean(v), cell)] for a, v in rows], colWidths=[130 * mm, 48 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5DD")),
        ("BACKGROUND", (0, 4), (-1, 5), SOFT),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    story.append(t)
    if itin.currency.code != "INR":
        story.append(Paragraph(clean(
            f"Local currency: {itin.currency.code}. Rough rate used: 1 {itin.currency.code} = INR "
            f"{itin.currency.approx_inr_per_unit:g} (estimate only; check a live rate)."), small))

    # Stays
    if itin.stays:
        story.append(Paragraph("Accommodation ideas (not bookings)", h2))
        for s in itin.stays:
            story.append(Paragraph(clean(
                f"<b>{s.name}</b> ({s.type}) - about {inr(s.price_per_night_inr)} per person per night. {s.note}"
                .replace("<b>", "").replace("</b>", "")), body))

    # Days
    for day in itin.days:
        when = f" - {day.date:%a, %d %b}" if day.date else ""
        story.append(Paragraph(clean(f"Day {day.day_number}: {day.theme}{when}"), h2))
        story.append(Paragraph(clean(f"Area: {day.area_focus}. {day.note}"), small))
        data = []
        for slot in SLOTS:
            a = getattr(day, slot)
            cost = inr(a.estimated_cost_inr) + (f"<br/>{clean(a.estimated_cost_local)}" if a.estimated_cost_local else "")
            data.append([
                Paragraph(f"<b>{slot.capitalize()}</b>", cell),
                Paragraph(f"<b>{clean(a.title)}</b><br/>{clean(a.description)}<br/><font color='#5B6770'>{clean(a.duration)}</font>", cell),
                Paragraph(cost, cell),
            ])
        data.append([Paragraph("", cell), Paragraph("<b>Day total (estimate)</b>", cell), Paragraph(f"<b>{inr(day.day_total_inr)}</b>", cell)])
        dt_ = Table(data, colWidths=[24 * mm, 122 * mm, 32 * mm], repeatRows=0)
        dt_.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5DD")),
            ("BACKGROUND", (0, 0), (0, -2), SOFT), ("BACKGROUND", (0, -1), (-1, -1), SOFT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(dt_)

    if itin.tips:
        story.append(Paragraph("Tips", h2))
        for tip in itin.tips:
            story.append(Paragraph("- " + clean(tip), body))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(16 * mm, 9 * mm, "Estimates only - verify prices, hours and availability before travelling.")
        canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
