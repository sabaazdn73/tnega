/* Follows the site's theme setting (theme/ThemeProvider.jsx, same origin). */
(function(){
  const apply=()=>{let v='system';try{v=localStorage.getItem('tnega_theme')||'system'}catch(e){}
    if(v==='dark'||v==='light') document.documentElement.setAttribute('data-theme',v); else document.documentElement.removeAttribute('data-theme');};
  apply(); addEventListener('storage',e=>{if(e.key==='tnega_theme') apply()});
})();
/* ---------------- Content ---------------- */
/* Review scenarios where a general AI model is likely to go wrong. General examples, from the public codes. */
const SCENARIOS = {
  s1:{title:"Beam rebar estimate review",topic:"Tension lap splice class and development modification factors applied in a beam reinforcement takeoff."},
  s2:{title:"Hooked bars at an exterior joint, a contractor's RFI",topic:"Hooked-bar development length into an exterior column, governing code edition and its modification factors."},
  s3:{title:"Deleting stud rails at an edge column, a contractor's RFI",topic:"Two-way shear at an edge column of a transfer slab: size effect, three-sided critical section, moment transfer and openings."},
  s4:{title:"Grade 80 substitution in a slab takeoff",topic:"Value-engineering proposal to substitute higher-grade bars in a one-way slab, checked against ACI 318-19."},
  s5:{title:"Column confinement under high axial load, a contractor's RFI",topic:"Hoop and crosstie layout in special moment frame columns where the factored axial load including earthquake effects is high."},
  s6:{title:"Seismic analysis review before permit",topic:"Redundancy factor, the drift limit it reduces, and scaling of modal response results in a moment-frame building."},
  s7:{title:"Special structural wall review before permit",topic:"Shear amplification, boundary-element thickness and drift capacity, and lap splices at the critical section of a special wall."},
  s8:{title:"Diaphragm collector review before permit",topic:"Collector forces with overstrength, lap lengths in seismic-force-resisting systems, and detailing of collector splice zones."},
  s9:{title:"Special moment frame beam review before permit",topic:"Probable moment strength with the bar grade actually used, design shear with the concrete contribution set to zero in the hinge zones, hoop spacing for Grade 80 bars, and unequal gravity shear along the span."},
  s10:{title:"Reducing mat reinforcement, a value-engineering proposal",topic:"One-way shear of a thick mat without stirrups: which row of Table 22.5.5.1 applies, the size-effect waiver for foundations, and which bars count in the longitudinal ratio."},
  s11:{title:"Column dowels at the mat, a contractor's RFI",topic:"Whether compression lap splices are allowed at the column base when wind load cases, including the combined-direction cases, put corner bars in tension."},
  s12:{title:"Moment frame joint check in a peer review",topic:"Joint shear in intermediate moment frames: demand from the beams' nominal strength and the seismic joint table, where the columns step down in size but the beams stay the same."}
};

/* Where an AI reviewer goes wrong, what it costs, and what an execution supervisor must open before accepting the result.
   sev: life = can lead to collapse or injury; money = rework, repair, claims or lost savings. */
const PROTOCOL = [
  "Read the code of record from the contract documents (general notes, specifications). Never fall back on the edition remembered from training.",
  "For every check marked below, open the governing clause text before accepting a number. Remembered formulas are often from an older edition.",
  "If the clause, report or project input is not available, stop and ask the user for it by exact name. Do not substitute a typical value.",
  "Site-specific inputs are never assumed: soil bearing, groundwater, exposure class, wind speed, seismic design category, partitions, stored material.",
  "Every finding is reported as error, consequence and fix. Life-safety findings get an independent second check before release."
];
const TRAPS = {
  footing:[
    {sev:"life",ref:"22.6.5.2",err:"Two-way shear in a thick footing is checked without the size-effect factor λs, which ACI 318-19 added.",cons:"Concrete shear strength is overestimated in deep members. Punching at the column is sudden and gives no warning.",look:"ACI 318-19 Table 22.6.5.2 and 13.2.7; footing depth d and whether shear reinforcement is provided.",ask:"The ACI 318-19 Chapter 22 text, if the reviewer cannot open it."},
    {sev:"both",ref:"Geotech",err:"An allowable bearing pressure is assumed (for example a 'typical' 3,000 psf) because no soil value is given.",cons:"Footings sized too small settle or fail in bearing; sized too large waste concrete and steel.",look:"The project geotechnical report: allowable bearing, settlement limits, groundwater, frost depth.",ask:"The geotechnical report or the bearing value stated on the foundation plan."},
    {sev:"life",ref:"Table 22.5.5.1",err:"One-way shear of a mat without stirrups checked with the simple 2λ√f'c expression although Av is below the minimum, or with ρw counted from the top and bottom bars together.",cons:"Shear strength of the mat is overestimated exactly where bars were reduced; a brittle diagonal crack forms under the heaviest columns.",look:"ACI 318-19 Table 22.5.5.1, 22.5.5.1.3 and 13.2.6.2 (λs in foundations); only the flexural tension bars count in ρw.",ask:"The mat reinforcement at both faces and the strip shears from the analysis."},
    {sev:"life",ref:"10.7.5.2",err:"Compression lap splices accepted at the column base because each single wind direction keeps the column in compression. The combined-direction wind cases are not checked.",cons:"Corner bars go into tension under combined wind; a compression lap pulls apart at the base of the column.",look:"ASCE 7-16 Fig. 27.3-8 (Cases 1 to 4), combinations with 0.9D, ACI 318-19 10.7.5.2 and 25.5.",ask:"Unfactored column base reactions by load case, for both wind directions."},
    {sev:"life",ref:"16.3.4.1",err:"Column-to-footing dowels below 0.005Ag, or column bars hooked into the footing for compression.",cons:"The column load is not transferred into the footing; hooks do not develop bars in compression.",look:"ACI 318-19 16.3.4.1, 25.4.9 (compression development), 25.4.1.2.",ask:"Column schedule and footing details."}],
  column:[
    {sev:"life",ref:"6.2.5",err:"Slenderness is ignored, or the non-sway limit is applied to a frame that sways.",cons:"Second-order moments are missed and the column is under-designed against instability.",look:"ACI 318-19 6.2.5, 6.6.4 and 6.6.4.4; the lateral system and story stability index Q.",ask:"The lateral analysis results (story drifts, Q) for the floor in question."},
    {sev:"life",ref:"10.7.5",err:"Column splices sized as compression laps where load combinations put the bars in tension.",cons:"Splices pull apart under lateral load or uplift.",look:"ACI 318-19 10.7.5.2; the bar stress range from all load combinations.",ask:"The factored load combinations and the interaction results for the column."},
    {sev:"life",ref:"18.7.5.2(f)",err:"In a special moment frame column with high axial load (Pu with earthquake effects above 0.3Ag f'c), crossties are placed on every other bar only, and the kf and kn factors of Table 18.7.5.4 are left out.",cons:"The core is not confined where the axial load is highest; the column fails in a brittle way in its hinge zone.",look:"ACI 318-19 18.7.5.2(f), Table 18.7.5.4 and the factored axial loads including the vertical earthquake effect, level by level.",ask:"The column axial loads from the seismic load combinations."},
    {sev:"life",ref:"25.7.2",err:"Tie spacing taken from a typical detail without checking 16db, 48 tie diameters and least dimension.",cons:"Bars buckle and the core loses confinement before the design load is reached.",look:"ACI 318-19 25.7.2.1 and, in seismic regions, 18.7.5.",ask:"The seismic design category, which decides whether Chapter 18 applies."}],
  beam:[
    {sev:"life",ref:"25.5.2.1",err:"Class A lap used where Class B is required (As provided less than twice As required, or more than half the bars spliced).",cons:"Lap splices fail in a brittle manner at the most stressed section.",look:"ACI 318-19 Table 25.5.2.1; As provided and required at the splice location; the percentage spliced.",ask:"The flexural design output at the splice location."},
    {sev:"life",ref:"25.4.2.5",err:"Development length computed without ψt for top bars, ψe for epoxy coating or ψg for Grade 80 bars.",cons:"Bars are anchored short and can pull out before yielding.",look:"ACI 318-19 Table 25.4.2.5; bar grade, coating and casting position from the general notes.",ask:"The reinforcement specification (grade, coating) if the notes do not state it."},
    {sev:"life",ref:"18.6.5.2",err:"Design shear of a special moment frame beam taken from the analysis, or Vc kept although the earthquake shear is at least half of the maximum shear in the hinge zone.",cons:"Too few hoops at the beam ends; the beam fails in shear before it yields in flexure.",look:"ACI 318-19 18.6.5.1 and 18.6.5.2; Mpr at both ends with 1.25 fy of the bar grade actually used; the gravity shear at each end, which differs when the loads are not symmetric.",ask:"Bar grade, beam reinforcement at both column faces and the gravity loads on the span."},
    {sev:"life",ref:"18.6.4.4",err:"Hinge-zone hoop spacing limited to 6db, the Grade 60 value, for Grade 80 longitudinal bars that need 5db.",cons:"Grade 80 bars buckle at lower strain; the hinge loses strength earlier under cyclic loading.",look:"ACI 318-19 18.6.4.4(b) and (c); the bar grade in the general notes.",ask:"The reinforcement grade of the beam bars."},
    {sev:"life",ref:"22.5.5.1",err:"One-way shear checked with the old 2√f'c expression, without λs and ρw, for a beam with less than minimum stirrups.",cons:"Shear strength is overestimated for deep, lightly reinforced beams.",look:"ACI 318-19 Table 22.5.5.1 and 9.6.3.1.",ask:"The beam size, ρw and stirrup layout."}],
  oneway:[
    {sev:"money",ref:"7.6.1.1",err:"Grade 80 minimum steel taken as 0.0014Ag. That is the ACI 318-14 rule; ACI 318-19 requires 0.0018Ag for any fy.",cons:"The slab is under-reinforced against shrinkage and temperature: wide cracks, corrosion, leaks and repair costs. The 'saving' in the bid disappears.",look:"ACI 318-19 7.6.1.1, 24.4.3.2 and Commentary R24.4.3.2; the edition named in the general notes.",ask:"The general notes sheet (edition of record) and the code text, if either is missing."},
    {sev:"money",ref:"24.3.2",err:"Bar spacing scaled by 80/60 without rechecking crack control at the higher service stress.",cons:"Crack widths exceed what the code intends; durability claims and remedial work follow.",look:"ACI 318-19 24.3.2 and 24.3.2.1 (fs = 2/3 fy or calculated); clear cover from the notes.",ask:"Service loads and clear cover, if not on the drawings."},
    {sev:"life",ref:"25.4.2.5",err:"Grade 60 lap lengths kept for Grade 80 bars; ψg = 1.15 is new in ACI 318-19.",cons:"Laps are about a third too short and can fail before the bars yield.",look:"ACI 318-19 Table 25.4.2.5 and 25.5.2.1; the lap schedule on the general notes.",ask:"The lap schedule basis (grade, cover, spacing) if the schedule is not stated."},
    {sev:"money",ref:"7.3.1.1.1",err:"The minimum-thickness exemption is kept after a grade change; the table value is multiplied by (0.4 + fy/100,000).",cons:"Excess deflection cracks partitions and finishes; floors may need remedial stiffening.",look:"ACI 318-19 7.3.1.1.1, 7.3.2 and 24.2; deflection limits in the general notes.",ask:"Whether the floor supports partitions likely to be damaged (sets L/480 or L/240)."}],
  flat:[
    {sev:"life",ref:"22.6.5.2",err:"Punching shear checked without the size-effect factor λs in a thick transfer slab.",cons:"Punching capacity is overestimated. A punching failure can spread to neighbouring columns and cause progressive collapse.",look:"ACI 318-19 Table 22.6.5.2 and 22.6.5.1.",ask:"Slab depth d and whether shear reinforcement is provided."},
    {sev:"life",ref:"8.4.4.2",err:"Edge or corner column checked with a four-sided critical section, or without the moment transferred by eccentric shear (γv).",cons:"The governing shear stress at the slab edge is underestimated.",look:"ACI 318-19 22.6.4, 8.4.4.2 and 8.4.4.2.3; the unbalanced moment from the analysis.",ask:"Unbalanced moments at the column from the analysis model."},
    {sev:"life",ref:"22.6.4.3",err:"Openings within 4h of the column are not deducted from the critical perimeter b0.",cons:"Shear capacity is overestimated right where MEP penetrations cluster.",look:"ACI 318-19 22.6.4.3; the MEP penetration drawings.",ask:"Coordinated MEP or sleeve drawings for the slab."},
    {sev:"life",ref:"8.7.4.2",err:"Integrity bottom bars through the column are left out or not continuous.",cons:"After a local punching failure the slab cannot hang from the column; progressive collapse.",look:"ACI 318-19 8.7.4.2.",ask:"The bottom reinforcement plan at columns."}],
  joint:[
    {sev:"life",ref:"25.4.3",err:"Hooked-bar development computed with the ACI 318-14 expression. ACI 318-19 uses a new equation with ψp, ψc, ψr and db^1.5.",cons:"Large-diameter hooked bars are anchored short and can pull out of an exterior joint.",look:"ACI 318-19 25.4.3.1 and Table 25.4.3.2; the edition of record.",ask:"The general notes (edition) and the column and beam dimensions at the joint."},
    {sev:"life",ref:"18.4.4.7",err:"An intermediate moment frame joint checked with forces from the analysis and the Chapter 15 table, as for a non-seismic joint. The joint with the largest analysis moments is taken as governing.",cons:"Joint demand set by beam strength is missed. Where the columns get smaller and the beams stay the same, the joint fails in shear before the beams yield.",look:"ACI 318-19 18.4.4.7.2 (Vu from beam Mn, 18.3.4), 18.4.4.7.4 and Table 18.8.4.3; check the joint with the smallest column in each beam band.",ask:"The frame beam schedule and the column schedule for every level band."},
    {sev:"life",ref:"18.8",err:"A special moment frame joint is detailed with Chapter 15 rules only.",cons:"Joint shear and anchorage fail under cyclic seismic loading.",look:"ACI 318-19 18.8.2 to 18.8.5; the seismic design category and frame type.",ask:"Seismic design category and the lateral system designation."}],
  wall:[
    {sev:"life",ref:"18.10.3.1",err:"Wall shear taken from the analysis with a fixed overstrength of 1.5, or with no amplification. ACI 318-19 uses Ve = Ωv ωv Vu, with Ωv the greater of Mpr/Mu and 1.5, capped at 3Vu.",cons:"Design shear is underestimated; the wall can fail in shear before it yields in flexure.",look:"ACI 318-19 18.10.3.1, Table 18.10.3.1.2 and 18.10.3.1.3; the probable moment strength Mpr at the critical section.",ask:"The section analysis giving Mpr at the critical section, and the wall height and story count."},
    {sev:"life",ref:"18.10.6.2(b)",err:"Special boundary elements checked for their height only. The wall thickness and drift-capacity checks, (ii) or (iii), are skipped.",cons:"A thin wall boundary buckles or crushes at the base under the design displacement, as seen in recent earthquakes.",look:"ACI 318-19 18.10.6.2(a) and (b), with the largest neutral axis depth c and the total design displacement δu.",ask:"Design displacement δu at the top of the wall and the neutral axis depth c."},
    {sev:"life",ref:"18.10.2.3(c)",err:"Boundary bars lapped on the foundation dowels right at the wall base. The lap length is checked, but the location is not.",cons:"Lap splices fail at the plastic hinge; the wall loses its flexural strength at the base.",look:"ACI 318-19 18.10.2.3(c) (no laps within boundary regions over hsx above and ℓd below the critical section) and 18.2.7.2 (Type 2 mechanical splices).",ask:"The wall elevation and boundary details at the base."},
    {sev:"life",ref:"ASCE 7 12.10.2.1",err:"Collector force taken as the overstrength factor times the story force only, or capped by an upper limit that ASCE 7-10 allowed and ASCE 7-16 removed. The force is the largest of three cases, one of them Ω0 times the diaphragm design force.",cons:"Collector bars are undersized; the floor separates from the walls before the walls reach their strength.",look:"ASCE 7-16 12.10.2.1 and Eq. 12.10-1; the diaphragm force at each level and the collector length.",ask:"Diaphragm forces per level, the collector layout and the share of force each collector carries."},
    {sev:"life",ref:"25.4.10.2(e)",err:"Collector lap lengths reduced by the ratio of required to provided steel.",cons:"Laps are too short to develop the bars; the splice fails before the collector yields.",look:"ACI 318-19 25.4.10.2 (no reduction in seismic-force-resisting systems of SDC C to F) and 25.5.2.",ask:"The lap schedule and the bar stress assumed at the splice."},
    {sev:"life",ref:"18.12.7.7",err:"Collector bars spliced with contact laps, thin cover and no ties, although the collector is designed with Ω0.",cons:"Bars buckle or the splice splits out under cyclic load; the load path to the wall is lost.",look:"ACI 318-19 18.12.7.6 and 18.12.7.7: bar spacing 3db, cover 2.5db and at least 2 in., or the minimum transverse reinforcement.",ask:"Collector sections through the lap zone, with cover, bar spacing and ties shown."},
    {sev:"money",ref:"11.6",err:"Minimum wall steel taken from a remembered ratio without checking bar size and fy.",cons:"Shrinkage cracking in exposed walls; repair and waterproofing costs.",look:"ACI 318-19 Table 11.6.1.",ask:"Wall bar sizes and grade."}],
  construction:[
    {sev:"both",ref:"26.12.3",err:"Concrete accepted on one test criterion only. Both the running average of three tests and the individual-test limit must be met.",cons:"Under-strength concrete stays in place, or sound concrete is rejected and cored at the owner's cost.",look:"ACI 318-19 26.12.3.1 and 26.12.6; the test reports.",ask:"The full strength-test report series, not a summary."},
    {sev:"life",ref:"ACI 347.2R",err:"Shores removed or reshores sized from a rule of thumb, without the load share of the floors below.",cons:"Young slabs are overloaded during construction; cracking or collapse of the work.",look:"ACI 347.2R load-distribution method; concrete strength at stripping; construction schedule.",ask:"The construction cycle, shoring layout and early-age strength data."},
    {sev:"money",ref:"ACI 306R",err:"Cold-weather protection skipped because the average forecast is above freezing.",cons:"Concrete freezes before reaching 500 psi; removal and replacement.",look:"ACI 306R and the project specification for protection periods.",ask:"Placement dates, forecasts and the specification section for cold weather."},
    {sev:"life",ref:"ACI 117",err:"Rebar inspection accepts top bars low by more than the depth tolerance, because cover looks fine.",cons:"Effective depth drops; cantilevers and negative-moment regions lose strength.",look:"ACI 117-10 2.2 (placement tolerances) and the slab section on the drawings.",ask:"Measured bar positions from the pre-pour inspection."},
    {sev:"life",ref:"26.6.3",err:"Partially embedded bars field-bent or straightened without engineer approval.",cons:"Bars crack at the bend and lose strength.",look:"ACI 318-19 26.6.3.1 and ACI 301 Section 3.",ask:"The RFI or approval for field bending, and bar grade."},
    {sev:"both",ref:"26.5.6",err:"Construction joints placed where convenient for the pour, not where the drawings or the engineer allow.",cons:"Weak planes at high shear; leaks and repair.",look:"ACI 318-19 26.5.6 and the pour-break drawing.",ask:"The approved pour sequence and joint locations."}],
  seismic:[
    {sev:"life",ref:"ASCE 7 11.4.3",err:"Site class assumed (often D) without a geotechnical report, or a default value used where ASCE 7-16 requires more.",cons:"Design spectral accelerations, and so all seismic forces, can be badly underestimated.",look:"ASCE 7-16 11.4.2 and 11.4.3; the geotechnical report; the seismic parameters on the general notes.",ask:"The geotechnical report with site class, or the stated SDS and SD1."},
    {sev:"life",ref:"ACI 6.6.3.1.1",err:"The analysis model uses gross section stiffness for all members.",cons:"Periods are too short and drifts too small; P-delta and pounding risks are hidden.",look:"ACI 318-19 Table 6.6.3.1.1 (0.70Ig columns, 0.35Ig beams and cracked walls); the model's property modifiers.",ask:"The analysis model or its property-modifier table."},
    {sev:"life",ref:"ASCE 7 12.9.1.4",err:"Modal response spectrum results scaled to 85 % of the ELF base shear, as in older editions. ASCE 7-16 requires 100 %.",cons:"Member forces are about 15 % low across the lateral system.",look:"ASCE 7-16 12.9.1.4.1; the base shear table of the analysis.",ask:"The edition of ASCE 7 adopted by the jurisdiction and the analysis base shear output."},
    {sev:"life",ref:"ASCE 7 12.3.4.2",err:"Redundancy factor ρ taken as 1.0 for a moment frame with a single bay in one direction, and the moment-frame drift limit not divided by ρ.",cons:"Seismic member forces miss the 1.3 factor, and drift checks pass that should fail.",look:"ASCE 7-16 12.3.4.2 and 12.12.1.1; the frame layout in each direction.",ask:"The framing plans and the ρ value used in each direction."},
    {sev:"life",ref:"ASCE 7 12.8.6",err:"Story drift read straight from the elastic analysis, without Cd/Ie.",cons:"Real drift is several times larger; damage to cladding and stairs, instability.",look:"ASCE 7-16 12.8.6 and Table 12.12-1.",ask:"Risk category and the R, Cd and Ω0 values used."}],
  rmat:[
    {sev:"both",ref:"ACI 336.2R",err:"The mat is analysed as rigid, or with an assumed subgrade modulus.",cons:"Moments and soil pressures are distributed wrongly; cracking under the core or local bearing failure.",look:"ACI 336.2R and the geotechnical report.",ask:"The geotechnical report with modulus of subgrade reaction or settlement data."},
    {sev:"life",ref:"22.6.5.2",err:"Punching at heavy columns and wall ends in the mat checked without λs.",cons:"Two-way shear capacity overestimated in a deep member.",look:"ACI 318-19 Table 22.6.5.2.",ask:"Mat depth and column reactions."},
    {sev:"money",ref:"ACI 301 Sec. 8",err:"A thick mat poured with a standard mix and no thermal control plan.",cons:"Early thermal cracking through the mat; durability and water-tightness problems.",look:"ACI 301-20 Section 8 (mass concrete) and ACI 207.1R.",ask:"The mix design, pour thickness and the contractor's thermal control plan."}],
  rslab:[
    {sev:"money",ref:"Table 8.3.1.1",err:"Flat plate thickness taken as ln/33 for an exterior panel without edge beams, where ln/30 applies.",cons:"Excess deflection; cracked partitions and doors that stick.",look:"ACI 318-19 Table 8.3.1.1 and 8.3.2.",ask:"Clear spans, edge conditions and partition type."},
    {sev:"money",ref:"24.2.3",err:"Long-term deflection estimated without the effect of early construction loading on a young slab.",cons:"Sag far beyond the calculation; tile and partition damage, remedial work.",look:"ACI 318-19 24.2.3 and 24.2.4; the shoring and reshoring schedule.",ask:"The construction cycle and stripping schedule."},
    {sev:"life",ref:"8.10.2",err:"Direct design method used outside its limits (unequal spans, offset columns, high live load ratio).",cons:"Moment distribution is wrong; parts of the slab are under-reinforced.",look:"ACI 318-19 8.10.2.1 to 8.10.2.7.",ask:"The column grid and the loads used."}],
  rshear:[
    {sev:"life",ref:"18.10.1",err:"A short wall segment between openings designed as a wall when it should be detailed as a wall pier or column.",cons:"Shear failure of the pier under earthquake loading.",look:"ACI 318-19 18.10.8 and the lw/bw and hw/lw ratios.",ask:"Wall elevations with openings."},
    {sev:"life",ref:"18.10.7",err:"Coupling beams with short spans detailed with ordinary bars instead of diagonal reinforcement.",cons:"Brittle shear failure of the coupling beams; the coupled wall loses most of its stiffness.",look:"ACI 318-19 18.10.7.2 to 18.10.7.4; ln/h and the shear stress.",ask:"Coupling beam sizes and shear demands."},
    {sev:"life",ref:"18.12",err:"Diaphragm collectors to the core not designed, or designed without the overstrength factor Ω0.",cons:"Floor slabs tear away from the walls in an earthquake.",look:"ACI 318-19 18.12.7 and ASCE 7-16 12.10.2.1.",ask:"Diaphragm force output and collector layout."}],
  rcant:[
    {sev:"life",ref:"ASCE 7 Table 4.3-1",err:"Balconies designed for the apartment live load of 40 psf. ASCE 7-16 requires 1.5 times the occupancy load, up to 100 psf.",cons:"Under-designed cantilevers; balcony collapse under a crowd.",look:"ASCE 7-16 Table 4.3-1 (balconies and decks).",ask:"The occupancy and the edition of ASCE 7 adopted."},
    {sev:"life",ref:"25.4",err:"Cantilever top bars stopped short in the back span, or detailed without the top-bar factor ψt.",cons:"Bars pull out and the cantilever fails suddenly at the support.",look:"ACI 318-19 25.4.2 and Table 25.4.2.5; the back-span reinforcement.",ask:"The balcony section and back-span bar layout."},
    {sev:"life",ref:"ACI 117",err:"Top bars of a cantilever allowed to sag during the pour.",cons:"Effective depth lost where it matters most; cracking or collapse of the balcony.",look:"ACI 117-10 placement tolerance; chair and bolster details; pre-pour inspection.",ask:"The pre-pour inspection record for the balconies."},
    {sev:"life",ref:"Stairs",err:"Stairs tied rigidly into floors without considering their effect on the frame.",cons:"Stairs act as diagonal struts in an earthquake and fail, cutting off escape.",look:"ASCE 7-16 13.5.10 (egress stairs) and the stair connection details.",ask:"Stair connection details and the drift at each level."}],
  park:[
    {sev:"money",ref:"Table 19.3.2.1",err:"Exposure classes F3 and C2 not assigned for a deck exposed to deicing salts, so w/cm, air content and cover are too relaxed.",cons:"Freeze-thaw scaling, chloride corrosion and spalling; large repair costs within a few years.",look:"ACI 318-19 Table 19.3.1.1, 19.3.2.1 and 20.5.1.3; project location.",ask:"The site climate and whether deicing chemicals will be used."},
    {sev:"life",ref:"ASCE 7 4.5.3",err:"Perimeter walls or barriers at ramp ends designed for wind only, without the 6,000 lb vehicle barrier load.",cons:"A car breaks through the barrier and falls to the street below.",look:"ASCE 7-16 4.5.3 and IBC 406.4.3; barrier height and the load application zone.",ask:"Barrier details and their connection to the deck."},
    {sev:"life",ref:"ASCE 7 4.10",err:"Decks checked for the 40 psf uniform garage load only, without the concentrated wheel load.",cons:"Local punching or flexural failure of thin deck panels under a heavy vehicle.",look:"ASCE 7-16 Table 4.3-1 and 4.10.1.",ask:"The vehicle class the garage is designed for."},
    {sev:"money",ref:"24.4",err:"Long decks without expansion joints, with restraint from stiff walls or cores ignored.",cons:"Through-cracks, leaks onto cars below, corrosion of reinforcement.",look:"ACI 318-19 24.4 and R5.3.6; ACI 362.1R joint spacing guidance; deck plan and wall locations.",ask:"The full deck plan with joint locations and wall positions."}],
  wall2:[
    {sev:"life",ref:"Geotech",err:"Soil friction angle, unit weight and surcharge assumed instead of taken from the report.",cons:"The wall slides or overturns; failure is often sudden after heavy rain.",look:"The geotechnical report; ASCE 7-16 3.2 for lateral soil load.",ask:"The geotechnical report and the drainage design."},
    {sev:"both",ref:"Drainage",err:"Hydrostatic pressure omitted on the assumption that drains will work.",cons:"Blocked drains double the load on the stem; cracking or collapse.",look:"Drainage details and the design assumption stated in the report.",ask:"Drainage details, or confirmation that the wall is designed for full water pressure."},
    {sev:"both",ref:"At-rest",err:"Basement walls braced by floor slabs designed with active pressure Ka, as if the wall could rotate.",cons:"Walls restrained at the top see at-rest pressure; flexural cracking and leaks, or failure.",look:"Geotechnical report (K0 and Ka values); support conditions from the slab framing.",ask:"The geotechnical report and the sequence in which floors are built against the wall."},
    {sev:"life",ref:"Buoyancy",err:"Basement slab checked for gravity loads only, with the design groundwater level ignored.",cons:"Uplift cracks or lifts the slab; flooding of the basement.",look:"Design groundwater level in the geotechnical report; ASCE 7-16 3.2.2.",ask:"Design groundwater level and any dewatering assumptions."},
    {sev:"life",ref:"Shoring",err:"Excavation next to an existing building approved without checking its footings or underpinning.",cons:"Settlement or collapse of the neighbouring structure.",look:"IBC 2021 3307 protection of adjoining property; shoring design; survey of adjacent foundations.",ask:"Survey of adjacent foundations and the shoring design submittal."}],
  bridge:[
    {sev:"life",ref:"MBE 6A",err:"An existing bridge checked with design provisions only, without the condition factor φc and system factor φs of the Manual for Bridge Evaluation.",cons:"Load rating is overstated for a deteriorated bridge; overweight trucks are allowed onto it.",look:"AASHTO MBE Section 6, Part A (LRFR).",ask:"The latest inspection report with condition ratings and the MBE edition required by the owner."},
    {sev:"life",ref:"MBE 4",err:"Section loss and broken strands from the inspection report not carried into the girder capacity.",cons:"Capacity is overestimated where corrosion is worst.",look:"Inspection report element data; AASHTO LRFD Section 5 with reduced areas.",ask:"Element-level inspection data and photographs of the damaged girders."},
    {sev:"both",ref:"Modal",err:"A drop in natural frequency read as damage without correcting for temperature and other environmental effects.",cons:"False alarms close a sound bridge, or real damage is masked by seasonal changes.",look:"Baseline modal data, temperature records and the measurement method.",ask:"Baseline modal measurements and temperature at each test."},
    {sev:"both",ref:"ACI 228.1R",err:"Rebound hammer or pulse velocity readings converted to strength with a generic curve.",cons:"In-place strength is wrong by a large margin; unsafe rating or unnecessary repair.",look:"ACI 228.1R-19 correlation requirements; cores from the same structure.",ask:"Core test results to correlate with the nondestructive readings."}],
};
const SEVTXT={life:"Life safety",money:"Financial",both:"Life safety and financial"};
const sevRank=s=>s==='life'||s==='both'?2:s==='money'?1:0;
const partSev=k=>{const L=TRAPS[k]||[];const r=Math.max(0,...L.map(t=>sevRank(t.sev)));return r===2?'life':r===1?'money':'none'};
let mode='status';

const STRUCTURES = {
  bldg:{name:"Commercial and office building",status:"prog",phase:"Structure type 1 · checks written",
    lede:"Cast-in-place office floors over a commercial podium with a transfer slab, the kind of project built in practice. Every critical member and construction stage gets its own checks.",
    codes:["ACI 318-19","ASCE 7-16","IBC 2021","ACI 301-20","ACI 117-10","ACI 347"],
    parts:["footing","column","beam","oneway","flat","joint","wall","seismic","construction"],
    cam:[46,34,52], target:[0,9,0]},
  res:{name:"Residential tower",status:"plan",phase:"Structure type 2 · planned",
    lede:"Mid-rise apartment building on a mat: flat-plate floors, shear-wall core, balconies and stairs. Slab deflection, wall detailing and seismic analysis carry most of the risk.",
    codes:["ACI 318-19","ASCE 7-16","IBC 2021"],
    parts:["rmat","column","rslab","rshear","rcant","seismic","construction"],
    cam:[98,52,-84], target:[36,12,-26]},
  park:{name:"Public parking structure",status:"plan",phase:"Structure type 3 · planned",
    lede:"Multi-level cast-in-place garage with ramps, open to weather and deicing salts. Durability, vehicle barriers and restraint cracking drive most failures.",
    codes:["ACI 318-19 Ch. 19, 20, 24","ASCE 7-16 Ch. 4","ACI 362.1R","IBC 2021 406"],
    checks:[["Table 19.3.1.1","Exposure classes F, S, C and the w/cm, air and strength limits they set"],["20.5.1.3","Cover for exposed decks"],["ASCE 7 4.5.3","Vehicle barrier loads"],["ASCE 7 4.10","Concentrated vehicle loads"],["24.4","Restraint from shrinkage and temperature on long decks"],["","Ramps, drainage slopes, expansion joints"]],
    cam:[-62,32,-48], target:[-34,4,-26]},
  wall:{name:"Foundations, basements and retaining walls",status:"plan",phase:"Structure type 4 · planned",
    lede:"Site work under and around the buildings: basement walls, mats, retaining walls and excavation support. Site supervision of foundation work is part of this set.",
    codes:["ACI 318-19 Ch. 11, 13","ASCE 7-16 Ch. 3","IBC 2021 Ch. 18"],
    checks:[["13.3","Footing and mat bearing, one-way and two-way shear"],["ASCE 7 3.2","Lateral soil loads and hydrostatic pressure"],["IBC 1807","Foundation and retaining walls"],["","Overturning and sliding stability, key design"],["","Buoyancy of basement slabs"],["","Excavation shoring next to existing buildings"]],
    cam:[-62,26,52], target:[-34,3,28]},
  bridge:{name:"Bridge condition assessment",status:"plan",phase:"Structure type 5 · planned",
    lede:"Existing concrete girder bridge: inspection findings, load rating and vibration-based damage detection, the area of the MSc research.",
    codes:["AASHTO MBE","AASHTO LRFD BDS 9th ed.","ACI 228.1R-19","ACI 228.2R"],
    checks:[["MBE Sec. 6","Load rating (LRFR) with condition and system factors"],["MBE Sec. 4","Inspection findings into member capacity"],["ACI 228.1R","In-place strength from nondestructive tests"],["","Damage detection from modal data and environmental effects"],["LRFD Sec. 5","Capacity of deteriorated prestressed girders"]],
    cam:[62,26,58], target:[34,4,32]}
};

const PARTS = {
  footing:{name:"Footings and mat",status:"done",codes:["ACI 318-19 Ch. 13","Ch. 16","Ch. 22","ASCE 7-16 Ch. 27"],
    checks:[["13.3.1.1","Footing area sized for service loads and allowable bearing"],["13.2.7.2","One-way and two-way shear in footings"],["16.3.4.1","Minimum dowel area at column-to-footing interface"],["25.4","Development of column bars into the footing"],["Table 22.5.5.1","One-way shear without stirrups: row choice, ρw and λs"],["13.2.6.2","Size-effect waiver for foundations and its conditions"],["10.7.5.2","Compression laps at the column base only where bars stay in compression"]],
    plan:["Spread footings: two-way shear and dowels","Pile caps (strut-and-tie)","Mat thermal control and pour joints"],scen:["s10","s11"]},
  column:{name:"Columns",status:"done",codes:["ACI 318-19 Ch. 10","Ch. 6","Ch. 22"],
    checks:[["10.6.1.1","Longitudinal reinforcement ratio 0.01 to 0.08"],["6.6.4","Slenderness and moment magnification"],["22.4","Axial and combined axial-flexural strength"],["25.7.2","Tie size and spacing"],["10.7.5","Column lap splices"],["18.7.5.2(f)","Crosstie support of every bar in special moment frame columns with high axial load"]],
    plan:["Second-order effects and slenderness","Mechanical splices and bundled bars","Strong-column / weak-beam (seismic phase)"],scen:["s5"]},
  beam:{name:"Beams and girders",status:"done",codes:["ACI 318-19 Ch. 9","Ch. 22","Ch. 24","Ch. 25"],
    checks:[["Table 22.5.5.1","One-way shear with size effect and longitudinal ratio"],["24.2.3.5","Effective moment of inertia for deflection"],["9.7.6.2.2","Stirrup spacing limits"],["25.5.2","Tension lap splice Class A / B"],["22.7","Torsion"],["18.6.5","Special moment frame beam design shear from Mpr, Vc = 0 when it applies"],["18.6.4.4","Hinge-zone hoop spacing, 5db for Grade 80 bars"]],
    plan:["One-way shear with size effect","Deflection and long-term multiplier","Torsion in spandrels","Transfer girders"],scen:["s1","s9"]},
  oneway:{name:"One-way slabs",status:"done",codes:["ACI 318-19 Ch. 7","Ch. 24"],
    checks:[["7.6.1.1","Minimum flexural reinforcement"],["24.4.3.2","Shrinkage and temperature reinforcement"],["24.3.2","Spacing for crack control"],["7.3.1.1","Minimum thickness without deflection calculation"],["7.7.2.3","Maximum bar spacing"]],
    plan:["Cover vs exposure class","Openings and penetrations through slabs"],scen:["s4"]},
  flat:{name:"Transfer slab / flat plate",status:"done",codes:["ACI 318-19 Ch. 8","Ch. 22"],
    checks:[["22.6.5","Two-way shear strength with size effect"],["8.4.4.2","Moment transfer by eccentric shear"],["22.6.4.3","Openings near the critical section"],["22.6.8","Headed shear stud reinforcement"],["8.7.4.2","Structural integrity reinforcement"]],
    plan:["Column and middle strips","Structural integrity steel","Post-tensioned flat plates"],scen:["s3"]},
  joint:{name:"Beam-column joints",status:"done",codes:["ACI 318-19 Ch. 15","Ch. 18","Ch. 25"],
    checks:[["25.4.3","Standard hook development length and its factors"],["15.4","Joint detailing and shear"],["18.4.4.7","Intermediate moment frame joints: Vu from beam Mn, Vn per Table 18.8.4.3"],["18.8","Joints of special moment frames"]],
    plan:["Special moment frame joints (seismic phase)","Headed bars in joints"],scen:["s2","s12"]},
  wall:{name:"Structural walls and core",status:"done",codes:["ACI 318-19 Ch. 11","Ch. 12","Ch. 18"],
    checks:[["11.5.3","Simplified design method limits"],["11.6","Minimum wall reinforcement"],["18.10.3.1","Shear amplification Ve = Ωv ωv Vu in special walls"],["18.10.6.2","Boundary elements: need, height, thickness and drift capacity"],["18.10.2.3(c)","No lap splices in boundary regions at the critical section"],["ASCE 7 12.10.2.1","Collector force with Ω0, largest of three cases"],["25.4.10.2(e)","No As,req/As,prov reduction of laps in seismic systems"],["18.12.7.7","Collector splice-zone spacing, cover or ties"]],
    plan:["Coupling beams","Diaphragm chords and shear transfer","Gravity columns deformation compatibility (18.14)","Walls with openings and flanged sections"],scen:["s7","s8"]},
  seismic:{name:"Lateral system and seismic analysis",status:"done",codes:["ASCE 7-16 Ch. 11, 12","ACI 318-19 6.6.3, Ch. 18"],
    checks:[["ASCE 7 11.4","Site class and design spectral accelerations"],["ASCE 7 12.8.6","Story drift with Cd and Ie"],["ASCE 7 12.9.1.4","Scaling of modal results to ELF base shear"],["ACI 6.6.3.1.1","Cracked-section stiffness in the analysis model"],["ASCE 7 12.8.4","Accidental torsion and its amplification"],["ASCE 7 12.3.4","Redundancy factor ρ and the drift limit Δa/ρ"]],
    plan:["Drift and P-delta","Horizontal and vertical irregularities","Diaphragm forces"],scen:["s6"]},
  rmat:{name:"Mat foundation",status:"plan",codes:["ACI 318-19 Ch. 13","ACI 336.2R","ACI 301 mass concrete"],
    checks:[["13.3.4","Mats and combined footings"],["22.6.5.2","Two-way shear at heavy columns and wall ends"],["ACI 336.2R","Subgrade modulus and mat flexibility"],["ACI 301 Sec. 8","Thermal control of thick pours"]],
    plan:["Mat under the core","Pour sequence and joints","Thermal control plan review"],scen:[]},
  rslab:{name:"Two-way flat slabs",status:"plan",codes:["ACI 318-19 Ch. 8","Ch. 24"],
    checks:[["Table 8.3.1.1","Minimum thickness of slabs without interior beams"],["8.10.2","Limits of the direct design method"],["24.2.3","Long-term deflection"],["8.6.1","Minimum flexural reinforcement"],["8.7.4.2","Structural integrity reinforcement"]],
    plan:["Deflection with early construction loading","Column and middle strip moments","Slab edges at balconies"],scen:[]},
  rshear:{name:"Shear walls and coupling beams",status:"plan",codes:["ACI 318-19 Ch. 11","Ch. 18"],
    checks:[["18.10.1","Wall versus wall pier versus column"],["18.10.7","Coupling beams"],["18.12","Diaphragms and collectors"],["18.10.6","Boundary elements"]],
    plan:["Coupling beam diagonal bars","Openings in walls","Collector forces into the core"],scen:[]},
  rcant:{name:"Balconies and stairs",status:"plan",codes:["ACI 318-19 Ch. 7, 25","ASCE 7-16 Table 4.3-1","ACI 117-10"],
    checks:[["ASCE 7 Table 4.3-1","Balcony live load"],["25.4","Anchorage of cantilever top bars into the back span"],["ACI 117","Placement tolerance of top bars"],["","Stair-to-floor connections and seismic interaction"]],
    plan:["Cantilever balconies","Stair flights and landings","Long-term cantilever deflection"],scen:[]},
  construction:{name:"Construction and QA",status:"plan",codes:["ACI 318-19 Ch. 26","ACI 301-20","ACI 347.2R","ACI 305R / 306R","ACI 228.1R"],
    checks:[["26.12.3","Strength acceptance of standard cylinders"],["26.12.6","Investigation of low-strength results, cores"],["26.11.2","Formwork removal"],["ACI 347.2R","Shoring and reshoring of multistory buildings"],["ACI 306R","Cold-weather protection"]],
    plan:["Early-age loading and reshoring","Hot and cold weather","Rebar substitution and field bending","Post-installed anchors (Ch. 17)","Repairs (ACI 562)"],scen:[]}
};

/* ---------------- Panel rendering ---------------- */
const panel=document.getElementById('panel');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pill=s=>`<span class="pill ${s}">${s==='done'?'Checks written':s==='prog'?'In progress':'Planned'}</span>`;
let current={s:'bldg',p:null};

function header(){
  const parts=Object.keys(PARTS).length, cards=Object.values(TRAPS).reduce((n,l)=>n+l.length,0), sc=Object.keys(SCENARIOS).length;
  const chips=Object.entries(STRUCTURES).map(([k,v])=>`<button class="chip" data-s="${k}" aria-pressed="${k===current.s}"><i class="sw" style="background:var(--${v.status})"></i>${esc(v.name)}</button>`).join('');
  return `<div class="eyebrow">The check library</div>
  <div class="stats" style="margin-top:4px"><span><b>${Object.keys(STRUCTURES).length}</b> structure types</span><span><b>${parts}</b> member groups</span><span><b>${cards}</b> failure cards</span><span><b>${sc}</b> review scenarios</span></div>
  <div class="chips">${chips}</div>
  <div class="mode" role="group" aria-label="Color the model by"><button data-mode="status" aria-pressed="${mode==='status'}">Coverage</button><button data-mode="risk" aria-pressed="${mode==='risk'}">AI error risk</button></div><hr>`;
}
const SKEY={park:'park',wall:'wall2',bridge:'bridge'};
function trapCards(list){
  if(!list||!list.length) return '';
  return list.map(x=>`<div class="trap ${x.sev==='both'?'life':x.sev}"><div class="th"><span class="sev">${esc(SEVTXT[x.sev])}</span><span class="ref">${esc(x.ref)}</span></div>
  <dl><dt>Error</dt><dd>${esc(x.err)}</dd><dt>Result</dt><dd>${esc(x.cons)}</dd><dt>Check</dt><dd>${esc(x.look)}</dd><dt>If missing</dt><dd class="ask">Ask the user for ${esc(x.ask.charAt(0).toLowerCase()+x.ask.slice(1))} Do not assume a value.</dd></dl></div>`).join('');
}
function protocolBox(){return `<div class="protocol"><div class="eyebrow">Execution supervisor · standing rules</div><ol>${PROTOCOL.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`}
function legend(){
  const L=document.getElementById('legend'); if(!L) return;
  L.innerHTML = mode==='status'
   ? `<span><i class="sw" style="background:var(--done)"></i>Checks written</span><span><i class="sw" style="background:var(--prog)"></i>In progress</span><span><i class="sw" style="background:var(--plan)"></i>Planned</span>`
   : `<span><i class="sw" style="background:var(--life)"></i>AI error can cost lives</span><span><i class="sw" style="background:var(--money)"></i>AI error costs money</span>`;
}
function checksList(rows){return `<ul class="checks">${rows.map(([r,t])=>`<li><span class="ref">${esc(r||'·')}</span><span>${esc(t)}</span></li>`).join('')}</ul>`}
function scenarioCards(ids){
  if(!ids.length) return `<p class="lede" style="color:var(--muted)">None written yet.</p>`;
  return ids.map(id=>{const t=SCENARIOS[id];return `<div class="task"><div class="t"><span>${esc(t.title)}</span></div><p>${esc(t.topic)}</p></div>`}).join('');
}
function render(){
  const S=STRUCTURES[current.s]; let h=header();
  if(current.p){
    const P=PARTS[current.p];
    h+=`<button class="back" data-back>← ${esc(S.name)}</button>
    <div class="eyebrow" style="margin-top:10px">Part</div><h2>${esc(P.name)}</h2>${pill(P.status)}
    <h3>Governing provisions</h3><div class="codes">${P.codes.map(c=>`<span class="code">${esc(c)}</span>`).join('')}</div>
    <h3>Critical checks</h3>${checksList(P.checks)}
    <h3>Where AI goes wrong</h3>${trapCards(TRAPS[current.p])}
    <h3>Review scenarios where a general AI model is likely to fail</h3>${scenarioCards(P.scen)}
    <h3>Planned topics</h3><ol class="plan">${P.plan.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`;
  } else {
    h+=`<div class="eyebrow">${esc(S.phase)}</div><h2>${esc(S.name)}</h2>${pill(S.status)}
    <p class="lede" style="margin-top:8px">${esc(S.lede)}</p>
    <h3>Codes</h3><div class="codes">${S.codes.map(c=>`<span class="code">${esc(c)}</span>`).join('')}</div>`;
    if(S.parts){
      h+=`<h3>How the supervisor works</h3>${protocolBox()}<h3>Parts · click one here or in the model</h3><div class="parts">${S.parts.map(k=>{const P=PARTS[k];return `<button class="part" data-p="${k}"><i class="sw" style="background:var(--${P.status})"></i><span class="n">${esc(P.name)}</span><span class="s">${(TRAPS[k]||[]).length} failure cards</span></button>`}).join('')}</div>`;
    } else {
      h+=`<h3>Critical checks to cover</h3>${checksList(S.checks)}<h3>Where AI goes wrong</h3>${trapCards(TRAPS[SKEY[current.s]])}<p class="note">Planned after the structure types before it.</p>`;
    }
  }
  h+=`<p class="note">Clause numbers refer to ACI 318-19 unless another standard is named. General engineering content from the public codes. These are the checks Tnega's review agent is being built to run; the agent is in development and not available yet.</p>`;
  panel.innerHTML=h; legend();
}
panel.addEventListener('click',e=>{
  const c=e.target.closest('[data-s]'), p=e.target.closest('[data-p]'), b=e.target.closest('[data-back]'), m=e.target.closest('[data-mode]');
  if(m){mode=m.dataset.mode; render(); applyTheme(); return}
  if(c){select(c.dataset.s,null,true)} else if(p){select(current.s,p.dataset.p,false)} else if(b){select(current.s,null,false)}
});

/* ---------------- 3D scene ---------------- */
let renderer,scene,camera,controls,pickables=[],matCache={},tween=null;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function init(){
  const canvas=document.getElementById('c');
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true})}catch(e){document.getElementById('fallback').hidden=false;return}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(38,1,0.5,600);
  camera.position.set(95,80,105);
  controls=new THREE.OrbitControls(camera,canvas);
  controls.enableDamping=true; controls.maxPolarAngle=Math.PI*0.47; controls.minDistance=12; controls.maxDistance=260;
  controls.target.set(0,4,6);
  scene.add(new THREE.HemisphereLight(0xffffff,0x888877,0.75));
  const sun=new THREE.DirectionalLight(0xffffff,0.8); sun.position.set(60,90,40); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:10,far:260});
  scene.add(sun);
  build(); applyTheme(); resize();
  addEventListener('resize',resize);
  new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
  setupPicking(canvas); loop();
}
function resize(){
  const r=renderer.domElement.parentElement.getBoundingClientRect();
  renderer.setSize(r.width,r.height,false); camera.aspect=r.width/Math.max(r.height,1); camera.updateProjectionMatrix();
}
function mat(key){ if(!matCache[key]) matCache[key]=new THREE.MeshStandardMaterial({roughness:.85,metalness:0}); return matCache[key]; }
function box(w,h,d,x,y,z,mkey,tag){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(mkey)); m.position.set(x,y+h/2,z);
  m.castShadow=true; m.receiveShadow=true; if(tag){m.userData=tag; pickables.push(m)} scene.add(m); return m;
}
function cyl(rt,rb,h,x,y,z,mkey,tag,seg=40,open=false){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg,1,open),mat(mkey)); m.position.set(x,y+h/2,z);
  m.castShadow=true; m.receiveShadow=true; if(tag){m.userData=tag; pickables.push(m)} scene.add(m); return m;
}
const T=(s,p)=>({s,p});

function build(){
  /* ground, roads, creek */
  const g=new THREE.Mesh(new THREE.PlaneGeometry(220,200),mat('ground')); g.rotation.x=-Math.PI/2; g.receiveShadow=true; scene.add(g);
  const road=(w,d,x,z)=>{const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat('road'));r.rotation.x=-Math.PI/2;r.position.set(x,0.02,z);r.receiveShadow=true;scene.add(r)};
  road(220,6,0,-10.5-6); road(7,200,-23,0); road(7,120,23,-40);
  const creek=new THREE.Mesh(new THREE.PlaneGeometry(10,90),mat('water')); creek.rotation.x=-Math.PI/2; creek.position.set(34,0.03,52); scene.add(creek);

  /* --- Mixed-use building (podium 36x30, tower 24x18) --- */
  const B=T('bldg');
  const px=[-18,-12,-6,0,6,12,18], pz=[-15,-9,-3,3,9,15];
  const tx=[-12,-6,0,6,12], tz=[-9,-3,3,9];
  const hP=3.6, nP=2, tTr=0.9, hT=3.0, nT=5;
  px.forEach(x=>pz.forEach(z=>box(2.4,0.45,2.4,x,0,z,'footing',{...B,p:'footing'})));
  for(let l=0;l<nP;l++){
    const y0=l*hP+(l?0.3:0.45);
    px.forEach(x=>pz.forEach(z=>box(0.8,hP-(l?0.3:0.45)-(l===nP-1?tTr:0.3),0.8,x,y0,z,'column',{...B,p:'column'})));
    if(l<nP-1) box(36.8,0.3,30.8,0,(l+1)*hP-0.3,0,'flat',{...B,p:'flat'});
  }
  const yTr=nP*hP-tTr; box(36.8,tTr,30.8,0,yTr,0,'flat',{...B,p:'flat'});
  const yTop=nP*hP;
  for(let l=0;l<nT;l++){
    const y0=yTop+l*hT, ySlab=y0+hT-0.25;
    tx.forEach(x=>tz.forEach(z=>box(0.7,hT-0.25-0.6,0.7,x,y0,z,'column',{...B,p:'column'})));
    tz.forEach(z=>box(24.5,0.6,0.5,0,ySlab-0.6,z,'beam',{...B,p:'beam'}));
    tx.forEach(x=>box(0.5,0.6,18.5,x,ySlab-0.6,0,'beam',{...B,p:'beam'}));
    tx.forEach(x=>tz.forEach(z=>box(0.95,0.85,0.95,x,ySlab-0.6,z,'joint',{...B,p:'joint'})));
    if(l<nT-1) box(24.8,0.25,18.8,0,ySlab,0,'oneway',{...B,p:'oneway'});
  }
  /* core walls through full height */
  const hCore=yTop+(nT-1)*hT+0.3;
  box(6,hCore,0.4,0,0.45,-3,'wall',{...B,p:'wall'}); box(6,hCore,0.4,0,0.45,3,'wall',{...B,p:'wall'});
  box(0.4,hCore,6,-3,0.45,0,'wall',{...B,p:'wall'}); box(0.4,hCore,6,3,0.45,0,'wall',{...B,p:'wall'});
  /* top level under construction: shores + crane */
  const yC=yTop+(nT-1)*hT;
  for(let x=-10.5;x<=10.5;x+=3) for(let z=-7.5;z<=7.5;z+=3){ if(Math.abs(x)<3.5&&Math.abs(z)<3.5) continue; cyl(0.07,0.07,hT-0.6,x,yC-hT+0.25,z,'construction',{...B,p:'construction'},6) }
  box(1.2,40,1.2,22,0,10,'construction',{...B,p:'construction'});
  box(30,0.9,0.9,14,40,10,'construction',{...B,p:'construction'});
  box(5,1.4,1.4,-2,39.6,10,'construction',{...B,p:'construction'});
  box(2,2,2,22,40.9,10,'construction',{...B,p:'construction'});

  /* --- Parking structure (ramped decks) --- */
  const Pk=T('park');
  for(let l=0;l<4;l++){ box(26,0.35,16,-34,l*2.8,-26,'park',Pk) }
  for(let x=-45;x<=-23;x+=5.5) for(let z=-32;z<=-20;z+=6) box(0.6,11.2,0.6,x,0,z,'park',Pk);
  const ramp=new THREE.Mesh(new THREE.BoxGeometry(22,0.3,5),mat('park')); ramp.position.set(-34,1.4,-36.5); ramp.rotation.z=Math.atan(2.8/22); ramp.castShadow=true; ramp.userData=Pk; pickables.push(ramp); scene.add(ramp);

  /* --- Residential tower on a mat (east lot) --- */
  const R=T('res'); const rx=[27,31.5,36,40.5,45], rz=[-32,-28,-24,-20], hR=3.0, nR=9;
  box(22,1.0,16,36,0,-26,'rmat',{...R,p:'rmat'});
  for(let l=0;l<nR;l++){
    const y0=1.0+l*hR;
    rx.forEach(x=>rz.forEach(z=>{ if(Math.abs(x-36)<3&&Math.abs(z+26)<3) return; box(0.6,hR-0.25,0.6,x,y0,z,'column',{...R,p:'column'}) }));
    box(20.6,0.25,14.6,36,y0+hR-0.25,-26,'rslab',{...R,p:'rslab'});
    [30,34,38,42].forEach(x=>box(3.2,0.18,1.7,x,y0+hR-0.22,-17.85,'rcant',{...R,p:'rcant'}));
  }
  const hW=nR*hR;
  box(5,hW,0.35,36,1.0,-28.4,'rshear',{...R,p:'rshear'}); box(5,hW,0.35,36,1.0,-23.6,'rshear',{...R,p:'rshear'});
  box(0.35,hW,4.4,33.6,1.0,-26,'rshear',{...R,p:'rshear'});
  box(0.35,hW*0.98,3.6,26.0,1.0,-30.2,'rshear',{...R,p:'rshear'}); box(0.35,hW*0.98,3.6,46.0,1.0,-30.2,'rshear',{...R,p:'rshear'});
  for(let l=0;l<nR;l++){ const st=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.2,4.6),mat('rcant')); st.position.set(47.6,1.0+l*hR+hR/2,-24); st.rotation.x=Math.atan(hR/4.2); st.castShadow=true; st.userData={...R,p:'rcant'}; pickables.push(st); scene.add(st) }

  /* --- Retaining wall with footing and backfill --- */
  const Rw=T('wall');
  box(30,0.8,6,-34,0,30,'rwall',Rw); box(30,6.5,0.8,-34,0.8,28.2,'rwall',Rw);
  const fill=new THREE.Mesh(new THREE.BoxGeometry(30,7,14),mat('ground')); fill.position.set(-34,3.5,36.2); fill.castShadow=true; fill.receiveShadow=true; scene.add(fill);

  /* --- Bridge over the creek --- */
  const Br=T('bridge');
  [24,44].forEach(x=>box(3,4.5,12,x,0,52,'bridge',Br));
  box(1.6,4.5,9,34,0,52,'bridge',Br);
  for(let z=48;z<=56;z+=2) box(24,1.1,0.6,34,4.5,z,'bridge',Br);
  box(26,0.5,12,34,5.6,52,'bridge',Br);
}

function applyTheme(){
  if(!renderer) return;
  const bg=new THREE.Color(css('--bg')); scene.background=bg; scene.fog=new THREE.Fog(bg,170,330);
  const st=k=>({done:css('--done'),prog:css('--prog'),plan:css('--concrete')}[k]);
  const rk=k=>css('--'+partSev(k));
  for(const [k,P] of Object.entries(PARTS)) if(matCache[k]) matCache[k].color.set(mode==='risk'?rk(k):st(P.status));
  for(const k of ['park','bridge']) if(matCache[k]) matCache[k].color.set(mode==='risk'?rk(k):css('--concrete'));
  if(matCache.rwall) matCache.rwall.color.set(mode==='risk'?rk('wall2'):css('--concrete'));
  matCache.ground.color.set(css('--ground')); matCache.road.color.set(css('--road')); matCache.water.color.set(css('--water'));
  highlight();
}

function highlight(){
  const sel=new THREE.Color(css('--sel'));
  for(const m of Object.values(matCache)) m.emissive&&m.emissive.set(0x000000);
  const key=current.p || ({park:'park',wall:'rwall',bridge:'bridge'}[current.s]);
  if(key&&matCache[key]){ matCache[key].emissive.copy(sel).multiplyScalar(.55) }
}

function setupPicking(canvas){
  const ray=new THREE.Raycaster(), v=new THREE.Vector2(); let down=null;
  const hit=e=>{const r=canvas.getBoundingClientRect(); v.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(v,camera); const h=ray.intersectObjects(pickables,false); return h[0]&&h[0].object.userData};
  canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
  canvas.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5) return;
    const u=hit(e); if(!u) return;
    if(u.s!==current.s) select(u.s,null,true); else if(u.p) select(u.s,u.p,false);
  });
  canvas.addEventListener('pointermove',e=>{ if(e.buttons) return; canvas.style.cursor=hit(e)?'pointer':'grab' });
}

function select(s,p,move){
  current={s,p}; render(); if(!renderer) return; highlight();
  if(move){ const S=STRUCTURES[s]; fly(new THREE.Vector3(...S.cam),new THREE.Vector3(...S.target)) }
}
function fly(pos,tgt){
  if(reduce){camera.position.copy(pos);controls.target.copy(tgt);return}
  tween={t:0,p0:camera.position.clone(),t0:controls.target.clone(),p1:pos,t1:tgt};
}
function loop(){
  requestAnimationFrame(loop);
  if(tween){tween.t=Math.min(1,tween.t+0.025); const k=1-Math.pow(1-tween.t,3);
    camera.position.lerpVectors(tween.p0,tween.p1,k); controls.target.lerpVectors(tween.t0,tween.t1,k); if(tween.t>=1) tween=null}
  controls.update(); renderer.render(scene,camera);
}

render();
if(window.THREE&&THREE.OrbitControls){ init(); select('bldg',null,true) } else { document.getElementById('fallback').hidden=false }
