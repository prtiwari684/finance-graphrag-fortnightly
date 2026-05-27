import neo4j, { Driver } from 'neo4j-driver';

let driver: Driver;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!),
      { maxConnectionPoolSize: 5 } // Keeps connections light for free instances
    );
  }
  return driver;
}