"""Generate synthetic factory-machine manuals with realistic, dense content.

Creates overlapping error-code pairs (E101, E204) that mean DIFFERENT things on
different machines for cross-document disambiguation testing.
"""
from __future__ import annotations

from pathlib import Path

import pymupdf

OUT = Path(__file__).resolve().parent.parent / "manuals"
OUT.mkdir(parents=True, exist_ok=True)


def build_pdf(filename: str, title: str, pages: list[str]) -> Path:
    path = OUT / filename
    doc = pymupdf.open()
    for i, body in enumerate(pages, start=1):
        page = doc.new_page()
        text = f"{title}  —  Page {i}\n\n{body}"
        page.insert_textbox((50, 70, 545, 780), text, fontsize=10, align=0)
    doc.save(path)
    doc.close()
    size_kb = path.stat().st_size // 1024
    print(f"  {path.name}  ({size_kb} KB, {len(pages)} pages)")
    return path


def roboinject() -> None:
    build_pdf(
        "RoboInject-300-Manual.pdf",
        "RoboInject-300 Service Manual",
        [
            # Page 1: Manual introduction + first error codes
            "1. INTRODUCTION\n\n"
            "This manual covers the RoboInject-300 injection molding machine (serial prefix SM-). "
            "Read all safety instructions before servicing. The RoboInject-300 is a fully electric "
            "injection molding machine with servo-driven injection arm and barrel heater zones. "
            "Error codes in this manual are specific to the RoboInject-300 and its control system "
            "version 4.3+. Do not apply these codes to other equipment without confirming the model.\n\n"
            "1.1 SYMBOLS USED\n"
            "WARNING — Risk of electrical shock or personal injury.\n"
            "CAUTION — Risk of damage to equipment.\n"
            "NOTE — Additional information or tip.\n\n"
            "1.2 MAINTENANCE SCHEDULE\n"
            "Daily: check oil level in the lubrication reservoir, inspect fan intake.\n"
            "Weekly: clean air filter, verify NTC sensor readings are within range.\n"
            "Monthly: full calibration check, belt tension inspection.",

            # Page 2: E101 and related codes
            "4. ERROR CODE REFERENCE\n\n"
            "4.1 E101 — Winding Overtemperature\n"
            "Meaning: The temperature of the injection servo motor windings has exceeded "
            "the safe operating threshold (130°C). The controller automatically reduces "
            "current to prevent thermal damage.\n\n"
            "Probable causes:\n"
            "- Blocked cooling fan intake (most common)\n"
            "- Dirty or clogged air filter restricting airflow\n"
            "- Failed NTC temperature sensor on the winding\n"
            "- Excessive duty cycle without cooldown period\n\n"
            "Corrective action:\n"
            "Step 1. Power down the machine and lock out the main disconnect.\n"
            "Step 2. Inspect the cooling fan on the back of the servo drive. Remove any debris.\n"
            "Step 3. Replace the air filter if visibly dirty (P/N AF-300-12).\n"
            "Step 4. Verify the NTC sensor: measure resistance between pins 3 and 4 on the "
            "sensor harness connector. Expected value at 25°C: 2.4kΩ ±5%.\n"
            "Step 5. If sensor is OK but problem persists, check 24V DC supply to fan motor "
            "(terminal block TB2, pins 1-2).\n"
            "Step 6. Restart and run under load for 20 minutes. Monitor winding temperature "
            "on the controller display.\n\n"
            "Source: Section 4.2, page 214. Referenced in: SS-300 Quick Reference, §E.\n\n"
            "4.2 E204 — Servo Stall Detected\n"
            "Meaning: The injection arm servo motor has exceeded its torque limit and the "
            "controller has triggered a stall protection. The arm may be mechanically bound "
            "or the servo drive parameters are incorrect.\n\n"
            "Probable causes:\n"
            "- Mechanical obstruction in the injection arm rails\n"
            "- Worn or damaged ball screw\n"
            "- Servo drive current limit set too low for the mold being used\n"
            "- Incorrect acceleration/deceleration ramp values\n\n"
            "Corrective action:\n"
            "Step 1. Clear the fault on the HMI (Main Menu > Faults > Reset).\n"
            "Step 2. Manually jog the injection arm to full retract and full extend. "
            "Listen for grinding or binding.\n"
            "Step 3. Inspect the ball screw for wear or contamination.\n"
            "Step 4. Check servo drive parameter P-07 (peak current limit). Default is 12A. "
            "Increase to 14A if running heavy molds.\n"
            "Step 5. Verify the acceleration ramp in parameter P-12 is not set below 500ms.",
            # Page 2 continued - fits the page
            "Source: Section 8.3, page 312.\n\n"
            "4.3 E302 — Zone 1 Heater Overcurrent\n"
            "Meaning: Electrical current draw on barrel zone 1 exceeds 20A. "
            "Indicates a shorted heating band or damaged wiring.\n\n"
            "Corrective action:\n"
            "Step 1. Switch off zone 1 from the controller.\n"
            "Step 2. Measure resistance across heating band terminals. Should read 11.5Ω ±1Ω.\n"
            "Step 3. Replace the heating band (P/N HB-1-300) if out of tolerance.",

            # Page 3: Temperature sensor details and maintenance
            "6. SENSOR CALIBRATION & MAINTENANCE\n\n"
            "6.1 NTC Temperature Sensor (Winding)\n"
            "The winding temperature sensor is a negative-temperature-coefficient (NTC) "
            "thermistor. Use the following table to verify its reading:\n\n"
            "Temperature     Resistance (nominal)\n"
            "25°C            2.4 kΩ\n"
            "50°C            1.1 kΩ\n"
            "75°C            0.55 kΩ\n"
            "100°C           0.28 kΩ\n\n"
            "If the measured resistance deviates by more than 8% from nominal, replace "
            "the sensor (P/N NTC-R300). Ensure the sensor tip is fully inserted into "
            "the thermal well and coated with heat-conductive paste.\n\n"
            "6.2 Thermocouple (Barrel Zones)\n"
            "Each barrel zone uses a Type-K thermocouple. Cold junction compensation is "
            "handled automatically by the controller board. If zone temperature readings "
            "are erratic, swap the thermocouple with an adjacent zone to isolate the fault.\n\n"
            "6.3 Lubrication System\n"
            "The central lubrication pump delivers oil to the ball screw and linear rails. "
            "Low oil level triggers alarm A107 on the HMI. Use only ISO-VG-68 grease. "
            "The reservoir holds 1.5 liters. Refill port is located behind the front access panel.",

            # Page 4: Fuses, wiring, and safety interlocks
            "7. ELECTRICAL SYSTEM\n\n"
            "7.1 Main Fuse Ratings\n"
            "Main AC input: 3 × 32A (class gG, P/N F-M300-MAIN)\n"
            "Servo drive: 2 × 16A (class aM, P/N F-M300-SERVO)\n"
            "Control circuit: 1 × 6.3A (class gG, P/N F-M300-CTRL)\n"
            "Heater zones: 1 × 25A per zone (class gG)\n\n"
            "Always disconnect mains power before accessing the fuse panel.\n\n"
            "7.2 Control Board LEDs\n"
            "D1 (green) — Power present\n"
            "D2 (yellow) — Communication active\n"
            "D3 (red) — Fault latch (see error code)\n"
            "D4 (amber) — Maintenance reminder\n\n"
            "7.3 Safety Interlock Circuit\n"
            "All access doors are monitored by magnetic safety switches (MSS-300). "
            "The interlock circuit must be closed for the machine to run. If the controller "
            "shows 'E011 — Safety Loop Open', test each door switch by cycling it open/closed "
            "while watching the input status on the HMI (Diagnostics > I/O Map). "
            "Replace any switch that fails to toggle.",
        ],
    )


def press2000() -> None:
    build_pdf(
        "Press-2000-Manual.pdf",
        "Press-2000 Hydraulic Press Manual",
        [
            # Page 1: Introduction and warning
            "1. MACHINE OVERVIEW\n\n"
            "The Press-2000 is a 2000-ton hydraulic shop press used for stamping and forming "
            "metal sheets and components. It operates on a dual-pump hydraulic system "
            "rated for ISO-VG68 hydraulic fluid at 210 bar maximum operating pressure. "
            "This manual covers serial prefixes HY- and HP- only.\n\n"
            "WARNING: The Press-2000 hydraulic system stores significant energy even when "
            "the pump is off. Always follow the pressure bleed procedure (§12.4) before "
            "opening any hydraulic line.\n\n"
            "The Press-2000 uses a different error code scheme from the RoboInject line. "
            "Always confirm the machine model before applying any corrective action. "
            "Section 2 of this manual provides a complete cross-reference.\n\n"
            "1.1 DAILY OPERATOR CHECKS\n"
            "- Visually inspect hydraulic fluid level in the reservoir sight glass.\n"
            "- Check pressure gauge reading at idle (should be 0-5 bar).\n"
            "- Verify all safety light curtains are clean and unobstructed.\n"
            "- Listen for unusual pump cavitation sounds during warm-up.",

            # Page 2: Error codes
            "3. ERROR CODE REFERENCE\n\n"
            "3.1 E101 — Low Hydraulic Pressure\n"
            "IMPORTANT: This code means something different on the Press-2000 than on "
            "the RoboInject line. Do not apply RoboInject corrective actions.\n\n"
            "Meaning: The main hydraulic system pressure has fallen below 150 bar during "
            "the press stroke. The press will stop immediately and hold at current position.\n\n"
            "Probable causes:\n"
            "- Hydraulic fluid level below the minimum mark in the reservoir.\n"
            "- Worn pump seal allowing internal leakage.\n"
            "- Relief valve stuck partially open or set below specification.\n"
            "- External leak in the main pressure line (between pump and manifold).\n"
            "- Air ingress into the hydraulic system (aerated fluid).\n\n"
            "Corrective action:\n"
            "Step 1. Check the reservoir sight glass — fluid must be between the MIN and MAX "
            "marks. Top up with ISO-VG68 hydraulic fluid if needed (3.5 L capacity).\n"
            "Step 2. Inspect the main pump seal (located behind the pump cover on the "
            "motor bell housing). Oil drip indicates a failed seal. Replace seal kit P/N PS-2000-SEAL.\n"
            "Step 3. Test the relief valve: slowly increase pressure in manual mode while "
            "watching the gauge. The valve should crack open at 210 bar ±5 bar. "
            "Adjust using the hex nut on the valve body (clockwise to increase).\n"
            "Step 4. Check all unions and connectors on the main pressure line from pump "
            "to manifold. Tighten any loose fittings. Look for wet spots indicating a leak.\n"
            "Step 5. Bleed air from the system: open the bleed valve at the top of the "
            "manifold and run the pump for 30 seconds. Close when steady oil flow appears.\n\n"
            "Source: Section 3.1, page 92.\n\n"
            "3.2 E204 — High Pressure Exceeded\n"
            "Meaning: The hydraulic pressure has exceeded 225 bar (the overpressure limit). "
            "The press has triggered an emergency stop.\n\n"
            "Probable causes:\n"
            "- Intensifier valve stuck in the closed position\n"
            "- Pressure transducer sensor fault\n"
            "- Control board pressure limit parameter set too high\n\n"
            "Corrective action:\n"
            "Step 1. Reset the emergency stop and clear the fault code.\n"
            "Step 2. Test the pressure transducer: voltage at pins 1-3 should read 0.5V "
            "at idle and 4.5V at 210 bar. Replace if outside this range.\n"
            "Step 3. In the controller menu, verify parameter PR-LIMIT is set to 210.\n\n"
            "Source: Section 5.2, page 138.",

            # Page 3: Maintenance and pumps
            "4. HYDRAULIC SYSTEM MAINTENANCE\n\n"
            "4.1 Pump Service Intervals\n"
            "The main hydraulic pump (Vickers-style vane pump, P/N VP-2000) should be "
            "serviced every 2000 operating hours:\n"
            "- Replace vane cartridge kit (P/N VC-2000-KIT)\n"
            "- Replace inlet filter (P/N IF-2000)\n"
            "- Replace oil return line filter (P/N RF-2000)\n"
            "- Inspect coupling between pump and motor for wear\n\n"
            "4.2 Hydraulic Fluid Specification\n"
            "Use only ISO-VG68 anti-wear hydraulic fluid. Do not mix with other grades. "
            "The system holds approximately 12 liters including lines and cylinder.\n"
            "Fluid temperature should be 40-55°C during normal operation. "
            "If temperature exceeds 65°C, check the oil cooler for blocked fins.\n\n"
            "4.3 Pressure Test Procedure\n"
            "Connect the digital pressure tester to test port TP-1 on the manifold. "
            "Run the press through one complete cycle in manual mode. Record peak pressure — "
            "should reach 210 bar ±5 bar. If peak is below 190 bar, suspect pump wear or "
            "relief valve set too low.",

            # Page 4: Electrical schematics and safety
            "5. ELECTRICAL & SAFETY SYSTEMS\n\n"
            "5.1 Controller Fuse Locations\n"
            "Main control board F1: 10A (PLC power supply)\n"
            "Main control board F2: 6.3A (24V DC sensor bus)\n"
            "Pump motor contactor coil: 2A\n"
            "Hydraulic valve solenoid bank: 4A total\n\n"
            "5.2 Light Curtain Alignment\n"
            "The front and rear safety light curtains (Type 4, P/N LC-2000) must be "
            "aligned within ±5° of the receiver axis. The emitter LED should be steady "
            "green when aligned. Flashing red indicates misalignment or a broken emitter unit.\n\n"
            "5.3 Emergency Stop Circuit\n"
            "E-stop pushbuttons are located at all four corners of the press base. "
            "The E-stop circuit is dual-channel, monitored by the safety PLC. If any "
            "E-stop is pressed or the circuit wiring is broken between the safety relay "
            "and the contactor, the main pump contactor drops out immediately.\n"
            "To test: press each E-stop individually and verify the controller shows "
            "'E-Stop Channel A/B Open' on the diagnostics screen.",
        ],
    )


def press2001() -> None:
    build_pdf(
        "Press-2001-Manual.pdf",
        "Press-2001 Mechanical Press Manual",
        [
            "1. MACHINE IDENTIFICATION\n\n"
            "The Press-2001 is a 1500-ton mechanical (flywheel) press. It has NO hydraulic "
            "system — clamping force is generated by a motor-driven flywheel and eccentric "
            "gear. Serial prefix MP- identifies the mechanical press family. "
            "Do not apply Press-2000 hydraulic error codes to this machine.\n\n"
            "1.1 LUBRICATION SYSTEM\n"
            "The gearbox and clutch are splash-lubricated with ISO-VG220 gear oil. "
            "The reservoir holds 6 liters. Change oil every 3000 operating hours.\n"
            "The slide guides are grease-lubricated. Grease fittings are located on the "
            "front and rear of each guide rail. Apply lithium-based grease (NLGI 2) weekly.\n\n"
            "1.2 CLUTCH/BRAKE UNIT\n"
            "The press uses a pneumatically actuated clutch and brake unit. "
            "Air supply must be at 6-8 bar, dry and filtered. The clutch engages when "
            "the solenoid valve opens, releasing the spring-applied brake. "
            "Brake wear is indicated by increased stopping time. Measure stopping angle "
            "annually — should not exceed 30°.",

            "7. TROUBLESHOOTING\n\n"
            "7.1 E101 — Drive Chain Binding\n"
            "Meaning: The main drive chain tension is excessive or the chain is catching "
            "on the guard. The controller detects increased torque on the flywheel motor.\n\n"
            "NOTE: E101 on the Press-2001 means DRIVE CHAIN BINDING, not winding "
            "temperature (RoboInject-300) and not low hydraulic pressure (Press-2000). "
            "Always verify the machine model before diagnosing.\n\n"
            "Probable causes:\n"
            "- Drive chain tension too high (overtightened)\n"
            "- Chain sprocket misalignment between motor and flywheel\n"
            "- Worn chain links causing the chain to 'skip' under load\n"
            "- Foreign object caught in the chain guard\n"
            "- Flywheel bearing seizure\n\n"
            "Corrective action:\n"
            "Step 1. Remove the chain guard and inspect the chain condition visually.\n"
            "Step 2. Measure chain tension at the center of the longest span. "
            "Deflection should be 15-20mm when pressed with 5 kg force.\n"
            "Step 3. Check sprocket alignment: use a straightedge across both sprockets. "
            "Misalignment >2mm causes accelerated wear.\n"
            "Step 4. Lubricate the chain with ISO-VG320 oil. Run the motor without load "
            "for 5 minutes to distribute oil.\n"
            "Step 5. If binding persists, replace the chain set (P/N CH-2001-KIT).\n\n"
            "Source: Section 7, page 311.\n\n"
            "7.2 E204 — Flywheel Overspeed\n"
            "Meaning: The flywheel speed has exceeded 110% of the rated max. "
            "The VFD has applied the dynamic brake.\n\n"
            "Probable cause: VFD parameters misconfigured or feedback encoder fault.",

            "7.3 E312 — Clutch Air Pressure Low\n"
            "Meaning: The air supply to the clutch solenoid has dropped below 5 bar. "
            "The press will not cycle.\n\n"
            "Corrective action:\n"
            "Step 1. Check the main air supply pressure at the regulator.\n"
            "Step 2. Inspect the air line filter — drain if water is present.\n"
            "Step 3. Test the solenoid valve by applying 24V DC directly. "
            "If the valve clicks but no air flows, replace the valve coil (P/N V-SOL-2001).\n\n"
            "8. PERIODIC MAINTENANCE\n\n"
            "Daily: visual check of chain tension, listen for abnormal gear noise, "
            "check air pressure on regulator gauge.\n"
            "Weekly: grease guide rails, drain air line filter, inspect clutch brake pads.\n"
            "Monthly: check gear oil level, inspect flywheel bearing temperature (touch test).\n"
            "Annually: change gearbox oil, replace clutch brake pads, full electrical inspection.",
        ],
    )


def iso9001() -> None:
    build_pdf(
        "ISO-9001-Safety.pdf",
        "ISO 9001 Factory Safety & Lockout Guide",
        [
            "1. LOCKOUT / TAGOUT PROCEDURE\n\n"
            "Before any service work, the authorized technician must follow the "
            "company-mandated lockout/tagout (LOTO) procedure:\n\n"
            "Step 1. Notify all affected operators that the machine is being serviced.\n"
            "Step 2. Identify all energy sources: electrical (main disconnect), "
            "pneumatic (air supply valve), hydraulic (pressure bleed), mechanical "
            "(flywheel/spring potential energy).\n"
            "Step 3. Shut down the machine using the normal stop procedure.\n"
            "Step 4. Disconnect or isolate each energy source. Lock the disconnect switch "
            "in the OFF position with a personal padlock.\n"
            "Step 5. Dissipate stored energy: bleed hydraulic pressure, discharge "
            "capacitors, lower suspended loads, release spring tension.\n"
            "Step 6. Verify zero energy state by attempting to start the machine.\n"
            "Step 7. Apply a tag identifying the technician and the expected completion time.\n\n"
            "WARNING: Never attempt to service a machine without completing the above steps. "
            "Failure to lock out can result in severe injury or death.",

            "2. CROSS-MACHINE ERROR CODE NOTES\n\n"
            "E101 — This code has different meanings on different machines in this facility:\n"
            "- RoboInject-300: winding overtemperature (see RoboInject manual §4.2)\n"
            "- Press-2000: low hydraulic pressure (see Press-2000 manual §3.1)\n"
            "- Press-2001: drive chain binding (see Press-2001 manual §7.1)\n\n"
            "Always identify the machine model before diagnosing any error code. "
            "Applying the wrong machine's corrective action can cause further damage "
            "and create safety hazards.\n\n"
            "E204 — Also varies by machine:\n"
            "- RoboInject-300: servo stall (§8.3)\n"
            "- Press-2000: high pressure exceeded (§5.2)\n"
            "- Press-2001: flywheel overspeed (§7.2)\n\n"
            "Common codes (same across all):\n"
            "E011 — Safety loop open\n"
            "E099 — Emergency stop activated\n",

            "3. GENERAL SAFETY RULES\n\n"
            "3.1 PPE Requirements\n"
            "All personnel in the production area must wear hearing protection (earplugs "
            "or earmuffs rated ≥25 dB NRR), safety glasses with side shields, and "
            "steel-toed boots. Gloves are prohibited around rotating machinery.\n\n"
            "3.2 Housekeeping\n"
            "Keep the area around each machine clear of debris, oil spills, and unused "
            "tools. Any spill exceeding 0.5 L must be reported to the shift supervisor.\n\n"
            "3.3 Emergency Procedures\n"
            "In the event of an injury, press the nearest E-stop and call for assistance. "
            "First-aid kits are located at each bay entrance. Fire extinguishers (Type ABC) "
            "are mounted at 20m intervals along the pillars.\n\n"
            "3.4 Reporting Near Misses\n"
            "Any near-miss incident (e.g., a tool dropped inside a machine guard, a "
            "hydraulic line that burst while the machine was idle) must be reported "
            "to safety within 24 hours using form SAF-101.",
        ],
    )


def main() -> None:
    print(f"Generating synthetic manuals in {OUT}\n")
    roboinject()
    press2000()
    press2001()
    iso9001()
    print("\nDone.")


if __name__ == "__main__":
    main()