import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { toast } from 'sonner'
import NFTMarketplaceABI from '@/lib/abis/NFTMarketplace.json'

const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS || '0x0') as `0x${string}`

export function useNFTOffer() {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const makeOffer = (
    nftContract: `0x${string}`,
    tokenId: bigint,
    offerPriceETH: string
  ) => {
    if (MARKETPLACE_ADDRESS === '0x0') {
      toast.error('Marketplace not deployed')
      return
    }

    const price = parseEther(offerPriceETH)

    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: NFTMarketplaceABI,
      functionName: 'makeOffer',
      args: [nftContract, tokenId, price],
      value: price
    })
    toast.success('Offer submitted')
  }

  const acceptOffer = (offerId: bigint) => {
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: NFTMarketplaceABI,
      functionName: 'acceptOffer',
      args: [offerId]
    })
    toast.success('Offer accepted')
  }

  return {
    makeOffer,
    acceptOffer,
    isPending: isPending || isConfirming,
    isSuccess
  }
}

