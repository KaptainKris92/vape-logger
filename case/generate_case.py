"""Generate the 3D-printable case for the Vape Logger.

Writes two STL files next to this script:
  vape-logger-case-tray.stl  the box the battery and XIAO sit in
  vape-logger-case-lid.stl   the press-fit lid

Layout (looking down into the tray, USB-C end at the top):
  the LiPo lies flat at the bottom end, the JST socket beside it,
  and the XIAO sits at the top end with its USB-C port in the end wall.

Every size is in millimetres. Change the numbers below and re-run:
  python3 -m pip install manifold3d trimesh
  python3 case/generate_case.py
"""
from pathlib import Path

import numpy as np
import trimesh
from manifold3d import CrossSection, JoinType, Manifold

# --- Print settings -------------------------------------------------------
WALL = 1.6          # 4 lines with a 0.4 mm nozzle
FLOOR = 1.2         # bottom of the tray (the side taped to the vape)
LID = 1.2           # lid plate thickness
CORNER = 3.0        # outside corner radius
FIT = 0.2           # gap between the lid's lip and the tray walls, per side
LIP_DEPTH = 1.8     # how far the lid's lip reaches into the tray
LIP_WALL = 1.2

# --- Inside of the tray ---------------------------------------------------
# Battery 28 x 20 x 4, JST-PH socket about 6 x 4.5, XIAO 21 x 17.8.
IN_W = 26.0         # across: battery (20) + JST socket (~5) + clearance
IN_L = 52.0         # along: battery (28) + wire gap + XIAO (21)
IN_H = 6.5          # battery (4) with room above; XIAO on 1 mm foam tape + resistor

# --- Cutouts --------------------------------------------------------------
PCB_LIFT = 1.0      # foam tape under the XIAO
PCB_T = 1.2
USB_W, USB_H = 9.6, 3.8                        # USB-C receptacle plus clearance
USB_Z = FLOOR + PCB_LIFT + PCB_T + 1.6         # centre height of the port
SLOT_W, SLOT_DEPTH = 6.0, 3.0                  # FSR wire slot in each long wall
SLOT_Y = IN_L / 2 - 8.0                        # beside the XIAO's D1 / 3V3 pins

OUT_W = IN_W + 2 * WALL
OUT_L = IN_L + 2 * WALL
TRAY_H = FLOOR + IN_H


def rounded_box(w, l, h, r, z0=0.0):
    r = min(r, w / 2 - 0.01, l / 2 - 0.01)
    section = CrossSection.square([w - 2 * r, l - 2 * r], center=True).offset(
        r, JoinType.Round, circular_segments=64)
    return Manifold.extrude(section, h).translate([0, 0, z0])


def block(x0, x1, y0, y1, z0, z1):
    return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0])


def tray():
    body = rounded_box(OUT_W, OUT_L, TRAY_H, CORNER)
    body -= rounded_box(IN_W, IN_L, IN_H + 1, CORNER - WALL, z0=FLOOR)
    # USB-C port: a notch in the top end wall, open at the top so it prints without bridging
    body -= block(-USB_W / 2, USB_W / 2, IN_L / 2 - 0.5, OUT_L / 2 + 1, USB_Z - USB_H / 2, TRAY_H + 1)
    # FSR wire slots in both long walls, so the tray works either way round
    for side in (-1, 1):
        x_in, x_out = side * (IN_W / 2 - 0.5), side * (OUT_W / 2 + 1)
        body -= block(min(x_in, x_out), max(x_in, x_out), SLOT_Y - SLOT_W / 2, SLOT_Y + SLOT_W / 2,
                      TRAY_H - SLOT_DEPTH, TRAY_H + 1)
    return body


def lid():
    # Printed plate-down; the lip points up on the print bed and into the tray when fitted.
    plate = rounded_box(OUT_W, OUT_L, LID, CORNER)
    lw, ll = IN_W - 2 * FIT, IN_L - 2 * FIT
    lip = rounded_box(lw, ll, LIP_DEPTH, CORNER - WALL, z0=LID)
    lip -= rounded_box(lw - 2 * LIP_WALL, ll - 2 * LIP_WALL, LIP_DEPTH + 1, 0.5, z0=LID - 0.5)
    # Leave the lip off where the USB port and the wire slots are
    lip -= block(-USB_W / 2 - 1.5, USB_W / 2 + 1.5, IN_L / 2 - 4, OUT_L / 2, 0, 10)
    lip -= block(-OUT_W, OUT_W, SLOT_Y - SLOT_W / 2 - 1, SLOT_Y + SLOT_W / 2 + 1, 0, 10)
    return plate + lip


def save(manifold, name):
    mesh = manifold.to_mesh()
    tm = trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3],
                         faces=np.asarray(mesh.tri_verts), process=True)
    assert tm.is_watertight, f"{name} is not watertight"
    path = Path(__file__).with_name(name)
    tm.export(path)
    ext = tm.bounds[1] - tm.bounds[0]
    print(f"{name}: {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} mm, {len(tm.faces)} triangles, watertight")


if __name__ == "__main__":
    save(tray(), "vape-logger-case-tray.stl")
    save(lid(), "vape-logger-case-lid.stl")
    print(f"Fitted case: {OUT_W:.1f} x {OUT_L:.1f} x {TRAY_H + LID:.1f} mm")
