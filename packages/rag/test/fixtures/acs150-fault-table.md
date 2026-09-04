# Fixture: ABB ACS150 user manual, "Fault tracing" chapter, printed page 130.
#
# This is the real content from EN_ACS150_Drives_UM_D_A4.pdf (PDF page 130),
# rendered as the GitHub-flavoured markdown a hosted parser emits. Multi-line
# cells use <br>, which is what LlamaParse/Unstructured produce.
#
# It exercises the cases that broke the original chunker:
#   - a 4-column table where CAUSE and WHAT TO DO must stay separate
#   - multi-line cells containing numbered parameter references with periods
#   - a parenthetical "(programmable fault function, parameters ...)" under the name
#   - a continuation row with an empty code cell (F0012 wraps)

| CODE | FAULT | CAUSE | WHAT TO DO |
| --- | --- | --- | --- |
| F0001 | OVERCURRENT | Output current has exceeded trip level.<br>Overcurrent trip limit for drive is 325% of drive nominal current. | Check motor load.<br>Check acceleration time (parameters 2202 ACCELER TIME 1 and 2205 ACCELER TIME 2).<br>Check motor and motor cable (including phasing).<br>Check ambient conditions. Load capacity decreases if installation site ambient temperature exceeds 40 °C. See section Derating on page 138. |
| F0002 | DC OVERVOLT | Excessive intermediate circuit DC voltage. DC overvoltage trip limit is 420 V for 200 V drives and 840 V for 400 V drives. | Check that overvoltage controller is on (parameter 2005 OVERVOLT CTRL).<br>Check brake chopper and resistor (if used). DC overvoltage control must be deactivated when brake chopper and resistor are used.<br>Check deceleration time (parameters 2203 DECELER TIME 1 and 2206 DECELER TIME 2).<br>Check input power line for static or transient overvoltage. |
| F0003 | DEV OVERTEMP | Drive IGBT temperature is excessive. Fault trip limit is 135 °C. | Check ambient conditions. See also section Derating on page 138.<br>Check air flow and fan operation.<br>Check motor power against drive power. |
| F0004 | SHORT CIRC | Short circuit in motor cable(s) or motor | Check motor and motor cable. |
| F0006 | DC UNDERVOLT | Intermediate circuit DC voltage is not sufficient due to missing input power line phase, blown fuse, rectifier bridge internal fault or too low input power. | Check that undervoltage controller is on (parameter 2006 UNDERVOLT CTRL).<br>Check input power supply and fuses. |
| F0007 | AI1 LOSS<br>(programmable fault function, parameters 3001 AI<MIN FUNCTION, 3021 AI1 FAULT LIMIT) | Analog input AI1 signal has fallen below limit defined by parameter 3021 AI1 FAULT LIMIT. | Check fault function parameter settings.<br>Check for proper analog control signal levels.<br>Check connections. |
| F0009 | MOT OVERTEMP<br>(programmable fault function, parameters 3005...3009) | Motor temperature is too high (or appears to be too high) due to excessive load, insufficient motor power, inadequate cooling or incorrect start-up data. | Check motor ratings, load and cooling.<br>Check start-up data.<br>Check fault function parameter settings.<br>Let motor cool down. Ensure proper motor cooling: Check cooling fan, clean cooling surfaces, etc. |
| F0012 | MOTOR STALL | Motor is operating in stall region due to, for example, excessive load or insufficient motor power. | Check motor load and drive ratings. |
|  | (programmable fault function, parameters 3010...3012) |  | Check fault function parameter settings. |
