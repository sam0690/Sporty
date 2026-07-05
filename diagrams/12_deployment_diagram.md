# Deployment Diagram

```mermaid
flowchart TB
    Browser(["Client Devices\n(Browser)"])
    Browser -->|HTTPS| Edge["Vercel / Cloudflare Edge\n(static assets + Next.js SSR)\n[CDN layer]"]
    Edge -->|"/api/v1, /api/ws\ncookie-JWT + CSRF"| Render["Render\nFastAPI (Uvicorn, PORT env)\n[App Server]"]

    Render --> PG[("Render/Neon PostgreSQL\n[Database]")]
    Render --> Upstash[("Upstash Redis\nrediss:// TLS\n[Cache/Broker/PubSub]")]
    Render --> R2[("Cloudflare R2\n[Object Storage]")]
    Render --> Metrics["/metrics endpoint\n(Prometheus format)\n[Monitoring - scrape target,\nno confirmed scraper in repo]"]

    LocalWorker["Local developer machine\ncelery worker + beat\n[Worker Node]"] --> PG
    LocalWorker --> Upstash

    FeederHost["Feeder host\nUvicorn + asyncio sim loop\n[App Server]"] -->|"POST /api/v1/feed/*\nX-Feeder-Secret"| Render
    FeederHost --> FeederDB[("Feeder's own PostgreSQL\n[Database]")]

    Render --> Google["Google OAuth\n[External API]"]
    Render --> Resend["Resend\n[External API - email]"]
    LocalWorker -.->|disabled: LIVE_POLLING_ENABLED=False| RapidAPI["RapidAPI\nAPI-Football / API-NBA\n[External API]"]

    Kafka[("Kafka broker\n[Message Queue - dormant,\nREALTIME_PIPELINE_ENABLED=False,\nnot provisioned in repo]")]
    Render -.-> Kafka

    classDef dormant stroke-dasharray: 5 5;
    class Kafka dormant;
```

**Not evidenced in the repository** (so intentionally omitted as concrete nodes
above rather than invented): a dedicated reverse proxy/load balancer in front of
Render (Render terminates TLS and load-balances internally, but no separate
proxy/LB config exists in this repo), a logging aggregation stack, a backup-service
integration, and a Kubernetes/container-orchestration layer — this is a
platform-as-a-service deployment (Render + Vercel/Cloudflare + Upstash + R2), not a
self-managed cluster.
