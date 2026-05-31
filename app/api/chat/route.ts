import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getNeo4jDriver } from '@/lib/neo4j';
import neo4j from 'neo4j-driver';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Initialise rate limiter — 10 requests per user IP per minute (sliding window)
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'finance-graphrag',
      })
    : null;

// Recursively flatten Neo4j Integer/Float objects
function flattenNeo4j(value: any): any {
  if (neo4j.isInt(value)) return value.toNumber();
  if (value instanceof neo4j.types.Integer) return value.toNumber();
  if (Array.isArray(value)) return value.map(flattenNeo4j);
  if (value !== null && typeof value === 'object') {
    if (value.properties) return flattenNeo4j(value.properties);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, flattenNeo4j(v)])
    );
  }
  return value;
}

export async function POST(req: Request) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  if (ratelimit) {
    // Use the real client IP; fall back to a static key for local dev
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      '127.0.0.1';

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please wait a moment before querying again.',
          limit,
          remaining,
          reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      );
    }
  }

  // ── Main pipeline ──────────────────────────────────────────────────────────
  try {
    const { question } = await req.json();

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { error: 'Question must be a non-empty string.' },
        { status: 400 }
      );
    }

    const cypherPrompt = `
    You are a strict Text-to-Cypher translator for an Indian Mutual Fund Graph database.
    Convert the user's natural language question into a syntactically correct Neo4j Cypher query.
    SCHEMA:
    (:AMC {name})-[:OFFERS]->(:Fund {name, total_securities})-[:HOLDS {allocation, as_of}]->(:Stock {name})-[:BELONGS_TO]->(:Industry {name})
    STRICT RULES FOR USER STRING INPUTS:
        1. Users will type shortcuts like "hdfc", "sbi", "parag parikh" or stock names in lowercase.
        2. NEVER use absolute equality (=) for text fields provided by the user.
        3. ALWAYS apply case-insensitive substring matching:
           - Use: WHERE toLower(a.name) CONTAINS toLower("HDFC")
           - Or: WHERE a.name =~ "(?i).*HDFC.*"
    STRICT RULES FOR OUTPUT ALIASES:
        1. NEVER return raw node properties with dots (e.g., Do NOT use: RETURN s.name).
        2. ALWAYS alias returns with clean English headers using the 'AS' keyword.
           - Use: RETURN s.name AS StockName, r.allocation AS AllocationPercentage
        3. Return EXACTLY a JSON string with the key "cypher". Do not wrap in markdown.
    Question: ${question}
`;

    const cypherResult = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: cypherPrompt,
    });

    // ── Cypher parse with safe error handling ──────────────────────────────
    let cypher: string;
    try {
      const cleanJsonText = cypherResult.text!.trim().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJsonText);
      if (!parsed.cypher || typeof parsed.cypher !== 'string') {
        throw new Error('Missing "cypher" key in model response.');
      }
      cypher = parsed.cypher;
    } catch {
      return NextResponse.json(
        {
          error: "Couldn't interpret your question into a graph query. Try rephrasing it — e.g. 'Which stocks does HDFC hold?' or 'Top sectors by allocation?'",
        },
        { status: 422 }
      );
    }

    console.log('Generated Cypher:', cypher);

    // ── Neo4j execution ────────────────────────────────────────────────────
    const driver = getNeo4jDriver();
    const session = driver.session();
    let graphFacts: any[] = [];

    try {
      const result = await session.run(cypher);
      graphFacts = result.records.map(record => flattenNeo4j(record.toObject()));
    } catch (dbError: any) {
      console.error('Neo4j query error:', dbError.message);
      return NextResponse.json(
        {
          error: 'The generated query could not run against the database. Try rephrasing your question.',
          cypher,
        },
        { status: 422 }
      );
    } finally {
      await session.close();
    }

    console.log('Graph facts count:', graphFacts.length);
    console.log('Graph facts sample:', JSON.stringify(graphFacts.slice(0, 3), null, 2));

    const synthesisPrompt = `
      You are a financial data assistant. Answer the user's question using the database results below.

      Question: "${question}"

      Database Results (${graphFacts.length} records found):
      ${JSON.stringify(graphFacts, null, 2)}

      Instructions:
      - If records are present, summarize the answer clearly in plain English.
      - List stocks, funds, or AMCs in a readable format.
      - If the array is empty, say the database returned no matching records and suggest the user check the spelling or try a broader term.
      - Never say "no information available" if records exist above.
    `;

    const finalModelResponse = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: synthesisPrompt,
    });

    return NextResponse.json({
      cypher,
      recordCount: graphFacts.length,
      answer: finalModelResponse.text,
    });
  } catch (error: any) {
    console.error('Execution Pipeline Failure:', error);
    return NextResponse.json(
      { error: 'Failed to process graph reasoning loop', detail: error.message },
      { status: 500 }
    );
  }
}