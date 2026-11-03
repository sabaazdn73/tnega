"""Calibrate five global parameters of model.py to the measured frequencies, then check the rest.

Measured data: Cunha, Caetano, Brincker & Andersen (2004), Table 1 (FDD) and Table 2 (free vibration).
Model modes are paired with measured modes by type (lateral, vertical, torsion) in order of frequency,
because measured mode shapes are not published as numbers. Modes 5 and 6 have no stated type and
are not used.
"""
import json, math
import numpy as np
from scipy.optimize import least_squares
import model as M

MEASURED = [  # (mode, f_FDD [Hz], f_FVT [Hz] or None, type, FVT damping [%] or None)
    (1, 0.3027, 0.295, 'lateral', 1.23), (2, 0.3385, 0.338, 'vertical', 0.21),
    (3, 0.4584, 0.456, 'vertical', 0.23), (4, 0.4696, 0.467, 'torsion', 0.24),
    (5, 0.5929, 0.591, None, 0.34), (6, 0.6197, None, None, None),
    (7, 0.6488, 0.647, 'vertical', 0.37), (8, 0.7123, 0.707, 'torsion', 0.78),
    (9, 0.8177, 0.814, 'vertical', 0.48), (10, 0.8993, None, 'torsion', None),
    (11, 0.9251, None, 'torsion', None), (12, 0.9865, 0.982, 'vertical', 0.74),
]
CAL = [1, 2, 3, 4, 7]                    # used for calibration; 8 to 12 are held back as a check
NAMES = ['k_stay', 'k_deck', 'k_rot', 'k_lat', 'kx_pylon']
X0 = np.log([1.0, 1.0, 1.0, 1.0, 2.0e5])
LB = np.log([0.5, 0.6, 0.5, 0.2, 1.0e3])
UB = np.log([3.5, 2.0, 1.6, 1.5, 5.0e6])
N_MODES = 30


def pair(modes):
    """Map each typed measured mode to the model mode of the same type and rank."""
    by_type = {}
    for m in modes:
        by_type.setdefault(m['kind'], []).append(m)
    rank, out = {}, {}
    for (n, f, _, t, _) in MEASURED:
        if t is None:
            continue
        k = rank.get(t, 0)
        rank[t] = k + 1
        lst = by_type.get(t, [])
        out[n] = lst[k] if k < len(lst) else None
    return out


def run(x):
    p = dict(zip(NAMES, np.exp(x)))
    _, modes = M.eigen(N_MODES, p)
    return p, modes, pair(modes)


def resid(x):
    _, _, pr = run(x)
    meas = {n: f for (n, f, *_ ) in MEASURED}
    return [(pr[n]['f'] - meas[n]) / meas[n] if pr[n] else 1.0 for n in CAL]


if __name__ == '__main__':
    p0, modes0, pr0 = run(X0)
    sol = least_squares(resid, X0, bounds=(LB, UB), diff_step=0.02, xtol=1e-4, ftol=1e-6, max_nfev=60)
    p, modes, pr = run(sol.x)
    rows = []
    for (n, f, ffvt, t, z) in MEASURED:
        a, b = pr0.get(n), pr.get(n)
        rows.append(dict(mode=n, type=t, f_fdd=f, f_fvt=ffvt, damping_fvt_pct=z,
                         used_for=('calibration' if n in CAL else ('check' if t else 'not used, type not stated')),
                         f_initial=round(a['f'], 4) if a else None,
                         f_calibrated=round(b['f'], 4) if b else None,
                         model_mode=b['n'] if b else None,
                         error_pct=round(100 * (b['f'] - f) / f, 1) if b else None))
    out = dict(parameters_initial={k: float(v) for k, v in p0.items() if k in NAMES},
               parameters_calibrated={k: float(v) for k, v in p.items() if k in NAMES},
               fixed={k: v for k, v in M.DEFAULT.items() if k not in NAMES},
               deck_section={k: round(float(v), 3) for k, v in M.deck_section().items()},
               comparison=rows,
               model_modes=[dict(n=m['n'], f=round(m['f'], 4), type=m['kind'], symmetry=m['sym'], deck_energy_share=round(m['deck_share'], 2)) for m in modes])
    json.dump(out, open('results/calibration.json', 'w'), indent=2)
    print(json.dumps(out['parameters_calibrated'], indent=1))
    for r in rows:
        print(r)
