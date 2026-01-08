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

export {
    DEFAULT_DEPLOYMENT_CONFIG,
    validateDeploymentConfig,
    mergeWithDefaults,
    generateNodeConfigs,
    type LimboDeploymentConfig,
    type NetworkConfig,
    type NodeConfig,
    type ModelConfig
} from "./DeploymentConfig.js";

export {
    NetworkCoordinator,
    LoadBalancingStrategy,
    type NetworkCoordinatorConfig,
    type NetworkNode,
    type InferenceRequest,
    type InferenceResponse
} from "./network/NetworkCoordinator.js";

export {
    DisVMManager,
    DisVMIsolate,
    type DisVMIsolateConfig
} from "./dis-vm/DisVMManager.js";
