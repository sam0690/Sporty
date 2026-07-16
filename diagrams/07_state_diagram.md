# State Diagrams

## League lifecycle (`League.status`)

```mermaid
stateDiagram-v2
    [*] --> SETUP
    SETUP --> DRAFTING : owner starts draft (draft leagues, >=2 members, >=1 sport)
    DRAFTING --> ACTIVE : last draft pick auto-advances
    SETUP --> ACTIVE : budget league, start_date reached (daily cron, >= min members)
    ACTIVE --> COMPLETED : end_date passed (daily cron)
    COMPLETED --> [*]

    note right of ACTIVE
        Entering ACTIVE generates the full-season
        H2H matchup schedule (once, idempotent)
        when is_head_to_head=true
    end note
    note right of COMPLETED
        POST /renew spawns a NEW League row in SETUP
        (same season_group_id lineage, season_number+1;
        dynasty=true carries rosters over)
    end note
```

## Match status (Sporty `Match.status` + feeder `SimulationState.status`)

```mermaid
stateDiagram-v2
    [*] --> scheduled
    scheduled --> live : simulation/poll starts (kickoff push)
    live --> finished : final minute or overtime resolves
    live --> stopped : POST /simulate/{id}/stop honored
    stopped --> finished : Match.status forced finished
    scheduled --> postponed
    scheduled --> cancelled
    live --> error : unhandled exception in run_simulation
    error --> [*]
    finished --> [*]
```

## Transfer Window lock states

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> TransfersLocked : transfer_deadline_at passed\n(Celery transfer.auto_lock_expired)
    TransfersLocked --> FullyLocked : lineup_deadline_at passed\n(Celery lineup.auto_lock_expired)
    FullyLocked --> [*]
```

## Trade Offer (`trade_offers.status`)

```mermaid
stateDiagram-v2
    [*] --> proposed
    proposed --> accepted : recipient accepts (opens 24h veto window)
    proposed --> rejected : recipient rejects
    proposed --> cancelled : proposer cancels
    accepted --> vetoed : commissioner vetoes
    accepted --> executed : veto_deadline passes (finalize_due_trades)
    rejected --> [*]
    cancelled --> [*]
    vetoed --> [*]
    executed --> [*]
```

## H2H Matchup result (`league_matchups.result`)

```mermaid
stateDiagram-v2
    [*] --> unresolved : schedule generated at ACTIVE (result NULL)
    [*] --> bye : odd team count, no opponent this round
    unresolved --> home_win : window scored, home_points > away_points
    unresolved --> away_win : window scored, away_points > home_points
    unresolved --> tie : window scored, equal points
    home_win --> [*]
    away_win --> [*]
    tie --> [*]
    bye --> [*]
```

## Support Ticket (`support_tickets.status`)

```mermaid
stateDiagram-v2
    [*] --> open : user opens ticket
    open --> in_progress : admin triages/assigns
    in_progress --> waiting_on_user : admin needs info
    waiting_on_user --> in_progress : user replies
    in_progress --> resolved : admin resolves
    open --> resolved
    resolved --> closed
    closed --> [*]
```

## Waiver Claim (`waiver_claims.status`)

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> success : processed, higher priority than conflicts
    pending --> failed : validation failed at processing time
    pending --> cancelled : manager cancels before processing
    success --> [*]
    failed --> [*]
    cancelled --> [*]
```
