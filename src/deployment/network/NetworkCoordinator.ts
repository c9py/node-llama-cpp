/**
 * Distributed Network Coordinator
 * 
 * Manages a network of Dis-VM isolates for distributed llama.cpp inference.
 * Implements load balancing, fault tolerance, and request routing.
 */

import {EventEmitter} from "events";
import {DisVMIsolate, DisVMIsolateConfig, DisVMManager} from "../dis-vm/DisVMManager.js";

/**
 * Load balancing strategies
 */
export enum LoadBalancingStrategy {
    RoundRobin = "round-robin",
    LeastConnections = "least-connections",
    Random = "random",
    WeightedRandom = "weighted-random"
}

/**
 * Configuration for the network coordinator
 */
export interface NetworkCoordinatorConfig {
    /** Load balancing strategy */
    strategy: LoadBalancingStrategy;
    
    /** Health check interval in milliseconds */
    healthCheckInterval?: number;
    
    /** Request timeout in milliseconds */
    requestTimeout?: number;
    
    /** Enable automatic failover */
    enableFailover?: boolean;
}

/**
 * Node information in the distributed network
 */
export interface NetworkNode {
    isolateId: string;
    address: string;
    port: number;
    isHealthy: boolean;
    connections: number;
    weight: number;
}

/**
 * Inference request
 */
export interface InferenceRequest {
    requestId: string;
    prompt: string;
    options?: Record<string, any>;
}

/**
 * Inference response
 */
export interface InferenceResponse {
    requestId: string;
    nodeId: string;
    result: string;
    timestamp: number;
}

/**
 * Coordinates distributed inference across Dis-VM isolates
 */
export class NetworkCoordinator extends EventEmitter {
    private readonly config: NetworkCoordinatorConfig;
    private readonly disVMManager: DisVMManager;
    private nodes: Map<string, NetworkNode> = new Map();
    private roundRobinIndex: number = 0;
    private healthCheckTimer?: NodeJS.Timeout;
    
    constructor(config: NetworkCoordinatorConfig) {
        super();
        this.config = {
            healthCheckInterval: 30000,
            requestTimeout: 60000,
            enableFailover: true,
            ...config
        };
        this.disVMManager = new DisVMManager();
        
        // Listen to isolate events
        this.disVMManager.on("isolate-started", (id) => this.handleIsolateStarted(id));
        this.disVMManager.on("isolate-stopped", (id) => this.handleIsolateStopped(id));
    }
    
    /**
     * Initialize the network coordinator
     */
    async initialize(): Promise<void> {
        console.log("Initializing Network Coordinator");
        console.log(`  Strategy: ${this.config.strategy}`);
        console.log(`  Failover: ${this.config.enableFailover ? "enabled" : "disabled"}`);
        
        // Start health check timer
        if (this.config.healthCheckInterval) {
            this.startHealthCheck();
        }
        
        this.emit("initialized");
    }
    
    /**
     * Deploy a new node to the network
     */
    async deployNode(config: DisVMIsolateConfig): Promise<NetworkNode> {
        console.log(`Deploying node: ${config.isolateId}`);
        
        // Create and start the Dis-VM isolate
        await this.disVMManager.createIsolate(config);
        
        // Register the node
        const node: NetworkNode = {
            isolateId: config.isolateId,
            address: config.address || "localhost",
            port: config.port || 8000,
            isHealthy: true,
            connections: 0,
            weight: 1.0
        };
        
        this.nodes.set(config.isolateId, node);
        this.emit("node-deployed", node);
        
        console.log(`Node ${config.isolateId} deployed successfully`);
        return node;
    }
    
    /**
     * Remove a node from the network
     */
    async removeNode(nodeId: string): Promise<void> {
        console.log(`Removing node: ${nodeId}`);
        
        const node = this.nodes.get(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }
        
        // Stop the isolate
        await this.disVMManager.removeIsolate(nodeId);
        
        // Unregister the node
        this.nodes.delete(nodeId);
        this.emit("node-removed", nodeId);
        
        console.log(`Node ${nodeId} removed successfully`);
    }
    
    /**
     * Dispatch an inference request to an available node
     */
    async dispatch(request: InferenceRequest): Promise<InferenceResponse> {
        const node = this.selectNode();
        
        if (!node) {
            throw new Error("No healthy nodes available");
        }
        
        console.log(`Dispatching request ${request.requestId} to node ${node.isolateId}`);
        
        try {
            node.connections++;
            
            const isolate = this.disVMManager.getIsolate(node.isolateId);
            if (!isolate) {
                throw new Error(`Isolate ${node.isolateId} not found`);
            }
            
            // Send request to the isolate
            const result = await isolate.send(JSON.stringify({
                type: "inference",
                requestId: request.requestId,
                prompt: request.prompt,
                options: request.options
            }));
            
            node.connections--;
            
            return {
                requestId: request.requestId,
                nodeId: node.isolateId,
                result,
                timestamp: Date.now()
            };
        } catch (error) {
            node.connections--;
            
            if (this.config.enableFailover) {
                console.warn(`Node ${node.isolateId} failed, attempting failover`);
                node.isHealthy = false;
                
                // Retry with another node
                return this.dispatch(request);
            }
            
            throw error;
        }
    }
    
    /**
     * Select a node based on the load balancing strategy
     */
    private selectNode(): NetworkNode | null {
        const healthyNodes = Array.from(this.nodes.values()).filter(
            node => node.isHealthy
        );
        
        if (healthyNodes.length === 0) {
            return null;
        }
        
        switch (this.config.strategy) {
            case LoadBalancingStrategy.RoundRobin:
                return this.selectRoundRobin(healthyNodes);
            
            case LoadBalancingStrategy.LeastConnections:
                return this.selectLeastConnections(healthyNodes);
            
            case LoadBalancingStrategy.Random:
                return this.selectRandom(healthyNodes);
            
            case LoadBalancingStrategy.WeightedRandom:
                return this.selectWeightedRandom(healthyNodes);
            
            default:
                return this.selectRoundRobin(healthyNodes);
        }
    }
    
    private selectRoundRobin(nodes: NetworkNode[]): NetworkNode {
        const node = nodes[this.roundRobinIndex % nodes.length];
        this.roundRobinIndex++;
        return node!;
    }
    
    private selectLeastConnections(nodes: NetworkNode[]): NetworkNode {
        return nodes.reduce((least, current) =>
            current.connections < least.connections ? current : least
        )!;
    }
    
    private selectRandom(nodes: NetworkNode[]): NetworkNode {
        return nodes[Math.floor(Math.random() * nodes.length)]!;
    }
    
    private selectWeightedRandom(nodes: NetworkNode[]): NetworkNode {
        const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const node of nodes) {
            random -= node.weight;
            if (random <= 0) {
                return node;
            }
        }
        
        return nodes[0]!;
    }
    
    /**
     * Start health check for all nodes
     */
    private startHealthCheck(): void {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    
    /**
     * Perform health check on all nodes
     */
    private async performHealthCheck(): Promise<void> {
        for (const [nodeId, node] of this.nodes.entries()) {
            try {
                const isolate = this.disVMManager.getIsolate(nodeId);
                if (!isolate) {
                    node.isHealthy = false;
                    continue;
                }
                
                // Ping the isolate
                await isolate.send(JSON.stringify({type: "ping"}));
                node.isHealthy = true;
            } catch (error) {
                console.warn(`Health check failed for node ${nodeId}:`, error);
                node.isHealthy = false;
                this.emit("node-unhealthy", nodeId);
            }
        }
    }
    
    /**
     * Get network status
     */
    getStatus(): {
        totalNodes: number;
        healthyNodes: number;
        strategy: LoadBalancingStrategy;
        nodes: NetworkNode[];
    } {
        const nodes = Array.from(this.nodes.values());
        return {
            totalNodes: nodes.length,
            healthyNodes: nodes.filter(n => n.isHealthy).length,
            strategy: this.config.strategy,
            nodes
        };
    }
    
    /**
     * Shutdown the network coordinator
     */
    async shutdown(): Promise<void> {
        console.log("Shutting down Network Coordinator");
        
        // Stop health check
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        // Stop all isolates
        await this.disVMManager.stopAll();
        
        this.nodes.clear();
        this.emit("shutdown");
        
        console.log("Network Coordinator shut down successfully");
    }
    
    private handleIsolateStarted(isolateId: string): void {
        console.log(`Isolate ${isolateId} started event received`);
    }
    
    private handleIsolateStopped(isolateId: string): void {
        console.log(`Isolate ${isolateId} stopped event received`);
        const node = this.nodes.get(isolateId);
        if (node) {
            node.isHealthy = false;
        }
    }
}
