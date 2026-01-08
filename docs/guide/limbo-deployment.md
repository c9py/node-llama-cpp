---
outline: [2, 4]
description: Limbo/Inferno Dis-VM Distributed Deployment for node-llama-cpp
---

# Limbo/Inferno Dis-VM Distributed Deployment

`node-llama-cpp` now supports distributed deployment using the Limbo programming language and Inferno's Dis Virtual Machine. This enables running llama.cpp inference across a network of isolated processes with advanced load balancing and fault tolerance.

## Overview

The Limbo deployment system provides a novel approach to distributed AI inference by leveraging:

- **Inferno OS**: A lightweight, portable operating system designed for distributed systems
- **Limbo**: A concurrent programming language with built-in support for communication and isolation
- **Dis-VM**: Inferno's virtual machine that provides secure process isolation
- **Network Coordination**: Automatic load balancing and failover across nodes

## Architecture

The deployment system consists of several layers:

```
┌─────────────────────────────────────────────────────┐
│           Node.js Application Layer                 │
│  (LimboDeploymentManager, NetworkCoordinator)      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│          Dis-VM Integration Layer                   │
│        (DisVMManager, Process Spawning)            │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│      Multiple Dis-VM Isolates (Limbo Modules)      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Node 1   │  │ Node 2   │  │ Node 3   │          │
│  │ [Model]  │  │ [Model]  │  │ [Model]  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

### Components

#### 1. Limbo Module (`llamacpp.b`)
Written in the Limbo programming language, this module runs inside the Dis-VM and provides:
- Model context management
- Inference execution
- Network communication primitives
- Node coordination

#### 2. Dis-VM Manager
A TypeScript layer that manages the lifecycle of Dis-VM processes:
- Spawning and stopping isolates
- Inter-process communication
- Process health monitoring

#### 3. Network Coordinator
Orchestrates distributed inference across nodes:
- Load balancing with multiple strategies
- Health checks and failover
- Request routing and dispatch

#### 4. Deployment Manager
High-level API for managing deployments:
- Configuration management
- Scaling operations
- Status monitoring

## Quick Start

### Prerequisites

1. **Inferno OS**: Install Inferno OS or the hosted Inferno VM (`emu`)
2. **Limbo Compiler**: Ensure the `limbo` compiler is available
3. **node-llama-cpp**: Version 0.1.0 or later

### Installation

```bash
npm install node-llama-cpp
```

### Generate Configuration

Generate a deployment configuration file:

```bash
npx node-llama-cpp deploy generate-config \
  --model ./models/llama-2-7b.gguf \
  --nodes 3 \
  --strategy round-robin \
  --output deployment.json
```

This creates a `deployment.json` file:

```json
{
  "name": "llama-deployment",
  "modulePath": "/dis/deployment/llamacpp.dis",
  "modelPath": "./models/llama-2-7b.gguf",
  "network": {
    "loadBalancing": "round-robin",
    "healthCheckInterval": 30000,
    "requestTimeout": 60000,
    "enableFailover": true,
    "basePort": 8000
  },
  "nodes": [
    {"id": "node-0", "address": "localhost", "port": 8000},
    {"id": "node-1", "address": "localhost", "port": 8001},
    {"id": "node-2", "address": "localhost", "port": 8002}
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

### Start Deployment

```bash
npx node-llama-cpp deploy start --config deployment.json
```

The deployment will:
1. Initialize the network coordinator
2. Spawn Dis-VM isolates for each node
3. Load the model in each isolate
4. Begin accepting inference requests

## Programmatic Usage

```typescript
import {
    LimboDeploymentManager,
    LoadBalancingStrategy,
    generateNodeConfigs
} from "node-llama-cpp";

// Create deployment configuration
const manager = new LimboDeploymentManager({
    name: "my-deployment",
    modulePath: "/dis/deployment/llamacpp.dis",
    modelPath: "./models/llama-2-7b.gguf",
    network: {
        loadBalancing: LoadBalancingStrategy.RoundRobin,
        healthCheckInterval: 30000,
        requestTimeout: 60000,
        enableFailover: true,
        basePort: 8000
    },
    nodes: generateNodeConfigs(3)
});

// Deploy the network
await manager.deploy();

// Perform inference
const response = await manager.evaluate(
    "What is the capital of France?"
);
console.log(response);

// Scale the deployment
await manager.scale(5); // Scale to 5 nodes

// Shutdown
await manager.shutdown();
```

## Load Balancing Strategies

The system supports four load balancing strategies:

### Round Robin
Distributes requests evenly across all nodes in sequence.

```json
{
  "network": {
    "loadBalancing": "round-robin"
  }
}
```

**Use when**: All nodes have similar capabilities and you want even distribution.

### Least Connections
Routes requests to the node with the fewest active connections.

```json
{
  "network": {
    "loadBalancing": "least-connections"
  }
}
```

**Use when**: Request processing times vary significantly.

### Random
Randomly selects an available node for each request.

```json
{
  "network": {
    "loadBalancing": "random"
  }
}
```

**Use when**: You want simple distribution without tracking state.

### Weighted Random
Randomly selects nodes based on their configured weights.

```json
{
  "network": {
    "loadBalancing": "weighted-random"
  },
  "nodes": [
    {"id": "powerful-node", "weight": 3.0},
    {"id": "standard-node", "weight": 1.0}
  ]
}
```

**Use when**: Nodes have different capabilities (CPU, GPU, memory).

## Scaling

### Manual Scaling

Scale your deployment dynamically:

```typescript
// Scale up to 10 nodes
await manager.scale(10);

// Scale down to 3 nodes
await manager.scale(3);
```

### Distributed Deployment

Deploy nodes across multiple machines:

```json
{
  "nodes": [
    {
      "id": "node-0",
      "address": "192.168.1.10",
      "port": 8000
    },
    {
      "id": "node-1",
      "address": "192.168.1.11",
      "port": 8000
    }
  ]
}
```

## Health Monitoring

The network coordinator automatically monitors node health:

- **Periodic Health Checks**: Configurable interval (default: 30s)
- **Automatic Failover**: Unhealthy nodes are automatically excluded
- **Recovery**: Nodes that recover are automatically re-included

Configure health check interval:

```json
{
  "network": {
    "healthCheckInterval": 60000  // 60 seconds
  }
}
```

## Events

The deployment manager emits events for monitoring:

```typescript
manager.on("status-change", (status) => {
    console.log(`Status: ${status}`);
});

manager.on("deployed", () => {
    console.log("Deployment ready");
});

manager.on("node-unhealthy", (nodeId) => {
    console.log(`Node ${nodeId} is unhealthy`);
});

manager.on("scaled", (nodeCount) => {
    console.log(`Scaled to ${nodeCount} nodes`);
});

manager.on("error", (error) => {
    console.error("Error:", error);
});
```

## Advanced Configuration

### Per-Node Configuration

Configure individual nodes with different settings:

```json
{
  "nodes": [
    {
      "id": "gpu-node",
      "address": "localhost",
      "port": 8000,
      "weight": 3.0,
      "gpuLayers": 35,
      "contextSize": 4096
    },
    {
      "id": "cpu-node",
      "address": "localhost",
      "port": 8001,
      "weight": 1.0,
      "gpuLayers": 0,
      "contextSize": 2048
    }
  ]
}
```

### Model Configuration

Global model settings applied to all nodes:

```json
{
  "model": {
    "contextSize": 2048,
    "gpuLayers": 0,
    "batchSize": 512,
    "threads": 4,
    "mlock": false
  }
}
```

## Limbo Module Reference

The Limbo module provides these ADTs (Abstract Data Types):

### ModelContext

```limbo
ModelContext: adt {
    load: fn(path: string, ctxSize: int, layers: int): ref ModelContext;
    unload: fn(ctx: self ref ModelContext);
    evaluate: fn(ctx: self ref ModelContext, input: string): string;
};
```

### DisNode

```limbo
DisNode: adt {
    init: fn(id: string, addr: string, p: int): ref DisNode;
    connect: fn(node: self ref DisNode): int;
    disconnect: fn(node: self ref DisNode);
    sendRequest: fn(node: self ref DisNode, req: string): string;
};
```

### NetworkCoordinator

```limbo
NetworkCoordinator: adt {
    init: fn(): ref NetworkCoordinator;
    addNode: fn(nc: self ref NetworkCoordinator, node: ref DisNode);
    removeNode: fn(nc: self ref NetworkCoordinator, nodeId: string);
    dispatch: fn(nc: self ref NetworkCoordinator, request: string): string;
};
```

## Building the Limbo Module

To compile the Limbo module from source:

```bash
cd src/deployment/limbo
limbo llamacpp.b
```

This generates `llamacpp.dis` which can be executed in the Dis-VM.

## Troubleshooting

### Dis-VM Not Found

Ensure `emu` is in your PATH:

```bash
which emu
# or on Windows
where emu
```

Install Inferno OS from: http://www.vitanuova.com/inferno/

### Port Conflicts

Change the base port if ports are in use:

```json
{
  "network": {
    "basePort": 9000
  }
}
```

### Node Health Failures

Increase health check interval or check network connectivity:

```json
{
  "network": {
    "healthCheckInterval": 60000
  }
}
```

### Memory Issues

Reduce context size or enable memory locking:

```json
{
  "model": {
    "contextSize": 1024,
    "mlock": true
  }
}
```

## Performance Considerations

- **Isolation Overhead**: Dis-VM isolates add minimal overhead but use memory
- **Network Latency**: Inter-node communication adds latency
- **Load Balancing**: Choose strategy based on your workload
- **Health Checks**: Balance frequency with network overhead

## Comparison with Other Deployment Methods

| Feature | Limbo/Dis-VM | Docker | Kubernetes |
|---------|-------------|--------|------------|
| Isolation | Process-level | Container | Pod |
| Startup Time | Very Fast | Fast | Moderate |
| Memory Overhead | Minimal | Moderate | High |
| Language | Limbo | Any | Any |
| Learning Curve | High | Moderate | High |
| Distributed | Built-in | Manual | Orchestrated |

## Future Enhancements

- Styx protocol integration for distributed file systems
- Dynamic model loading/unloading per node
- Batch request processing
- GPU support per node
- Metrics and monitoring dashboard
- Cross-datacenter deployment support

## Resources

- [Inferno OS Documentation](http://www.vitanuova.com/inferno/papers/)
- [Limbo Programming Guide](http://www.vitanuova.com/inferno/papers/limbo.html)
- [Dis Virtual Machine](http://www.vitanuova.com/inferno/papers/dis.html)
- [node-llama-cpp Documentation](https://node-llama-cpp.withcat.ai)

## License

This deployment system is part of node-llama-cpp and is licensed under the MIT License.
