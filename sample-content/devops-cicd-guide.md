# DevOps & CI/CD Best Practices

## Introduction

DevOps is a set of practices that combines software development (Dev) and IT operations (Ops) to shorten the systems development life cycle and provide continuous delivery with high software quality.

## CI/CD Pipeline Architecture

### Pipeline Stages

```
Source Code → Build → Test → Security Scan → Deploy to Staging → E2E Tests → Deploy to Production
     │           │       │          │                │              │              │
     │           │       │          │                │              │              │
     ▼           ▼       ▼          ▼                ▼              ▼              ▼
  Git Push   Compile  Unit      SAST/DAST       Integration     Smoke Tests    Canary/
  PR Open    Bundle   Tests     Dependency      Test Env        API Tests      Blue-Green
             Package  Lint      License Check   Migration       UI Tests       Rollback
                      Coverage  Container Scan  Health Check    Performance    Monitoring
```

### GitHub Actions Example

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: "20"
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Stage 1: Build and Test
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  # Stage 2: Security Scanning
  security:
    runs-on: ubuntu-latest
    needs: build-and-test
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run SAST (CodeQL)
        uses: github/codeql-action/init@v2
        with:
          languages: javascript

      - name: Autobuild
        uses: github/codeql-action/autobuild@v2

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2

      - name: Dependency vulnerability scan
        run: npm audit --audit-level=high

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: "fs"
          format: "sarif"
          output: "trivy-results.sarif"

  # Stage 3: Build and Push Container
  build-container:
    runs-on: ubuntu-latest
    needs: [build-and-test, security]
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix={{branch}}-
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

  # Stage 4: Deploy to Staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build-container
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging..."
          # kubectl, terraform, or other deployment commands

      - name: Run smoke tests
        run: |
          curl -f https://staging.example.com/health || exit 1

  # Stage 5: Deploy to Production
  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment:
      name: production
      url: https://example.com
    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
          # Production deployment with canary/blue-green strategy

      - name: Verify deployment
        run: |
          curl -f https://example.com/health || exit 1
```

## Infrastructure as Code (IaC)

### Terraform Best Practices

```hcl
# environments/production/main.tf
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "production"
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  }
}

# modules/vpc/main.tf
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway = true
  enable_vpn_gateway = false

  tags = {
    Terraform = "true"
    Environment = var.environment
  }
}

# modules/eks/main.tf
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "${var.environment}-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      min_size     = 2
      max_size     = 10

      instance_types = ["m6i.large"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "general"
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled"             = "true"
        "k8s.io/cluster-autoscaler/${var.cluster_name}" = "owned"
      }
    }

    spot = {
      desired_size = 2
      min_size     = 0
      max_size     = 5

      instance_types = ["m6i.large", "m5.large", "m5a.large"]
      capacity_type  = "SPOT"

      labels = {
        role = "spot"
      }

      taints = [{
        key    = "spot"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}
```

### Terraform Project Structure

```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── outputs.tf
│   ├── staging/
│   │   └── ...
│   └── production/
│       └── ...
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── eks/
│   │   └── ...
│   ├── rds/
│   │   └── ...
│   └── s3/
│       └── ...
└── global/
    ├── iam/
    └── route53/
```

## Container Orchestration

### Kubernetes Deployment Patterns

```yaml
# Deployment with Rolling Update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
        version: v1.2.3
    spec:
      containers:
        - name: api
          image: ghcr.io/myorg/api:v1.2.3
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
            - name: LOG_LEVEL
              value: "info"
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - api-service
                topologyKey: kubernetes.io/hostname
---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
---
# Pod Disruption Budget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-service-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api-service
```

### Helm Charts

```yaml
# Chart.yaml
apiVersion: v2
name: api-service
version: 1.2.3
description: A Helm chart for the API service
type: application
appVersion: "1.2.3"

# values.yaml
replicaCount: 3

image:
  repository: ghcr.io/myorg/api
  tag: ""
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt"
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: api-tls
      hosts:
        - api.example.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "api-service.fullname" . }}
  labels:
    {{- include "api-service.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "api-service.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "api-service.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - containerPort: 8080
        resources:
          {{- toYaml .Values.resources | nindent 12 }}
```

## Monitoring & Observability

### The Three Pillars

**1. Metrics (Prometheus + Grafana):**

```yaml
# Prometheus ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-metrics
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: api-service
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
---
# Application metrics (Node.js example)
const prometheus = require('prom-client');

// Counter
const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Histogram
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Gauge
const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });

    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });
  });

  next();
});
```

**2. Logs (ELK Stack / Loki):**

```typescript
// Structured logging
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: "api-service",
    environment: process.env.NODE_ENV
  },
  transports: [new winston.transports.Console()]
});

// Usage
logger.info("User logged in", {
  userId: user.id,
  ip: req.ip,
  userAgent: req.headers["user-agent"]
});

logger.error("Database connection failed", {
  error: error.message,
  stack: error.stack,
  retryCount: 3
});
```

**3. Traces (Jaeger / Zipkin):**

```typescript
// OpenTelemetry tracing
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: "http://jaeger:14268/api/traces"
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

// Custom spans
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("api-service");

async function processOrder(orderId: string) {
  const span = tracer.startSpan("process-order");
  span.setAttribute("order.id", orderId);

  try {
    // Validate order
    const validationSpan = tracer.startSpan("validate-order", {
      parent: span
    });
    await validateOrder(orderId);
    validationSpan.end();

    // Charge payment
    const paymentSpan = tracer.startSpan("process-payment", {
      parent: span
    });
    await chargePayment(orderId);
    paymentSpan.end();

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
```

## Deployment Strategies

### Blue-Green Deployment

```bash
#!/bin/bash
# blue-green-deploy.sh

# Current active environment
CURRENT=$(kubectl get svc production -o jsonpath='{.spec.selector.version}')

# Determine target
if [ "$CURRENT" == "blue" ]; then
  TARGET="green"
else
  TARGET="blue"
fi

echo "Deploying to $TARGET environment..."

# Deploy to target
kubectl set image deployment/api-$TARGET api=ghcr.io/myorg/api:$VERSION
kubectl rollout status deployment/api-$TARGET

# Run smoke tests
if ! curl -f http://api-$TARGET/health; then
  echo "Health check failed, aborting"
  kubectl rollout undo deployment/api-$TARGET
  exit 1
fi

# Switch traffic
kubectl patch svc production -p '{"spec":{"selector":{"version":"'$TARGET'"}}}'

echo "Switched to $TARGET environment"
```

### Canary Deployment

```yaml
# Flagger Canary resource
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: api-service
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  service:
    port: 80
    targetPort: 8080
  analysis:
    interval: 30s
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 1m
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 1m
    webhooks:
      - name: load-test
        url: http://flagger-loadtester.test/
        timeout: 5s
        metadata:
          cmd: "hey -z 1m -q 10 -c 2 http://api-service-canary/"
```

## Infrastructure Security

### Security Best Practices

**1. Secrets Management:**

```bash
# Use external secrets operator
# kubernetes-external-secrets or External Secrets Operator

# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name production/database-url \
  --secret-string "postgres://user:pass@host:5432/db"

# Reference in Kubernetes
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-url
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: database-secret
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: production/database-url
```

**2. Network Policies:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8080
    - from:
        - podSelector:
            matchLabels:
              app: monitoring
      ports:
        - protocol: TCP
          port: 9090
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
```

**3. Pod Security Standards:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /cache
  volumes:
    - name: tmp
      emptyDir: {}
    - name: cache
      emptyDir: {}
```

## Resources

- "The DevOps Handbook" by Gene Kim
- "Continuous Delivery" by Jez Humble
- Kubernetes Documentation
- Terraform Documentation
- GitHub Actions Documentation
- Prometheus & Grafana Documentation
