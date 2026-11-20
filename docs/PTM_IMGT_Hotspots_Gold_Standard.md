# PTM & IMGT Hotspots — Official Gold-Standard Specification

## 1. 4-Tier Risk Classification System (Gold Standard)

All Post-Translational Modification (PTM) and IMGT structural hotspot evaluations across `TAP_2024_Batch.py`, `TNP_2025_Batch.py`, `src/server/stats.ts`, `src/components/Guidelines.tsx`, and `src/components/ResultsViewer.tsx` strictly adhere to the following 4-Tier specification:

| Tier | Risk Level | Type | Amino Acid / Motif & 3D Structural Condition | Color Flag |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Intolerable**（不可接受风险） | Free Cys; N-glycosylation | **`C`** (unpaired free thiol in 3D structure, $S_\gamma\text{–}S_\gamma > 3.0\text{ \AA}$);<br>**`Nx[ST] except for NP[ST]`** (canonical N-glycosylation sequon `N-[^P]-[S/T]`) | **RED** |
| **Tier 2** | **High risk**（高风险） | Isomerization; Deamidation; Oxidation | **`NG & DG; exposed & in loops`**<br>(处于暴露环区的 `NG`、`DG`) | **RED** |
| **Tier 3** | **Moderate risk**（中等风险） | Isomerization; Deamidation; Oxidation | **`M, W, NS, NT, NN, NH, DS, DD; exposed & in loops`**<br>(处于暴露环区的 `M, W, NS, NT, NN, NH, DS, DD`) | **AMBER** |
| **Tier 4** | **Low risk**（低风险） | Isomerization; Deamidation; Oxidation | **`Nx Dx not mentioned above; exposed & in loops`**<br>(未列入前述等级的其余 15 种 `Nx` [含 `NP`] 与其余 17 种 `Dx` [含 `DP, DT, DH` 等]，且处于暴露环区) | **LIGHT_GREEN** |
| **Protected** | **Structurally Protected**（结构保护态） | β-Strand / Buried Core | Any `Nx`, `Dx`, `M`, `W` located on a rigid $\beta$-strand (`[CDR-Strand]` / `[FR-Strand]`), or buried in the hydrophobic core (`[*,Buried]`, $\text{RSA} < 7.5\%$), or located in `[FR-Loop]` when the extended FR-Loop toggle is OFF | **DARK_GREEN** |

### Mathematical Partition of Dipeptide Motifs (`Nx` and `Dx`)
- **Deamidation (`Nx`, all 20 Asn dipeptides when `exposed & in loops`)**:
  - **Tier 2 (`High risk`)**: `NG` (1 motif)
  - **Tier 3 (`Moderate risk`)**: `NS, NT, NN, NH` (4 motifs)
  - **Tier 4 (`Low risk`)**: All other 15 `Nx` motifs (`NA, NC, ND, NE, NF, NI, NK, NL, NM, NP, NQ, NR, NV, NW, NY`)
- **Isomerization (`Dx`, all 20 Asp dipeptides when `exposed & in loops`)**:
  - **Tier 2 (`High risk`)**: `DG` (1 motif)
  - **Tier 3 (`Moderate risk`)**: `DS, DD` (2 motifs)
  - **Tier 4 (`Low risk`)**: All other 17 `Dx` motifs (`DA, DC, DE, DF, DH, DI, DK, DL, DM, DN, DP, DQ, DR, DT, DV, DW, DY` — no separate `Cleavage` category)
- **Oxidation (`M` and `W` when `exposed & in loops`)**:
  - **Tier 3 (`Moderate risk`)**: `M` and `W` when `exposed & in loops`

---

## 2. Pure 3D Structure-Driven Residue Evaluation Pipeline

Every input antibody in this application is provided as a 3D `.pdb` or `.cif` structure. No sequence-only fallback heuristics are used in the 3D batch pipeline:

1. **Step 1 — Regional Identity & IMGT Numbering (`ANARCI --scheme imgt`)**:
   - Amino acid sequences are extracted directly from the cleaned 3D coordinates of each chain and numbered via `ANARCI --scheme imgt`.
   - **`CDR` Region**: IMGT positions **`27–38`** (CDR1), **`56–65`** (CDR2), and **`105–117`** (CDR3).
   - **`FR` Region**: All remaining IMGT positions (`1–26`, `39–55`, `66–104`, `118–128`).

2. **Step 2 — 3D Secondary Structure (`Loop` vs `Strand` via Kabsch-Sander DSSP Backbone H-Bonds)**:
   - Using the 3D backbone coordinates (`N, CA, C, O`) of each residue, the Kabsch & Sander (1983) electrostatic hydrogen-bond energy is evaluated across all donor-acceptor pairs ($|i - j| \ge 2$):
     $$E = 0.42 \times 0.20 \times 332 \left(\frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}}\right) < -0.5\text{ kcal/mol}$$
   - **`Strand`**: Residues participating in parallel or antiparallel $\beta$-bridges/ladders (`E/B`) or $\alpha/3_{10}/\pi$-helices (`H/G/I`). Even within an IMGT CDR interval, rigid $\beta$-hairpin stem/torso residues (e.g., CDR3 base `105–106`, `116–117`, or CDR1 C-terminal stem `37–38`) that form $\beta$-sheet hydrogen bonds are classified as **`[CDR-Strand]`** (structurally locked and protected).
   - **`Loop`**: Residues in turns, bends, or unbonded random coils (`T/S/C`), yielding **`[CDR-Loop]`** (in CDRs) or **`[FR-Loop]`** (in framework turns such as AB-turn `14–17`, CC'-turn `44–47`, C''D-turn `71–74`, DE-turn/HV4 `82–85`, and EF-turn `95–97`).

3. **Step 3 — Surface Exposure (`Exp` vs `Buried` via `PSA`)**:
   - Evaluated strictly on the reactive residue (`N`, `D`, `M`, `W`, `C`) itself using `PSA` relative side-chain solvent accessibility:
     - **`Exp`**: $\text{side\_rsa} \ge 7.5\%$
     - **`Buried`**: $\text{side\_rsa} < 7.5\%$

4. **Canonical Site Token Format**:
   $$\text{linearPos}@\text{IMGT}\{\text{imgtLabel}\}(\text{Motif})[\{\text{CDR}|\text{FR}\}\text{-}\{\text{Loop}|\text{Strand}\},\{\text{Exp}|\text{Buried}\}]$$

---

## 3. Loop Scope Toggle (`CDR-Loop Only` Default vs. `+ FR-Loop` Extended Mode)

- **Default Mode (`includeFrLoops = false` · `CDR-Loop Only — Strict 01 Parity`)**:
  - `"exposed & in loops"` strictly requires **`[CDR-Loop,Exp]`**, achieving 100% regional alignment with `01. 3D Surface & CDR` while protecting conserved germline framework turns (`[FR-Loop,Exp]`, e.g., human IGHV3 FR3 DE-loop `IMGT 82–85`) and CDR $\beta$-sheet stems (`[CDR-Strand,*]`).
- **Extended Mode (`includeFrLoops = true` · `+ FR-Loop — CDR + Framework Turns`)**:
  - Turning on the `+ FR-Loop` switch expands `"exposed & in loops"` to **`[CDR-Loop,Exp] ∪ [FR-Loop,Exp]`**, enabling comprehensive profiling of both antigen-binding CDR loops and solvent-exposed framework connecting turns (such as HV4 / DE-loop).
