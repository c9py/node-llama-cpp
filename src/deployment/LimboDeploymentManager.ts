/**
 * Limbo Deployment Manager
 * 
 * Main orchestrator for deploying and managing llama.cpp models
 * across a distributed network of Inferno Dis-VM isolates
 */

import {EventEmitter} from "events";
import * as path from "path";
import {NetworkCoordinator, InferenceRequest, InferenceResponse, LoadBalancingStrategy} from "./network/NetworkCoordinator.js";
import {DisVMIsolateConfig} from "./dis-vm/DisVMManager.js";
import {
    LimboDeploymentConfig,
    validateDeploymentConfig,
    mergeWithDefaults
} from "./DeploymentConfig.js";

/**
 * Deployment status
 */
export enum DeploymentStatus {
    Initializing = "initializing",
    Running = "running",
    Paused = "paused",
    Stopped = "stopped",
    Error = "error"
}

/**
 * Main deployment manager
 */
export class LimboDeploymentManager extends EventEmitter {
    private config: LimboDeploymentConfig;
    private coordinator: NetworkCoordinator | null = null;
    private status: DeploymentStatus = DeploymentStatus.Stopped;
    private requestCounter: number = 0;
    
    constructor(config: Partial<LimboDeploymentConfig>) {
        super();
        
        // Validate configuration
        const errors = validateDeploymentConfig(config);
        if (errors.length > 0) {
            throw new Error(`Invalid deployment configuration:\n${errors.join("\n")}`);
        }
        
        // Merge with defaults
        this.config = mergeWithDefaults(config);
    }
    
    /**
     * Deploy the distributed network
     */
    async deploy(): Promise<void> {
        if (this.status !== DeploymentStatus.Stopped) {
            throw new Error(`Cannot deploy: current status is ${this.status}`);
        }
        
        this.status = DeploymentStatus.Initializing;
        this.emit("status-change", this.status);
        
        console.log(`Deploying ${this.config.name}`);
        console.log(`  Model: ${this.config.modelPath}`);
        console.log(`  Module: ${this.config.modulePath}`);
        console.log(`  Nodes: ${this.config.nodes.length}`);
        
        try {
            // Create network coordinator
            this.coordinator = new NetworkCoordinator({
                strategy: this.config.network.loadBalancing,
                healthCheckInterval: this.config.network.healthCheckInterval,
                requestTimeout: this.config.network.requestTimeout,
                enableFailover: this.config.network.enableFailover
            });
            
            // Initialize coordinator
            await this.coordinator.initialize();
            
            // Deploy each node
            for (const nodeConfig of this.config.nodes) {
                const isolateConfig: DisVMIsolateConfig = {
                    isolateId: nodeConfig.id,
                    modulePath: this.config.modulePath,
                    address: nodeConfig.address,
                    port: nodeConfig.port,
                    env: {
                        MODEL_PATH: this.config.modelPath,
                        CONTEXT_SIZE: String(nodeConfig.contextSize || this.config.model.contextSize),
                        GPU_LAYERS: String(nodeConfig.gpuLayers ?? this.config.model.gpuLayers),
                        BATCH_SIZE: String(this.config.model.batchSize),
                        THREADS: String(this.config.model.threads)
                    }
                };
                
                await this.coordinator.deployNode(isolateConfig);
                console.log(`  ✓ Node ${nodeConfig.id} deployed`);
            }
            
            this.status = DeploymentStatus.Running;
            this.emit("status-change", this.status);
            this.emit("deployed");
            
            console.log(`✓ Deployment ${this.config.name} is running`);
        } catch (error) {
            this.status = DeploymentStatus.Error;
            this.emit("status-change", this.status);
            this.emit("error", error);
            throw error;
        }
    }
    
    /**
     * Evaluate a prompt using the distributed network
     */
    async evaluate(prompt: string, options?: Record<string, any>): Promise<string> {
        if (this.status !== DeploymentStatus.Running) {
            throw new Error(`Cannot evaluate: deployment status is ${this.status}`);
        }
        
        if (!this.coordinator) {
            throw new Error("Coordinator not initialized");
        }
        
        const requestId = `req-${++this.requestCounter}`;
        
        const request: InferenceRequest = {
            requestId,
            prompt,
            options
        };
        
        console.log(`Evaluating prompt (${requestId}): ${prompt.substring(0, 50)}...`);
        
        const response = await this.coordinator.dispatch(request);
        
        console.log(`Response from ${response.nodeId} (${requestId})`);
        
        return response.result;
    }
    
    /**
     * Pause the deployment (stop processing requests but keep nodes alive)
     */
    async pause(): Promise<void> {
        if (this.status !== DeploymentStatus.Running) {
            throw new Error(`Cannot pause: current status is ${this.status}`);
        }
        
        this.status = DeploymentStatus.Paused;
        this.emit("status-change", this.status);
        
        console.log(`Deployment ${this.config.name} paused`);
    }
    
    /**
     * Resume a paused deployment
     */
    async resume(): Promise<void> {
        if (this.status !== DeploymentStatus.Paused) {
            throw new Error(`Cannot resume: current status is ${this.status}`);
        }
        
        this.status = DeploymentStatus.Running;
        this.emit("status-change", this.status);
        
        console.log(`Deployment ${this.config.name} resumed`);
    }
    
    /**
     * Scale the deployment by adding or removing nodes
     */
    async scale(targetNodeCount: number): Promise<void> {
        if (this.status !== DeploymentStatus.Running) {
            throw new Error(`Cannot scale: deployment status is ${this.status}`);
        }
        
        if (!this.coordinator) {
            throw new Error("Coordinator not initialized");
        }
        
        const currentNodeCount = this.config.nodes.length;
        
        if (targetNodeCount === currentNodeCount) {
            console.log("Already at target scale");
            return;
        }
        
        if (targetNodeCount > currentNodeCount) {
            // Scale up
            const nodesToAdd = targetNodeCount - currentNodeCount;
            console.log(`Scaling up: adding ${nodesToAdd} nodes`);
            
            const basePort = this.config.network.basePort + currentNodeCount;
            
            for (let i = 0; i < nodesToAdd; i++) {
                const nodeId = `node-${currentNodeCount + i}`;
                const isolateConfig: DisVMIsolateConfig = {
                    isolateId: nodeId,
                    modulePath: this.config.modulePath,
                    address: "localhost",
                    port: basePort + i,
                    env: {
                        MODEL_PATH: this.config.modelPath,
                        CONTEXT_SIZE: String(this.config.model.contextSize),
                        GPU_LAYERS: String(this.config.model.gpuLayers)
                    }
                };
                
                await this.coordinator.deployNode(isolateConfig);
                console.log(`  ✓ Node ${nodeId} added`);
            }
        } else {
            // Scale down
            const nodesToRemove = currentNodeCount - targetNodeCount;
            console.log(`Scaling down: removing ${nodesToRemove} nodes`);
            
            for (let i = 0; i < nodesToRemove; i++) {
                const nodeId = this.config.nodes[currentNodeCount - 1 - i].id;
                await this.coordinator.removeNode(nodeId);
                console.log(`  ✓ Node ${nodeId} removed`);
            }
        }
        
        this.emit("scaled", targetNodeCount);
    }
    
    /**
     * Get deployment status
     */
    getStatus(): {
        name: string;
        status: DeploymentStatus;
        network?: ReturnType<NetworkCoordinator["getStatus"]>;
    } {
        return {
            name: this.config.name,
            status: this.status,
            network: this.coordinator?.getStatus()
        };
    }
    
    /**
     * Shutdown the deployment
     */
    async shutdown(): Promise<void> {
        if (this.status === DeploymentStatus.Stopped) {
            return;
        }
        
        console.log(`Shutting down deployment ${this.config.name}`);
        
        if (this.coordinator) {
            await this.coordinator.shutdown();
            this.coordinator = null;
        }
        
        this.status = DeploymentStatus.Stopped;
        this.emit("status-change", this.status);
        this.emit("shutdown");
        
        console.log(`✓ Deployment ${this.config.name} stopped`);
    }
}

/**
 * Create a deployment from a configuration file
 */
export async function createDeploymentFromConfig(
    configPath: string
): Promise<LimboDeploymentManager> {
    const fs = await import("fs/promises");
    const configData = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configData) as Partial<LimboDeploymentConfig>;
    
    return new LimboDeploymentManager(config);
}
