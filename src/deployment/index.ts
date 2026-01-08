/**
 * Limbo/Inferno Dis-VM Distributed Deployment
 * 
 * This module provides infrastructure for deploying llama.cpp models
 * as a distributed network of Inferno Dis-VM isolates using Limbo.
 * 
 * @module deployment
 */

export {
    LimboDeploymentManager,
    DeploymentStatus,
    createDeploymentFromConfig
} from "./LimboDeploymentManager.js";

export type {
    LimboDeploymentConfig,
    NetworkConfig,
    NodeConfig,
    ModelConfig
} from "./DeploymentConfig.js";

export {
    DEFAULT_DEPLOYMENT_CONFIG,
    validateDeploymentConfig,
    mergeWithDefaults,
    generateNodeConfigs
} from "./DeploymentConfig.js";

export {
    NetworkCoordinator,
    LoadBalancingStrategy
} from "./network/NetworkCoordinator.js";

export type {
    NetworkCoordinatorConfig,
    NetworkNode,
    InferenceRequest,
    InferenceResponse
} from "./network/NetworkCoordinator.js";

export {
    DisVMManager,
    DisVMIsolate
} from "./dis-vm/DisVMManager.js";

export type {
    DisVMIsolateConfig
} from "./dis-vm/DisVMManager.js";
