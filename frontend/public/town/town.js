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
  s12:{title:"Moment frame joint check in a peer review",topic:"Joint shear in intermediate moment frames: demand from the beams' nominal strength and the seismic joint table, where the columns step down in size but the beams stay the same."},
  s13:{title:"Low-strength concrete in gravity columns",topic:"Acceptance of a low strength test: the individual-test limit, length-to-diameter correction of cores, and an analytical strength evaluation with the right strength reduction factors."},
  s14:{title:"Wall pier review before permit",topic:"A short wall segment between openings that the code treats as a wall pier, and the special moment frame column rules it then has to meet."},
  s15:{title:"Compatibility torsion in a spandrel beam",topic:"Reducing the torsion in a spandrel to the cracking torque, and carrying the released moment into the framing beam; torsion steel limits in special moment frame beams."},
  s16:{title:"Gravity columns and deformation compatibility",topic:"Gravity columns checked at the design displacement with the deflection amplification and importance factors, from a model with released gravity framing."},
  s17:{title:"Strapped footing at the property line",topic:"Reaction of an eccentric footing tied by a strap beam, vertical seismic load in allowable-stress bearing, and column hoops carried into the footing."},
  s18:{title:"Mechanical splices and bar substitution in special moment frame beams, a contractor's RFI",topic:"Joint depth for Grade 80 beam bars passing through a column, where Type 2 couplers may sit when the bars are Grade 80, and position couplers for prefabricated cages."},
  s19:{title:"Tied-back shoring before the engineer of record signs, a deferred submittal",topic:"Apparent earth pressure for a tied-back wall, passive resistance over three hole diameters, and whether the soldier piles can carry the downward pull of a steep tieback."}
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
    {sev:"life",ref:"Strap footing",err:"The reaction on an eccentric property-line footing is taken as the column load only, without the extra load the strap beam adds.",cons:"The exterior footing is undersized in bearing and the strap is underdesigned; the column base rotates and settles.",look:"Statics of the footing and strap with the real eccentricity; ASCE 7 12.4.2.2 vertical seismic effect in allowable-stress bearing; ACI 318-19 18.13.2.4 column hoops into the footing.",ask:"The foundation plan with the property line, the strap section and the footing loads."},
    {sev:"life",ref:"22.6.5.2",err:"Two-way shear in a thick footing is checked without the size-effect factor λs, which ACI 318-19 added.",cons:"Concrete shear strength is overestimated in deep members. Punching at the column is sudden and gives no warning.",look:"ACI 318-19 Table 22.6.5.2 and 13.2.7; footing depth d and whether shear reinforcement is provided.",ask:"The ACI 318-19 Chapter 22 text, if the reviewer cannot open it."},
    {sev:"both",ref:"Geotech",err:"An allowable bearing pressure is assumed (for example a 'typical' 3,000 psf) because no soil value is given.",cons:"Footings sized too small settle or fail in bearing; sized too large waste concrete and steel.",look:"The project geotechnical report: allowable bearing, settlement limits, groundwater, frost depth.",ask:"The geotechnical report or the bearing value stated on the foundation plan."},
    {sev:"life",ref:"Table 22.5.5.1",err:"One-way shear of a mat without stirrups checked with the simple 2λ√f'c expression although Av is below the minimum, or with ρw counted from the top and bottom bars together.",cons:"Shear strength of the mat is overestimated exactly where bars were reduced; a brittle diagonal crack forms under the heaviest columns.",look:"ACI 318-19 Table 22.5.5.1, 22.5.5.1.3 and 13.2.6.2 (λs in foundations); only the flexural tension bars count in ρw.",ask:"The mat reinforcement at both faces and the strip shears from the analysis."},
    {sev:"life",ref:"10.7.5.2",err:"Compression lap splices accepted at the column base because each single wind direction keeps the column in compression. The combined-direction wind cases are not checked.",cons:"Corner bars go into tension under combined wind; a compression lap pulls apart at the base of the column.",look:"ASCE 7-16 Fig. 27.3-8 (Cases 1 to 4), combinations with 0.9D, ACI 318-19 10.7.5.2 and 25.5.",ask:"Unfactored column base reactions by load case, for both wind directions."},
    {sev:"life",ref:"16.3.4.1",err:"Column-to-footing dowels below 0.005Ag, or column bars hooked into the footing for compression.",cons:"The column load is not transferred into the footing; hooks do not develop bars in compression.",look:"ACI 318-19 16.3.4.1, 25.4.9 (compression development), 25.4.1.2.",ask:"Column schedule and footing details."}],
  column:[
    {sev:"life",ref:"18.14",err:"Gravity columns checked at the elastic drift from the analysis, or with the deflection amplification but forces from a model that keeps the gravity beams rigidly framed.",cons:"Gravity columns lose their vertical capacity at the design drift; collapse can follow even when the moment frames survive.",look:"ASCE 7 12.8.6 (Cd, Ie) and ACI 318-19 18.14.3.",ask:"The drift output and how the gravity framing is modeled."},
    {sev:"life",ref:"6.2.5",err:"Slenderness is ignored, or the non-sway limit is applied to a frame that sways.",cons:"Second-order moments are missed and the column is under-designed against instability.",look:"ACI 318-19 6.2.5, 6.6.4 and 6.6.4.4; the lateral system and story stability index Q.",ask:"The lateral analysis results (story drifts, Q) for the floor in question."},
    {sev:"life",ref:"10.7.5",err:"Column splices sized as compression laps where load combinations put the bars in tension.",cons:"Splices pull apart under lateral load or uplift.",look:"ACI 318-19 10.7.5.2; the bar stress range from all load combinations.",ask:"The factored load combinations and the interaction results for the column."},
    {sev:"life",ref:"18.7.5.2(f)",err:"In a special moment frame column with high axial load (Pu with earthquake effects above 0.3Ag f'c), crossties are placed on every other bar only, and the kf and kn factors of Table 18.7.5.4 are left out.",cons:"The core is not confined where the axial load is highest; the column fails in a brittle way in its hinge zone.",look:"ACI 318-19 18.7.5.2(f), Table 18.7.5.4 and the factored axial loads including the vertical earthquake effect, level by level.",ask:"The column axial loads from the seismic load combinations."},
    {sev:"life",ref:"25.7.2",err:"Tie spacing taken from a typical detail without checking 16db, 48 tie diameters and least dimension.",cons:"Bars buckle and the core loses confinement before the design load is reached.",look:"ACI 318-19 25.7.2.1 and, in seismic regions, 18.7.5.",ask:"The seismic design category, which decides whether Chapter 18 applies."}],
  beam:[
    {sev:"life",ref:"18.2.7.2",err:"Type 2 mechanical splices accepted at any location in a special moment frame beam with Grade 80 bars. ACI 318-19 allows any location only for Type 2 splices on Grade 60 bars.",cons:"Couplers sit in the plastic hinge region where bar stresses can exceed what the splice can carry; splices fail in an earthquake.",look:"ACI 318-19 18.2.7.2 and R18.2.7; the bar grade on the general notes.",ask:"The coupler locations from the column faces and the bar grade."},
    {sev:"life",ref:"22.7.3.3",err:"Spandrel torsion reduced to the cracking torque, but the framing beam is still designed for the original end moment.",cons:"The beam that picks up the released moment is underdesigned at midspan and cracks or fails in flexure.",look:"ACI 318-19 22.7.3.2 and 22.7.3.3 (redistribution to the adjoining members).",ask:"The framing beam design moments after the torsion reduction."},
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
    {sev:"life",ref:"18.8.2.3",err:"Larger Grade 80 beam bars accepted through a special moment frame joint with the 20db rule, which applies to Grade 60 bars. Grade 80 bars need a joint depth of 26db.",cons:"Bars slip through the joint under cyclic loading; the frame loses stiffness and strength.",look:"ACI 318-19 18.8.2.3(a) and (b) and the column dimension parallel to the bars.",ask:"The bar size and grade and the column dimensions at each joint."},
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
  xfer:[
    {sev:"life",ref:"9.9.1.1",err:"A transfer girder with a residential column 5 ft from its support designed as an ordinary beam with sectional shear (Chapter 22).",cons:"Struts and nodes are never checked; the girder can fail in a brittle way under a column that carries eight floors.",look:"ACI 318-19 9.9.1.1(b), 9.9.1.3, 9.9.2.1 and Chapter 23; the distance from each column to the support face compared with 2h.",ask:"The framing plan with the residential column positions over the transfer girders."},
    {sev:"life",ref:"ASCE 7 12.3.3.3",err:"Nobody checks whether a wall or frame of the lateral system stops at the podium, so a discontinued wall ends up on a girder designed with the basic combinations only.",cons:"The girder or the columns under it fail before the wall above reaches its strength; the lateral load path is lost in an earthquake.",look:"ASCE 7-16 Table 12.3-2 Type 4, 12.3.3.3 and 12.4.3; wall elevations from the foundation to the roof.",ask:"Wall elevations marking every wall that stops at the transfer level."},
    {sev:"money",ref:"24.2.4",err:"Transfer girder deflection checked for the immediate load only, without creep and shrinkage under eight floors of sustained load.",cons:"The girder keeps sagging for years; flat plates and partitions over that bay crack on every floor and doors bind.",look:"ACI 318-19 24.2.3, 24.2.4.1 and Table 24.2.2; the shoring sequence under the transfer level.",ask:"The shoring and reshoring sequence and the deflection limit agreed for the transfer girders."}],
  pgdeck:[
    {sev:"life",ref:"GEC 4 5.6",err:"A tied-back shoring submittal is accepted after checking the anchors and the pile bending only; nobody checks whether the embedded soldier piles can carry the downward pull of a steep tieback.",cons:"The piles settle under the vertical anchor component, the anchors lose load and the wall, the street and the utilities behind it move.",look:"FHWA GEC 4 Fig. 24 (apparent pressure for tied-back walls), 5.6 and Table 14 (axial capacity of drilled-in soldier piles); the boring N values below subgrade; the anchor angle.",ask:"The shoring calculations, the geotechnical report with SPT values below subgrade, and the anchor angle and loads."},
    {sev:"money",ref:"Table 19.3.1.1",err:"Below-grade garage decks treated as dry interior concrete (C0) because rain does not reach them.",cons:"Cars bring in deicing salt water; chlorides reach the top bars and the deck spalls under the stalls within a few years.",look:"ACI 318-19 19.3.1.1, Table 19.3.2.1 and 20.5.1.3; ACI 362.1R; the regional use of deicing salts.",ask:"Whether deicing salts are used in the region and the owner's durability requirements."},
    {sev:"life",ref:"At-rest",err:"Basement walls designed as cantilevers with active pressure, or backfilled before the P1 and L1 decks that brace them are cast.",cons:"Walls braced by the decks carry at-rest pressure; backfilled early, the unbraced wall cracks or moves before the decks are in place.",look:"The geotechnical report (K0 and Ka); ASCE 7-16 3.2; the construction sequence on the drawings.",ask:"The geotechnical report and the backfill and deck casting sequence."},
    {sev:"money",ref:"ADA 502.5",err:"Clear height checked at the slab soffit only, not under the edges of the ramp openings, sprinkler mains and ducts.",cons:"The van-accessible route loses its 98 in. clearance; ducts are rerouted or the route moved after construction.",look:"2010 ADA Standards 502.5 and IBC 2021 406.2.2; the coordinated MEP drawings along the vehicular route.",ask:"The coordinated MEP and sprinkler drawings for the garage levels."}],
  retail:[
    {sev:"life",ref:"ASCE 7 Table 12.3-2",err:"The 20 ft retail story with an open storefront is not checked for soft-story or weak-story irregularity because the core walls are continuous.",cons:"Drift concentrates at Level 1, and the prohibitions of 12.3.3.1 (Type 5b in SDC D; Types 1b, 5a, 5b in SDC E-F) and the 2-story / 30 ft limit of 12.3.3.2 are missed.",look:"ASCE 7-16 Table 12.3-2 Types 1a, 1b, 5a and 5b, 12.3.3.1 and 12.3.3.2; story stiffness and strength by level.",ask:"Story stiffness and story shear strength of Levels 1 and 2 from the analysis."},
    {sev:"life",ref:"ASCE 7 4.7.5",err:"Live load reduction applied to the fitness room and the event hall, or the courtyard soil weighed dry.",cons:"Beams, girders and podium columns are designed for less load than the code requires.",look:"ASCE 7-16 Table 4.3-1, 4.7.5 (no reduction in assembly uses) and 3.1.4 (saturated and dry soil).",ask:"The Level 2 occupancy plan and the courtyard landscape section with soil depths."},
    {sev:"money",ref:"Table 9.3.1.1",err:"Long-span podium beams sized from the Table 9.3.1.1 minimum depth although they support storefront glazing and partitions.",cons:"The table applies only to beams not supporting construction likely to be damaged; deflection cracks the glazing and finishes.",look:"ACI 318-19 9.3.1.1, 24.2.2 and Table 24.2.2.",ask:"What the beams support (glazing, partitions) and the deflection limit in the general notes."}],
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
    lede:"A 12-story cast-in-place office with retail at the ground floor: special moment frames, shear walls on four grid lines, pan-joist floors and pile foundations, built from the FEMA P-751 design example. Every critical member and construction stage gets its own checks.",
    codes:["ACI 318-19","ASCE 7-16","IBC 2021","ACI 301-20","ACI 117-10","ACI 347"],
    parts:["footing","column","beam","oneway","flat","joint","wall","seismic","construction"],
    cam:[-250,210,-330], target:[0,70,0]},
  res:{name:"Residential tower",status:"plan",phase:"Structure type 2 · planned",
    lede:"A 22-story apartment tower with flat-plate floors and a core of four coupled L-shaped walls, built from the FEMA P-2192 design example. Slab deflection, wall and coupling-beam detailing and seismic analysis carry most of the risk.",
    codes:["ACI 318-19","ASCE 7-16","IBC 2021"],
    parts:["rmat","column","rslab","rshear","rcant","seismic","construction"],
    cam:[470,330,-360], target:[211,110,-52]},
  park:{name:"Public parking structure",status:"plan",phase:"Structure type 3 · planned",
    lede:"Multi-level cast-in-place garage with ramps, open to weather and deicing salts. Durability, vehicle barriers and restraint cracking drive most failures.",
    codes:["ACI 318-19 Ch. 19, 20, 24","ASCE 7-16 Ch. 4","ACI 362.1R","IBC 2021 406"],
    checks:[["Table 19.3.1.1","Exposure classes F, S, C and the w/cm, air and strength limits they set"],["20.5.1.3","Cover for exposed decks"],["ASCE 7 4.5.3","Vehicle barrier loads"],["ASCE 7 4.10","Concentrated vehicle loads"],["24.4","Restraint from shrinkage and temperature on long decks"],["","Ramps, drainage slopes, expansion joints"]],
    cam:[430,150,330], target:[204,20,128]},
  wall:{name:"Foundations, basements and retaining walls",status:"plan",phase:"Structure type 4 · planned",
    lede:"Site work under and around the buildings: basement walls, mats, retaining walls and excavation support. Site supervision of foundation work is part of this set.",
    codes:["ACI 318-19 Ch. 11, 13","ASCE 7-16 Ch. 3","IBC 2021 Ch. 18"],
    checks:[["13.3","Footing and mat bearing, one-way and two-way shear"],["ASCE 7 3.2","Lateral soil loads and hydrostatic pressure"],["IBC 1807","Foundation and retaining walls"],["","Overturning and sliding stability, key design"],["","Buoyancy of basement slabs"],["","Excavation shoring next to existing buildings"]],
    cam:[-130,30,470], target:[-17,-18,360]},
  bridge:{name:"Bridge condition assessment",status:"plan",phase:"Structure type 5 · planned",
    lede:"Existing concrete girder bridge: inspection findings, load rating and vibration-based damage detection, the area of the MSc research.",
    codes:["AASHTO MBE","AASHTO LRFD BDS 9th ed.","ACI 228.1R-19","ACI 228.2R"],
    checks:[["MBE Sec. 6","Load rating (LRFR) with condition and system factors"],["MBE Sec. 4","Inspection findings into member capacity"],["ACI 228.1R","In-place strength from nondestructive tests"],["","Damage detection from modal data and environmental effects"],["LRFD Sec. 5","Capacity of deteriorated prestressed girders"]],
    cam:[330,70,620], target:[94,-14,420]},
  mixed:{name:"Mixed-use podium building",status:"prog",phase:"Structure type 6 · in progress",
    lede:"A fictional mid-rise block: a grocery and retail podium over two below-grade parking levels, an amenity level whose ceiling holds the transfer girders, and eight floors of apartments on a 20 ft grid that does not line up with the 30 ft podium grid. Transfer girders, the tall retail story and garage durability carry most of the risk.",
    codes:["ACI 318-19","ASCE 7-16","IBC 2021 406, 510","ACI 362.1R"],
    parts:["footing","rmat","pgdeck","column","retail","xfer","flat","rslab","rshear","seismic","construction"],
    cam:[690,200,270], target:[405,30,-40]}
};

const PARTS = {
  footing:{name:"Footings and mat",status:"done",codes:["ACI 318-19 Ch. 13","Ch. 16","Ch. 22","ASCE 7-16 Ch. 27"],
    checks:[["13.3.1.1","Footing area sized for service loads and allowable bearing"],["13.2.7.2","One-way and two-way shear in footings"],["16.3.4.1","Minimum dowel area at column-to-footing interface"],["25.4","Development of column bars into the footing"],["Table 22.5.5.1","One-way shear without stirrups: row choice, ρw and λs"],["13.2.6.2","Size-effect waiver for foundations and its conditions"],["10.7.5.2","Compression laps at the column base only where bars stay in compression"]],
    plan:["Spread footings: two-way shear and dowels","Pile caps (strut-and-tie)","Mat thermal control and pour joints"],scen:["s10","s11","s17"]},
  column:{name:"Columns",status:"done",codes:["ACI 318-19 Ch. 10","Ch. 6","Ch. 22"],
    checks:[["10.6.1.1","Longitudinal reinforcement ratio 0.01 to 0.08"],["6.6.4","Slenderness and moment magnification"],["22.4","Axial and combined axial-flexural strength"],["25.7.2","Tie size and spacing"],["10.7.5","Column lap splices"],["18.7.5.2(f)","Crosstie support of every bar in special moment frame columns with high axial load"]],
    plan:["Second-order effects and slenderness","Bundled bars","Strong-column / weak-beam (seismic phase)"],scen:["s5","s16"]},
  beam:{name:"Beams and girders",status:"done",codes:["ACI 318-19 Ch. 9","Ch. 22","Ch. 24","Ch. 25"],
    checks:[["Table 22.5.5.1","One-way shear with size effect and longitudinal ratio"],["24.2.3.5","Effective moment of inertia for deflection"],["9.7.6.2.2","Stirrup spacing limits"],["25.5.2","Tension lap splice Class A / B"],["22.7","Torsion"],["18.6.5","Special moment frame beam design shear from Mpr, Vc = 0 when it applies"],["18.6.4.4","Hinge-zone hoop spacing, 5db for Grade 80 bars"]],
    plan:["One-way shear with size effect","Deflection and long-term multiplier","Transfer girders"],scen:["s1","s9","s15","s18"]},
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
    plan:["Coupling beams","Diaphragm chords and shear transfer","Walls with openings and flanged sections"],scen:["s7","s8","s14"]},
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
  construction:{name:"Construction and QA",status:"done",codes:["ACI 318-19 Ch. 26","ACI 301-20","ACI 347.2R","ACI 305R / 306R","ACI 228.1R"],
    checks:[["26.12.3","Strength acceptance of standard cylinders"],["26.12.6","Investigation of low-strength results, cores"],["26.11.2","Formwork removal"],["ACI 347.2R","Shoring and reshoring of multistory buildings"],["ACI 306R","Cold-weather protection"]],
    plan:["Early-age loading and reshoring","Hot and cold weather","Rebar substitution and field bending","Post-installed anchors (Ch. 17)","Repairs (ACI 562)"],scen:["s13"]},
  xfer:{name:"Transfer girders at Level 2",status:"plan",codes:["ACI 318-19 Ch. 9, 23","Ch. 24","ASCE 7-16 12.3.3.3"],
    checks:[["9.9.1.1","Deep beam test: clear span up to 4h, or a concentrated load within 2h of the support face"],["9.9.1.3","Strut-and-tie method of Chapter 23 for deep beam regions"],["9.9.2.1","Dimensional limit Vu ≤ φ10√f'c bw d"],["9.9.3.1","Distributed reinforcement of at least 0.0025 bw s in each direction"],["24.2.4","Long-term deflection under the residential floors and its effect on the floors above"],["ASCE 7 12.3.3.3","Overstrength combinations only where a wall or frame of the lateral system is discontinued"]],
    plan:["Strut-and-tie model of a girder with an offset column","Construction sequence and shoring under the transfer level","Column bearing on the girder (22.8)","Hanger reinforcement where secondary girders frame into primaries"],scen:[]},
  pgdeck:{name:"Garage decks, ramp and basement walls",status:"prog",codes:["ACI 318-19 Ch. 8, 11, 19, 20","ASCE 7-16 4.10","IBC 2021 406","ACI 362.1R"],
    checks:[["Table 8.3.1.1","Flat plate minimum thickness in the 30 ft garage bays"],["22.6.5.2","Punching shear with the size effect at the garage columns"],["19.3.1.1","Exposure classes: chlorides dripping from cars, freeze-thaw near the entrance"],["20.5.1.3","Specified cover for decks and for walls cast against earth"],["ASCE 7 4.10.1","3,000 lb wheel load on 4.5 x 4.5 in."],["IBC 406.2.2","Clear height 7 ft; 98 in. on van-accessible routes (ADA 502.5)"],["FHWA GEC 4 Fig. 24","Apparent earth pressure envelope for tied-back excavation shoring"],["FHWA GEC 4 5.6","Soldier pile support for the vertical component of inclined tiebacks"]],
    plan:["Ramp slope, transitions and clearance under the slab openings","Basement walls braced by the decks: at-rest pressure and construction sequence","Waterproofing, drainage and buoyancy of the P2 slab","Restraint cracking of long below-grade decks"],scen:["s19"]},
  retail:{name:"Podium long-span framing",status:"plan",codes:["ACI 318-19 Ch. 7, 9, 24","ASCE 7-16 Table 4.3-1, 3.1.4, 12.3","IBC 2021 510.2"],
    checks:[["Table 9.3.1.1","Minimum beam depth, only for beams not supporting construction likely to be damaged"],["Table 24.2.2","Deflection limits where glazing, partitions or finishes can be damaged"],["ASCE 7 Table 4.3-1","Retail first floor 100 psf; fitness and event hall 100 psf, not reducible; landscaped deck for assembly 100 psf"],["ASCE 7 3.1.4","Courtyard soil and drainage layers as dead load, saturated and dry"],["ASCE 7 Table 12.3-2","Soft or weak story at the 20 ft retail level"],["IBC 510.2","Horizontal building separation at the podium, only where the podium is treated as a separate building"]],
    plan:["Long-span beams over the grocery hall","Courtyard deck loads, drainage and waterproofing","Storefront openings and the soft-story check","Floor vibration under fitness and event use"],scen:[]}
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
function sourcesBox(k){const M=MODEL_SOURCES[k]; if(!M) return ''; return `<p class="srcref">${esc(M.ref)}</p><table class="src">${M.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>`}
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
    <h3>Codes</h3><div class="codes">${S.codes.map(c=>`<span class="code">${esc(c)}</span>`).join('')}</div>
    <h3>Model geometry and sources</h3>${sourcesBox(current.s)}<h3>Site, scale and people</h3>${sourcesBox('site')}`;
    if(S.parts){
      h+=`<h3>How the supervisor works</h3>${protocolBox()}<h3>Parts · click one here or in the model</h3><div class="parts">${S.parts.map(k=>{const P=PARTS[k];return `<button class="part" data-p="${k}"><i class="sw" style="background:var(--${P.status})"></i><span class="n">${esc(P.name)}</span><span class="s">${(TRAPS[k]||[]).length} failure cards</span></button>`}).join('')}</div>`;
    } else {
      h+=`<h3>Critical checks to cover</h3>${checksList(S.checks)}<h3>Where AI goes wrong</h3>${trapCards(TRAPS[SKEY[current.s]])}<p class="note">Planned after the structure types before it.</p>`;
    }
  }
  h+=`<p class="note">Clause numbers refer to ACI 318-19 unless another standard is named. General engineering content from the public codes. These are the checks Tnega's review agent is being built to run; the agent is in development and not available yet. Model geometry: see the source table of each structure.</p>`;
  panel.innerHTML=h; legend();
}
panel.addEventListener('click',e=>{
  const c=e.target.closest('[data-s]'), p=e.target.closest('[data-p]'), b=e.target.closest('[data-back]'), m=e.target.closest('[data-mode]');
  if(m){mode=m.dataset.mode; render(); applyTheme(); return}
  if(c){select(c.dataset.s,null,true)} else if(p){select(current.s,p.dataset.p,false)} else if(b){select(current.s,null,false)}
});

/* Model geometry: every dimension in the 3D model and where it comes from. "Not given" items are left out of the model or marked. */
const MODEL_SOURCES = {
  bldg:{ref:"FEMA P-751 (2009) NEHRP Design Examples, Ch. 7: 12-story reinforced concrete office, Berkeley configuration (pp. 7-3 to 7-76); foundations from Sec. 5.2 (deep foundations for a similar 12-story building).",
    rows:[
      ["Stories","12 above grade + 1 basement","p. 7-3"],
      ["Story heights","basement 15'-0\", first 18'-0\", 11 at 13'-0\"; roof at 161 ft","Fig. 7-2, p. 7-5"],
      ["Grids","1 to 8 at 30'-0\" (N-S); A, A', B, C, C', D at 20'-0\" (E-W); 212'-6\" x 102'-6\" overall","Fig. 7-1, p. 7-4"],
      ["Columns","36 columns, 30 x 30 in. at all levels; A' and C' only on grids 1 and 8","p. 7-12; p. 5-50"],
      ["Frame beams","24 in. wide x 32 in. deep on grids A-D (N-S) and 1-8 (E-W)","p. 7-12"],
      ["Shear walls","16 in. panels between the B and C columns on grids 3, 4, 5 and 6 (clear 17.5 ft; 22.5 ft overall)","pp. 7-12, 7-60, 7-61"],
      ["Floor","one-way pan joists spanning 30 ft N-S, 36 in. o.c., 6 in. web, 16 in. deep + 4 in. slab","p. 7-3"],
      ["Pile caps and piles","2x2 piles, 22 in. dia at 66 in.; caps 9'-2\" x 9'-2\" x 4'-0\"; piles 46 ft (corner) and 49 ft (side), Site Class C; shown at corner and side columns only","Sec. 5.2: pp. 5-33, 5-36, 5-43"],
      ["Not given (not modeled)","foundation of the Ch. 7 building itself, interior-column foundations, basement walls and slab, floor openings, parapet, cladding","p. 7-3; p. 5-47"],
      ["Construction stage","roof edge guardrails: top rail 42 in., midrail at mid-height, toeboard 3 1/2 in.","29 CFR 1926.502(b)(1), (b)(2)(i), (j)(3)"]]},
  res:{ref:"FEMA P-2192-V1 (2020) NEHRP Provisions Design Examples, Ch. 4.5: 22-story residential building, ductile coupled walls (pp. 142-167).",
    rows:[
      ["Stories and heights","22 stories: 16.25 ft, 15 ft, 13 ft, then 19 at 10 ft; roof 234.25 ft","Table 4-6, p. 149"],
      ["Floor plate","2nd-floor plan of Fig. 4-4b used for every floor (the text says the plan changes with height); outline scaled from the figure, 142.33 x 94.54 ft extents","Fig. 4-4b, p. 143"],
      ["Core","four L-shaped walls, 26 in. thick, legs 164 in. (x) and 152 in. (y); core 33.67 x 31.67 ft","pp. 143-144; Fig. 4-5, p. 151"],
      ["Coupling beams","76 in. clear x 28 in. deep x 26 in. wide, every floor, both axes","pp. 144, 166"],
      ["Slabs","flat plate 8 in. (floors 2-3), 7.5 in. (floor 4 and up)","p. 144"],
      ["Gravity columns","18 columns; positions and sizes (1.6 to 2.3 ft) scaled from Fig. 4-4b; the text gives \"various sizes\"","Fig. 4-4b; p. 144"],
      ["Not given (not modeled)","foundation, basement, plans above floor 2, core openings, balconies, stairs","p. 148"],
      ["Construction stage","roof-edge guardrails per OSHA 1926.502(b)","29 CFR 1926.502"]]},
  park:{ref:"Geometry from IBC 406 / 1015, ASCE 7-16 4.5.3, 2010 ADA Standards 502 and public owner parking design standards; members sized for this model to ACI 318-19 minimums (no federal garage design example exists).",
    rows:[
      ["Module","62 ft clear: 9.0 x 18.0 ft stalls each side of a 26 ft aisle","Boise CCDC Parking Structure Design Guidelines (2016) pp. 24-25; U-M SBA-E (2009) p. 2 (62 ft)"],
      ["Clear height","8'-2\" at every level (U-M SBA-E p. 2: 8'-2\" at grade, 7'-6\" above); IBC 406.2.2 min. 7 ft","U-M SBA-E; IBC 406.2.2"],
      ["Speed ramps","rise 12'-2\" over 162 ft = 7.5 % (no parking on ramps; U-M max 10 %; under the 8 % transition trigger of the Boise guideline)","U-M SBA-E p. 3; Boise p. 14"],
      ["Guards","42 in. on elevated deck edges (also over the 2'-9\" vehicle barrier height); barrier load 6,000 lb at 1'-6\" to 2'-3\"","IBC 1015.3, 406.4.2; ASCE 7-16 4.5.3"],
      ["Beams","24 x 48 in., 64 ft c/c columns, 27 ft o.c.: min. depth l/18.5 = 41.5 in. (one end continuous); Mu = 7.26 klf x 64 ft^2/10 = 2,974 k-ft, As = 16.5 in.^2 (rho 1.5 %)","ACI 318-19 Table 9.3.1.1; loads ASCE 7-16 Table 4.3-1 (40 psf)"],
      ["Slab","12 in. one-way, 27 ft span: l/28 = 11.6 in. (both ends continuous)","ACI 318-19 Table 7.3.1.1"],
      ["Columns","24 x 24 in., f'c 5,000 psi, 2 %: phiPn,max = 1,606 kips vs Pu = 1,394 kips (interior, 3 decks)","ACI 318-19 22.4.2"],
      ["Cars","AASHTO P design vehicle 7 ft x 19 ft (1 ft longer than the stall); height 4.25 ft","Green Book (2004) as cited by Chester County PC; height Green Book Table 2-1a (to verify)"],
      ["Not given (not modeled)","lateral system, stairs and elevators, drainage slopes, transitions"," - "]]},
  wall:{ref:"FHWA LRFD Steel Girder Superstructure Bridge Design Example, Design Step 7: full-depth reinforced concrete cantilever abutment, used here as a cantilever retaining wall.",
    rows:[
      ["Retained height","22 ft (stem 15 ft + backwall 7 ft)","DS 7, Figs. 7-2, 7-8, 7-9"],
      ["Stem","3'-6\" thick; backwall 1'-3\" wide","Fig. 7-2"],
      ["Footing","10'-3\" wide (toe 2'-9\", heel 4'-0\"), 2'-6\" thick; length 46.875 ft","Fig. 7-2; DS 7"],
      ["Backfill","120 pcf, Ka = 0.3; drained (no detail given)","DS 7"],
      ["Not given","shear key (none), drainage detail; wall ends and end slopes (2H:1V shown)","DS 7"]]},
  bridge:{ref:"FHWA NHI-04-043 (2003) LRFD Design Example for a Prestressed Concrete Girder Bridge (Modjeski and Masters for FHWA); AASHTO LRFD BDS 9th ed. for lanes and truck.",
    rows:[
      ["Spans","2 x 110 ft, 20 deg skew","DS 2.1"],
      ["Girders","6 AASHTO Type VI, 72 in. deep, at 9'-8\"; top flange 42 in., bottom 28 in. (flange thicknesses simplified)","DS 2.1"],
      ["Deck","8 in. (overhang 9 in.), 55'-4 1/2\" out-to-out, 52'-0\" roadway: 6 ft + 3 x 12 ft + 10 ft","DS 2.1, 4.2, 4.3"],
      ["Parapets","Type F, 42 in. high, 1'-8 1/4\" base (profile simplified)","DS 4.4, Fig. 4-2"],
      ["Pier","4 columns 3'-6\" dia at 14'-1\", 18 ft; cap 4 x 4 ft, 58'-11 1/8\", tapering to 2 ft; footings 12 x 12 x 3 ft","DS 7.2"],
      ["Bearings","elastomeric 7.5 x 24 x 1.86 in., 2 per girder at the pier","DS 6.1"],
      ["Abutments","integral, 3 ft thick, 10'-3 3/4\" high, 58.93 ft; wingwalls 15 ft, 20.25 in., 10.31 to 2 ft; approach slab 25 ft x 1'-6\"","DS 7.1"],
      ["Diaphragms","midspan, 10 x 50 in.","DS 2.1"],
      ["HL-93 truck","axles 14 ft + 14 ft (min.), gage 6 ft, tire contact 20 x 10 in.","AASHTO LRFD 3.6.1.2.2, 3.6.1.2.5"],
      ["Not given (display only)","clearance under the bridge, pier diaphragm, piles, embankment slope (2H:1V shown), haunch (4 in. max. used)","DS 2.2, 7.1"]]},
  mixed:{ref:"Fictional US mid-rise mixed-use block; no published design example: grid, levels and uses assumed for this concept, garage geometry from IBC 406, ADA 502 and the owner standards used for the parking structure; members sized for this model to ACI 318-19 minimums with first strength checks (calc_mixed.py, concept sizes, not a design).",
    rows:[
      ["Grid and levels", "podium and garage 7 x 30 ft = 210 ft (E-W) by 4 x 30 ft = 120 ft (N-S); P2 -22, P1 -11, L1 0 (20 ft), L2 +20 (14 ft), L3 +34, L3-L10 at 10 ft, roof +114 ft", "concept, assumed"],
      ["Live loads", "residential 40 psf; retail first floor 100 psf; garage 40 psf (+ 3,000 lb on 4.5 x 4.5 in., 4.10.1); fitness / event hall 100 psf (gymnasiums, ballrooms; not reducible, 4.7.5); courtyard 100 psf (landscaped roof used for assembly); roof 20 psf; no reduction used", "ASCE 7-16 Table 4.3-1, 4.7.5, 4.10.1"],
      ["Clear height (garage)", "11'-0\" story - 12 in. flat plate = 120 in. = 10'-0\" clear >= 98 in. (8'-2\", as the parking structure) >= 7 ft", "IBC 2021 406.2.2; 2010 ADA Standards 502.5 (98 in.)"],
      ["Ramps", "two stacked straight single-lane ramps (P2 to P1, P1 to grade), 14 ft wide, rise 11 ft over 150 ft = 7.33 % (<= 7.5 %), no parking, 10 ft clear between them; L1 slab open over the upper ramp except the first 25 ft from its low end (clearance would drop below 8'-2\"); one direction at a time (assumed)", "U-M SBA-E p. 3; Boise p. 14; lane width assumed"],
      ["Parking layout", "62 ft module (18 ft stalls + 26 ft aisle + 18 ft stalls, 44 to 106 ft from the north wall) plus a single-loaded 26 ft aisle along the north wall; 9.0 x 18.0 ft stalls, 3 per 30 ft bay; the 30 ft column lines stand 2 to 4 ft inside the stall rows, never in an aisle; west and east end bays are turning aisles", "Boise CCDC (2016) pp. 24-25; layout assumed"],
      ["Residential flat plate", "8 in.; ln = 20 ft - 18 in. = 222 in.: exterior panel without edge beams ln/30 = 7.4 in., interior ln/33 = 6.7 in. (fy 60 ksi)", "ACI 318-19 Table 8.3.1.1"],
      ["Garage decks (P1, L1)", "12 in. flat plate; ln = 30 ft - 30 in. = 330 in.: ln/30 = 11.0 in.; punching at an interior column, f'c 5,000 psi, d = 10 in.: phiVc = 339 k vs Vu = 222 k (P1, 40 psf) and 313 k (L1, retail 100 psf, 92 % before moment transfer: studs likely)", "ACI 318-19 Table 8.3.1.1, 22.6.5.2"],
      ["Podium framing at L2", "retail ceiling and amenity floor: slab 8 in. one-way over 15 ft (l/24 = 7.5 in., one end continuous, Table 7.3.1.1); beams 18 x 24 in. at 15 ft, 30 ft span: min. l/18.5 = 19.5 in.; wu = 4.92 klf, Mu = wu ln^2/10 = 386 k-ft, As = 4.3 in.^2 (rho 1.12 %); girders 24 x 36 in. on grid lines: P = 148 k at midspan, Mu = 1202 k-ft (simple span), As = 8.8 in.^2 (rho 1.11 %)", "ACI 318-19 Table 9.3.1.1, Table 7.3.1.1, 6.5.2; loads ASCE 7-16 Table 4.3-1 (100 psf)"],
      ["Courtyard deck at L3", "slab 10 in.; soil 2 ft saturated, 240 psf (assumed); beams 24 x 30 in. at 15 ft: wu = 9.93 klf, Mu = 751 k-ft, rho 0.99 %; girders 30 x 42 in.: P = 298 k, Mu = 2369 k-ft, rho 1.30 % (all above the l/18.5 = 19.5 in. minimum)", "ACI 318-19 Table 9.3.1.1; ASCE 7-16 3.1.4, Table 4.3-1 (100 psf)"],
      ["Residential columns", "18 x 18 in. on the 20 ft grid, f'c 5,000 psi, rho 1 %: phiPn,max = 810 k vs Pu = 676 k at L3 (D = 411 k from 7 floors + roof at 120 psf + column; L = 112 k; Lr = 8 k; 400 sq ft each)", "ACI 318-19 22.4.2; ASCE 7-16 2.3.1"],
      ["Transfer girder (typ.)", "secondary, 36 x 60 in., f'c 6,000 psi, span 30 ft between primary girders (ln = 312 in.), one residential column at midspan: Pu = 676 k + wu = 7.46 klf; Mu = PL/4 + wL^2/8 = 5,912 k-ft (simple span), As = 25.6 in.^2 (rho 1.28 %, tension-controlled: yes); Vu = 435 k <= phi10 sqrt(f'c) bd = 1161 k; ln/h = 5.2 > 4 and the load is 156 in. > 2h = 120 in. from the face: not a deep beam; bays where columns sit 5 ft from the support (load within 2h) are deep-beam regions, strut-and-tie; Table 9.3.1.1 l/16 = 22.5 in. does not govern", "ACI 318-19 9.9.1.1, 9.9.2.1, Ch. 23, Table 9.3.1.1"],
      ["Primary transfer girder", "48 x 72 in., spans 30 ft between podium columns (ln = 330 in., ln/h = 4.6); each secondary delivers P = 1238 k; Mu = 9,774 k-ft (secondary at midspan, simple span), As = 34.3 in.^2 (rho 1.06 %); Vu = 1298 k <= 1882 k; spans with secondaries 5 ft from the columns (load 45 in. from the face < 2h) are deep beams: strut-and-tie; concept size (assumed proportions)", "ACI 318-19 9.9.1.1(b), 9.9.2.1, Ch. 23"],
      ["Transfer slab zone", "48 in. under the two side wings, f'c 6,000 psi, d = 44 in., lambda_s = 0.61; residential column: phiVc = 1,543 k vs Pu = 676 k; podium column (30 x 30 ft tributary): Vu = 2,167 k (column self-weight above and Lr neglected; about 2,249 k with them) > phiVc = 1,842 k, so headed shear studs (limit phi8 sqrt(f'c) b0 d = 6,053 k) or a thicker slab; thickness assumed for the concept", "ACI 318-19 22.6.5.2, Table 22.6.6.3, 22.6.8"],
      ["Podium columns", "podium and garage, 30 x 30 in., f'c 8,000 psi, rho 2 %: phiPn,max = 3,680 k vs Pu = 2,938 k at P2 (interior column under the north wing: 1,987 k from the transfer girders + L2 at 187 psf / 100 psf, L1 160 / 100, P1 155 / 40, column 52 k)", "ACI 318-19 22.4.2; ASCE 7-16 Table 4.3-1"],
      ["Shear walls (cores)", "two 20 x 20 ft stair and elevator cores, 16 in., special reinforced concrete shear walls continuous P2 to roof: boundary-element width >= hu/16 = 228/16 = 14.2 in. at the 20 ft retail story, and >= 12 in. where 18.10.6.4(c) applies (hw/lw >= 2, continuous, single critical section, c/lw >= 3/8); (Table 11.3.1.1 hu/25 = 9.1 in. applies only with the simplified method of 11.5.3, not to these Chapter 18 walls); no wall or frame of the lateral system stops at the transfer level, so 12.3.3.3 is not triggered (gravity transfer only)", "ACI 318-19 18.10.6.4(b), (c), Table 11.3.1.1; ASCE 7-16 Table 12.2-1 (B4, 160 ft limit in SDC D), 12.3.3.3"],
      ["Basement walls", "14 in. around P2 and P1, 22 ft retained, braced by the P1 and L1 decks (at-rest pressure); P2 slab on grade 6 in.; thicknesses assumed (no geotechnical data); Table 11.3.1.1(e) 7.5 in. applies only with the simplified method", "assumed; ACI 318-19 Table 11.3.1.1"],
      ["Foundations", "spread footings 12 x 12 x 4 ft under the podium columns and 5 ft mats under the cores: display only, sizes assumed (no geotechnical report)", "assumed"],
      ["Guards", "roof (+114 ft) and exposed podium-deck edges (+34 ft) under construction: top rail 42 in., midrail, toeboard 3 1/2 in.", "29 CFR 1926.502(b)(1), (b)(2)(i), (j)(3)"],
      ["Not given (not modeled)", "stairs and elevators inside the cores, apartment layouts, facade, MEP, drainage slopes, entry ramp details and signals, foundation design", " - "]]},
  site:{ref:"Town-wide elements",
    rows:[
      ["Scale","1 model unit = 1 ft; true scale throughout",""],
      ["People","mean US adult height: men 68.9 in., women 63.5 in.; shoulder breadth 20.1 / 17.9 in. (body proportions schematic)","NCHS Vital Health Stat 3(50), 2025, Tables 7-8; FAA HFDS App. B, Table 2"],
      ["Lanes","12.0 ft","AASHTO LRFD 3.6.1.1.1"],
      ["Pavement markings","broken lines 10 ft / 30 ft gaps, 4 in. wide; yellow left edge on one-way roadways","MUTCD 2009 (rev. 2012) 3A.06, 3B.06"],
      ["Sidewalks","4.0 ft (minimum pedestrian access route)","PROWAG R302.3 (2013 SNPRM text; 2023 final rule to confirm)"],
      ["Layout","positions of the structures on the site, the valley and its 2H:1V banks are display choices, not from a source",""]]}
};

/* ---------------- 3D scene (v4: true scale, 1 unit = 1 ft; every dimension from MODEL_SOURCES) ---------------- */
let renderer,scene,camera,controls,pickables=[],matCache={},tween=null,terrain=null,belowGrade=[];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const IN=1/12, D2R=Math.PI/180;

function init(){
  const canvas=document.getElementById('c');
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true})}catch(e){document.getElementById('fallback').hidden=false;return}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(38,1,1,6000);
  camera.position.set(-560,430,760);
  controls=new THREE.OrbitControls(camera,canvas);
  controls.enableDamping=true; controls.maxPolarAngle=Math.PI*0.495; controls.minDistance=8; controls.maxDistance=2600;
  controls.target.set(110,10,160);
  scene.add(new THREE.HemisphereLight(0xffffff,0x77776a,0.55));
  const sun=new THREE.DirectionalLight(0xffffff,0.72); sun.position.set(-300,600,-200); sun.castShadow=true;
  sun.shadow.mapSize.set(4096,4096); Object.assign(sun.shadow.camera,{left:-650,right:650,top:650,bottom:-650,near:50,far:1600});
  sun.target.position.set(60,0,150); scene.add(sun.target); scene.add(sun);
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
function tagMesh(m,tag,below){ m.castShadow=true; m.receiveShadow=true; if(tag){m.userData=tag; pickables.push(m)} if(below) belowGrade.push(m); scene.add(m); return m; }
/* single box: x,z = centre in plan, y0 = bottom; ry = rotation about vertical (rad) */
function box(w,h,d,x,y0,z,mkey,tag,ry=0,below=false){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(mkey)); m.position.set(x,y0+h/2,z); m.rotation.y=ry; return tagMesh(m,tag,below);
}
/* many boxes in one instanced mesh: items {x,yc,z,w,h,d,ry,rx} (yc = centre) */
const _o=new THREE.Object3D();
function boxes(items,mkey,tag,below=false){
  if(!items.length) return null;
  const m=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat(mkey),items.length);
  items.forEach((b,i)=>{_o.position.set(b.x,b.yc,b.z); _o.rotation.set(b.rx||0,b.ry||0,0); _o.scale.set(b.w,b.h,b.d); _o.updateMatrix(); m.setMatrixAt(i,_o.matrix)});
  return tagMesh(m,tag,below);
}
function cyls(items,mkey,tag,below=false,seg=24){
  if(!items.length) return null;
  const m=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5,0.5,1,seg),mat(mkey),items.length);
  items.forEach((c,i)=>{_o.position.set(c.x,c.yc,c.z); _o.rotation.set(c.rx||0,0,c.rz||0); _o.scale.set(c.dia,c.h,c.dia); _o.updateMatrix(); m.setMatrixAt(i,_o.matrix)});
  return tagMesh(m,tag,below);
}
/* plan polygon slab: pts [[x,z]...] world, top at yTop, thickness t */
function slab(pts,yTop,t,mkey,tag){
  const s=new THREE.Shape(); pts.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1]));
  const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0,yTop-t,0);
  return tagMesh(new THREE.Mesh(g,mat(mkey)),tag);
}
/* profile (s,y) extruded along a horizontal axis: profile in local (s = along axis 'u', y up), width w across, centred at (x,z), axis angle ang */
function profileExtrude(prof,w,x,z,ang,mkey,tag,below=false){
  const s=new THREE.Shape(); prof.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));
  const g=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:false}); g.translate(0,0,-w/2);
  const m=new THREE.Mesh(g,mat(mkey)); m.position.set(x,0,z); m.rotation.y=ang; return tagMesh(m,tag,below);
}
const T=(s,p)=>({s,p});

/* ===== Terrain (town at EL 0; valley for the bridge) ===== */
const VAL={zTopN:291.0, zToeN:349.31, zToeS:490.69, zTopS:548.99, floor:-29.155};
function groundY(z){
  if(z<=VAL.zTopN||z>=VAL.zTopS) return 0;
  if(z<VAL.zToeN) return -(z-VAL.zTopN)/2;
  if(z>VAL.zToeS) return -(VAL.zTopS-z)/2;
  return VAL.floor;
}
function buildTerrain(){
  const g=new THREE.PlaneGeometry(1800,1500,90,300); g.rotateX(-Math.PI/2); g.translate(80,0,150);
  const p=g.attributes.position; const col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const y=groundY(p.getZ(i)); p.setY(i,y); const f=y===0?1:(y<=VAL.floor+0.01?0.9:0.8); col.set([f,f*0.97,f*0.9],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.computeVertexNormals();
  /* the ground is pushed back in depth so the faces that sit exactly on it (ground-floor slabs, beams and joints at EL 0) never flicker against it */
  terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({roughness:1,metalness:0,transparent:false,opacity:1,vertexColors:true,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:4}));
  terrain.receiveShadow=true; scene.add(terrain);
}
function strip(x0,x1,z0,z1,mkey,y=0.03){const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),mat(mkey));m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,y,(z0+z1)/2);m.receiveShadow=true;scene.add(m);return m}
/* MUTCD 3A.05/3B: broken line 10 ft segments, 30 ft gaps; normal line width 4 to 6 in (4 in used) */
function dashedZ(x,z0,z1,mkey,y=0.05){const L=[];for(let z=z0;z+10<=z1;z+=40)L.push({x,yc:y,z:z+5,w:4*IN,h:0.01,d:10});boxes(L,mkey,null)}
function dashedX(z,x0,x1,mkey,y=0.05){const L=[];for(let x=x0;x+10<=x1;x+=40)L.push({x:x+5,yc:y,z,w:10,h:0.01,d:4*IN});boxes(L,mkey,null)}
function solidZ(x,z0,z1,mkey,y=0.05){box(4*IN,0.01,z1-z0,x,y,(z0+z1)/2,mkey,null)}
function solidX(z,x0,x1,mkey,y=0.05){box(x1-x0,0.01,4*IN,(x0+x1)/2,y,z,mkey,null)}

/* ===== People: mean US adult height, men 68.9 in, women 63.5 in (NCHS 3(50), 2021-2023); shoulder breadth 20.1 / 17.9 in (FAA HFDS App. B) ===== */
const PEOPLE=[];
function person(x,y,z,sex){PEOPLE.push({x,y,z,sex})}
function buildPeople(){
  const body=[],head=[];
  PEOPLE.forEach(p=>{const H=p.sex==='m'?68.9*IN:63.5*IN, S=p.sex==='m'?20.1*IN:17.9*IN;
    const hh=0.13*H; /* head: display proportion only */
    body.push({x:p.x,yc:p.y+(H-hh)/2,z:p.z,dia:S,h:H-hh}); head.push({x:p.x,yc:p.y+H-hh/2,z:p.z,dia:hh*0.85,h:hh});});
  cyls(body,'people',null,false,10); cyls(head,'people',null,false,10);
}
/* AASHTO passenger car design vehicle P: 7 ft x 19 ft (Green Book, as cited); overall height 4.25 ft (Green Book Table 2-1a, to verify) */
const CARS=[];
function car(x,y,z,alongZ){CARS.push({x,y,z,alongZ})}
function buildCars(){
  const lower=[],cab=[];
  CARS.forEach(c=>{const L=19,W=7,H=4.25; const w=c.alongZ?W:L, d=c.alongZ?L:W;
    lower.push({x:c.x,yc:c.y+0.25+H*0.3,z:c.z,w,h:H*0.6-0.5,d}); /* body */
    cab.push({x:c.x,yc:c.y+H*0.8,z:c.z,w:c.alongZ?W*0.86:L*0.5,h:H*0.4,d:c.alongZ?L*0.5:W*0.86});});
  boxes(lower,'car',null); boxes(cab,'carcab',null);
}

/* ===== OSHA 29 CFR 1926.502(b): top rail 42 in, midrail at mid-height; (j): toeboard 3.5 in ===== */
function guardrail(x0,z0,x1,z1,y,tag){
  const L=Math.hypot(x1-x0,z1-z0), ang=Math.atan2(x1-x0,z1-z0), cx=(x0+x1)/2, cz=(z0+z1)/2, it=[];
  it.push({x:cx,yc:y+42*IN,z:cz,w:1.5*IN,h:1.5*IN,d:L,ry:ang});
  it.push({x:cx,yc:y+21*IN,z:cz,w:1.5*IN,h:1.5*IN,d:L,ry:ang});
  it.push({x:cx,yc:y+1.75*IN,z:cz,w:1*IN,h:3.5*IN,d:L,ry:ang});
  const n=Math.max(1,Math.round(L/8)); for(let i=0;i<=n;i++){const t=i/n; it.push({x:x0+(x1-x0)*t,yc:y+21*IN,z:z0+(z1-z0)*t,w:2*IN,h:42*IN,d:2*IN})}
  boxes(it,'construction',tag);
}

function build(){
  buildTerrain();
  buildStreets();
  buildOffice();
  buildResidential();
  buildGarage();
  buildBridge();
  buildRetainingWall();
  buildMixed();
  buildPeople(); buildCars();
}

/* ===== Streets: AASHTO LRFD 3.6.1.1.1 / design lanes 12.0 ft; N-S street = bridge roadway 52'-0" (6 ft left shoulder, 3 x 12 ft, 10 ft right shoulder, FHWA NHI-04-043 DS 2.1); sidewalks 4.0 ft (PROWAG R302.3 min.) ===== */
const ST={x0:68,x1:120};
function buildStreets(){
  strip(ST.x0,ST.x1,-330,284,'road'); strip(64,ST.x0,-330,284,'walk'); strip(ST.x1,124,-330,284,'walk');
  /* one-way southbound: right shoulder (10 ft) on the west, left shoulder (6 ft) on the east */
  solidZ(78,-330,284,'lineW'); dashedZ(90,-330,284,'lineW'); dashedZ(102,-330,284,'lineW'); solidZ(114,-330,284,'lineY');
  /* E-W street, two-way, 4 x 12 ft = 48 ft */
  strip(-330,ST.x0,-164,-116,'road'); strip(ST.x1,520,-164,-116,'road'); strip(ST.x0,ST.x1,-164,-116,'road',0.035);
  [[-330,ST.x0],[ST.x1,520]].forEach(([a,b])=>{solidX(-140-2*IN,a,b,'lineY');solidX(-140+6*IN,a,b,'lineY');dashedX(-152,a,b,'lineW');dashedX(-128,a,b,'lineW')});
  strip(-330,ST.x0-4,-168,-164,'walk'); strip(-330,64,-116,-112,'walk'); strip(124,520,-168,-164,'walk'); strip(124,520,-116,-112,'walk');
  /* valley road under the bridge, 2 x 12 ft */
  strip(-330,520,445,469,'road',VAL.floor+0.03); dashedX(457,-330,520,'lineY',VAL.floor+0.05);
  [[96,-125],[96,-30],[66,40],[66,140],[122,-60],[122,200],[-20,-114],[-60,-166],[200,-166],[300,-114]].forEach(([x,z],i)=>person(x,0,z,i%2?'f':'m'));
  car(84,0,-60,true); car(96,0,40,true); car(108,0,180,true); car(-100,0,-146,false); car(260,0,-134,false); car(-150,VAL.floor,451,false); car(200,VAL.floor,463,false);
}

/* ===== Office: FEMA P-751 (2009) Ch. 7, 12-story RC office, Berkeley configuration ===== */
function buildOffice(){
  const B=T('bldg');
  const X={A:-50,Ap:-30,B:-10,C:10,Cp:30,D:50}, Zg=[...Array(8)].map((_,i)=>-105+30*i); /* grids 1..8 at 30'-0", A-D at 20'-0" */
  const LV=[-15,0,18]; for(let n=3;n<=12;n++) LV.push(18+13*(n-2)); LV.push(161); /* B, G, 2..12, R */
  const C=2.5, BW=2, BD=32*IN, SL=4*IN, JW=6*IN, JD=16*IN, WT=16*IN;
  const colsAt=i=>(i===0||i===7)?['A','Ap','B','C','Cp','D']:['A','B','C','D'];
  const cols=[],joints=[],beams=[],joists=[],walls=[],caps=[],piles=[];
  for(let li=0;li<LV.length;li++){
    const y=LV[li];
    Zg.forEach((z,gi)=>colsAt(gi).forEach(k=>{
      if(li>0) joints.push({x:X[k],yc:y-BD/2,z,w:C,h:BD,d:C});
      if(li<LV.length-1){const top=LV[li+1]-BD, bot=(li===0?y:y); cols.push({x:X[k],yc:(bot+top)/2,z,w:C,h:top-bot,d:C})}
    }));
    if(li===0) continue;
    /* N-S frame beams on A, B, C, D */
    ['A','B','C','D'].forEach(k=>{for(let gi=0;gi<7;gi++){const z0=Zg[gi]+C/2,z1=Zg[gi+1]-C/2; beams.push({x:X[k],yc:y-BD/2,z:(z0+z1)/2,w:BW,h:BD,d:z1-z0})}});
    /* E-W beams on grids 1..8 between columns; grids 3..6 have the wall in bay B-C */
    Zg.forEach((z,gi)=>{const ks=colsAt(gi); for(let j=0;j<ks.length-1;j++){
      if(gi>=2&&gi<=5&&ks[j]==='B') continue;
      const x0=X[ks[j]]+C/2,x1=X[ks[j+1]]-C/2; beams.push({x:(x0+x1)/2,yc:y-BD/2,z,w:x1-x0,h:BD,d:BW})}});
    /* pan joists, span N-S between E-W beams, 36 in. o.c., 6 in. web, 16 in. below a 4 in. slab */
    for(let gi=0;gi<7;gi++){const z0=Zg[gi]+BW/2,z1=Zg[gi+1]-BW/2;
      [[-50,-10],[-10,10],[10,50]].forEach(([a,b])=>{const n=Math.floor((b-a)/3)-1, s0=(a+b)/2-(n-1)*1.5; for(let k=0;k<n;k++) joists.push({x:s0+3*k,yc:y-SL-JD/2,z:(z0+z1)/2,w:JW,h:JD,d:z1-z0})});}
    slab([[-51.25,-106.25],[51.25,-106.25],[51.25,106.25],[-51.25,106.25]],y,SL,'oneway',{...B,p:'oneway'});
  }
  /* shear walls: 16 in. panels on grids 3-6 between the B and C columns, basement to roof */
  for(let gi=2;gi<=5;gi++) walls.push({x:0,yc:(-15+161)/2,z:Zg[gi],w:20-C,h:176,d:WT});
  /* FEMA P-751 Sec. 5.2 (similar building): 2x2 piles, 22 in. dia at 66 in., caps 9'-2" x 9'-2" x 4'-0", top 1'-6" below the lowest floor; lengths 46 ft corner / 49 ft side (Site Class C). Interior columns: not given. */
  Zg.forEach((z,gi)=>colsAt(gi).forEach(k=>{
    const perim=(gi===0||gi===7||k==='A'||k==='D'); if(!perim) return;
    const corner=(gi===0||gi===7)&&(k==='A'||k==='D'); const top=-15-1.5;
    caps.push({x:X[k],yc:top-2,z,w:9+2/12,h:4,d:9+2/12});
    const Lp=corner?46:49; [-2.75,2.75].forEach(dx=>[-2.75,2.75].forEach(dz=>piles.push({x:X[k]+dx,yc:top-4+4*IN-Lp/2,z:z+dz,dia:22*IN,h:Lp})));
  }));
  boxes(cols,'column',{...B,p:'column'}); boxes(joints,'joint',{...B,p:'joint'}); boxes(beams,'beam',{...B,p:'beam'});
  boxes(joists,'oneway',{...B,p:'oneway'}); boxes(walls,'wall',{...B,p:'wall'});
  boxes(caps,'footing',{...B,p:'footing'},true); cyls(piles,'footing',{...B,p:'footing'},true,14);
  /* roof under construction: OSHA guardrails at the roof edge, crew */
  const R=161; guardrail(-51.25,-106.25,51.25,-106.25,R,{...B,p:'construction'}); guardrail(51.25,-106.25,51.25,106.25,R,{...B,p:'construction'});
  guardrail(51.25,106.25,-51.25,106.25,R,{...B,p:'construction'}); guardrail(-51.25,106.25,-51.25,-106.25,R,{...B,p:'construction'});
  [[-30,-60],[-26,-58],[10,20],[30,70],[-40,90]].forEach(([x,z],i)=>person(x,R,z,i%3?'m':'f'));
  [[-20,-112],[0,-112],[20,-112],[-56,0],[58,-20],[58,60]].forEach(([x,z],i)=>person(x,0,z,i%2?'f':'m'));
}

/* ===== Residential tower: FEMA P-2192 (2020) Ch. 4.5, 22-story ductile coupled-wall building ===== */
const RES={x0:140,z0:-100};
function buildResidential(){
  const Rt=T('res'), X=x=>RES.x0+x, Z=y=>RES.z0+y;
  const LV=[0,16.25,31.25,44.25]; for(let i=1;i<=19;i++) LV.push(44.25+10*i); /* base, L02..L23 (234.25) */
  /* floor plate scaled from Fig. 4-4b (2nd-floor plan, used for all floors), rounded to 0.25 ft */
  const P=[[45.5,3.25],[131,3.25],[131,18.75],[135.25,18.75],[135.25,29.75],[131.25,29.75],[131.25,45.75],[129.5,45.75],[129.5,51.75],[137.25,51.75],[137.25,87.75],[96.75,87.75],[96.75,91.25],[11.25,91.25],[11.25,74.75],[7,74.75],[7,63.5],[11,63.5],[11,51.75],[15.5,51.75],[15.5,45.75],[5,45.75],[5,7],[45.5,7]].map(p=>[X(p[0]),Z(p[1])]);
  for(let i=1;i<LV.length;i++) slab(P,LV[i],i<=2?8*IN:7.5*IN,'rslab',{...Rt,p:'rslab'});
  /* gravity columns: positions and sizes scaled from Fig. 4-4b ("various sizes" in the text) */
  const CL=[[6.8,10.5,1.71,1.81],[71.2,11.3,1.81,2.19],[97.2,11.3,1.81,2.19],[123.7,11.3,2.19,2.1],[18.5,11.3,1.71,1.81],[44.7,11.3,1.81,1.81],[6.1,35.3,1.62,1.72],[18.5,35.3,2.28,1.72],[125.2,35.3,2.19,1.72],[123.7,62.9,1.81,2.29],[17.1,62.9,2.28,1.72],[135.8,62.9,1.81,1.72],[12.4,86.6,2.19,2.19],[32.6,86.6,1.81,1.81],[58.8,86.6,1.62,1.81],[82.6,86.6,1.81,1.81],[109.1,86.6,1.71,1.91],[135.8,86.6,1.81,1.91]];
  const cols=[]; for(let i=0;i<LV.length-1;i++){const b=LV[i],t=LV[i+1]-(i+1<=2?8*IN:7.5*IN); CL.forEach(c=>cols.push({x:X(c[0]),yc:(b+t)/2,z:Z(c[1]),w:c[2],h:t-b,d:c[3]}))}
  boxes(cols,'column',{...Rt,p:'column'});
  /* core: four L walls 26 in. thick, legs 164 in. (x) and 152 in. (y); coupling beams 76 in. clear x 28 in. deep x 26 in. wide at every floor */
  const cx0=54.3357, cy0=33.5111, t=26*IN, lx=164*IN, ly=152*IN, gap=76*IN, Hc=234.25, wl=[], cb=[];
  [[0,0,1,1],[lx+gap,0,-1,1],[0,ly+gap,1,-1],[lx+gap,ly+gap,-1,-1]].forEach(([ox,oy,sx,sy])=>{
    const x0=cx0+ox+(sx<0?0:0), y0=cy0+oy;
    const xa=x0, xb=x0+lx, ya=y0, yb=y0+ly;
    const yEdge=sy>0?ya:yb-t, xEdge=(sx>0?xa:xb-t);
    wl.push({x:X((xa+xb)/2),yc:Hc/2,z:Z(yEdge+t/2),w:lx,h:Hc,d:t});
    wl.push({x:X(xEdge+t/2),yc:Hc/2,z:Z((ya+yb)/2),w:t,h:Hc,d:ly});
  });
  const W=lx*2+gap, Hh=ly*2+gap;
  for(let i=1;i<LV.length;i++){const y=LV[i];
    cb.push({x:X(cx0+lx+gap/2),yc:y-14*IN,z:Z(cy0+t/2),w:gap,h:28*IN,d:t});
    cb.push({x:X(cx0+lx+gap/2),yc:y-14*IN,z:Z(cy0+Hh-t/2),w:gap,h:28*IN,d:t});
    cb.push({x:X(cx0+t/2),yc:y-14*IN,z:Z(cy0+ly+gap/2),w:t,h:28*IN,d:gap});
    cb.push({x:X(cx0+W-t/2),yc:y-14*IN,z:Z(cy0+ly+gap/2),w:t,h:28*IN,d:gap});}
  boxes(wl,'rshear',{...Rt,p:'rshear'}); boxes(cb,'rshear',{...Rt,p:'rshear'});
  const R=234.25; for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length]; guardrail(a[0],a[1],b[0],b[1],R,{...Rt,p:'construction'})}
  [[60,20],[100,60],[30,40]].forEach(([x,y],i)=>person(X(x),R,Z(y),i%2?'f':'m'));
  [[40,1],[44,1],[100,93],[104,93]].forEach(([x,y],i)=>person(X(x),0,Z(y),i%2?'m':'f'));
}

/* ===== Parking structure: geometry from IBC 406 / ADA 502 / owner design standards; members sized to ACI 318-19 minimums (see MODEL_SOURCES) ===== */
const GAR={x0:140,z0:20};
function buildGarage(){
  const Pk=T('park'), X=x=>GAR.x0+x, Z=z=>GAR.z0+z;
  const XL=[0,64,128], ZL=[...Array(9)].map((_,i)=>27*i), H=8+2/12+4, LV=[0,H,2*H,3*H]; /* 8'-2" clear + 48 in. beam */
  const C=2, BW=2, BD=4, SL=1, RAMP_END=162;
  const cols=[],beams=[],slabsF=[],ramps=[],guards=[],lines=[];
  XL.forEach(x=>ZL.forEach(z=>cols.push({x:X(x),yc:(3*H-BD)/2,z:Z(z),w:C,h:3*H-BD,d:C})));
  const rampY=(k,z)=>k*H+H*(RAMP_END-z)/RAMP_END;
  for(let k=1;k<=3;k++){
    const y=LV[k];
    /* west module: flat deck full length */
    slabsF.push({x:X(32),yc:y-SL/2,z:Z(108),w:64+C,h:SL,d:216+C});
    ZL.forEach(z=>beams.push({x:X(32),yc:y-BD/2,z:Z(z),w:64-C,h:BD,d:BW}));
    /* east module: flat deck from the ramp end to the south end */
    slabsF.push({x:X(96),yc:y-SL/2,z:Z((RAMP_END+216)/2),w:64+C,h:SL,d:216-RAMP_END+C/2});
    ZL.filter(z=>z>=RAMP_END).forEach(z=>beams.push({x:X(96),yc:y-BD/2,z:Z(z),w:64-C,h:BD,d:BW}));
  }
  /* east module speed ramps: rise H over 162 ft (7.5 %), level k to k+1 */
  for(let k=0;k<3;k++){
    const len=Math.hypot(RAMP_END,H), ang=Math.atan2(H,RAMP_END), yMid=k*H+H/2;
    ramps.push({x:X(96),yc:yMid-SL/2,z:Z(RAMP_END/2),w:64+C,h:SL,d:len,rx:ang});
    ZL.filter(z=>z<RAMP_END).forEach(z=>{ const yt=rampY(k,z); if(yt-BD<0.5) return; beams.push({x:X(96),yc:yt-BD/2,z:Z(z),w:64-C,h:BD,d:BW})});
  }
  /* perimeter guards 42 in. (IBC 1015.3; also exceed the 2'-9" vehicle barrier of 406.4.2) on the elevated decks */
  for(let k=1;k<=3;k++){const y=LV[k], g=42*IN, t=6*IN;
    guards.push({x:X(-C/2-t/2),yc:y+g/2,z:Z(108),w:t,h:g,d:216+C});
    guards.push({x:X(128+C/2+t/2),yc:y+g/2,z:Z(108),w:t,h:g,d:216+C});
    guards.push({x:X(32),yc:y+g/2,z:Z(-C/2-t/2),w:64+C,h:g,d:t});
    guards.push({x:X(64),yc:y+g/2,z:Z(216+C/2+t/2),w:128+C,h:g,d:t});}
  /* stalls 9.0 ft x 18.0 ft each side of a 26 ft aisle (62 ft module, Boise guideline pp. 24-25) */
  const stallY=[0,H,2*H,3*H]; stallY.forEach((y,k)=>{
    for(let z=0;z<=216;z+=9){ lines.push({x:X(1+9),yc:y+0.03,z:Z(z),w:18,h:0.01,d:4*IN}); lines.push({x:X(63-9),yc:y+0.03,z:Z(z),w:18,h:0.01,d:4*IN}); }
  });
  boxes(cols,'park',Pk); boxes(beams,'park',Pk); boxes(slabsF,'park',Pk); boxes(ramps,'park',Pk); boxes(guards,'park',Pk); boxes(lines,'lineW',null);
  /* cars in stalls (P vehicle 19 ft is 1 ft longer than the 18 ft stall: it overhangs into the 26 ft aisle) */
  stallY.forEach((y,k)=>{ for(let i=0;i<24;i++){ if((i*7+k*3)%5===0) continue; const zc=Z(4.5+9*i);
      if(i%2===0) car(X(1+9.5),y,zc,false); if(i%3!==1) car(X(63-9.5),y,zc,false);} });
  [[20,30],[44,100],[30,190]].forEach(([x,z],i)=>person(X(x),H,Z(z),i%2?'f':'m'));
  [[-6,10],[-6,60]].forEach(([x,z],i)=>person(X(x),0,Z(z),'m'));
}

/* ===== Bridge: FHWA NHI-04-043 PSC girder design example (two 110 ft spans, 20 deg skew) ===== */
const BR={x:94, zN:310, zP:420, zS:530, sk:20*D2R};
function buildBridge(){
  const Br=T('bridge'), tan=Math.tan(BR.sk);
  const zLine=(z0,x)=>z0+(x-BR.x)*tan;
  const gX=[-2.5,-1.5,-0.5,0.5,1.5,2.5].map(k=>BR.x+k*(9+8/12)); /* 6 girders at 9'-8" */
  const deckTop=0, deckT=8*IN, haunch=4*IN, GD=6, brg=1.86*IN, capTop=deckTop-deckT-haunch-GD-brg, capD=4, colH=18, ftgTop=capTop-capD-colH;
  const half=55.375/2, gdr=[], dia=[];
  /* AASHTO Type VI girders, 72 in. deep, top flange 42 in., bottom flange 28 in. (flange thicknesses simplified) */
  const gTop=deckTop-deckT-haunch;
  gX.forEach(x=>{
    [[zLine(BR.zN,x)-0.5,zLine(BR.zP,x)-0.25],[zLine(BR.zP,x)+0.25,zLine(BR.zS,x)+0.5]].forEach(([a,b])=>{
      const L=b-a,zc=(a+b)/2;
      gdr.push({x,yc:gTop-0.5,z:zc,w:42*IN,h:1,d:L}); gdr.push({x,yc:gTop-2.75,z:zc,w:8*IN,h:3.5,d:L}); gdr.push({x,yc:gTop-GD+0.75,z:zc,w:28*IN,h:1.5,d:L});
    });
  });
  /* intermediate diaphragms at midspan, 10 in. x 50 in. */
  for(let i=0;i<5;i++){const xm=(gX[i]+gX[i+1])/2; [(BR.zN+BR.zP)/2,(BR.zP+BR.zS)/2].forEach(zm=>dia.push({x:xm,yc:gTop-50*IN/2,z:zLine(zm,xm),w:9+8/12-8*IN,h:50*IN,d:10*IN}))}
  boxes(gdr,'bridge',Br); boxes(dia,'bridge',Br);
  /* deck 8 in. (overhang 9 in.), out-to-out 55'-4 1/2", skewed ends at the abutment back faces */
  const dz=(x)=>(x-BR.x)*tan, xa=BR.x-half, xb=BR.x+half, zA=BR.zN-1.5, zB=BR.zS+1.5;
  slab([[xa,zA+dz(xa)],[xb,zA+dz(xb)],[xb,zB+dz(xb)],[xa,zB+dz(xa)]],deckTop,deckT,'bridge',Br);
  /* Type F parapets, 42 in. high, 1'-8 1/4" base (profile simplified to a taper) */
  [xa,xb].forEach((xe,i)=>{const s=i?-1:1, bw=20.25*IN; const prof=[[0,0],[bw,0],[bw*0.55,42*IN],[0,42*IN]].map(p=>[p[0]*s,p[1]]);
    const L=zB-zA; const sh=new THREE.Shape(); prof.forEach((p,j)=>j?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));
    const g=new THREE.ExtrudeGeometry(sh,{depth:L,bevelEnabled:false}); const m=new THREE.Mesh(g,mat('bridge')); m.position.set(xe,deckTop,zA+dz(xe)); tagMesh(m,Br);});
  /* lane lines: 52 ft roadway, 6 ft left shoulder (east), 3 x 12 ft lanes, 10 ft right shoulder (west) */
  [[78,'lineW',1],[90,'lineW',0],[102,'lineW',0],[114,'lineY',1]].forEach(([x,mk,solid])=>{const z0=zA+dz(x)+2,z1=zB+dz(x)-2; solid?solidZ(x,z0,z1,mk,deckTop+0.02):dashedZ(x,z0,z1,mk,deckTop+0.02)});
  /* pier: 4 columns 3'-6" dia at 14'-1" along the skew, 18 ft tall; cap 4 ft x 4 ft, 58'-11 1/8" long, tapering to 2 ft; footings 12 x 12 x 3 ft */
  const ux=Math.cos(BR.sk), uz=Math.sin(BR.sk), capL=58+11.125/12, ext=21.125+1.75;
  const prof=[[-capL/2,capTop-2],[-ext,capTop-capD],[ext,capTop-capD],[capL/2,capTop-2],[capL/2,capTop],[-capL/2,capTop]];
  profileExtrude(prof,4,BR.x,BR.zP,-BR.sk,'bridge',Br);
  const pc=[],pf=[],pads=[];
  [-21.125,-7.0417,7.0417,21.125].forEach(s=>{const x=BR.x+s*ux, z=BR.zP+s*uz;
    pc.push({x,yc:ftgTop+colH/2,z,dia:3.5,h:colH}); pf.push({x,yc:ftgTop-1.5,z,w:12,h:3,d:12,ry:-BR.sk});});
  cyls(pc,'bridge',Br); boxes(pf,'footing',Br,true);
  /* elastomeric bearings at the pier, 7.5 in. x 24 in. x 1.86 in., 2 per girder line */
  gX.forEach(x=>[-0.4,0.4].forEach(o=>pads.push({x,yc:capTop+brg/2,z:zLine(BR.zP,x)+o,w:24*IN,h:brg,d:7.5*IN})));
  boxes(pads,'bridge',Br);
  /* integral abutments: 3 ft thick, 10'-3 3/4" high, 58.93 ft along the skew; U-wingwalls 15 ft long, 20.25 in. thick, 10.31 ft to 2 ft; approach slab 25 ft x 1'-6" */
  const abH=10+3.75/12, abL=58.93;
  [[BR.zN,-1],[BR.zS,1]].forEach(([z0,dir])=>{
    box(abL,abH,3,BR.x,deckTop-abH,z0,'bridge',Br,-BR.sk);
    [xa+20.25*IN/2,xb-20.25*IN/2].forEach(xw=>{const zb=z0+dz(xw)+dir*1.5;
      const prof=[[0,deckTop],[15,deckTop],[15,deckTop-2],[0,deckTop-abH]];
      const sh=new THREE.Shape(); prof.forEach((p,j)=>j?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));
      const g=new THREE.ExtrudeGeometry(sh,{depth:20.25*IN,bevelEnabled:false}); g.translate(0,0,-20.25*IN/2);
      const m=new THREE.Mesh(g,mat('bridge')); m.position.set(xw,0,zb); m.rotation.y=dir>0?-Math.PI/2:Math.PI/2; tagMesh(m,Br);});
    const zs=z0+dir*(1.5+12.5); box(55.34,1.5,25,BR.x,deckTop-1.5-0.02,zs,'bridge',Br);
  });
  /* HL-93 design truck (AASHTO LRFD 3.6.1.2.2): axles 14 ft + 14 ft (min.), gage 6 ft; tires 20 in. x 10 in. */
  const tx=96, tz0=380, tires=[];
  [0,14,28].forEach(a=>{[-3,3].forEach(g=>tires.push({x:tx+g,yc:deckTop+1*IN,z:tz0+a,w:20*IN,h:2*IN,d:10*IN})); tires.push({x:tx,yc:deckTop+2*IN,z:tz0+a,w:6,h:2*IN,d:2*IN});});
  boxes(tires,'lineY',null);
  [[70,330],[118,500],[50,420],[54,424]].forEach(([x,z],i)=>person(x,groundY(z)<0&&i>1?VAL.floor:0,z,i%2?'f':'m'));
}

/* ===== Retaining wall: geometry of the FHWA LRFD steel girder example, Design Step 7 cantilever abutment ===== */
function buildRetainingWall(){
  const Rw=T('wall'), x0=-40, L=46.875, xc=x0+L/2, yF=VAL.floor, zFace=362;
  /* footing 10'-3" wide x 2'-6" thick: toe 2'-9" (south), stem 3'-6", heel 4'-0" (north, retained side) */
  const toe=2.75, stem=3.5, heel=4, ft=2.5;
  box(L,ft,toe+stem+heel,xc,yF-ft,zFace+toe-(toe+stem+heel)/2,'rwall',Rw,0,true);
  box(L,15,stem,xc,yF,zFace-stem/2,'rwall',Rw);
  box(L,7,1.25,xc,yF+15,zFace-stem+1.25/2,'rwall',Rw);
  /* retained fill to the top of the wall, 22 ft above the footing (gamma = 120 pcf, Ka = 0.3 in the example) */
  const top=yF+22, zBack=zFace-stem, zTopFill=VAL.zTopN+2*(-top);
  const fill=new THREE.Mesh(new THREE.BoxGeometry(L,22,zBack-zTopFill),mat('ground')); fill.position.set(xc,yF+11,(zBack+zTopFill)/2); fill.receiveShadow=true; scene.add(fill);
  /* fill graded down at 2H:1V beyond each end of the wall (display choice, same slope as the valley banks) */
  [[x0,-1],[x0+L,1]].forEach(([xe,sg])=>{const sh=new THREE.Shape(); sh.moveTo(0,0); sh.lineTo(0,22); sh.lineTo(sg*44,0); sh.lineTo(0,0);
    const w=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:zBack-zTopFill,bevelEnabled:false}),mat('ground')); w.position.set(xe,yF,zTopFill); w.receiveShadow=true; w.castShadow=true; scene.add(w)});
  person(xc-6,yF,zFace+8,'m'); person(xc+4,yF,zFace+10,'f');
}

/* ===== Mixed-use podium building (fictional): 7 x 30 ft by 4 x 30 ft podium over two garage levels, 8 residential floors on a 20 ft grid; sizes from calc_mixed.py (see MODEL_SOURCES) ===== */
const MX={x0:300,z0:-100}, MXCORES=[[25,25],[165,25]]; /* 20 x 20 ft cores, min. corner in plan */
function buildMixed(){
  const Mt=T('mixed'), X=x=>MX.x0+x, Z=z=>MX.z0+z, tg=p=>({...Mt,p});
  const B=30, E=1.25, CP=2.5, CR=1.5, GS=1, RS=8*IN, L3=34, ROOF=114;
  const inCore=(x,z,m=0)=>MXCORES.some(([a,b])=>x>=a-m&&x<=a+20+m&&z>=b-m&&z<=b+20+m);
  const XL=[...Array(8)].map((_,i)=>B*i), ZL=[...Array(5)].map((_,i)=>B*i);
  const bx=(x0,x1,z0,z1,y0,h)=>({x:X((x0+x1)/2),yc:y0+h/2,z:Z((z0+z1)/2),w:x1-x0,h,d:z1-z0});
  /* podium and garage columns 30 x 30 in. (f'c 8,000 psi): P2 to the L3 deck; none inside the cores */
  const pcB=[],pcA=[],ftg=[];
  XL.forEach(x=>ZL.forEach(z=>{ if(inCore(x,z)) return;
    pcB.push(bx(x-E,x+E,z-E,z+E,-22,-12+22)); pcB.push(bx(x-E,x+E,z-E,z+E,-11,-1+11));
    pcA.push(bx(x-E,x+E,z-E,z+E,0,20-3)); pcA.push(bx(x-E,x+E,z-E,z+E,20,L3-10*IN-20));
    if(!inCore(x,z,10)) ftg.push(bx(x-6,x+6,z-6,z+6,-22.5-4,4)); }));
  boxes(pcB,'column',tg('column'),true); boxes(pcA,'column',tg('column'));
  /* foundations: display only, sizes assumed (no geotechnical report): 12 x 12 x 4 ft footings, 5 ft mats under the cores */
  boxes(ftg,'footing',tg('footing'),true);
  boxes(MXCORES.map(([a,b])=>bx(a-10,a+30,b-10,b+30,-22.5-5,5)),'rmat',tg('rmat'),true);
  /* garage: P2 slab on grade 6 in., P1 and L1 flat plates 12 in. with the ramp strip (z 106 to 120) open from x 30 to 155 */
  const gd=[bx(-E,210+E,-E,120+E,-22.5,0.5)];
  /* P1: the upper ramp replaces the deck from x 30 to 180; L1: open over the upper ramp from x 30 to 155, where the clearance would drop below 8'-2" */
  [[-11,180],[0,155]].forEach(([y,xe])=>{ const t=y-GS+(y===0?0.04:0); /* L1 drawn 1/2 in. above the ground plane to avoid z-fighting */
    gd.push(bx(-E,210+E,-E,106,t,GS)); gd.push(bx(-E,30,106,120+E,t,GS)); gd.push(bx(xe,210+E,106,120+E,t,GS)); });
  boxes(gd.slice(0,4),'pgdeck',tg('pgdeck'),true); boxes(gd.slice(4),'pgdeck',tg('pgdeck'));
  /* ramps: 11 ft over 150 ft = 7.33 %, 14 ft lane against the south wall; P2 -> P1 and P1 -> grade, stacked */
  const rl=Math.hypot(150,11), ra=Math.atan2(11,150);
  [-22,-11].forEach(y=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(rl,GS,13.4),mat('pgdeck'));
    m.position.set(X(105),y+5.5-GS/2,Z(112.7)); m.rotation.z=-ra; tagMesh(m,tg('pgdeck'),true); });
  /* basement walls 14 in. (assumed), P2 to grade */
  const bw=14*IN; boxes([bx(-bw/2,bw/2,-E,120+E,-22.5,22.5),bx(210-bw/2,210+bw/2,-E,120+E,-22.5,22.5),bx(-E,210+E,-bw/2,bw/2,-22.5,22.5),bx(-E,210+E,120-bw/2,120+bw/2,-22.5,22.5)],'pgdeck',tg('pgdeck'),true);
  /* stalls 9 x 18 ft, 3 per 30 ft bay, rows 26-44, 44-62 (62 ft module with aisle 62-88) and 88-106; end bays are turning aisles */
  const stl=[]; [-22,-11].forEach((y,k)=>{ [[26,44,34.5],[44,62,53.5],[88,106,96.5]].forEach(([z0,z1,zc],r)=>{
    for(let b=1;b<=5;b++) for(let i=0;i<3;i++){ const xs=B*b+1.5+9*i, xc=xs+4.5; if(inCore(xc,zc,1)) continue;
      stl.push({x:X(xs),yc:y+0.03,z:Z((z0+z1)/2),w:4*IN,h:0.01,d:18}); if(i===2) stl.push({x:X(xs+9),yc:y+0.03,z:Z((z0+z1)/2),w:4*IN,h:0.01,d:18});
      if((b*3+i*7+r*5+k*2)%5<3) car(X(xc),y,Z(zc),true); } }); });
  boxes(stl,'lineW',null);
  /* L2 framing (retail ceiling, amenity floor): slab 8 in., girders 24 x 36 in. on grid lines, beams 18 x 24 in. E-W at mid-bay */
  const rt=[bx(-E,210+E,-E,120+E,20-8*IN,8*IN)];
  XL.forEach(x=>{ for(let j=0;j<4;j++){ const z0=B*j+E, z1=B*(j+1)-E; if(inCore(x,(z0+z1)/2)) continue; rt.push(bx(x-1,x+1,z0,z1,20-3,3)); } });
  ZL.forEach(z=>{ for(let i=0;i<7;i++){ const x0=B*i+E, x1=B*(i+1)-E; if(inCore((x0+x1)/2,z)) continue; rt.push(bx(x0,x1,z-1,z+1,20-3,3)); } });
  [15,45,75,105].forEach(z=>{ for(let i=0;i<7;i++){ const x0=B*i+1, x1=B*(i+1)-1; if(inCore((x0+x1)/2,z)) continue; rt.push(bx(x0,x1,z-0.75,z+0.75,20-2,2)); } });
  /* L3 podium deck 10 in.; courtyard framing: girders 30 x 42 in., beams 24 x 30 in. */
  rt.push(bx(-E,210+E,-E,120+E,L3-10*IN,10*IN));
  [90,120].forEach(x=>rt.push(bx(x-1.25,x+1.25,90+E,120,L3-3.5,3.5)));
  [90,120].forEach(z=>rt.push(bx(75,135,z-1.25,z+1.25,L3-3.5,3.5)));
  [75,105].forEach(z=>rt.push(bx(75,135,z-1,z+1,L3-2.5,2.5)));
  boxes(rt,'retail',tg('retail'));
  /* transfer girders at the top of Level 2: primary 48 x 72 in. N-S on podium lines (z 0 to 90), secondary 36 x 60 in. E-W on residential lines z 5, 25, 45, 65 */
  const xg=[];
  XL.forEach(x=>{ const segs=MXCORES.some(([a])=>x>=a&&x<=a+20)?[[0,25],[45,90]]:[[0,90]]; segs.forEach(([z0,z1])=>xg.push(bx(x-2,x+2,z0||-E,z1,L3-6,6))); });
  [5,25,45,65].forEach(z=>{ const segs=(z===25||z===45)?[[0,25],[45,165],[185,210]]:[[0,210]]; segs.forEach(([x0,x1])=>xg.push(bx(x0||-E,x1===210?210+E:x1,z-1.5,z+1.5,L3-5,5))); });
  boxes(xg,'xfer',tg('xfer'));
  /* transfer slab zone 48 in. under the side wings */
  boxes([bx(-E,75,70,120+E,L3-4,4),bx(135,210+E,70,120+E,L3-4,4)],'flat',tg('flat'));
  /* residential: 18 in. columns on the 20 ft grid (offset 5 ft from the podium grid), flat plates 8 in., U plan around the courtyard */
  const rc=[], rcols=[];
  for(let x=5;x<=205;x+=20) [5,25,45,65].forEach(z=>rcols.push([x,z]));
  [5,25,45,65,145,165,185,205].forEach(x=>[85,105].forEach(z=>rcols.push([x,z])));
  for(let y=L3;y<ROOF;y+=10) rcols.forEach(([x,z])=>{ if(inCore(x,z)) return; rc.push(bx(x-CR/2,x+CR/2,z-CR/2,z+CR/2,y,10-RS)); });
  boxes(rc,'column',tg('column'));
  const U=[[0,0],[210,0],[210,110],[140,110],[140,70],[70,70],[70,110],[0,110]].map(([x,z])=>[X(x),Z(z)]);
  for(let y=L3+10;y<=ROOF;y+=10) slab(U,y,RS,'rslab',tg('rslab'));
  /* cores: special RC shear walls 16 in., continuous from P2 to the roof */
  const cw=[], wt=16*IN, Hc=ROOF+22.5;
  MXCORES.forEach(([a,b])=>{ cw.push(bx(a-wt/2,a+20+wt/2,b-wt/2,b+wt/2,-22.5,Hc)); cw.push(bx(a-wt/2,a+20+wt/2,b+20-wt/2,b+20+wt/2,-22.5,Hc));
    cw.push(bx(a-wt/2,a+wt/2,b+wt/2,b+20-wt/2,-22.5,Hc)); cw.push(bx(a+20-wt/2,a+20+wt/2,b+wt/2,b+20-wt/2,-22.5,Hc)); });
  boxes(cw,'rshear',tg('rshear'));
  /* storefront on the street (north) side: mullions 4 x 6 in. at 5 ft and a head at 17 ft (display) */
  const sf=[]; for(let x=0;x<=210;x+=5) sf.push(bx(x-2*IN,x+2*IN,-E-0.5,-E,0,17)); sf.push(bx(0,210,-E-0.5,-E,16.5,0.5));
  boxes(sf,'carcab',Mt);
  /* courtyard planting: 2 ft soil (display) */
  const soil=new THREE.Mesh(new THREE.BoxGeometry(50,2,36),mat('ground')); soil.position.set(X(105),L3+1,Z(94)); tagMesh(soil,Mt);
  /* OSHA guardrails at the roof edge and the exposed podium-deck edge */
  for(let i=0;i<U.length;i++){const a=U[i],b=U[(i+1)%U.length]; guardrail(a[0],a[1],b[0],b[1],ROOF,tg('construction'))}
  [[[-E,110],[-E,120+E]],[[-E,120+E],[210+E,120+E]],[[210+E,120+E],[210+E,110]]].forEach(([a,b])=>guardrail(X(a[0]),Z(a[1]),X(b[0]),Z(b[1]),L3,tg('construction')));
  /* people: street front, grocery hall, courtyard, roof crew */
  [[15,-6],[48,-8],[96,-5],[140,-7],[188,-6],[60,40],[120,20],[150,50]].forEach(([x,z],i)=>person(X(x),0,Z(z),i%2?'f':'m'));
  [[74,100],[100,116],[135,80],[30,115]].forEach(([x,z],i)=>person(X(x),L3,Z(z),i%2?'m':'f'));
  [[60,30],[150,40],[30,90]].forEach(([x,z],i)=>person(X(x),ROOF,Z(z),i%2?'f':'m'));
}

function applyTheme(){
  if(!renderer) return;
  const bg=new THREE.Color(css('--bg')); scene.background=bg; scene.fog=new THREE.Fog(bg,1400,3600);
  const st=k=>({done:css('--done'),prog:css('--prog'),plan:css('--concrete')}[k]);
  const rk=k=>css('--'+partSev(k));
  for(const [k,P] of Object.entries(PARTS)) if(matCache[k]) matCache[k].color.set(mode==='risk'?rk(k):st(P.status));
  for(const k of ['park','bridge']) if(matCache[k]) matCache[k].color.set(mode==='risk'?rk(k):css('--concrete'));
  if(matCache.rwall) matCache.rwall.color.set(mode==='risk'?rk('wall2'):css('--concrete'));
  if(terrain) terrain.material.color.set(css('--ground'));
  const fix={ground:'--ground',road:'--road',walk:'--walk',lineW:'--lineW',lineY:'--lineY',people:'--person',car:'--car',carcab:'--carcab'};
  for(const [k,v] of Object.entries(fix)) if(matCache[k]) matCache[k].color.set(css(v));
  highlight();
}
function highlight(){
  const sel=new THREE.Color(css('--sel'));
  for(const m of Object.values(matCache)) m.emissive&&m.emissive.set(0x000000);
  const key=current.p || ({park:'park',wall:'rwall',bridge:'bridge'}[current.s]);
  if(key&&matCache[key]){ matCache[key].emissive.copy(sel).multiplyScalar(.55) }
}
let showBelow=false;
function setBelow(on){ showBelow=on; if(terrain){terrain.material.transparent=on; terrain.material.opacity=on?0.28:1; terrain.material.depthWrite=!on; terrain.material.needsUpdate=true} }
function setupPicking(canvas){
  const ray=new THREE.Raycaster(), v=new THREE.Vector2(); let down=null;
  const hit=e=>{const r=canvas.getBoundingClientRect(); v.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(v,camera);
    const objs=showBelow?pickables:pickables.filter(o=>!belowGrade.includes(o)); const h=ray.intersectObjects(objs,false); return h[0]&&h[0].object.userData};
  canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
  canvas.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5) return;
    const u=hit(e); if(!u||!u.s) return;
    if(u.s!==current.s) select(u.s,null,true); else if(u.p) select(u.s,u.p,false);
  });
  canvas.addEventListener('pointermove',e=>{ if(e.buttons) return; const u=hit(e); canvas.style.cursor=(u&&u.s)?'pointer':'grab' });
}
function select(s,p,move){
  current={s,p}; render(); if(!renderer) return; highlight();
  if(move){ const S=STRUCTURES[s]; fly(new THREE.Vector3(...S.cam),new THREE.Vector3(...S.target)) }
}
function fly(pos,tgt){
  if(reduce){camera.position.copy(pos);controls.target.copy(tgt);return}
  tween={t:0,s0:performance.now(),p0:camera.position.clone(),t0:controls.target.clone(),p1:pos,t1:tgt};
}
function loop(){
  requestAnimationFrame(loop);
  if(tween){tween.t=Math.min(1,(performance.now()-tween.s0)/1400); const k=1-Math.pow(1-tween.t,3);
    camera.position.lerpVectors(tween.p0,tween.p1,k); controls.target.lerpVectors(tween.t0,tween.t1,k); if(tween.t>=1) tween=null}
  controls.update();
  /* near plane follows the zoom: a fixed 1 ft near plane with a 6000 ft far plane leaves too little depth precision at the overview distance */
  const nr=Math.min(20,Math.max(0.5,camera.position.distanceTo(controls.target)/150)); if(Math.abs(nr-camera.near)>0.01){camera.near=nr; camera.updateProjectionMatrix()}
  renderer.render(scene,camera);
}
document.getElementById('overview').addEventListener('click',()=>fly(new THREE.Vector3(-560,430,760),new THREE.Vector3(110,10,160)));
document.getElementById('below').addEventListener('click',e=>{const b=e.currentTarget; const on=b.getAttribute('aria-pressed')!=='true'; b.setAttribute('aria-pressed',on); setBelow(on)});

render();
if(window.THREE&&THREE.OrbitControls){ init(); select('bldg',null,true) } else { document.getElementById('fallback').hidden=false }

