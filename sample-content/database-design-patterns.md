# Database Design & Patterns

## Introduction

Database design is the foundation of any application. Good design ensures data integrity, performance, and scalability. This guide covers relational and NoSQL database patterns.

## Relational Database Design

### Normalization

**First Normal Form (1NF):**

- Atomic values (no multi-valued attributes)
- No repeating groups

```sql
-- Violates 1NF (multiple emails in one field)
CREATE TABLE users_bad (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    emails VARCHAR(500)  -- 'alice@a.com, alice@b.com'
);

-- 1NF Compliant
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE user_emails (
    user_id INT REFERENCES users(id),
    email VARCHAR(255),
    PRIMARY KEY (user_id, email)
);
```

**Second Normal Form (2NF):**

- Must be in 1NF
- No partial dependencies (all non-key attributes depend on entire key)

```sql
-- Violates 2NF (product_name depends only on product_id, not order_id)
CREATE TABLE order_items_bad (
    order_id INT,
    product_id INT,
    product_name VARCHAR(255),  -- Only depends on product_id
    quantity INT,
    PRIMARY KEY (order_id, product_id)
);

-- 2NF Compliant
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE order_items (
    order_id INT,
    product_id INT REFERENCES products(id),
    quantity INT,
    PRIMARY KEY (order_id, product_id)
);
```

**Third Normal Form (3NF):**

- Must be in 2NF
- No transitive dependencies (non-key attributes don't depend on other non-key attributes)

```sql
-- Violates 3NF (zip_code determines city/state)
CREATE TABLE customers_bad (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    zip_code VARCHAR(10),
    city VARCHAR(100),      -- Depends on zip_code
    state VARCHAR(100)      -- Depends on zip_code
);

-- 3NF Compliant
CREATE TABLE zip_codes (
    code VARCHAR(10) PRIMARY KEY,
    city VARCHAR(100),
    state VARCHAR(100)
);

CREATE TABLE customers (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    zip_code VARCHAR(10) REFERENCES zip_codes(code)
);
```

### Common Schema Patterns

**Many-to-Many Relationships:**

```sql
-- Users can have many roles, roles can have many users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Junction/Join table
CREATE TABLE user_roles (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- Query: Get all users with their roles
SELECT u.username, array_agg(r.name) as roles
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id, u.username;
```

**Tree Structures (Self-Referencing):**

```sql
-- Organizational hierarchy, comment threads
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT REFERENCES categories(id),
    path LTREE  -- PostgreSQL specific for efficient tree queries
);

-- Get all descendants
SELECT * FROM categories
WHERE path <@ (SELECT path FROM categories WHERE id = 5);

-- Get all ancestors
SELECT * FROM categories
WHERE path @> (SELECT path FROM categories WHERE id = 10);

-- Alternative: Closure Table pattern
CREATE TABLE category_tree (
    ancestor_id INT REFERENCES categories(id),
    descendant_id INT REFERENCES categories(id),
    depth INT,
    PRIMARY KEY (ancestor_id, descendant_id)
);
```

**Versioning/Soft Deletes:**

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,  -- Soft delete
    version INT DEFAULT 1  -- Optimistic locking
);

-- Query active products only
SELECT * FROM products WHERE deleted_at IS NULL;

-- Optimistic lock update
UPDATE products
SET price = 29.99, version = version + 1
WHERE id = 123 AND version = 5;
-- If version changed, update fails (concurrent modification)
```

### Indexing Strategies

**Types of Indexes:**

```sql
-- B-Tree (default) - good for equality and range queries
CREATE INDEX idx_users_email ON users(email);

-- Hash - good only for equality
CREATE INDEX idx_users_phone ON users USING HASH (phone);

-- GiST - for geometric data, full-text search
CREATE INDEX idx_locations_geom ON locations USING GIST (geom);

-- GIN - for arrays, JSONB, full-text
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);

-- Partial index - only for specific condition
CREATE INDEX idx_active_users ON users(created_at)
WHERE deleted_at IS NULL;

-- Composite index - order matters!
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);
-- Good for: WHERE user_id = X ORDER BY created_at DESC
-- Bad for: WHERE created_at > X (can't use index)

-- Covering index - includes all needed columns
CREATE INDEX idx_orders_covering ON orders(user_id, created_at)
INCLUDE (total_amount, status);
```

**Index Selection Guidelines:**

- Index columns used in WHERE, JOIN, ORDER BY
- Don't over-index (writes become slower)
- Consider index-only scans
- Monitor with EXPLAIN ANALYZE
- Remove unused indexes

### Query Optimization

**Efficient Pagination:**

```sql
-- Offset pagination (slow for large offsets)
SELECT * FROM posts
ORDER BY created_at DESC
LIMIT 10 OFFSET 10000;

-- Cursor/keyset pagination (fast)
SELECT * FROM posts
WHERE created_at < '2024-01-01'
ORDER BY created_at DESC
LIMIT 10;

-- With unique tiebreaker
SELECT * FROM posts
WHERE (created_at, id) < ('2024-01-01', 12345)
ORDER BY created_at DESC, id DESC
LIMIT 10;
```

**N+1 Query Problem:**

```typescript
// Bad: N+1 queries
const posts = await db.query("SELECT * FROM posts LIMIT 10");
for (const post of posts) {
  // This runs 10 times!
  post.author = await db.query("SELECT * FROM users WHERE id = ?", [
    post.author_id
  ]);
}

// Good: Single query with JOIN
const posts = await db.query(`
  SELECT p.*, u.name as author_name, u.email as author_email
  FROM posts p
  JOIN users u ON p.author_id = u.id
  LIMIT 10
`);

// Or: Batch fetch
const posts = await db.query("SELECT * FROM posts LIMIT 10");
const authorIds = posts.map((p) => p.author_id);
const authors = await db.query("SELECT * FROM users WHERE id = ANY($1)", [
  authorIds
]);
const authorMap = new Map(authors.map((a) => [a.id, a]));
posts.forEach((p) => (p.author = authorMap.get(p.author_id)));
```

## NoSQL Patterns

### Document Store (MongoDB)

**Schema Design:**

```javascript
// Embedding vs Referencing

// Embedded (one-to-few, frequently accessed together)
const user = {
  _id: ObjectId("..."),
  name: "Alice",
  email: "alice@example.com",
  addresses: [
    { street: "123 Main", city: "NYC", primary: true },
    { street: "456 Oak", city: "LA", primary: false }
  ]
};

// Referenced (one-to-many, many-to-many)
const post = {
  _id: ObjectId("..."),
  title: "My Post",
  author_id: ObjectId("..."),  // Reference to users collection
  tag_ids: [ObjectId("..."), ObjectId("...")]  // References to tags
};

// Bucketing pattern (time-series data)
const sensorReadings = {
  sensor_id: ObjectId("..."),
  date: ISODate("2024-01-15"),
  readings: [
    { hour: 0, values: [23.5, 23.6, 23.7, ...] },  // Hour bucket
    { hour: 1, values: [23.4, 23.5, 23.6, ...] },
    // ... 24 hours
  ]
};
```

**Common Patterns:**

```javascript
// Polymorphic pattern (multiple types in one collection)
const events = [
  {
    _id: ObjectId("..."),
    type: "user_signup",
    user_id: ObjectId("..."),
    timestamp: ISODate("...")
  },
  {
    _id: ObjectId("..."),
    type: "purchase",
    user_id: ObjectId("..."),
    amount: 99.99,
    timestamp: ISODate("...")
  }
];

// Schema versioning
const document = {
  _id: ObjectId("..."),
  schema_version: 2,  // For migrations
  data: { ... }
};

// Computed/Pre-aggregated pattern
const monthlyStats = {
  user_id: ObjectId("..."),
  month: "2024-01",
  totalPosts: 42,
  totalLikes: 1500,
  avgEngagement: 0.35,
  dailyBreakdown: [
    { day: 1, posts: 2, likes: 50 },
    { day: 2, posts: 3, likes: 75 },
    // ...
  ]
};
```

### Key-Value Store (Redis)

**Data Structures:**

```redis
# Strings - caching, counters
SET user:123:session "session_data"
EXPIRE user:123:session 3600

INCR view_count:post:456
INCRBY view_count:post:456 5

# Hashes - objects
HSET user:123 name "Alice" email "alice@example.com" age 30
HGET user:123 name
HGETALL user:123

# Lists - queues, timelines
LPUSH recent_posts "post:1"
LPUSH recent_posts "post:2"
LRANGE recent_posts 0 9  # Get top 10

# Sets - unique collections, relationships
SADD user:123:friends 456 789
SISMEMBER user:123:friends 456  # Check friendship
SINTER user:123:friends user:456:friends  # Mutual friends

# Sorted Sets - leaderboards, time-series
ZADD leaderboard 1500 "player:alice"
ZADD leaderboard 2000 "player:bob"
ZREVRANGE leaderboard 0 9 WITHSCORES  # Top 10
ZINCRBY leaderboard 100 "player:alice"  # Add points

# Geospatial - location-based features
GEOADD locations 13.361389 38.115556 "Palermo"
GEOADD locations 15.087269 37.502669 "Catania"
GEODIST locations Palermo Catania KM
GEORADIUS locations 15 37 100 KM  # Find locations within 100km
```

**Caching Patterns:**

```typescript
// Cache-aside (Lazy Loading)
async function getUser(userId: string): Promise<User> {
  // Try cache first
  let user = await redis.get(`user:${userId}`);
  if (user) return JSON.parse(user);

  // Cache miss - fetch from DB
  user = await db.users.findById(userId);
  if (user) {
    await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));
  }

  return user;
}

// Write-through
async function updateUser(userId: string, data: Partial<User>) {
  // Update DB first
  const user = await db.users.update(userId, data);

  // Then update cache
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));

  return user;
}

// Cache invalidation strategies
async function deleteUser(userId: string) {
  // Delete from DB
  await db.users.delete(userId);

  // Invalidate cache
  await redis.del(`user:${userId}`);

  // Or: Set short TTL for eventual consistency
  await redis.expire(`user:${userId}`, 60);
}
```

### Wide-Column Store (Cassandra)

**Data Modeling:**

```sql
-- Query-first design: Tables optimized for specific queries

-- Time-series data
CREATE TABLE sensor_readings (
    sensor_id UUID,
    date DATE,
    timestamp TIMESTAMP,
    temperature DOUBLE,
    humidity DOUBLE,
    PRIMARY KEY ((sensor_id, date), timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);

-- Query: Get readings for sensor on specific date
SELECT * FROM sensor_readings
WHERE sensor_id = ? AND date = ?
LIMIT 100;

-- User timeline (materialized view pattern)
CREATE TABLE user_timeline (
    user_id UUID,
    tweet_id TIMEUUID,
    author_id UUID,
    content TEXT,
    PRIMARY KEY (user_id, tweet_id)
) WITH CLUSTERING ORDER BY (tweet_id DESC);

-- Denormalized for fast reads
CREATE TABLE tweet_by_author (
    author_id UUID,
    tweet_id TIMEUUID,
    content TEXT,
    PRIMARY KEY (author_id, tweet_id)
) WITH CLUSTERING ORDER BY (tweet_id DESC);
```

### Graph Database (Neo4j)

**Modeling:**

```cypher
// Create nodes
CREATE (alice:Person {name: 'Alice', age: 30})
CREATE (bob:Person {name: 'Bob', age: 25})
CREATE (carol:Person {name: 'Carol', age: 35})

// Create relationships
CREATE (alice)-[:FOLLOWS]->(bob)
CREATE (bob)-[:FOLLOWS]->(alice)
CREATE (alice)-[:FOLLOWS]->(carol)
CREATE (carol)-[:FOLLOWS]->(alice)

// Queries
// Find Alice's followers
MATCH (alice:Person {name: 'Alice'})<-[:FOLLOWS]-(follower)
RETURN follower.name

// Find friends (mutual follows)
MATCH (a:Person {name: 'Alice'})-[:FOLLOWS]->(b:Person)-[:FOLLOWS]->(a)
RETURN b.name

// Find friends of friends
MATCH (a:Person {name: 'Alice'})-[:FOLLOWS]->()-[:FOLLOWS]->(fof:Person)
WHERE NOT (a)-[:FOLLOWS]->(fof) AND a <> fof
RETURN fof.name, count(*) as mutualFriends
ORDER BY mutualFriends DESC
```

## Sharding Strategies

### Horizontal Partitioning

**Range Sharding:**

```sql
-- Shard by date ranges
-- Shard 1: 2024-01-01 to 2024-03-31
-- Shard 2: 2024-04-01 to 2024-06-31
-- etc.

-- Good for: Time-series data
-- Bad for: Hot spots (current shard gets all writes)
```

**Hash Sharding:**

```sql
-- Shard = hash(user_id) % num_shards
-- Even distribution of data

-- Good for: Even load distribution
-- Bad for: Range queries (need to query all shards)
```

**Consistent Hashing:**

```typescript
// Minimizes rebalancing when adding/removing shards
class ConsistentHash {
  private ring: Map<number, string> = new Map();
  private replicas = 150; // Virtual nodes per shard

  addShard(shardId: string) {
    for (let i = 0; i < this.replicas; i++) {
      const hash = this.hash(`${shardId}:${i}`);
      this.ring.set(hash, shardId);
    }
  }

  getShard(key: string): string {
    const hash = this.hash(key);
    const sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);

    for (const h of sortedHashes) {
      if (h >= hash) return this.ring.get(h)!;
    }

    return this.ring.get(sortedHashes[0])!;
  }
}
```

## CAP Theorem in Practice

**CP Systems (Consistency + Partition Tolerance):**

- PostgreSQL with synchronous replication
- MongoDB with write concern majority
- etcd, Consul

**AP Systems (Availability + Partition Tolerance):**

- Cassandra
- DynamoDB
- Couchbase

**Trade-off Examples:**

**Banking (CP):**

```sql
-- Synchronous replication for consistency
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 'A';
UPDATE accounts SET balance = balance + 100 WHERE id = 'B';
COMMIT;
-- Both updates must succeed or both fail
```

**Social Feed (AP):**

```javascript
// Eventual consistency acceptable
// Post might not appear immediately to all users
// But system remains available during network issues
```

## Resources

- "Designing Data-Intensive Applications" by Martin Kleppmann
- PostgreSQL Documentation
- MongoDB University
- Redis University
- Cassandra Documentation
