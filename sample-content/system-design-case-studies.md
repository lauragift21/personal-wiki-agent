# System Design Case Studies

## 1. URL Shortener (like bit.ly)

### Requirements

**Functional:**

- Shorten long URLs to unique short codes
- Redirect short URLs to original URLs
- Custom aliases (optional)
- Link expiration (optional)
- Analytics (click tracking)

**Non-Functional:**

- High availability (99.9% uptime)
- Low latency (<100ms for redirects)
- Handle 10M+ new URLs per day
- Scale to 1B+ redirects per month

### API Design

```
POST /api/v1/urls
Request: { "url": "https://example.com/very/long/url", "customAlias": "mylink" }
Response: { "shortUrl": "https://short.ly/abc123", "expiresAt": "2024-12-31" }

GET /:shortCode
Response: 302 Redirect to original URL

GET /api/v1/urls/:shortCode/stats
Response: { "clicks": 1500, "countries": {...} }
```

### Data Model

```sql
CREATE TABLE urls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    user_id BIGINT,
    click_count BIGINT DEFAULT 0
);

CREATE TABLE url_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    url_id BIGINT REFERENCES urls(id),
    clicked_at TIMESTAMP,
    country_code VARCHAR(2),
    user_agent TEXT,
    referer TEXT
);
```

### Short Code Generation

**Approach 1: Base62 Encoding**

```python
import string

ALPHABET = string.ascii_letters + string.digits  # 62 characters

def encode(num: int) -> str:
    """Convert integer to base62 string"""
    if num == 0:
        return ALPHABET[0]

    result = []
    while num > 0:
        num, remainder = divmod(num, 62)
        result.append(ALPHABET[remainder])

    return ''.join(reversed(result))

# Generate short code from auto-increment ID
short_code = encode(database_id)  # e.g., 1000000 -> "4c92"
```

**Approach 2: Hash + Collision Resolution**

```python
import hashlib
import base64

def generate_short_code(url: str, attempt: int = 0) -> str:
    """Generate short code using MD5 hash"""
    input_str = f"{url}:{attempt}"
    hash_bytes = hashlib.md5(input_str.encode()).digest()
    # Take first 6 bytes and encode to base64
    short_code = base64.urlsafe_b64encode(hash_bytes[:6]).decode()[:8]
    return short_code
```

**Approach 3: Random Generation + Check**

```python
import secrets
import string

def generate_random_code(length: int = 7) -> str:
    """Generate cryptographically secure random code"""
    alphabet = string.ascii_letters + string.digits
    while True:
        code = ''.join(secrets.choice(alphabet) for _ in range(length))
        if not db.exists(code):  # Check uniqueness
            return code
```

### Architecture

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
       │  App Server │ │ App Server│ │  App Server │
       └──────┬──────┘ └────┬─────┘ └──────┬──────┘
              │             │              │
     ┌────────┴────────┐    │     ┌────────┴────────┐
     │                 │    │     │                 │
┌────▼────┐      ┌─────▼────┴─────▼────┐     ┌──────▼──────┐
│  Redis  │      │      Database       │     │   Kafka     │
│ (Cache) │      │   (Primary + Replicas)│    │ (Analytics) │
└─────────┘      └─────────────────────┘     └─────────────┘
```

**Read Path (Redirect):**

1. Check Redis cache (99% hit rate expected)
2. Cache miss → Query read replica database
3. Store in cache, return redirect

**Write Path (Create URL):**

1. Validate URL and permissions
2. Generate unique short code
3. Write to primary database
4. Return short URL

### Scaling Considerations

**Database Sharding:**

- Shard by short_code prefix (e.g., first 2 characters)
- Range: aa-zz gives 676 shards
- Distribute shards across database clusters

**Caching Strategy:**

- Redis with 24-hour TTL
- Cache-aside pattern
- Expected 100:1 read:write ratio

**Analytics Processing:**

- Asynchronous via message queue
- Batch insert to analytics database
- Aggregate for dashboard queries

---

## 2. Twitter Timeline (News Feed)

### Requirements

**Functional:**

- Users can post tweets (text, images, video)
- Follow other users
- View timeline of followed users' tweets
- Like, retweet, reply to tweets
- Search tweets

**Non-Functional:**

- 500M+ daily active users
- 500M+ tweets per day
- Timeline load < 200ms
- Eventually consistent acceptable

### Core Data Models

```sql
-- Users
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP
);

-- Tweets
CREATE TABLE tweets (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    content TEXT,
    created_at TIMESTAMP,
    like_count INT DEFAULT 0,
    retweet_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    media_urls TEXT[]
);

-- Social Graph (Followers)
CREATE TABLE follows (
    follower_id BIGINT REFERENCES users(id),
    following_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP,
    PRIMARY KEY (follower_id, following_id)
);

-- Likes
CREATE TABLE likes (
    user_id BIGINT REFERENCES users(id),
    tweet_id BIGINT REFERENCES tweets(id),
    created_at TIMESTAMP,
    PRIMARY KEY (user_id, tweet_id)
);
```

### Timeline Implementation

**Fan-out on Write (Push Model):**

For users with < 1000 followers:

1. User A posts a tweet
2. System writes tweet to tweets table
3. System pushes tweet ID to all followers' timeline queues
4. Followers' timelines are pre-computed

```python
def create_tweet(user_id: int, content: str):
    tweet_id = db.tweets.insert(user_id, content)

    # Get followers
    followers = db.follows.get_followers(user_id)

    # Push to timelines
    for follower in followers:
        cache.lpush(f"timeline:{follower.id}", tweet_id)
        cache.ltrim(f"timeline:{follower.id}", 0, 999)  # Keep last 1000
```

**Fan-out on Read (Pull Model):**

For users with > 1000 followers (celebrities):

1. User's tweet is stored once
2. Followers fetch timeline by querying followed users' tweets
3. Merge and sort by time

```python
def get_timeline(user_id: int, cursor: str = None):
    # Get list of followed users
    following = db.follows.get_following(user_id)
    user_ids = [u.id for u in following]

    # Query recent tweets from followed users
    tweets = db.tweets.find(
        user_id__in=user_ids,
        created_at__lt=cursor,
        order_by="-created_at",
        limit=20
    )

    return tweets
```

**Hybrid Approach (Twitter's Actual Implementation):**

```
Normal Users (< 1000 followers):
  └─ Fan-out on Write

Celebrities (> 1000 followers):
  └─ Fan-out on Read

Timeline Construction:
  1. Get tweets from cache (normal users)
  2. Query tweets from celebrities separately
  3. Merge and sort
```

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  API Gateway │────▶│ Load Balancer│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
           ┌────────▼────────┐         ┌──────────▼──────────┐       ┌──────────▼──────────┐
           │  Tweet Service  │         │   Timeline Service  │       │   Social Service    │
           └────────┬────────┘         └──────────┬──────────┘       └──────────┬──────────┘
                    │                             │                             │
           ┌────────▼────────┐         ┌──────────▼──────────┐       ┌──────────▼──────────┐
           │  Cassandra      │         │     Redis Cluster   │       │     PostgreSQL      │
           │  (Tweets)       │         │   (Timelines)       │       │   (Social Graph)    │
           └─────────────────┘         └─────────────────────┘       └─────────────────────┘
```

### Scaling the Social Graph

**Challenge:** Finding mutual followers is expensive

**Solution 1: Intolerance Set**

```python
# For each user, store:
# - followees: users they follow
# - followers: users who follow them

# Check if A follows B:
# O(1) lookup in Redis Set
redis.sismember("user:A:followees", "B")
```

**Solution 2: Graph Database (Neo4j)**

```cypher
// Find mutual followers
MATCH (a:User)-[:FOLLOWS]->(b:User)<-[:FOLLOWS]-(c:User)
WHERE a.id = $userId
RETURN c

// Find friends of friends
MATCH (a:User)-[:FOLLOWS]->(:User)-[:FOLLOWS]->(fof:User)
WHERE a.id = $userId AND fof.id <> $userId
RETURN fof
```

### Search Implementation

**Inverted Index:**

```json
{
  "word": "javascript",
  "tweets": [
    { "tweet_id": 12345, "position": 2, "timestamp": "2024-01-15T10:00:00Z" },
    { "tweet_id": 12346, "position": 0, "timestamp": "2024-01-15T10:05:00Z" }
  ]
}
```

**Elasticsearch Mapping:**

```json
{
  "mappings": {
    "properties": {
      "content": { "type": "text", "analyzer": "standard" },
      "user_id": { "type": "keyword" },
      "created_at": { "type": "date" },
      "hashtags": { "type": "keyword" },
      "mentions": { "type": "keyword" }
    }
  }
}
```

---

## 3. Video Streaming (like YouTube)

### Requirements

**Functional:**

- Upload videos
- Stream videos with quality options
- Search videos
- Recommendations
- Comments and interactions

**Non-Functional:**

- Support 2B+ users
- 1B+ hours of video watched daily
- Support 4K streaming
- Adaptive bitrate streaming
- Global CDN distribution

### Video Processing Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│ Raw Upload  │───▶│  Transcoding │───▶│ Thumbnails  │───▶│  CDN Push   │
│  (MP4/etc)  │    │(HLS/DASH gen)│    │  Generation │    │             │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                                                          │
                   ┌──────────────┐                       │
                   │  Metadata    │◀──────────────────────┘
                   │  Storage     │
                   └──────────────┘
```

**Transcoding Process:**

```python
def transcode_video(video_id: str):
    # Generate multiple resolutions
    resolutions = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p"]

    for res in resolutions:
        # Extract resolution dimensions
        width, height = get_dimensions(res)

        # Transcode with FFmpeg
        ffmpeg.input(f"raw/{video_id}.mp4").filter(
            "scale", width, height
        ).output(
            f"transcoded/{video_id}/{res}.mp4",
            vcodec="h264",
            acodec="aac",
            video_bitrate=get_bitrate(res)
        ).run()

        # Create HLS segments
        create_hls_segments(video_id, res)
```

**HLS Playlist Generation:**

```
# master.m3u8
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080
1080p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=854x480
480p/playlist.m3u8

# 1080p/playlist.m3u8
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:3
#EXTINF:10.0,
segment_0.ts
#EXTINF:10.0,
segment_1.ts
#EXTINF:10.0,
segment_2.ts
#EXT-X-ENDLIST
```

### Storage Strategy

**Object Storage (S3/R2):**

- Raw uploads: Long-term archival
- Transcoded videos: Multiple formats per video
- Thumbnails: Multiple sizes

**Storage Calculation:**

```
For a 10-minute 1080p video:
- Raw (source): ~500 MB
- 1080p H264: ~150 MB
- 720p H264: ~75 MB
- 480p H264: ~35 MB
- Thumbnails: ~500 KB
Total: ~760 MB per video

At 500 hours uploaded per minute:
Daily storage growth: ~6.5 PB
```

### Streaming Architecture

```
User Request
     │
     ▼
┌──────────────┐
│   CDN Edge   │──── Cache Hit? ──── Yes ───▶ Return Video
│   (Closest)  │                              Fragment
└──────┬───────┘
       │ No
       ▼
┌──────────────┐
│  Origin      │
│  Storage     │
└──────────────┘
```

**Adaptive Bitrate Algorithm:**

```javascript
// Client-side ABR logic
function selectQuality(bandwidth, bufferLevel) {
  const qualities = [
    { bitrate: 8000000, resolution: "1080p" },
    { bitrate: 4000000, resolution: "720p" },
    { bitrate: 2000000, resolution: "480p" },
    { bitrate: 1000000, resolution: "360p" }
  ];

  // Select highest quality bandwidth can support
  // with safety margin for buffer
  const safetyMargin = 0.8;
  const availableBandwidth = bandwidth * safetyMargin;

  for (const q of qualities) {
    if (q.bitrate <= availableBandwidth) {
      // Check buffer level - if low, step down
      if (bufferLevel < 5 && q.bitrate > 2000000) {
        continue;
      }
      return q.resolution;
    }
  }

  return "240p"; // Fallback
}
```

### Recommendation System

**Two-Stage Architecture:**

**Stage 1: Candidate Generation (Millions → Thousands)**

```python
# Collaborative Filtering
# Users who watched A also watched B
candidates = get_similar_items(user_history)

# Content-based
# Videos similar to what user liked
candidates += get_content_matches(user_interests)

# Trending
candidates += get_trending_videos(region)

# Subscriptions
candidates += get_subscription_uploads(user_subscriptions)
```

**Stage 2: Ranking (Thousands → 100)**

```python
# Neural network scoring
features = [
    # User features
    user.watch_time_history,
    user.like_patterns,
    user.subscription_topics,

    # Video features
    video.category,
    video.uploader_reputation,
    video.engagement_rate,
    video.age,

    # Context features
    time_of_day,
    device_type,
    location,
]

score = ranking_model.predict(features)
sorted_candidates = sort_by_score(candidates)
return sorted_candidates[:100]
```

### Database Sharding

**Video Metadata:**

- Shard by video_id (consistent hashing)
- Hot videos cached in Redis

**Comments:**

- Shard by video_id
- Top-level and replies stored together
- Pagination by timestamp

**User History:**

- Shard by user_id
- Time-series data (write-heavy)
- Recent history cached

---

## Common Design Patterns

### Caching Strategies

| Pattern       | Use Case                         | Example       |
| ------------- | -------------------------------- | ------------- |
| Cache-Aside   | Read-heavy, eventual consistency | User profiles |
| Write-Through | Write-heavy, strong consistency  | Shopping cart |
| Write-Behind  | High write throughput            | Analytics     |
| Read-Through  | Simplified client logic          | Static assets |

### Database Selection

| Requirement           | Solution         | Example                 |
| --------------------- | ---------------- | ----------------------- |
| Relational data       | PostgreSQL/MySQL | User accounts, orders   |
| High write throughput | Cassandra        | Time-series, feeds      |
| Caching               | Redis            | Sessions, rate limiting |
| Search                | Elasticsearch    | Full-text search        |
| Graph relationships   | Neo4j            | Social networks         |
| Blob storage          | S3/R2            | Videos, images          |

### Rate Limiting Algorithms

**Token Bucket:**

```python
class TokenBucket:
    def __init__(self, rate: int, capacity: int):
        self.rate = rate  # tokens per second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()

    def allow_request(self) -> bool:
        now = time.time()
        elapsed = now - self.last_update
        self.tokens = min(
            self.capacity,
            self.tokens + elapsed * self.rate
        )
        self.last_update = now

        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
```

**Sliding Window Counter:**

```python
def is_allowed(redis, key: str, limit: int, window: int) -> bool:
    now = time.time()
    window_start = now - window

    # Remove old entries
    redis.zremrangebyscore(key, 0, window_start)

    # Count current
    current = redis.zcard(key)

    if current < limit:
        # Add current request
        redis.zadd(key, {str(now): now})
        redis.expire(key, window)
        return True

    return False
```

### Idempotency

**Idempotency Keys:**

```python
def process_payment(idempotency_key: str, payment_data: dict):
    # Check if already processed
    existing = redis.get(f"idempotency:{idempotency_key}")
    if existing:
        return json.loads(existing)

    # Process payment
    result = charge_card(payment_data)

    # Store result for 24 hours
    redis.setex(
        f"idempotency:{idempotency_key}",
        86400,
        json.dumps(result)
    )

    return result
```

## Resources

- "Designing Data-Intensive Applications" by Martin Kleppmann
- System Design Primer (GitHub)
- ByteByteGo YouTube channel
- System Design Interview books by Alex Xu
