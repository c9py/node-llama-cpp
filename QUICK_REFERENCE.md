# Quick Reference: Limbo Deployment

## Installation & Setup

```bash
# Install node-llama-cpp
npm install node-llama-cpp

# Ensure Inferno OS is installed
which emu  # Should show path to Inferno emulator
```

## Quick Start

### 1. Generate Configuration

```bash
npx node-llama-cpp deploy generate-config \
  --model ./models/llama-2-7b.gguf \
  --nodes 3 \
  --output deployment.json
```

### 2. Start Deployment

```bash
npx node-llama-cpp deploy start --config deployment.json
```

## Programmatic Usage

### Basic Deployment

```typescript
import {LimboDeploymentManager, LoadBalancingStrategy} from "node-llama-cpp";

const manager = new LimboDeploymentManager({
    name: "my-deployment",
    modulePath: "/dis/deployment/llamacpp.dis",
    modelPath: "./models/llama-2-7b.gguf",
    nodes: [
        {id: "node-0", address: "localhost", port: 8000},
        {id: "node-1", address: "localhost", port: 8001}
    ]
});

await manager.deploy();
const result = await manager.evaluate("Hello, world!");
await manager.shutdown();
```

### With Custom Configuration

```typescript
const manager = new LimboDeploymentManager({
    name: "advanced-deployment",
    modulePath: "/dis/deployment/llamacpp.dis",
    modelPath: "./models/model.gguf",
    network: {
        loadBalancing: LoadBalancingStrategy.LeastConnections,
        healthCheckInterval: 30000,
        requestTimeout: 60000,
        enableFailover: true,
        basePort: 8000
    },
    nodes: [
        {
            id: "gpu-node",
            address: "192.168.1.10",
            port: 8000,
            weight: 3.0,
            gpuLayers: 35,
            contextSize: 4096
        },
        {
            id: "cpu-node",
            address: "192.168.1.11",
            port: 8000,
            weight: 1.0,
            gpuLayers: 0,
            contextSize: 2048
        }
    ],
    model: {
        contextSize: 2048,
        gpuLayers: 0,
        batchSize: 512,
        threads: 4,
        mlock: false
    }
});
```

## Load Balancing Strategies

```typescript
import {LoadBalancingStrategy} from "node-llama-cpp";

// Round Robin - Even distribution
LoadBalancingStrategy.RoundRobin

// Least Connections - Route to least busy node
LoadBalancingStrategy.LeastConnections

// Random - Random selection
LoadBalancingStrategy.Random

// Weighted Random - Based on node weights
LoadBalancingStrategy.WeightedRandom
```

## Scaling

```typescript
// Scale up
await manager.scale(10);  // Scale to 10 nodes

// Scale down
await manager.scale(3);   // Scale to 3 nodes
```

## Events

```typescript
manager.on("status-change", (status) => {
    console.log(`Status: ${status}`);
});

manager.on("deployed", () => {
    console.log("Deployment ready");
});

manager.on("node-unhealthy", (nodeId) => {
    console.log(`Node ${nodeId} unhealthy`);
});

manager.on("scaled", (nodeCount) => {
    console.log(`Scaled to ${nodeCount} nodes`);
});

manager.on("error", (error) => {
    console.error("Error:", error);
});
```

## Configuration File Format

```json
{
  "name": "deployment-name",
  "modulePath": "/dis/deployment/llamacpp.dis",
  "modelPath": "/path/to/model.gguf",
  "network": {
    "loadBalancing": "round-robin",
    "healthCheckInterval": 30000,
    "requestTimeout": 60000,
    "enableFailover": true,
    "basePort": 8000
  },
  "nodes": [
    {
      "id": "node-0",
      "address": "localhost",
      "port": 8000,
      "weight": 1.0,
      "gpuLayers": 0,
      "contextSize": 2048
    }
  ],
  "model": {
    "contextSize": 2048,
    "gpuLayers": 0,
    "batchSize": 512,
    "threads": 4,
    "mlock": false
  }
}
```

## CLI Commands

```bash
# Generate configuration
deploy generate-config --model <path> --nodes <count> --output <file>

# Start deployment
deploy start --config <file>

# Stop deployment
deploy stop --name <deployment-name>

# Get status
deploy status --name <deployment-name>

# Scale deployment
deploy scale --name <deployment-name> --target <count>
```

## Troubleshooting

### Dis-VM Not Found
```bash
# Install Inferno OS
# Download from: http://www.vitanuova.com/inferno/

# Verify installation
which emu
```

### Port Already in Use
```json
{
  "network": {
    "basePort": 9000
  }
}
```

### Health Check Failures
```json
{
  "network": {
    "healthCheckInterval": 60000
  }
}
```

## Common Patterns

### Single Node Testing
```typescript
const manager = new LimboDeploymentManager({
    name: "test",
    modelPath: "./model.gguf",
    nodes: [{id: "test-node", address: "localhost", port: 8000}]
});
```

### Multi-Machine Deployment
```typescript
nodes: [
    {id: "server1", address: "192.168.1.10", port: 8000},
    {id: "server2", address: "192.168.1.11", port: 8000},
    {id: "server3", address: "192.168.1.12", port: 8000}
]
```

### GPU-Optimized Node
```typescript
{
    id: "gpu-node",
    gpuLayers: 35,      // Offload 35 layers to GPU
    contextSize: 4096,   // Larger context
    weight: 3.0         // Higher priority
}
```

## Resources

- [Full Documentation](./docs/guide/limbo-deployment.md)
- [Technical Details](./src/deployment/README.md)
- [Implementation Summary](./IMPLEMENTATION.md)
- [Inferno OS](http://www.vitanuova.com/inferno/)
- [Limbo Language](http://www.vitanuova.com/inferno/papers/limbo.html)
