"""Simplified 3D modal model of the cable-stayed main bridge of the Vasco da Gama Bridge, Lisbon.

Units: m, kN, t (tonne), s.  1 kN = 1 t*m/s^2, so E is in kPa and mass in t.

Geometry is taken from published descriptions (see README.md). Member sizes that are not
published (edge-girder width, pylon leg sections, stay areas) are engineering estimates, and
four global parameters are calibrated against the frequencies measured in the ambient
vibration test (Cunha et al., IMAC-XXII, 2004). This is a teaching and research model, not
the design model of the bridge.
"""
import math
import numpy as np
import openseespy.opensees as ops

# ---------------- published geometry ----------------
MAIN = 420.0                       # main span [m]
SIDE = [72.0, 70.6, 62.0]          # side spans from the pylon outwards [m]; 62 + 70.6 + 72 per side
X_PYL = MAIN / 2                   # pylons at x = +-210 m
Z_DECK = 52.5                      # deck level above the river [m]
H_PYL = 147.0                      # pylon height [m]
B_DECK = 31.0                      # deck width [m]
Y_GIRDER = 14.65                   # edge-girder centreline (stay planes), estimated from the 31 m width
N_STAYS_PER_TOWER = 48             # two vertical planes -> 12 stays per plane on each side of a tower

# ---------------- estimated properties ----------------
E_C = 36.0e6                       # concrete modulus [kPa], C40/50-class estimate
NU_C = 0.2
E_S = 195.0e6                      # stay strand modulus [kPa]
RHO_C = 2.5                        # reinforced concrete [t/m3]
GAMMA_STAY = 85.0                  # stay weight incl. sheath [kN/m3] (for the Ernst modulus)
SIGMA_DL = 0.40 * 1860e3           # stay stress under dead load [kPa] (0.40 f_pu)
G = 9.81


def deck_section(bw=1.7):
    """Two edge girders 2.6 m deep (incl. 0.25 m slab) and a 0.25 m slab, 31 m wide."""
    hs, h = 0.25, 2.6
    a_s, a_g = B_DECK * hs, 2 * bw * (h - hs)
    z_s, z_g = -hs / 2, -(hs + (h - hs) / 2)
    A = a_s + a_g
    zc = (a_s * z_s + a_g * z_g) / A
    Iv = B_DECK * hs**3 / 12 + a_s * (z_s - zc) ** 2 + 2 * bw * (h - hs) ** 3 / 12 + a_g * (z_g - zc) ** 2
    Il = hs * B_DECK**3 / 12 + 2 * ((h - hs) * bw**3 / 12 + bw * (h - hs) * Y_GIRDER**2)
    J = B_DECK * hs**3 / 3 + 2 * 0.229 * (h - hs) * bw**3      # open section, St Venant
    # mass per metre: concrete + steel cross girders (I-girders every 4.42 m) + surfacing + barriers
    m_conc = A * RHO_C
    m_steel, m_surf, m_barr = 1.5, 0.08 * 28.0 * 2.3, 2.0
    m = m_conc + m_steel + m_surf + m_barr
    # polar mass moment per metre about the deck axis
    Im = (2 * (bw * (h - hs) * RHO_C) * Y_GIRDER**2 + a_s * RHO_C * B_DECK**2 / 12
          + m_surf * 28.0**2 / 12 + m_barr * 15.0**2 + m_steel * B_DECK**2 / 12)
    return dict(A=A, Iv=Iv, Il=Il, J=J, m=m, Im=Im)


def hollow_rect(b, d, t):
    A = b * d - (b - 2 * t) * (d - 2 * t)
    Iy = (b * d**3 - (b - 2 * t) * (d - 2 * t) ** 3) / 12
    Iz = (d * b**3 - (d - 2 * t) * (b - 2 * t) ** 3) / 12
    J = 4 * ((b - t) * (d - t)) ** 2 * t / (2 * (b - t) + 2 * (d - t))   # Bredt
    return A, Iy, Iz, J


DEFAULT = dict(k_deck=1.0,       # multiplier on deck stiffness (E of the deck)
               k_mass=1.0,       # multiplier on deck translational mass
               k_rot=1.0,        # multiplier on deck mass moment of inertia (torsion)
               k_lat=1.0,        # multiplier on deck lateral bending stiffness (shear lag in the 31 m slab)
               k_stay=1.0,       # multiplier on stay areas
               ky_pylon=2.0e5,   # transverse deck-pylon spring [kN/m]: the dampers act as elastic supports in service
               kx_pylon=2.0e5)   # longitudinal deck-pylon spring [kN/m]: assumed, the dampers only free slow movement


def build(p=None, dx=4.0):
    """Build the model. Returns node bookkeeping for post-processing."""
    p = dict(DEFAULT, **(p or {}))
    ops.wipe()
    ops.model('basic', '-ndm', 3, '-ndf', 6)
    sec = deck_section()
    Ec = E_C * p['k_deck']
    Gc = Ec / (2 * (1 + NU_C))

    # ---- deck spine nodes ----
    x_end = X_PYL + sum(SIDE)
    piers = [X_PYL + SIDE[0], X_PYL + SIDE[0] + SIDE[1], x_end]          # bearing lines, each side
    n = int(round(2 * x_end / dx))
    xs = np.linspace(-x_end, x_end, n + 1)
    keyx = sorted(set([round(v, 3) for v in list(xs) + [s * v for v in piers + [X_PYL] for s in (-1, 1)]]))
    deck = {}
    tag = 1
    for x in keyx:
        ops.node(tag, x, 0.0, Z_DECK)
        deck[x] = tag
        tag += 1
    dxs = np.diff(keyx)
    # deck mass lumped at nodes
    m_l, Im_l = sec['m'] * p['k_mass'], sec['Im'] * p['k_rot']
    for i, x in enumerate(keyx):
        L = ((dxs[i - 1] if i > 0 else 0) + (dxs[i] if i < len(dxs) else 0)) / 2
        ops.mass(deck[x], m_l * L, m_l * L, m_l * L, Im_l * L, 1e-6, 1e-6)
    ops.geomTransf('Linear', 1, 0.0, 1.0, 0.0)          # deck: local z = global y, so Iz is vertical bending
    ele = 1
    for i in range(len(keyx) - 1):
        ops.element('elasticBeamColumn', ele, deck[keyx[i]], deck[keyx[i + 1]],
                    sec['A'], Ec, Gc, sec['J'], sec['Il'] * p['k_lat'], sec['Iv'], 1)
        ele += 1

    # ---- bearings at piers and abutments: vertical, transverse and torsion restrained ----
    for s in (-1, 1):
        for x in piers:
            ops.fix(deck[round(s * x, 3)], 0, 1, 1, 1, 0, 0)

    # ---- pylons: two legs at y = +-16.5 m, fixed at river level, H crossbeam under the deck ----
    A_l, Iy_l, Iz_l, J_l = hollow_rect(5.0, 7.0, 0.8)      # leg: 5 m transverse x 7 m longitudinal
    A_c, Iy_c, Iz_c, J_c = hollow_rect(4.0, 5.0, 0.6)      # crossbeam
    ops.geomTransf('Linear', 2, 1.0, 0.0, 0.0)              # vertical legs, local z = global x
    ops.geomTransf('Linear', 3, 1.0, 0.0, 0.0)              # crossbeam along y
    y_leg = 16.5
    z_lev = sorted(set([0.0, 20.0, 45.0, Z_DECK - 4.0] + list(np.linspace(95.0, H_PYL, 13))))
    pyl = {}
    for s in (-1, 1):
        for yl in (-y_leg, y_leg):
            prev = None
            for z in z_lev:
                ops.node(tag, s * X_PYL, yl, z)
                pyl[(s, yl, round(z, 3))] = tag
                if z == 0.0:
                    ops.fix(tag, 1, 1, 1, 1, 1, 1)
                if prev is not None:
                    ops.element('elasticBeamColumn', ele, prev, tag, A_l, E_C, E_C / 2.4, J_l, Iy_l, Iz_l, 2)
                    ele += 1
                    hz = z - z_lev[z_lev.index(z) - 1]
                    for nd in (prev, tag):
                        ops.mass(nd, *(3 * [A_l * RHO_C * hz / 2]), 1e-6, 1e-6, 1e-6)
                prev = tag
                tag += 1
        # crossbeam under the deck
        zc = Z_DECK - 4.0
        ops.element('elasticBeamColumn', ele, pyl[(s, -y_leg, zc)], pyl[(s, y_leg, zc)],
                    A_c, E_C, E_C / 2.4, J_c, Iy_c, Iz_c, 3)
        ele += 1
        # deck-pylon springs; grounded directly, so pylon flexibility in this path is folded into the spring value
        ops.node(tag, s * X_PYL, 0.0, Z_DECK)
        ops.fix(tag, 1, 1, 1, 1, 1, 1)                     # grounded through the crossbeam stiffness, simplified
        my, mx = 100 + (s > 0), 110 + (s > 0)
        ops.uniaxialMaterial('Elastic', my, p['ky_pylon'])
        ops.uniaxialMaterial('Elastic', mx, p['kx_pylon'])
        ops.element('zeroLength', ele, tag, deck[round(s * X_PYL, 3)], '-mat', mx, my, '-dir', 1, 2)
        ele += 1
        tag += 1

    # ---- stays: 12 per plane on each side of each tower, semi-fan ----
    w_plane = sec['m'] * G / 2                              # dead load carried per stay plane [kN/m]
    z_anch = list(np.linspace(95.0, H_PYL - 3.0, 12))        # k = 0 is the stay nearest the pylon: lowest anchor; the outermost stay anchors at the top
    stays = []
    ops.uniaxialMaterial('Elastic', 1, E_S)
    mat = 2
    for s in (-1, 1):
        for side in (-1, 1):                               # -1: towards mid-span, +1: towards the side span
            reach = (MAIN / 2 - 6.0) if side < 0 else (sum(SIDE) - 2.0)
            d = np.linspace(20.0, reach, 12)
            spacing = d[1] - d[0]
            for yl in (-y_leg, y_leg):
                yp = math.copysign(Y_GIRDER, yl)
                for k in range(12):
                    xd = s * X_PYL + s * side * d[k]
                    xd_key = min(keyx, key=lambda v: abs(v - xd))
                    za = z_anch[k]
                    # rigid offset from the deck spine to the girder anchorage
                    ops.node(tag, xd_key, yp, Z_DECK); a_deck = tag; tag += 1
                    ops.rigidLink('beam', deck[xd_key], a_deck)
                    # anchorage on the pylon leg, rigid offset to the stay plane
                    ops.node(tag, s * X_PYL, yp, za); a_pyl = tag; tag += 1
                    zk = min([z for (ss, yy, z) in pyl if ss == s and yy == yl], key=lambda v: abs(v - za))
                    ops.rigidLink('beam', pyl[(s, yl, zk)], a_pyl)
                    Lh = abs(xd_key - s * X_PYL)
                    L = math.hypot(Lh, za - Z_DECK)
                    sin_t = (za - Z_DECK) / L
                    T = w_plane * spacing / sin_t
                    A = p['k_stay'] * T / SIGMA_DL
                    E_eq = E_S / (1 + (GAMMA_STAY * Lh) ** 2 * E_S / (12 * SIGMA_DL**3))   # Ernst
                    ops.uniaxialMaterial('Elastic', mat, E_eq)
                    ops.element('Truss', ele, a_pyl, a_deck, A, mat)
                    ops.mass(a_deck, *(3 * [A * 7.85 * L / 2]), 0, 0, 0)
                    stays.append(dict(ele=ele, A=A, L=L, T=T))
                    ele += 1
                    mat += 1
    return dict(deck=deck, keyx=keyx, sec=sec, stays=stays, params=p)


def classify(info, mode):
    """Return (type, symmetry) of a mode from deck-spine displacements: lateral, vertical, torsion."""
    keyx = info['keyx']
    u = np.array([ops.nodeEigenvector(info['deck'][x], mode) for x in keyx])
    uy, uz, rx = np.abs(u[:, 1]).max(), np.abs(u[:, 2]).max(), np.abs(u[:, 3]).max() * Y_GIRDER
    ux = np.abs(u[:, 0]).max()
    kind = ['longitudinal', 'lateral', 'vertical', 'torsion'][int(np.argmax([ux, uy, uz, rx]))]
    comp = {'longitudinal': 0, 'lateral': 1, 'vertical': 2, 'torsion': 3}[kind]
    v = u[:, comp]
    sym = 'symmetric' if np.dot(v, v[::-1]) >= 0 else 'antisymmetric'
    return kind, sym


def deck_energy_share(info, mode):
    """Share of the modal kinetic energy carried by the deck spine nodes."""
    deck = set(info['deck'].values())
    ed = et = 0.0
    for nd in ops.getNodeTags():
        ms = ops.nodeMass(nd)
        v = ops.nodeEigenvector(nd, mode)
        e = sum(ms[i] * v[i] ** 2 for i in range(6))
        et += e
        if nd in deck:
            ed += e
    return ed / et if et > 0 else 0.0


def eigen(n=20, p=None):
    info = build(p)
    ops.constraints('Transformation')                   # needed for the rigid links
    ops.numberer('RCM')
    ops.system('BandGeneral')
    lam = ops.eigen(n)
    f = [math.sqrt(l) / (2 * math.pi) for l in lam]
    modes = []
    for i in range(n):
        kind, sym = classify(info, i + 1)
        share = deck_energy_share(info, i + 1)
        if share < 0.5:                 # local pylon mode, little deck motion: not seen by the deck sensors
            kind = 'pylon'
        modes.append(dict(n=i + 1, f=f[i], kind=kind, sym=sym, deck_share=share))
    return info, modes


if __name__ == '__main__':
    info, modes = eigen(16)
    s = info['sec']
    print(f"deck A {s['A']:.2f} m2, Iv {s['Iv']:.1f} m4, Il {s['Il']:.0f} m4, J {s['J']:.2f} m4, m {s['m']:.1f} t/m")
    for m in modes:
        print(f"{m['n']:>2}  {m['f']:.3f} Hz  {m['kind']:<12} {m['sym']:<14} deck energy {100*m['deck_share']:.0f}%")
