# Diagram Examples for Review

> Review these examples and note your preferences — which styles, layouts, and detail levels you like or dislike. Your feedback will shape the skill that tells Claude how to generate diagrams from Companies House data.

Each section shows **intentional variants** of the same diagram type using real company data.

---

## 1. Ownership Flowcharts

Real data from **All Seasons Flowers Holdings Limited** (13554616) — 3 active PSCs: one corporate entity and two individuals, each owning 25-50%.

### Variant A: Top-down, colour-coded by PSC type

```mermaid
graph TD
    C["All Seasons Flowers Holdings Ltd\n13554616 | Active\nPrivate Limited Company"]

    P1["All Seasons Flowers\nInvestments Ltd\n16298872\n(Corporate PSC)"]
    P2["Mrs Louise Cromey\n(Individual)"]
    P3["Mr Simon Cromey\n(Individual)"]

    P1 -->|"25-50% shares\n25-50% votes"| C
    P2 -->|"25-50% shares\n25-50% votes"| C
    P3 -->|"25-50% shares\n25-50% votes"| C

    style C fill:#1e3a5f,color:#fff,stroke:#0d253f
    style P1 fill:#7c3aed,color:#fff,stroke:#5b21b6
    style P2 fill:#0d9488,color:#fff,stroke:#0f766e
    style P3 fill:#0d9488,color:#fff,stroke:#0f766e
```

### Variant B: Top-down, minimal, no colours

```mermaid
graph TD
    P1["All Seasons Flowers Investments Ltd (Corporate)\n25-50% shares"] --> C["All Seasons Flowers Holdings Ltd"]
    P2["Louise Cromey\n25-50% shares"] --> C
    P3["Simon Cromey\n25-50% shares"] --> C
```

### Variant C: Left-to-right, badges for control type

```mermaid
graph LR
    C["🏢 All Seasons Flowers\nHoldings Ltd\n13554616"]

    P1["🏛️ All Seasons Flowers\nInvestments Ltd"]
    P2["👤 Louise Cromey"]
    P3["👤 Simon Cromey"]

    P1 -- "25-50% shares + votes" --> C
    P2 -- "25-50% shares + votes" --> C
    P3 -- "25-50% shares + votes" --> C

    style C fill:#1e40af,color:#fff
    style P1 fill:#6d28d9,color:#fff
    style P2 fill:#059669,color:#fff
    style P3 fill:#059669,color:#fff
```

### Variant D: Top-down, with ceased PSCs shown as dashed

Real data from **Varley International Holdings Limited** (12075176) — shows ownership change over time.

```mermaid
graph TD
    C["Varley International Holdings Ltd\n12075176 | Active"]

    A1["Lavendo Investments Ltd\n(Corporate PSC)\nActive since Dec 2023"]
    A2["Anders Holch Povlsen\n(Danish national)\nActive since Dec 2023"]

    X1["Brightfolk A/S\n(Danish corporate)\nCeased Dec 2023"]:::ceased
    X2["Benjamin Mead\nCeased Dec 2023"]:::ceased
    X3["Lara Mead\nCeased Dec 2023"]:::ceased

    A1 -->|"25-50% shares + votes"| C
    A2 -->|"25-50% shares + votes"| C
    X1 -.->|"formerly 25-50%"| C
    X2 -.->|"formerly 25-50%"| C
    X3 -.->|"formerly 25-50%"| C

    style C fill:#1e3a5f,color:#fff,stroke:#0d253f
    style A1 fill:#7c3aed,color:#fff,stroke:#5b21b6
    style A2 fill:#0d9488,color:#fff,stroke:#0f766e
    classDef ceased fill:#94a3b8,color:#fff,stroke:#64748b,stroke-dasharray: 5 5
```

---

## 2. Officer Network Graphs

Real data from **Simon Cromey** — director of 4 companies (3 active, 1 resigned).

### Variant A: Left-to-right, status colour-coded

```mermaid
graph LR
    O["Simon Cromey"]

    C1["Flowers by Post Ltd\nFC034234"]
    C2["All Seasons Flowers\nHoldings Ltd\n13554616"]
    C3["All Seasons Flowers Ltd\n03472499"]
    C4["Flowers by Bike Ltd\n11728782"]:::dissolved

    O -->|"Director\n(active)"| C1
    O -->|"Director\n(active)"| C2
    O -->|"Director\n(active)"| C3
    O -->|"Director\n(resigned)"| C4

    style O fill:#1e40af,color:#fff,stroke:#1e3a8a
    style C1 fill:#059669,color:#fff,stroke:#047857
    style C2 fill:#059669,color:#fff,stroke:#047857
    style C3 fill:#059669,color:#fff,stroke:#047857
    classDef dissolved fill:#dc2626,color:#fff,stroke:#b91c1c
```

### Variant B: Left-to-right, minimal with role labels only

```mermaid
graph LR
    O(("Simon\nCromey"))

    C1["Flowers by Post Ltd"]
    C2["All Seasons Flowers Holdings Ltd"]
    C3["All Seasons Flowers Ltd"]
    C4["Flowers by Bike Ltd ✗"]

    O --> C1
    O --> C2
    O --> C3
    O -.-> C4
```

### Variant C: Top-down, grouped by status

```mermaid
graph TD
    O["Simon Cromey\nDirector"]

    subgraph Active
        C1["Flowers by Post Ltd\nFC034234"]
        C2["All Seasons Flowers Holdings Ltd\n13554616"]
        C3["All Seasons Flowers Ltd\n03472499"]
    end

    subgraph Resigned
        C4["Flowers by Bike Ltd\n11728782"]
    end

    O --> C1
    O --> C2
    O --> C3
    O -.-> C4

    style O fill:#1e40af,color:#fff
    style C1 fill:#059669,color:#fff
    style C2 fill:#059669,color:#fff
    style C3 fill:#059669,color:#fff
    style C4 fill:#94a3b8,color:#fff
```

---

## 3. Filing Timeline

Real data from **BrewDog PLC** (SC311560) — curated key events from 2006 to 2026, showing the company's journey to administration.

### Variant A: Sectioned by category

```mermaid
timeline
    title BrewDog PLC — Key Events
    section Formation
        Nov 2006 : Incorporated in Scotland
    section Growth Phase
        Jun 2009 : First US-based directors appointed (Foglio, Greggor)
        Aug 2012 : Neil Simpson joins as Director
        Dec 2012 : Martin Dempster joins as Director
    section Board Changes
        Jan 2016 : Allison Green and Gareth Bath join
        Apr 2017 : Frances Jack and James O'Hara join
        Sep 2021 : Allan Leighton joins as Director
        Jan 2022 : Charles Greggor resigns after 13 years
    section Recent Events
        May 2023 : Giny Boer appointed Director
        Aug 2025 : Alan Dickie resigns (co-founder, 19 years)
        Mar 2026 : Administration — administrators appointed
                 : James Watt resigns (co-founder)
                 : Mass board resignations (4 directors, 1 secretary)
```

### Variant B: Flat timeline, dates and events only

```mermaid
timeline
    title BrewDog PLC (SC311560)
    Nov 2006 : Incorporated
    Jun 2009 : First external directors
    Sep 2021 : Allan Leighton joins board
    May 2023 : Giny Boer appointed CEO
    Aug 2025 : Co-founder Alan Dickie resigns
    Dec 2024 : Two directors resign
    Mar 2026 : Enters administration
             : Co-founder James Watt resigns
```

---

## 4. Officer Tenure (Gantt)

Real data from **BrewDog PLC** (SC311560) — directors only, showing the full board history. BrewDog was incorporated Nov 2006 and entered administration Mar 2026.

### Variant A: Full board history, grouped by status

```mermaid
gantt
    title BrewDog PLC — Director Tenure
    dateFormat YYYY-MM-DD
    axisFormat %Y

    section Active
        Giny Boer            :active, 2023-05-31, 2026-03-25
        Allan Leighton       :active, 2021-09-10, 2026-03-25

    section Resigned 2026
        James Watt (co-founder) :done, 2006-11-07, 2026-03-24
        James O'Hara         :done, 2017-04-06, 2026-03-06
        Erik Johnson          :done, 2023-01-30, 2026-03-06
        David Ligon           :done, 2024-12-19, 2026-03-06
        George Croft          :done, 2025-03-31, 2026-03-06

    section Resigned Earlier
        Alan Dickie (co-founder) :done, 2006-11-07, 2025-08-20
        Neil Simpson          :done, 2012-08-06, 2024-02-08
        Frances Jack          :done, 2017-04-06, 2024-12-19
        Alexander Gilmore     :done, 2023-01-30, 2024-12-19
        Niall McCallum        :done, 2020-10-19, 2023-10-17
        David McDowall        :done, 2015-09-21, 2022-12-21
        Charles Greggor       :done, 2009-06-22, 2022-01-22
        Allison Green         :done, 2016-01-04, 2019-12-31
        Anthony Foglio        :done, 2009-06-22, 2014-08-28
        Martin Dempster       :done, 2012-12-28, 2015-10-30
```

### Variant B: Simplified — co-founders and key directors only

```mermaid
gantt
    title BrewDog PLC — Key Directors
    dateFormat YYYY-MM-DD
    axisFormat %Y

    section Co-founders
        James Watt       :done, 2006-11-07, 2026-03-24
        Alan Dickie       :done, 2006-11-07, 2025-08-20

    section Key Appointments
        Charles Greggor   :done, 2009-06-22, 2022-01-22
        Allan Leighton    :active, 2021-09-10, 2026-03-25
        Giny Boer (CEO)   :active, 2023-05-31, 2026-03-25
```

---

## 5. Due Diligence Risk (Quadrant)

Hypothetical example — a company with multiple flags at different severity levels.

### Variant A: Severity vs urgency matrix

```mermaid
quadrantChart
    title Risk Assessment
    x-axis Low Severity --> High Severity
    y-axis Low Urgency --> High Urgency
    quadrant-1 Immediate Action
    quadrant-2 Monitor
    quadrant-3 Note
    quadrant-4 Investigate
    In Administration: [0.95, 0.95]
    Accounts Overdue: [0.70, 0.80]
    Recent Mass Resignations: [0.65, 0.70]
    Outstanding Charges: [0.55, 0.40]
    No Active PSCs: [0.40, 0.30]
    Company Under 1 Year: [0.15, 0.15]
```

### Variant B: Simple severity only (pie chart of flag counts)

```mermaid
pie title Risk Flags by Severity
    "High" : 2
    "Medium" : 1
    "Low" : 3
```

---

## 6. Charge Lifecycle

Real data from **Tesco PLC** (00445790) — 9 charges, showing outstanding vs satisfied.

### Variant A: Gantt-style timeline

```mermaid
gantt
    title Tesco PLC — Charges
    dateFormat YYYY-MM-DD
    axisFormat %Y

    section Outstanding
        Account Security (Pension Scheme) :active, 2009-11-04, 2026-03-25
        Account Security (Pension Plan)   :active, 2009-11-04, 2026-03-25

    section Satisfied
        Account Security (Exec Scheme) :done, 2009-03-27, 2009-11-25
        Account Security (Staff Scheme) :done, 2009-03-27, 2009-11-25
        Share Charge (RBS Aerospace)    :done, 2005-05-13, 2009-10-09
        Debenture (Deans Food Group)    :done, 2003-04-03, 2009-12-18
        Debenture (Adminstore Ltd)      :done, 2002-01-22, 2009-12-18
```

### Variant B: Flowchart showing current state

```mermaid
graph TD
    T["Tesco PLC\n00445790"]

    subgraph Outstanding["Outstanding Charges (2)"]
        O1["Pension Scheme\nAccount Security\nSince Nov 2009"]
        O2["Pension Plan\nAccount Security\nSince Nov 2009"]
    end

    subgraph Satisfied["Satisfied (7)"]
        S1["5 charges satisfied\n2009"]
        S2["2 charges satisfied\nPre-2009"]
    end

    T --- Outstanding
    T --- Satisfied

    style T fill:#1e3a5f,color:#fff
    style O1 fill:#dc2626,color:#fff
    style O2 fill:#dc2626,color:#fff
    style S1 fill:#059669,color:#fff
    style S2 fill:#059669,color:#fff
```

---

## What to tell me

For each section, note:
- Which variant you prefer (A, B, C, D)
- Anything you'd change (more/less detail, different colours, different layout direction)
- Whether the diagram type itself is worth including in the skill at all
- Any diagram types you want to see that aren't here
