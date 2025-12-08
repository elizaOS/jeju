/**
 * Infrastructure Module
 *
 * Real blockchain and TEE integration for production deployment.
 */

export {
  BlockchainClient,
  type BlockchainConfig,
  type ChainId,
  type GameState,
  type OperatorInfo,
} from './blockchain-client.js';

export {
  type BootstrapConfig,
  type BootstrappedGame,
  bootstrap,
  type GameStatus,
} from './bootstrap.js';

export {
  DStackClient,
  ProductionTEEEnclave,
} from './dstack-integration.js';

export {
  createPhalaGateway,
  type DeploymentConfig,
  type GatewayConfig,
  PhalaGateway,
  type PhalaNode,
  type ProvisionRequest,
} from './phala-gateway.js';

export {
  type DeploymentResult,
  decodeIPFSContenthash,
  type ENSConfig,
  ENSDeployer,
  encodeArweaveContenthash,
  encodeIPFSContenthash,
  uploadToArweave as uploadToArweaveENS,
  uploadToLocalIPFS as uploadToLocalIPFSENS,
} from './ens-deployer.js';

export {
  ENSRegistrar,
  encodeArweaveContenthash as encodeArweaveContenthashRegistrar,
  encodeIPFSContenthash as encodeENSIPFSContenthash,
  type RegistrationResult,
} from './ens-registrar.js';

export {
  AttestationABI,
  AttestationClient,
  generateSimulatedAttestation,
  OnChainAttestationClient,
  type OnChainRegistration,
  type TEEAttestation,
  verifyAttestationLocally,
} from './onchain-attestation.js';

export {
  checkGatewayHealth,
  isLocalIPFSAvailable,
  retrieveFromArweave,
  retrieveFromIPFS,
  runFullStorageTest,
  uploadToArweave,
  uploadToLocalIPFS,
} from './real-storage-test.js';
