const JEJU_IPFS_API = process.env.NEXT_PUBLIC_JEJU_IPFS_API || 'http://localhost:3100';
const JEJU_IPFS_GATEWAY = process.env.NEXT_PUBLIC_JEJU_IPFS_GATEWAY || 'http://localhost:3100';

export async function uploadToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${JEJU_IPFS_API}/upload`, {
    method: 'POST',
    headers: {
      'X-Duration-Months': '1',
    },
    body: formData,
  });

  if (response.status === 402) {
    throw new Error('Payment required - configure x402 wallet');
  }

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const { cid } = await response.json();
  return cid;
}

export function getIPFSUrl(hash: string): string {
  return `${JEJU_IPFS_GATEWAY}/ipfs/${hash}`;
}

export async function retrieveFromIPFS(hash: string): Promise<Blob> {
  const response = await fetch(getIPFSUrl(hash));
  
  if (!response.ok) {
    throw new Error(`Failed to retrieve from IPFS: ${hash}`);
  }
  
  return await response.blob();
}

export async function fileExists(cid: string): Promise<boolean> {
  const response = await fetch(`${JEJU_IPFS_API}/pins?cid=${cid}`);
  const { count } = await response.json();
  return count > 0;
}

