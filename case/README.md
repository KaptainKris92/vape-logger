# Case

A two-part 3D-printed case that holds the LiPo, the JST socket and the XIAO as one unit, so the whole thing can be taped to the back of the vape. The FSR stays outside, stuck to the fire button, and its wires come in through a slot in the side.

| File | What it is |
|---|---|
| `vape-logger-case-tray.stl` | The tray. Its flat bottom goes against the vape. |
| `vape-logger-case-lid.stl` | The press-fit lid |
| `generate_case.py` | The script that makes both files. Change a number and re-run it. |

**Fitted size:** 29.2 × 55.2 × 8.9 mm (walls 1.6 mm, floor and lid 1.2 mm).

## Inside the tray

```
 USB-C end
 ┌─────[ port ]─────┐
 │  ┌────────────┐  │
 │  │    XIAO    │  │
 ▯  │ (on 1 mm   │  ▯  ← FSR wire slot (one in each long side)
 │  │ foam tape) │  │
 │  └────────────┘  │
 │                  │
 │  ┌────────┐ ┌──┐ │
 │  │  LiPo  │ │JST│ │
 │  │ 28×20  │ └──┘ │
 │  └────────┘      │
 └──────────────────┘
```

- The LiPo lies flat at the far end, with the JST socket beside it.
- The XIAO sits at the USB end on a strip of 1 mm foam tape, with its USB-C port in the notch in the end wall so you can charge and upload without opening the case. Keep the tape off the BAT pads in the middle of its underside.
- Use whichever wire slot ends up facing the fire button.

## Printing on the Ultimaker 2

- **Material:** PLA. PETG is better if the vape lives in a hot car or a pocket.
- **Orientation:** the tray with its open side up, and the lid with its flat plate on the bed and the lip pointing up. Neither needs supports.
- **Settings in Cura:** 0.2 mm layers, 20% infill, no supports, and a brim only if the corners lift.
- **What I actually used:** 0.1 mm layers, 20% infill, no supports and no build plate adhesion. It printed fine.
- **Fit:** the lid's lip has a 0.2 mm gap on each side. If it's too loose, set `FIT = 0.1` in the script and re-run it. If it's too tight, set `FIT = 0.3`. A strip of tape across the lid also works.

Print it before you solder anything, and put the parts in loose to check the fit.

## Changing the design

```
python3 -m pip install manifold3d trimesh
python3 case/generate_case.py
```

The sizes are at the top of `generate_case.py`. The ones you're most likely to change are `IN_H` (inside height), `FIT` (lid tightness) and `SLOT_Y` (where the wire slots are).
