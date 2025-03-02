import { apiRequest } from './api';

export const fetchNetworkHealth = () => 
  apiRequest('/network/health');

export const setupRequiredStreams = () => 
  apiRequest('/admin/setup-streams', { method: 'POST' });

export const forceMineBlocks = (chain, count = 1) => 
  apiRequest('/admin/force-mine', { 
    method: 'POST',
    body: JSON.stringify({ chain, count })
  });

export const syncMerkleRoots = () =>
  apiRequest('/admin/sync-merkle-roots', { method: 'POST' });

export const checkPeerConnections = () =>
  apiRequest('/network/check-peers');

export const fetchBlockExplorer = (chain) =>
  apiRequest(`/network/blocks/${chain}`);
