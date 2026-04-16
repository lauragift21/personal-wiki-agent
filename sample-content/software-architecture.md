# Software Architecture & System Design

## Introduction

Software architecture is the high-level structure of a software system, the discipline of creating such structures, and the documentation of these structures. It serves as the blueprint for both the system and the project developing it.

## Core Principles

### 1. Single Responsibility Principle

Every module, class, or function should have responsibility over a single part of the functionality provided by the software, and that responsibility should be entirely encapsulated by the class.

**Example:**

```typescript
// Bad: Class doing too much
class UserManager {
  createUser() {}
  sendEmail() {}
  generateReport() {}
  connectToDatabase() {}
}

// Good: Separated concerns
class UserService {
  createUser() {}
}

class EmailService {
  sendEmail() {}
}

class ReportGenerator {
  generateReport() {}
}
```

### 2. Loose Coupling & High Cohesion

- **Loose Coupling:** Components should have minimal dependencies on each other
- **High Cohesion:** Related functionality should be grouped together

### 3. Separation of Concerns

Divide your application into distinct sections, each addressing separate concerns:

- Presentation layer (UI)
- Business logic layer
- Data access layer
- Infrastructure layer

## Architectural Patterns

### Microservices Architecture

**Definition:** An architectural approach where an application is built as a collection of small, independent services that communicate over well-defined APIs.

**Benefits:**

- Independent deployment and scaling
- Technology diversity
- Fault isolation
- Team autonomy

**Challenges:**

- Distributed system complexity
- Network latency
- Data consistency
- Operational overhead

**When to Use:**

- Large, complex applications
- Multiple teams working independently
- Need for independent scaling of components
- Long-term maintainability is critical

### Monolithic Architecture

**Definition:** A single-tiered software application where different components are combined into a single program.

**Benefits:**

- Simpler development and testing
- Easier debugging
- Lower operational complexity
- Better performance (no network calls)

**When to Use:**

- Small to medium applications
- Rapid prototyping
- Small teams
- Tight deadlines

### Event-Driven Architecture

**Definition:** A software architecture pattern promoting the production, detection, consumption of, and reaction to events.

**Key Components:**

- **Event Producers:** Generate events
- **Event Consumers:** React to events
- **Event Channel:** Transports events (message queue, event bus)

**Example Flow:**

```
User Registration → Event Published → Multiple Consumers:
  ├─ Welcome Email Service
  ├─ Analytics Service
  ├─ CRM Integration
  └─ Audit Logger
```

### Serverless Architecture

**Definition:** Cloud computing execution model where the cloud provider dynamically manages the allocation of machine resources.

**Characteristics:**

- No server management
- Pay-per-use billing
- Auto-scaling
- Event-triggered execution

**Best Practices:**

1. Keep functions small and focused
2. Minimize cold starts
3. Use connection pooling
4. Design for idempotency
5. Handle partial failures

## Scalability Patterns

### Horizontal Scaling (Scale Out)

Adding more machines to distribute the load.

**Techniques:**

- Load balancing
- Data partitioning (sharding)
- Caching layers
- CDN for static assets

### Vertical Scaling (Scale Up)

Adding more resources (CPU, RAM) to existing machines.

**Limitations:**

- Hardware ceiling
- Single point of failure
- Usually more expensive

### Database Scaling Strategies

**Read Replicas:**

- Master handles writes
- Replicas handle reads
- Eventual consistency

**Database Sharding:**

- Distribute data across multiple databases
- Shard key selection is critical
- Cross-shard queries are expensive

**Caching Strategies:**

- Cache-aside (Lazy loading)
- Write-through
- Write-behind (Write-back)
- Refresh-ahead

## Design Patterns

### Creational Patterns

**Factory Pattern:**

```typescript
interface Notification {
  send(message: string): void;
}

class EmailNotification implements Notification {
  send(message: string) {
    console.log(`Email: ${message}`);
  }
}

class SMSNotification implements Notification {
  send(message: string) {
    console.log(`SMS: ${message}`);
  }
}

class NotificationFactory {
  create(type: "email" | "sms"): Notification {
    switch (type) {
      case "email":
        return new EmailNotification();
      case "sms":
        return new SMSNotification();
    }
  }
}
```

**Singleton Pattern:**
Ensure a class has only one instance and provides a global point of access to it.

### Structural Patterns

**Adapter Pattern:**
Allows incompatible interfaces to work together.

**Decorator Pattern:**
Adds behavior to objects dynamically without affecting other objects.

### Behavioral Patterns

**Observer Pattern:**
Defines a subscription mechanism to notify multiple objects about events.

**Strategy Pattern:**
Defines a family of algorithms, encapsulates each one, and makes them interchangeable.

## System Design Considerations

### CAP Theorem

You can only guarantee two of the three:

- **Consistency:** All nodes see the same data
- **Availability:** Every request receives a response
- **Partition Tolerance:** System continues to operate despite network partitions

**Practical Implications:**

- CP systems: Bank transactions
- AP systems: Social media feeds

### Load Balancing Algorithms

1. **Round Robin:** Distributes requests sequentially
2. **Least Connections:** Sends to server with fewest active connections
3. **IP Hash:** Consistent routing based on client IP
4. **Weighted:** Assign different capacities to servers

### Rate Limiting Strategies

**Token Bucket:**

- Tokens added at fixed rate
- Request consumes a token
- Burst capacity allowed

**Leaky Bucket:**

- Requests queued at fixed rate
- Smooths out traffic spikes
- No burst capacity

**Fixed Window:**

- Count requests in time window
- Simple but can have edge spikes

**Sliding Window:**

- More accurate
- Higher memory usage

## API Design

### REST Principles

- Statelessness
- Client-Server architecture
- Cacheability
- Uniform interface
- Layered system

### GraphQL vs REST

**GraphQL Advantages:**

- Client specifies exact data needs
- Single endpoint
- Strong typing
- Reduced over-fetching

**REST Advantages:**

- Better caching with HTTP
- Simpler to understand
- Better tooling ecosystem
- File uploads are easier

## Security Considerations

### Defense in Depth

Multiple layers of security controls:

1. Network layer (firewalls, WAF)
2. Application layer (input validation)
3. Data layer (encryption)
4. Access control (authentication/authorization)

### Authentication Patterns

- JWT (JSON Web Tokens)
- Session-based
- OAuth 2.0 / OpenID Connect
- API Keys

### Common Vulnerabilities

- SQL Injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Insecure deserialization
- Security misconfiguration

## Performance Optimization

### Latency Reduction Techniques

1. **Caching:** Redis, Memcached, CDN
2. **Database indexing:** Query optimization
3. **Connection pooling:** Reuse connections
4. **Async processing:** Queue heavy operations
5. **Lazy loading:** Load data on demand

### Monitoring & Observability

**The Three Pillars:**

1. **Metrics:** Quantitative data (CPU, memory, requests/sec)
2. **Logs:** Event records
3. **Traces:** Request flow through the system

**Key Metrics to Track:**

- Response time (p50, p95, p99)
- Error rates
- Throughput
- Resource utilization

## References

- "Designing Data-Intensive Applications" by Martin Kleppmann
- "Building Microservices" by Sam Newman
- "Clean Architecture" by Robert C. Martin
- "The Twelve-Factor App" methodology
