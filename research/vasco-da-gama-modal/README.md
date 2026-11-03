# Vasco da Gama Bridge: a calibrated modal model

A simplified 3D OpenSeesPy model of the cable-stayed main bridge of the Vasco da Gama Bridge in Lisbon. The model is calibrated to the natural frequencies measured in a published ambient vibration test and then checked against higher modes that were not used in the fit.

Study page: https://www.tnega.app/bridge/vasco-da-gama/ (linked from the bridge card in the code town).

This is the first worked study for the town's "Bridge condition assessment" structure type: vibration-based assessment starts from a model that reproduces the measured modes of the healthy structure.

## Run it

```
pip install -r requirements.txt
python model.py        # build the model with start values and list the first modes
python calibrate.py    # fit five parameters, write results/calibration.json (about 2 minutes)
python figures.py      # write the three figures in results/
python build_page.py   # write the study page in frontend/public/bridge/vasco-da-gama/
```

## The structure, from published sources

- Cable-stayed length 829.2 m: main span 420 m, side spans 62 + 70.6 + 72 m on each side.
- Deck 31 m wide, two lateral prestressed concrete girders 2.6 m deep, a 0.25 m cast-in-place slab, transverse steel I-girders every 4.42 m. The deck is continuous and fully suspended, about 52.5 m above the river.
- Two H-shaped pylons, 147 m high. Two vertical planes of stays, 48 stays per pylon.
- Hysteretic steel dampers connect deck and pylons. In service the transverse dampers act as elastic supports and the longitudinal dampers allow slow movement.

## The model

Units are m, kN, t and s.

- Deck: one beam on the bridge axis with rigid arms to the stay anchorages at y = ±14.65 m. Section properties come from the two girders and the slab (the girder width of 1.7 m is an estimate). Mass includes concrete, steel cross girders, surfacing and barriers, with the mass moment of inertia about the deck axis.
- Pylons: two legs per pylon, hollow 5 x 7 m with 0.8 m walls (estimate), fixed at river level, with a crossbeam under the deck.
- Stays: 12 per plane on each side of each pylon in a semi-fan, deck anchors from 20 m off the pylon, pylon anchors from 95 m to 144 m. Areas are sized for the deck dead load at 0.40 of strand strength and then scaled by the calibration. Stiffness uses the Ernst equivalent modulus for sag.
- Supports: side-span piers and abutments restrain vertical and transverse movement and rotation about the deck axis. At the pylons the deck has no vertical support. Elastic springs stand in for the dampers in the transverse and longitudinal directions.

## Calibration

Five global parameters are fitted by least squares to measured modes 1, 2, 3, 4 and 7 (FDD frequencies). Modes 8, 9, 10, 11 and 12 are held back as a check. Modes 5 and 6 have no type stated in the paper and are not used.

Measured mode shapes are only published as figures, so model and measured modes are paired by type (lateral, vertical, torsion) and by order of frequency. Model modes in which the deck carries less than half of the kinetic energy are treated as local pylon modes and are not paired, because the test sensors were mostly on the deck.

The fitted values and the full comparison are in `results/calibration.json`. In short:

| Measured mode | Type | Measured [Hz] | Model [Hz] | Use |
|---|---|---|---|---|
| 1 | lateral | 0.3027 | 0.303 | calibration |
| 2 | vertical | 0.3385 | 0.340 | calibration |
| 3 | vertical | 0.4584 | 0.443 | calibration |
| 4 | torsion | 0.4696 | 0.470 | calibration |
| 7 | vertical | 0.6488 | 0.659 | calibration |
| 8 | torsion | 0.7123 | 0.640 | check, -10% |
| 9 | vertical | 0.8177 | 0.830 | check, +1.5% |
| 10 | torsion | 0.8993 | 0.909 | check, +1.1% |
| 11 | torsion | 0.9251 | 1.065 | check, +15% |
| 12 | vertical | 0.9865 | 1.003 | check, +1.7% |

## Limits

- This is not the design model of the bridge. Section sizes, stay areas and pylon dimensions are estimates, and the fitted parameters absorb every other modelling error. Treat them as effective values, not as measured properties.
- Five parameters fitted to five frequencies reproduce them closely by construction. The held-back modes are the real test: vertical modes and the third torsion mode are within 2%, torsion modes 8 and 11 are off by about 10% and 15%. Mode 11 shows large pylon movement in the test, which this simple pylon does not represent.
- The lateral stiffness factor and the transverse spring trade off against each other, and one lateral frequency cannot separate them. The low lateral factor is a combined effect.
- The transverse and longitudinal springs are grounded, so pylon flexibility in that load path is folded into the spring values.
- The model has a longitudinal deck mode near 0.40 Hz and local pylon modes near 0.40 and 0.47 Hz. The paper does not report them, and the source cannot say whether they exist on the real bridge at these frequencies.
- Pairing by order is weaker than pairing by mode shape (MAC). A MAC check against measured shapes would be the next step if those shapes become available as numbers.

## Sources

- E. Cunha, E. Caetano, R. Brincker and P. Andersen, "Identification from the natural response of Vasco da Gama Bridge", Proceedings of IMAC-XXII, 2004. Open copy at Aalborg University: https://vbn.aau.dk/ws/files/12774610/Identification_from_the_Natural_Response_of_Vasco_Da_Gama_Bridge. The measured frequencies, damping values and structural description are cited here as facts. No text or figures of the paper are reproduced.
- Vasco da Gama Bridge, Wikipedia, for general facts.
- OpenSeesPy, https://openseespydoc.readthedocs.io/

No measured time histories were available as open data, so this study starts from the published modal results, not from raw records.
