# Limbo/Inferno Dis-VM Distributed Deployment

This module provides infrastructure for deploying `node-llama-cpp` models as a distributed network of Inferno Dis-VM isolates using the Limbo programming language.

## Overview

The Limbo deployment system enables running llama.cpp inference across multiple isolated Dis-VM processes in a distributed network. This architecture provides:

- **Isolation**: Each node runs in its own Dis-VM isolate
- **Scalability**: Dynamically add or remove nodes
- **Fault Tolerance**: Automatic failover to healthy nodes
- **Load Balancing**: Multiple strategies (round-robin, least-connections, etc.)
- **Network Distribution**: Nodes can run on different machines

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Network Coordinator                      │
│  (Node.js - Manages Dis-VM Isolates)                   │
└───────────┬─────────────┬─────────────┬────────────────┘
            │             │             │
            ▼             ▼             ▼
    ┌───────────┐ ┌───────────┐ ┌───────────┐
    │  Dis-VM   │ │  Dis-VM   │ │  Dis-VM   │
    │ Isolate 1 │ │ Isolate 2 │ │ Isolate 3 │
    │           │ │           │ │           │
    │ [Limbo]   │ │ [Limbo]   │ │ [Limbo]   │
    │ [Model]   │ │ [Model]   │ │ [Model]   │
    └───────────┘ └───────────┘ └───────────┘
```

### Components

1. **Limbo Module** (`src/deployment/limbo/llamacpp.b`)
   - Written in Limbo programming language
   - Provides the interface for model loading and inference
   - Runs inside Inferno Dis-VM

2. **Dis-VM Manager** (`src/deployment/dis-vm/DisVMManager.ts`)
   - TypeScript layer that manages Dis-VM isolate lifecycle
   - Spawns and communicates with Dis-VM processes
   - Handles inter-process communication

3. **Network Coordinator** (`src/deployment/network/NetworkCoordinator.ts`)
   - Orchestrates distributed inference requests
   - Implements load balancing strategies
   - Monitors node health and handles failover

4. **Deployment Manager** (`src/deployment/LimboDeploymentManager.ts`)
   - High-level API for deployment operations
   - Manages configuration and orchestration
   - Provides scaling and monitoring capabilities

## Usage

### Installation

First, ensure you have Inferno OS and the Dis-VM installed on your system. The deployment system expects the `emu` command to be available in your PATH.

### Configuration

Create a deployment configuration file:

```json
{
  "name": "my-llama-deployment",
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
    },
    {
      "id": "node-1",
      "address": "localhost",
      "port": 8001,
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

### CLI Usage

Generate a configuration file:

```bash
npx node-llama-cpp deploy generate-config \
  --model /path/to/model.gguf \
  --nodes 3 \
  --output deployment.json
```

Start a deployment:

```bash
npx node-llama-cpp deploy start --config deployment.json
```

### Programmatic Usage

```typescript
import {
    LimboDeploymentManager,
    LimboDeploymentConfig,
    LoadBalancingStrategy
} from "node-llama-cpp/deployment";

// Create deployment configuration
const config: Partial<LimboDeploymentConfig> = {
    name: "my-deployment",
    modulePath: "/dis/deployment/llamacpp.dis",
    modelPath: "/path/to/model.gguf",
    network: {
        loadBalancing: LoadBalancingStrategy.RoundRobin,
        healthCheckInterval: 30000,
        requestTimeout: 60000,
        enableFailover: true,
        basePort: 8000
    },
    nodes: [
        {
            id: "node-0",
            address: "localhost",
            port: 8000
        },
        {
            id: "node-1",
            address: "localhost",
            port: 8001
        }
    ]
};

// Create and deploy
const manager = new LimboDeploymentManager(config);

manager.on("deployed", () => {
    console.log("Deployment is ready");
});

manager.on("error", (error) => {
    console.error("Deployment error:", error);
});

await manager.deploy();

// Perform inference
const result = await manager.evaluate("What is the meaning of life?");
console.log(result);

// Scale the deployment
await manager.scale(5); // Scale to 5 nodes

// Get status
const status = manager.getStatus();
console.log(status);

// Shutdown
await manager.shutdown();
```

## Load Balancing Strategies

The system supports multiple load balancing strategies:

- **round-robin**: Distribute requests evenly across nodes in sequence
- **least-connections**: Route to the node with fewest active connections
- **random**: Randomly select an available node
- **weighted-random**: Random selection based on node weights

Configure the strategy in your deployment configuration:

```json
{
  "network": {
    "loadBalancing": "least-connections"
  }
}
```

## Scaling

Scale your deployment dynamically:

```typescript
// Scale up to 10 nodes
await manager.scale(10);

// Scale down to 3 nodes
await manager.scale(3);
```

## Health Monitoring

The network coordinator automatically monitors node health:

- Periodic health checks (configurable interval)
- Automatic failover to healthy nodes
- Node status tracking

Configure health check interval:

```json
{
  "network": {
    "healthCheckInterval": 30000  // 30 seconds
  }
}
```

## Limbo Module Reference

The Limbo module (`llamacpp.b`) provides the following ADTs:

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
    balance: fn(nc: self ref NetworkCoordinator): ref DisNode;
};
```

## Requirements

- Inferno OS with Dis-VM
- Limbo compiler (`limbo`)
- Node.js >= 20.0.0
- node-llama-cpp

## Building the Limbo Module

Compile the Limbo module:

```bash
cd src/deployment/limbo
limbo llamacpp.b
```

This will generate `llamacpp.dis` which can be executed in the Dis-VM.

## Troubleshooting

### Dis-VM Not Found

Ensure the `emu` command is in your PATH:

```bash
which emu
```

### Port Already in Use

Change the base port in your configuration:

```json
{
  "network": {
    "basePort": 9000
  }
}
```

### Node Health Check Failures

Increase the health check interval or check network connectivity:

```json
{
  "network": {
    "healthCheckInterval": 60000
  }
}
```

## Advanced Topics

### Distributed Deployment Across Machines

Configure nodes with different addresses:

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

### Custom Load Balancing

Implement weighted load balancing:

```json
{
  "network": {
    "loadBalancing": "weighted-random"
  },
  "nodes": [
    {
      "id": "powerful-node",
      "weight": 3.0
    },
    {
      "id": "standard-node",
      "weight": 1.0
    }
  ]
}
```

## Performance Considerations

- Each node maintains its own model context, consuming memory
- Health checks add network overhead
- Load balancing strategy affects latency and throughput
- Dis-VM isolates provide strong isolation but add overhead

## Future Enhancements

- Styx protocol integration for file system access
- Dynamic model loading/unloading
- Batch request processing
- Cross-datacenter deployment
- GPU support per node
- Metrics and monitoring dashboard

## License

MIT License - see LICENSE file for details.
