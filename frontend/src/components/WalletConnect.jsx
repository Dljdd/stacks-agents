import React, { useEffect, useMemo, useState } from 'react'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { AppConfig, UserSession, showConnect } from '@stacks/connect'

const NETWORK = 'testnet'
const HIRO_API = NETWORK === 'testnet' ? 'https://api.testnet.hiro.so' : 'https://api.hiro.so'

export default function WalletConnect({ onWalletConnected, onWalletDisconnected }) {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState('')
  const [balance, setBalance] = useState('0')
  const [copied, setCopied] = useState(false)

  const userSession = useMemo(() => {
    const appConfig = new AppConfig(['store_write', 'publish_data'])
    return new UserSession({ appConfig })
  }, [])

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const data = userSession.loadUserData()
      const stxAddress = data.profile?.stxAddress?.[NETWORK]
      if (stxAddress) {
        setIsConnected(true)
        setAddress(stxAddress)
        fetchBalance(stxAddress)
      }
    }
  }, [userSession])

  async function fetchBalance(stxAddress) {
    try {
      const res = await fetch(`${HIRO_API}/extended/v1/address/${stxAddress}/balances`)
      const json = await res.json()
      const micro = json.stx?.balance ? Number(json.stx.balance) : 0
      const stx = micro / 1_000_000
      setBalance(stx.toLocaleString(undefined, { maximumFractionDigits: 6 }))
    } catch (e) {
      console.error('Balance fetch failed', e)
    }
  }

  const handleConnect = () => {
    showConnect({
      userSession,
      appDetails: {
        name: 'AgentPay',
        icon: window.location.origin + '/neon-logo.svg',
      },
      onFinish: () => {
        const data = userSession.loadUserData()
        const stxAddress = data.profile?.stxAddress?.[NETWORK]
        if (stxAddress) {
          setIsConnected(true)
          setAddress(stxAddress)
          fetchBalance(stxAddress)
          onWalletConnected?.({ address: stxAddress })
        }
      },
      onCancel: () => {},
    })
  }

  const handleDisconnect = () => {
    try {
      userSession.signUserOut()
    } catch {}
    setIsConnected(false)
    setAddress('')
    setBalance('0')
    onWalletDisconnected?.()
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }

  const formatAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '')

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 font-medium"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    )
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 min-w-[220px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
          <span className="text-emerald-400 text-sm font-medium">Connected</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Address:</span>
          <button
            onClick={copyAddress}
            className="flex items-center gap-1 text-slate-300 hover:text-white text-xs transition-colors"
            title="Copy address"
          >
            {formatAddress(address)}
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Balance:</span>
          <span className="text-white font-semibold text-sm">{balance} STX</span>
        </div>
      </div>
    </div>
  )
}
