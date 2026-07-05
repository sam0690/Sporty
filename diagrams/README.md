# Sporty — Diagrams

Every diagram is reverse-engineered from the actual codebase (see `/docs` for the
explanations, citations, and reasoning behind each one — these files intentionally
contain only diagram code and a short title). Mermaid is used except where UML
notation has no native Mermaid equivalent (use case, object diagrams), where
PlantUML is used instead.

| # | Diagram | File |
|---|---|---|
| 1 | Development methodology (commit-activity timeline) | [01_development_methodology.md](01_development_methodology.md) |
| 2 | Use case diagram | [02_use_case_diagram.md](02_use_case_diagram.md) |
| 3 | Gantt chart (development timeline with dependencies) | [03_gantt_chart.md](03_gantt_chart.md) |
| 4 | Class diagram (core domain model) | [04_class_diagram.md](04_class_diagram.md) |
| 5 | Object diagram (runtime instances) | [05_object_diagram.md](05_object_diagram.md) |
| 6 | Sequence diagrams (login; full live-match flow) | [06_sequence_diagram.md](06_sequence_diagram.md) |
| 7 | State diagrams (League, Match, TransferWindow, Trade, Waiver) | [07_state_diagram.md](07_state_diagram.md) |
| 8 | Activity diagrams (login, team creation, simulation, prediction, leaderboard) | [08_activity_diagram.md](08_activity_diagram.md) |
| 9 | Refined class diagram (services, DTOs) | [09_refined_class_diagram.md](09_refined_class_diagram.md) |
| 10 | Refined sequence diagrams (transfer confirm; feeder ingestion with retry/queue) | [10_refined_sequence_diagram.md](10_refined_sequence_diagram.md) |
| 11 | Component diagram | [11_component_diagram.md](11_component_diagram.md) |
| 12 | Deployment diagram | [12_deployment_diagram.md](12_deployment_diagram.md) |

Diagrams 2 and 5 use PlantUML (`plantuml` fenced code blocks) since Mermaid has no
native use-case or object-diagram syntax; all others use Mermaid.
