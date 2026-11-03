"""Write the public study page from results/ so the numbers on the site always match the run.

Output: frontend/public/bridge/vasco-da-gama/index.html plus the three figures next to it.
Run from this folder after calibrate.py and figures.py.
"""
import json
import shutil
from html import escape
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'frontend' / 'public' / 'bridge' / 'vasco-da-gama'
REPO = 'https://github.com/sabaazdn73/tnega/tree/main/research/vasco-da-gama-modal'
PAPER = 'https://vbn.aau.dk/ws/files/12774610/Identification_from_the_Natural_Response_of_Vasco_Da_Gama_Bridge'

r = json.loads((HERE / 'results' / 'calibration.json').read_text())
p = r['parameters_calibrated']
OUT.mkdir(parents=True, exist_ok=True)
SIZE = {}
for f in ('frequencies.png', 'mode_shapes.png', 'model_elevation.png'):
    shutil.copy(HERE / 'results' / f, OUT / f)
    h, w = plt.imread(OUT / f).shape[:2]
    SIZE[f] = f'width="{w}" height="{h}"'


def fmt(v, d=3):
    return '' if v is None else f'{v:.{d}f}'


rows = []
for c in r['comparison']:
    t = c['type'] or 'not stated'
    use = {'calibration': 'calibration', 'check': 'check'}.get(c['used_for'], 'not used')
    err = '' if c['error_pct'] is None else f"{c['error_pct']:+.1f}%"
    rows.append(f"<tr><td>{c['mode']}</td><td>{escape(t)}</td><td>{c['f_fdd']:.4f}</td>"
                f"<td>{fmt(c['f_fvt'])}</td><td>{fmt(c['damping_fvt_pct'], 2)}</td>"
                f"<td>{fmt(c['f_calibrated'])}</td><td>{err}</td><td>{use}</td></tr>")
checks = [c for c in r['comparison'] if c['used_for'] == 'check']
within = sum(abs(c['error_pct']) <= 5 for c in checks)

E = 36.0 * p['k_deck']
sigma = 0.40 * 1860 / p['k_stay']
params = [
    ('Deck concrete modulus', f"{E:.0f} GPa", f"{p['k_deck']:.2f} x the 36 GPa start value"),
    ('Stay areas', f"{p['k_stay']:.2f} x dead-load sizing", f"dead-load stress about {sigma:.0f} MPa, {sigma / 1860:.2f} of strand strength"),
    ('Deck mass moment of inertia', f"{p['k_rot']:.2f} x estimate", 'radius of gyration about the deck axis reduced accordingly'),
    ('Deck lateral stiffness', f"{p['k_lat']:.2f} x full section", 'also absorbs the transverse spring, see limitations'),
    ('Longitudinal damper stiffness', f"{p['kx_pylon'] / 1e3:.0f} MN/m per pylon", 'elastic stand-in for the hysteretic dampers'),
]
prow = ''.join(f'<tr><td>{escape(a)}</td><td>{escape(b)}</td><td>{escape(c)}</td></tr>' for a, b, c in params)

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Vasco da Gama modal study</title>
<meta name="description" content="An OpenSeesPy model of the cable-stayed Vasco da Gama Bridge in Lisbon, calibrated to frequencies measured in a published ambient vibration test, with a held-back check on higher modes.">
<link rel="canonical" href="https://www.tnega.app/bridge/vasco-da-gama/">
<link rel="icon" href="/favicon.ico?v=3" sizes="any">
<style>
@font-face{{font-family:'Hanken Grotesk';font-style:normal;font-display:swap;font-weight:100 900;src:url('/fonts/hanken-grotesk-latin-wght-normal.woff2') format('woff2-variations')}}
:root{{--bg:#e9e7e1;--panel:#f6f5f1;--ink:#22251f;--muted:#62665c;--line:#cfccc2;--accent:#2f5d8a;--fig:#fcfcfb;
  --f-body:"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;--f-mono:ui-monospace,Menlo,Consolas,monospace}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#15181b;--panel:#1c2024;--ink:#e7e5de;--muted:#9aa09a;--line:#30363b;--accent:#7fb0de;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#15181b;--panel:#1c2024;--ink:#e7e5de;--muted:#9aa09a;--line:#30363b;--accent:#7fb0de;color-scheme:dark}}
html,body{{margin:0;padding:0}}
body{{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.6}}
main{{max-width:880px;margin:0 auto;padding:28px 16px 64px}}
.eyebrow{{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}}
h1{{font-size:34px;line-height:1.15;margin:6px 0 10px;text-wrap:balance}}
h2{{font-size:21px;margin:36px 0 8px}}
p,li{{max-width:68ch}}
a{{color:var(--accent);text-underline-offset:2px}}
.lede{{font-size:18px;color:var(--ink)}}
.meta{{color:var(--muted);font-size:14px}}
figure{{margin:18px 0;background:var(--fig);border:1px solid var(--line);border-radius:4px;padding:10px}}
figure img{{display:block;width:100%;height:auto}}
figcaption{{font-size:13.5px;color:#52514e;margin-top:6px}}
.tbl{{overflow-x:auto;border:1px solid var(--line);border-radius:4px;background:var(--panel)}}
table{{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}}
th,td{{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}}
th{{font-weight:600;color:var(--muted);font-size:12.5px;text-transform:uppercase;letter-spacing:.04em}}
tr:last-child td{{border-bottom:0}}
.wrap td{{white-space:normal}}
.facts{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}}
.facts div{{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:10px 12px}}
.facts b{{display:block;font-size:22px}}
.facts span{{font-size:13px;color:var(--muted)}}
</style>
</head>
<body>
<main>
<div class="eyebrow">RC Code Town · bridge condition assessment · worked study 1</div>
<h1>Vasco da Gama Bridge: a calibrated modal model</h1>
<p class="lede">A simplified 3D OpenSeesPy model of the cable-stayed main bridge over the Tagus in Lisbon, tuned to the natural frequencies measured in a published ambient vibration test, then checked against higher modes it was not tuned to.</p>
<p class="meta">Saba Azadegan · code, data and figures: <a href="{REPO}">research/vasco-da-gama-modal</a> · back to the <a href="/town/">code town</a></p>

<div class="facts">
<div><b>420 m</b><span>main span, 829.2 m cable-stayed length</span></div>
<div><b>147 m</b><span>H-shaped pylons, 48 stays each</span></div>
<div><b>5 of 12</b><span>measured modes used to calibrate</span></div>
<div><b>{within} of {len(checks)}</b><span>held-back modes within 5%</span></div>
</div>

<h2>Why this bridge</h2>
<p>It is my favourite structure and it is close to where I live. It is also a good test case for vibration-based assessment, the subject of my MSc research: a long, fully suspended, lightly damped deck whose modes were measured carefully and published, so a model can be checked against the structure itself rather than against another model.</p>

<h2>What was done</h2>
<ol>
<li>Built a spine model: the deck as one beam with rigid arms to the two stay planes, pylon legs and crossbeam as beams, 96 stays as truss members with the Ernst equivalent modulus for sag, bearings at the side-span piers, and elastic springs at the pylons standing in for the hysteretic dampers.</li>
<li>Took the geometry from published descriptions. Section sizes that are not published were estimated and are listed in the code.</li>
<li>Ran an eigen analysis, sorted the modes by what the deck does (lateral, vertical, torsion, longitudinal) and set aside local pylon modes that barely move the deck.</li>
<li>Fitted five global parameters to measured modes 1, 2, 3, 4 and 7 by least squares, pairing modes by type and order because the measured mode shapes are not published as numbers.</li>
<li>Compared the model with measured modes 8 to 12, which were not used in the fit.</li>
</ol>

<figure><img src="model_elevation.png" alt="Elevation of the model showing the deck, the two pylons, the semi-fan stays and the side-span piers" {SIZE['model_elevation.png']}><figcaption>The model in elevation, one stay plane.</figcaption></figure>

<h2>Result</h2>
<figure><img src="frequencies.png" alt="Scatter of measured against model frequencies; most points sit inside a 10 percent band around the diagonal, two torsion modes fall outside" {SIZE['frequencies.png']}><figcaption>Filled points were used for calibration, open points are the check. Torsion modes 8 and 11 are the weak spots.</figcaption></figure>
<div class="tbl"><table>
<thead><tr><th>Mode</th><th>Type</th><th>Measured FDD [Hz]</th><th>Free vibration [Hz]</th><th>Damping [%]</th><th>Model [Hz]</th><th>Error</th><th>Use</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="meta">Measured values from Cunha, Caetano, Brincker and Andersen (2004), tables 1 and 2. Damping from the free-vibration test. Modes 5 and 6 have no type stated in the paper and were left out.</p>

<figure><img src="mode_shapes.png" alt="Four mode shapes along the deck: first lateral, first two vertical and first torsion" {SIZE['mode_shapes.png']}><figcaption>Deck mode shapes of the calibrated model. Measured shapes are shown only as figures in the paper, so they are not compared here.</figcaption></figure>

<h2>Calibrated parameters</h2>
<div class="tbl"><table class="wrap"><thead><tr><th>Parameter</th><th>Value</th><th>Note</th></tr></thead><tbody>{prow}</tbody></table></div>

<h2>Limits, read before using any number</h2>
<ul>
<li>This is not the design model. Section properties, stay areas and pylon sizes are estimates, and the five fitted parameters absorb every other modelling error, so they are effective values, not measured properties.</li>
<li>Five parameters fitted to five frequencies fit them almost exactly by construction. The meaningful evidence is the held-back check, and there torsion modes 8 and 11 are off by about 10 and 15%. Mode 11 involves large pylon movement in the test, which this simple pylon cannot represent.</li>
<li>The lateral stiffness factor and the transverse spring trade off against each other; one lateral frequency cannot separate them. The low lateral factor should be read as a combined effect.</li>
<li>Pairing by type and order is weaker than pairing by mode shape (MAC). With measured shapes as numbers, a MAC check would be the next step.</li>
<li>The model has a longitudinal deck mode near 0.40 Hz that the paper does not report, and local pylon modes near 0.40 and 0.47 Hz that move the deck very little. Whether these exist on the real bridge at these frequencies is not known from the source.</li>
</ul>

<h2>Next</h2>
<p>Use the calibrated model as the baseline for damage detection: introduce stiffness loss in a girder segment or a stay and see which frequencies and shapes move enough to be measured above the environmental scatter reported for bridges of this kind.</p>

<h2>Sources</h2>
<ul>
<li>E. Cunha, E. Caetano, R. Brincker, P. Andersen, <a href="{PAPER}">Identification from the natural response of Vasco da Gama Bridge</a>, IMAC-XXII, 2004. Measured frequencies and damping, test layout, structural description. Numbers are cited as facts; the paper itself is not reproduced here.</li>
<li><a href="https://en.wikipedia.org/wiki/Vasco_da_Gama_Bridge">Vasco da Gama Bridge</a>, Wikipedia, for general facts.</li>
<li><a href="https://openseespydoc.readthedocs.io/">OpenSeesPy</a>, the analysis software.</li>
</ul>
</main>
</body>
</html>
'''
(OUT / 'index.html').write_text(html)
print('wrote', OUT / 'index.html')
