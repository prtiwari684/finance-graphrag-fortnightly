# 📈 Indian Finance GraphRAG Engine

An autonomous, zero-hallucination portfolio intelligence engine that maps active Indian mutual fund holdings into a multi-hop knowledge graph. Powered by **Next.js**, **Neo4j AuraDB**, and **Google Gemma 4**, this system completely bypasses the factual limitations of traditional vector-based RAG by forcing the LLM to act as a strict database compiler.

---

## 🧭 The Core Problem & Our Moat

### The Vector RAG Flaw
Most modern financial chatbots convert text into flat coordinates via Vector Embeddings ($Cosine\ Similarity$). While great for basic semantic similarity search, they completely fail at **structured relational tracing**. If you ask a vector chatbot to find overlapping mid-cap stock allocations across 6 different mutual funds simultaneously, it bogs down, merges context window chunks incorrectly, and outputs a highly fluent, plausible-sounding **hallucination**.

### Our Solution: Relational Graph Fabric
This project shifts the boundary of "truth" away from fuzzy LLM weights and places it into a deterministic, multi-hop **Knowledge Graph**. The LLM is strictly forbidden from guessing. Instead, it reads a natural language query, compiles it into a strict **Cypher query**, extracts absolute mathematical truths from **Neo4j AuraDB**, and translates the raw data arrays back into human-friendly text.

### 🔒 The Data Handling Moat
Financial portfolio disclosures are highly dynamic—fund managers churn allocations constantly, and SEBI mandates updates every 30 days. 
* **Zero Manual Upkeep:** This system features an automated **Vercel Cron Job** data pipeline. Every month, it fires serverless sync operations that parse new disclosure payloads and execute complex structural `MERGE` mutations directly into the cloud database tier.
* **Entity Resolution:** The ingestion pipeline maps equities using unique **ISIN codes** instead of volatile string names, entirely eliminating duplicate nodes and fragmentation.

---

## 🛠️ Tech Stack & Cloud Infrastructure

* **Frontend Dashboard:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
* **Graph Database Tier:** Neo4j AuraDB (Fully Managed Enterprise Cloud Tier)
* **Inference Engine:** Google GenAI SDK (`gemma-4-31b-it` / `gemma-4-26b-a4b-it`)
* **Edge Protection Layer:** Upstash Redis (`@upstash/ratelimit` via Sliding Window)
* **Automation Lifecycle:** Vercel Serverless Cron Schedule Utilities

---

## 📐 Graph Schema Definition

The graph data layer maps interconnected networks using **4 distinct node types** and **3 strict relational vectors**:

* **Nodes:**
  * `(:AMC {name: string})` — Asset Management Companies
  * `(:Fund {name: string, total_securities: integer})` — Specific Active Mutual Fund Schemes
  * `(:Stock {isin: string, name: string})` — Unique underlying corporate equities
  * `(:Industry {name: string})` — SEBI-defined market sectors
* **Edges / Relationships:**
  * `(:AMC)-[:OFFERS]->(:Fund)`
  * `(:Fund)-[:HOLDS {allocation: float, as_of: string}]->(:Stock)`
  * `(:Stock)-[:BELONGS_TO]->(:Industry)`

---