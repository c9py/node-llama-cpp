/**
 * Example: Limbo Distributed Deployment
 * 
 * This example demonstrates how to deploy a llama.cpp model
 * across a distributed network of Inferno Dis-VM isolates
 */

import {
    LimboDeploymentManager,
    LoadBalancingStrategy,
    generateNodeConfigs
} from "../index.js";

async function main() {
    console.log("=== Limbo Distributed Deployment Example ===\n");
    
    // Create deployment configuration
    const config = {
        name: "example-deployment",
        modulePath: "/dis/deployment/llamacpp.dis",
        modelPath: "./models/example-model.gguf",
        network: {
            loadBalancing: LoadBalancingStrategy.RoundRobin,
            healthCheckInterval: 30000,
            requestTimeout: 60000,
            enableFailover: true,
            basePort: 8000
        },
        nodes: generateNodeConfigs(3, "localhost", 8000),
        model: {
            contextSize: 2048,
            gpuLayers: 0,
            batchSize: 512,
            threads: 4,
            mlock: false
        }
    };
    
    console.log("Configuration:");
    console.log(`  Name: ${config.name}`);
    console.log(`  Model: ${config.modelPath}`);
    console.log(`  Nodes: ${config.nodes.length}`);
    console.log(`  Strategy: ${config.network.loadBalancing}`);
    console.log();
    
    // Create deployment manager
    const manager = new LimboDeploymentManager(config);
    
    // Listen to events
    manager.on("status-change", (status) => {
        console.log(`Status changed: ${status}`);
    });
    
    manager.on("deployed", () => {
        console.log("✓ Deployment is ready\n");
    });
    
    manager.on("error", (error) => {
        console.error("Deployment error:", error);
    });
    
    try {
        // Deploy the network
        console.log("Deploying distributed network...");
        await manager.deploy();
        
        // Get initial status
        const status = manager.getStatus();
        console.log("\nDeployment Status:");
        console.log(`  Name: ${status.name}`);
        console.log(`  Status: ${status.status}`);
        if (status.network) {
            console.log(`  Total Nodes: ${status.network.totalNodes}`);
            console.log(`  Healthy Nodes: ${status.network.healthyNodes}`);
            console.log(`  Load Balancing: ${status.network.strategy}`);
        }
        console.log();
        
        // Perform some inference requests
        console.log("Running inference requests...\n");
        
        const prompts = [
            "What is the capital of France?",
            "Explain quantum computing in simple terms.",
            "Write a haiku about programming."
        ];
        
        for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];
            console.log(`Request ${i + 1}: ${prompt}`);
            
            const result = await manager.evaluate(prompt, {
                temperature: 0.7,
                maxTokens: 100
            });
            
            console.log(`Response: ${result}`);
            console.log();
        }
        
        // Demonstrate scaling
        console.log("Scaling deployment to 5 nodes...");
        await manager.scale(5);
        
        const scaledStatus = manager.getStatus();
        if (scaledStatus.network) {
            console.log(`  New node count: ${scaledStatus.network.totalNodes}`);
        }
        console.log();
        
        // Scale back down
        console.log("Scaling deployment back to 3 nodes...");
        await manager.scale(3);
        console.log();
        
        // Pause deployment
        console.log("Pausing deployment...");
        await manager.pause();
        console.log("Deployment paused\n");
        
        // Resume deployment
        console.log("Resuming deployment...");
        await manager.resume();
        console.log("Deployment resumed\n");
        
        // Shutdown
        console.log("Shutting down deployment...");
        await manager.shutdown();
        console.log("✓ Deployment shut down successfully");
        
    } catch (error) {
        console.error("Error:", error);
        await manager.shutdown();
        process.exit(1);
    }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error("Unhandled error:", error);
        process.exit(1);
    });
}

export default main;
