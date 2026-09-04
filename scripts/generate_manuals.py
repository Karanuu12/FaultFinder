"""Generate synthetic factory-machine manuals for the RAG demo.

Creates overlapping error-code pairs (E101, E204) that mean DIFFERENT things on
different machines, plus natural-language symptoms and sections to test
cross-document disambiguation and retrieval precision.
"""
from __future__ import annotations

import os
from pathlib import Path

import pymupdf

OUT = Path(__file__).resolve().parent.parent / "manuals"
OUT.mkdir(parents=True, exist_ok=True)


def build_pdf(filename: str, title: str, pages: list[str]) -> Path:
    """Write each string as a full text page (not line-per-page) so chunking is realistic."""
    path = OUT / filename
    doc = pymupdf.open()  # type: ignore[attr-defined]
    for i, body in enumerate(pages, start=1):
        page = doc.new_page()
        text = f"{title}  —  Page {i}\n\n{body}"
        page.insert_textbox((50, 70, 545, 780), text, fontsize=10, align=0)
    doc.save(path)
    doc.close()
    print(f"  wrote {path.name} ({path.stat().st_size} bytes)")
    return path


def roboinject() -> None:
    """RoboInject-300 injection molding machine. E101 = winding overtemperature."""
    build_pdf(
        "RoboInject-300-Manual.pdf",
        "RoboInject-300 Service Manual",
        [
            "1. Error Code Reference",
            "",
            "This manual covers the RoboInject-300 injection molding machine.",
            "Error codes in this manual are specific to the RoboInject-300.",
            "",
            "E101 Winding Overtemperature",
            "Probable causes: blocked cooling fan, dirty air filter, failed NTC sensor.",
            "Corrective action:",
            " 1. Power down safely and lock out the machine.",
            " 2. Clear debris from the fan intake.",
            " 3. Verify 24V DC reaching the fan motor.",
            " 4. Retest under load for 20 minutes.",
            "Source: Section 4.2, page 214.",
            "",
            "E204 Servo Stall",
            "The injection arm servo exceeded its torque limit.",
            "Check the arm rails for obstruction and the servo current draw.",
            "",
            "6.1 Temperature Sensor",
            "The NTC sensor should read 2.4kΩ at 25°C. Replace if out of tolerance.",
            "Source: Section 6.1, page 247.",
        ],
    )


def press2000() -> None:
    """Press-2000 hydraulic press. E101 = low hydraulic pressure (DIFFERENT meaning)."""
    build_pdf(
        "Press-2000-Manual.pdf",
        "Press-2000 Hydraulic Press Manual",
        [
            "1. Facing Errors",
            "",
            "This manual covers the Press-2000 hydraulic shop press.",
            "The Press-2000 uses a different error code scheme from the RoboInject line.",
            "Always confirm the machine model before applying a code.",
            "",
            "E101 Low Hydraulic Pressure",
            "Probable causes: hydraulic fluid below level, worn pump seal, relief valve leak.",
            "Corrective action:",
            " 1. Check hydraulic fluid level and top up with ISO-VG68.",
            " 2. Inspect the pump seal for wear.",
            " 3. Bleed the relief valve.",
            " 4. Cycle the press empty to confirm pressure holds.",
            "Source: Section 3.1, page 92.",
            "",
            "E204 High Press Pressure",
            "Preas exceeded the set limit. Check the pressure relief on the intensifier.",
            "Source: Section 5.2, page 138.",
        ],
    )


def iso9001() -> None:
    """A cross-cutting document with generic safety + an E101 mention (trap for RAG)."""
    build_pdf(
        "ISO-9001-Safety.pdf",
        "ISO 9001 Factory Safety & Lockout Guide",
        [
            "Lockout / Tagout Procedure",
            "Before any service work, follow the lockout/tagout procedure.",
            "Never open a guard while the machine is running.",
            "",
            "Note on E101: see the machine-specific service manual for your model.",
            "E101 codes differ between machine families. Do not guess.",
        ],
    )


def press2001() -> None:
    """A similar-but-not-identical model to test disambiguation nuance."""
    build_pdf(
        "Press-2001-Manual.pdf",
        "Press-2001 Mechanical Press Manual",
        [
            "1. MACHINE IDENTIFICATION",
            "The Press-2001 is a mechanical press; it has no hydraulic system.",
            "Most fault codes are mechanical rather than hydraulic.",
            "",
            "TROUBLESHOOTING",
            "E101 on the Press-2001: drive chain binding.",
            "Check the drive chain tension and sprocket alignment.",
            "Source: Section 7, page 311.",
        ],
    )


def main() -> None:
    print("Generating synthetic manuals in", OUT)
    roboinject()
    press2000()
    press2001()
    iso9001()
    print("Done.")


if __name__ == "__main__":
    main()