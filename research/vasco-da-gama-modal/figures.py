"""Figures for the README and the study page. Run after calibrate.py."""
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import openseespy.opensees as ops
import model as M

SURF, INK, INK2, MUTED, GRID = '#fcfcfb', '#0b0b0b', '#52514e', '#8a8984', '#e4e3df'
COL = {'vertical': '#2a78d6', 'torsion': '#eb6834', 'lateral': '#1baf7a'}
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': MUTED,
                     'axes.labelcolor': INK2, 'xtick.color': INK2, 'ytick.color': INK2,
                     'axes.facecolor': SURF, 'figure.facecolor': SURF, 'axes.spines.top': False,
                     'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.8})

res = json.load(open('results/calibration.json'))
p = res['parameters_calibrated']

# ---- 1. measured vs model frequencies ----
fig, ax = plt.subplots(figsize=(6.4, 5.4), dpi=200)
lim = [0.25, 1.1]
ax.fill_between(lim, [l * 0.9 for l in lim], [l * 1.1 for l in lim], color=GRID, alpha=0.6, lw=0, label='within 10%')
ax.plot(lim, lim, color=MUTED, lw=1)
for r in res['comparison']:
    if r['f_calibrated'] is None:
        continue
    c = COL[r['type']]
    cal = r['used_for'] == 'calibration'
    ax.scatter(r['f_fdd'], r['f_calibrated'], s=70, zorder=3, edgecolor=c, linewidth=2,
               facecolor=c if cal else SURF)
    ax.annotate(str(r['mode']), (r['f_fdd'], r['f_calibrated']), xytext=(7, -3), textcoords='offset points',
                color=INK2, fontsize=9)
for t, c in COL.items():
    ax.scatter([], [], s=60, color=c, label=t)
ax.scatter([], [], s=60, facecolor=MUTED, edgecolor=MUTED, label='used for calibration')
ax.scatter([], [], s=60, facecolor=SURF, edgecolor=MUTED, linewidth=2, label='held back as a check')
ax.set(xlim=lim, ylim=lim, xlabel='Measured frequency, ambient test FDD [Hz]', ylabel='Model frequency [Hz]')
ax.set_title('Measured vs calibrated model, numbers are measured mode numbers', color=INK, fontsize=10.5, loc='left')
ax.legend(frameon=False, fontsize=8.5, loc='upper left', labelcolor=INK2)
fig.tight_layout()
fig.savefig('results/frequencies.png')

# ---- 2. mode shapes of the deck ----
info, modes = M.eigen(30, p)
keyx = np.array(info['keyx'])
wanted = [('lateral', 0), ('vertical', 0), ('vertical', 1), ('torsion', 0)]
comp = {'lateral': 1, 'vertical': 2, 'torsion': 3}
fig, axs = plt.subplots(4, 1, figsize=(8, 7.2), dpi=200, sharex=True)
shapes = {}
for ax, (t, k) in zip(axs, wanted):
    m = [mm for mm in modes if mm['kind'] == t][k]
    v = np.array([ops.nodeEigenvector(info['deck'][x], m['n'])[comp[t]] for x in keyx])
    v = v / np.abs(v).max()
    if v[np.argmax(np.abs(v))] < 0:
        v = -v
    shapes[f"{t}_{k + 1}"] = dict(f=round(m['f'], 4), model_mode=m['n'], shape=[round(float(a), 4) for a in v])
    ax.axhline(0, color=MUTED, lw=0.8)
    ax.plot(keyx, v, color=COL[t], lw=2)
    for xp in (-M.X_PYL, M.X_PYL):
        ax.axvline(xp, color=INK2, lw=1, ls=(0, (3, 3)))
    meas = {('lateral', 0): 0.3027, ('vertical', 0): 0.3385, ('vertical', 1): 0.4584, ('torsion', 0): 0.4696}[(t, k)]
    label = {'lateral': 'lateral bending', 'vertical': 'vertical bending', 'torsion': 'torsion (rotation x 14.65 m)'}[t]
    ax.set_title(f"{label}, model {m['f']:.3f} Hz, measured {meas:.4f} Hz", loc='left', fontsize=9.5, color=INK)
    ax.set_ylim(-1.15, 1.15)
    ax.set_yticks([-1, 0, 1])
axs[-1].set_xlabel('Position along the deck from mid-span [m], dashed lines are the pylons')
fig.tight_layout()
fig.savefig('results/mode_shapes.png')
json.dump(dict(x=[float(x) for x in keyx], modes=shapes), open('results/mode_shapes.json', 'w'))

# ---- 3. model elevation ----
fig, ax = plt.subplots(figsize=(10, 3.4), dpi=200)
ax.grid(False)
for e in ops.getEleTags():
    nd = ops.eleNodes(e)
    if len(nd) != 2:
        continue
    a, b = ops.nodeCoord(nd[0]), ops.nodeCoord(nd[1])
    if a[1] < -1 or b[1] < -1:     # draw the downstream half only (y >= 0) plus the spine
        continue
    is_stay = ops.eleType(e) == 'Truss'
    is_deck = abs(a[2] - M.Z_DECK) < 1e-6 and abs(b[2] - M.Z_DECK) < 1e-6 and abs(a[1]) < 1e-6
    if not (is_stay or is_deck or abs(a[0] - b[0]) < 1e-6 and abs(a[1] - b[1]) < 1e-6):
        continue
    ax.plot([a[0], b[0]], [a[2], b[2]], color=COL['vertical'] if is_stay else INK,
            lw=0.7 if is_stay else (2.2 if is_deck else 1.6))
bear = [M.X_PYL + M.SIDE[0], M.X_PYL + M.SIDE[0] + M.SIDE[1], M.X_PYL + sum(M.SIDE)]
for s in (-1, 1):
    for x in bear:
        ax.plot([s * x, s * x], [0, M.Z_DECK - 1.5], color=MUTED, lw=1.4)
ax.axhline(0, color=MUTED, lw=0.8)
ax.set_aspect('equal')
ax.set(xlabel='x [m]', ylabel='z [m]')
ax.set_title('OpenSeesPy model, elevation of one stay plane: 420 m main span, 147 m pylons, 12 stays per plane per side',
             loc='left', fontsize=9.5, color=INK)
for sp in ('left', 'bottom'):
    ax.spines[sp].set_color(MUTED)
fig.tight_layout()
fig.savefig('results/model_elevation.png', bbox_inches='tight', pad_inches=0.15)
print('figures written')
