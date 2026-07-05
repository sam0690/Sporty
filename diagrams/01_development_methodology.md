# Development Methodology — Continuous / Kanban-style Trunk Flow

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    title Sporty — Actual Commit Activity Timeline (derived from git log)
    axisFormat  %b %d

    section Foundations
    Initial commit + backend scaffold        :done, f1, 2026-03-07, 10d
    Scoring engines                          :done, f2, 2026-03-17, 11d
    Frontend initialization                  :done, f3, 2026-03-28, 2d

    section Core Product
    Auth flows + API/route setup             :done, c1, 2026-03-29, 20d
    Landing + matches pages (redesigns)      :done, c2, 2026-04-18, 20d
    Scoring: starter-only + auto-subs         :done, c3, 2026-05-08, 15d

    section Public Discovery
    Public fixtures browsing                 :done, d1, 2026-05-23, 10d
    Fixture page redesign                     :done, d2, 2026-06-02, 5d

    section Draft Roster System
    Draft/build teams fixes                   :done, r1, 2026-06-07, 10d
    FPL-style roster mgmt (waivers+trades)     :active, r2, 2026-06-17, 15d
    Player dedupe + photos/logos + R2 storage :active, r3, 2026-07-01, 4d

    section Live/Realtime Polish
    Match predict metrics                     :done, l1, 2026-06-27, 3d
    Team crest + player photo rendering        :done, l2, 2026-07-01, 2d
    Constraints fully wired                    :milestone, m1, 2026-07-04, 0d
```
