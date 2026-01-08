/**
 * Deployment Configuration
 * 
 * Configuration types and utilities for Limbo/Inferno Dis-VM deployment
 */

import {LoadBalancingStrategy} from "./network/NetworkCoordinator.js";

/**
 * Limbo deployment configuration
 */
export interface LimboDeploymentConfig {
    /** Deployment name/identifier */
    name: string;
    
    /** Path to the Limbo module (.b or .dis file) */
    modulePath: string;
    
    /** Path to the GGUF model file */
    modelPath: string;
    
    /** Network configuration */
    network: NetworkConfig;
    
    /** Node configurations */
    nodes: NodeConfig[];
    
    /** Model configuration */
    model: ModelConfig;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
    /** Load balancing strategy */
    loadBalancing: LoadBalancingStrategy;
    
    /** Health check interval in milliseconds */
    healthCheckInterval: number;
    
    /** Request timeout in milliseconds */
    requestTimeout: number;
    
    /** Enable automatic failover */
    enableFailover: boolean;
    
    /** Base port for nodes (each node will increment) */
    basePort: number;
}

/**
 * Individual node configuration
 */
export interface NodeConfig {
    /** Node identifier */
    id: string;
    
    /** Network address */
    address: string;
    
    /** Network port */
    port: number;
    
    /** Node weight for weighted load balancing */
    weight?: number;
    
    /** GPU layers to offload (-1 for all) */
    gpuLayers?: number;
    
    /** Context size for this node */
    contextSize?: number;
}

/**
 * Model configuration
 */
export interface ModelConfig {
    /** Default context size */
    contextSize: number;
    
    /** Default GPU layers */
    gpuLayers: number;
    
    /** Batch size */
    batchSize: number;
    
    /** Number of threads */
    threads: number;
    
    /** Enable memory locking */
    mlock: boolean;
}

/**
 * Default deployment configuration
 */
export const DEFAULT_DEPLOYMENT_CONFIG: Partial<LimboDeploymentConfig> = {
    network: {
        loadBalancing: LoadBalancingStrategy.RoundRobin,
        healthCheckInterval: 30000,
        requestTimeout: 60000,
        enableFailover: true,
        basePort: 8000
    },
    model: {
        contextSize: 2048,
        gpuLayers: 0,
        batchSize: 512,
        threads: 4,
        mlock: false
    }
};

/**
 * Validate deployment configuration
 */
export function validateDeploymentConfig(config: Partial<LimboDeploymentConfig>): string[] {
    const errors: string[] = [];
    
    if (!config.name) {
        errors.push("Deployment name is required");
    }
    
    if (!config.modulePath) {
        errors.push("Module path is required");
    }
    
    if (!config.modelPath) {
        errors.push("Model path is required");
    }
    
    if (!config.nodes || config.nodes.length === 0) {
        errors.push("At least one node configuration is required");
    }
    
    if (config.nodes) {
        const nodeIds = new Set<string>();
        for (const node of config.nodes) {
            if (!node.id) {
                errors.push("Node ID is required");
            } else if (nodeIds.has(node.id)) {
                errors.push(`Duplicate node ID: ${node.id}`);
            } else {
                nodeIds.add(node.id);
            }
            
            if (!node.address) {
                errors.push(`Node ${node.id}: address is required`);
            }
            
            if (!node.port || node.port < 1 || node.port > 65535) {
                errors.push(`Node ${node.id}: invalid port`);
            }
        }
    }
    
    return errors;
}

/**
 * Merge configuration with defaults
 */
export function mergeWithDefaults(config: Partial<LimboDeploymentConfig>): LimboDeploymentConfig {
    return {
        name: config.name || "default-deployment",
        modulePath: config.modulePath || "",
        modelPath: config.modelPath || "",
        network: {
            ...DEFAULT_DEPLOYMENT_CONFIG.network!,
            ...config.network
        },
        nodes: config.nodes || [],
        model: {
            ...DEFAULT_DEPLOYMENT_CONFIG.model!,
            ...config.model
        }
    };
}

/**
 * Generate node configurations from a template
 */
export function generateNodeConfigs(
    count: number,
    baseAddress: string = "localhost",
    basePort: number = 8000
): NodeConfig[] {
    const nodes: NodeConfig[] = [];
    
    for (let i = 0; i < count; i++) {
        nodes.push({
            id: `node-${i}`,
            address: baseAddress,
            port: basePort + i,
            weight: 1.0,
            gpuLayers: 0,
            contextSize: 2048
        });
    }
    
    return nodes;
}
