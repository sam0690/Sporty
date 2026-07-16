# Refined Sequence Diagrams — Validation, Auth, Logging, Error Handling, Cache, Retry, Queue

## A. Confirm a staged transfer

```mermaid
sequenceDiagram
    autonumber
    participant U as Browser
    participant MW as Middleware (CORS/CSRF/RateLimit)
    participant API as api/v1/transfers.py
    participant SESS as transfer_session_service (Redis)
    participant SVC as transfer_service.confirm_transfers
    participant DB as PostgreSQL
    participant R as Redis (mirrors)
    participant LOG as Logger

    U->>MW: POST /api/v1/transfers/confirm (X-CSRF-Token)
    MW->>MW: validate CSRF hash in Redis
    alt CSRF invalid
        MW-->>U: 403 + fresh token
    end
    MW->>API: forward (auth cookie validated: get_current_active_user)
    API->>SESS: load session:{user_id}
    alt session missing/expired
        SESS-->>API: None
        API-->>U: 404 No active transfer session
    end
    SESS-->>API: pending in/out lists + running budget
    API->>SVC: confirm_transfers(db, session, user)
    SVC->>DB: re-validate squad size, budget, mixed-sport split (authoritative)
    alt re-validation fails
        SVC->>LOG: log warning (stale session vs DB drift)
        SVC-->>API: 409 Conflict
        API-->>U: 409 + reason
    end
    SVC->>DB: release outgoing TeamPlayer rows (released_window_id = window)
    SVC->>DB: insert incoming TeamPlayer rows
    SVC->>DB: write BudgetTransaction rows + update current_budget
    SVC->>DB: write Transfer audit rows (swap pairs)
    API->>DB: commit (router owns transaction)
    SVC->>R: mirror team:{user_id}, budget:{user_id}, player:prices
    alt Redis mirror update fails
        SVC->>LOG: log error (non-fatal - DB is source of truth)
    end
    SVC->>SESS: drop session:{user_id}
    API-->>U: 200 + updated squad/budget (response serialized via Pydantic)
```

## B. Feeder match-result ingestion with retry and queue publishing

```mermaid
sequenceDiagram
    autonumber
    participant F as Feeder simulation loop
    participant BE as backend api/v1/feed.py
    participant AUTH as verify_feeder_secret
    participant DB as PostgreSQL
    participant R as Redis (pub/sub + hash)
    participant TRIG as scoring/trigger.py
    participant Q as Celery (Redis broker)
    participant W as Celery worker
    participant LOG as Logger

    loop up to 3 attempts, backoff 1.5^n
        F->>BE: POST /feed/match-result (X-Feeder-Secret)
        alt push fails (network/5xx)
            F->>LOG: log error, sleep backoff
        end
    end
    BE->>AUTH: compare_digest(header, FEEDER_SECRET)
    alt secret missing
        AUTH-->>F: 503 Service Unavailable
    else mismatch
        AUTH-->>F: 401 Unauthorized
    end
    AUTH-->>BE: ok
    BE->>DB: INSERT live_events ... ON CONFLICT (match_id,event_id) DO NOTHING
    BE->>DB: update Match.home_score/away_score/status
    BE->>R: PUBLISH SCORE_UPDATE (match:{key})
    BE->>R: HINCRBYFLOAT fantasy:match:{key}:player:{id}
    BE->>R: PUBLISH FANTASY_POINTS_DELTA
    alt live -> finished transition
        BE->>DB: persist_match_stats (fold events into stat tables)
        BE->>DB: commit
        BE->>TRIG: enqueue_scoring_for_finished_match(window)
        TRIG->>R: SET score:enqueue:{window} NX EX 300 (throttle)
        alt throttle key already set
            TRIG->>LOG: log skip (already enqueued)
        else acquired
            TRIG->>Q: send_task score.transfer_window(window_id) ignore_result=True
            alt broker error
                TRIG->>LOG: log error, release throttle key for retry
            end
        end
    end
    BE-->>F: 200 ack (best-effort; ingestion never fails on downstream push/enqueue errors)
    Q-->>W: deliver task
    W->>R: acquire redis_lock(lock:score:{league}:{window})
    W->>DB: player_scoring UPDATE, upsert_team_weekly_scores, RANK()
    W->>DB: resolve_matchups_for_window (H2H leagues: compare points → win/loss/tie)
    W->>R: invalidate leaderboard cache
    W->>R: release lock (Lua: delete if token matches)
```
