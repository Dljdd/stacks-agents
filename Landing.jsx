import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, ShieldCheck, Zap, Bitcoin, Bot } from 'lucide-react'
import CrazyStarryBackground from '../components/CrazyStarryBackground'
import { motion } from 'framer-motion'

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* Crazy p5.js animated starry background */}
      <CrazyStarryBackground />
      
      {/* Subtle overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/20 -z-5" />

      {/* Navbar: centered glowing pill, fixed, collapses to logo-only on scroll */}
      <NavbarPill />

      {/* Hero */}
      <section className="container mx-auto px-6 pt-24 md:pt-28 pb-16 md:pb-24 relative">
        {/* Split hero glows */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          {/* Left gradient glow behind text */}
          <div className="absolute left-0 top-8 w-[60%] h-[60%] rounded-[100%] blur-3xl opacity-30"
               style={{ background: 'radial-gradient( circle at 20% 30%, rgba(99,102,241,0.6), transparent 60% )' }} />
          {/* Right spotlight behind logo */}
          <div className="absolute right-0 top-0 w-[55%] h-[70%] rounded-[100%] blur-3xl opacity-40"
               style={{ background: 'radial-gradient( circle at 80% 30%, rgba(168,85,247,0.6), transparent 65% )' }} />
        </div>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur text-xs text-white/80">
            <Sparkles className="w-4 h-4 text-orange-300" /> Enterprise Bitcoin Payment Infrastructure
          </div>
          <h1 className="mt-5 text-4xl md:text-6xl font-black leading-tight">
            Accept Bitcoin payments instantly with sBTC on Stacks
          </h1>
          <p className="mt-5 text-base md:text-lg max-w-2xl leading-relaxed" style={{ color: '#B0B0B0' }}>
            Complete Bitcoin payment infrastructure with instant settlement, comprehensive APIs, and intelligent transaction monitoring for modern businesses.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* Get Started with gradient border + glow hover */}
            <Link to="/dashboard" className="group relative rounded-xl p-[2px] overflow-hidden">
              <span className="absolute inset-0 rounded-xl opacity-80 transition duration-300 group-hover:opacity-100"
                    style={{ background: 'linear-gradient(90deg,#F7931A 0%,#FFD580 100%)' }} />
              <span className="relative z-10 block px-5 py-3 rounded-[10px] text-[#1E1E1E] font-semibold shadow-lg bg-white"
                    style={{ background: 'linear-gradient(90deg,#FAD29A 0%,#FFE3B3 100%)' }}>
                <span className="inline-block transition-transform duration-200 group-hover:scale-[1.03]">Get Started</span>
              </span>
            </Link>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl border border-white/15 bg-white/10 backdrop-blur-md hover:bg-white/15 transition font-medium text-white/90 shadow-sm"
            >
              View Documentation
            </a>
            <div className="inline-flex items-center gap-2 text-white/70 text-sm">
              <ShieldCheck className="w-4 h-4" /> Enterprise-grade security
            </div>
          </div>
        </div>

        {/* Right visual: 3D Bitcoin logo */}
        <div className="hidden md:block absolute right-6 top-28 md:right-6 md:top-24 lg:right-6 lg:top-24" aria-hidden>
          <div className="relative w-[100px] h-[100px] lg:w-[420px] lg:h-[420px] rounded-full overflow-hidden border border-white/10 shadow-2xl">
            <iframe
              title="3D Bitcoin – Spline"
              src="https://my.spline.design/untitled-Voecsz6xO8zJVCHM9ELTqXqd/"
              frameBorder="0"
              className="absolute inset-0 w-full h-full transform"
              style={{ transform: 'scale(1.38) ', transformOrigin: 'center' }}
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
            />
            {/* Orbit animation elements */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Glowing orbit ring */}
              <div
                className="absolute rounded-full border border-white/20"
                style={{ width: '110%', height: '110%', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.35))', animation: 'spin 18s linear infinite' }}
              />
              {/* Rotating particles */}
              <div className="absolute inset-0" style={{ animation: 'spin 12s linear infinite' }}>
                <span className="absolute left-1/2 top-0 -translate-x-1/2 w-2 h-2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                <span className="absolute right-2 top-1/3 w-1.5 h-1.5 rounded-full bg-blue-300/90 shadow-[0_0_10px_rgba(147,197,253,0.7)]" />
                <span className="absolute left-3 bottom-1/3 w-1.5 h-1.5 rounded-full bg-purple-300/90 shadow-[0_0_10px_rgba(196,181,253,0.7)]" />
              </div>
              {/* Bitcoin sparks */}
              <div className="absolute inset-0" style={{ animation: 'spin 8s linear infinite reverse' }}>
                <span className="absolute top-1/2 -left-1 w-1 h-1 rounded-full bg-orange-300 shadow-[0_0_14px_rgba(251,146,60,0.9)]" />
                <span className="absolute bottom-2 right-1/4 w-1.5 h-1.5 rounded-full bg-orange-200 shadow-[0_0_16px_rgba(254,215,170,0.9)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Showcase card */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div whileHover={{ rotateX: -2, rotateY: 2, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} style={{ transformStyle: 'preserve-3d', perspective: 1000 }} className="relative rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-xl overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20" style={{background:'linear-gradient(135deg,#F7931A,#FFD580)'}} />
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-visible" style={{background:'linear-gradient(135deg,#F7931A,#FFD580)'}}>
                <span className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(circle, rgba(247,147,26,0.35), transparent 70%)', filter: 'blur(8px)' }} />
                <Bitcoin className="w-5 h-5 text-[#1E1E1E]" />
              </div>
              <div>
                <p className="text-sm text-white/70">Real-time Balance</p>
                <p className="text-2xl font-bold">₿ 0.54820000</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/70">Professional dashboard with real-time transaction monitoring and comprehensive analytics.</p>
          </motion.div>
          <motion.div whileHover={{ rotateX: -2, rotateY: -2, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} style={{ transformStyle: 'preserve-3d', perspective: 1000 }} className="relative rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-visible" style={{background:'linear-gradient(135deg,#F7931A,#FFD580)'}}>
                <span className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(circle, rgba(255,196,77,0.35), transparent 70%)', filter: 'blur(8px)' }} />
                <Bot className="w-5 h-5 text-[#1E1E1E]" />
              </div>
              <div>
                <p className="text-sm text-white/70">Intelligent Analytics</p>
                <p className="text-2xl font-bold">Data-driven insights</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/70">AI-powered analytics provide instant answers about revenue, trends, and payment performance.</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-orange-300">
              Learn more <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-md shadow-md">
            <Zap className="w-6 h-6 text-orange-300" />
            <h3 className="mt-3 font-semibold text-lg">Instant Settlement</h3>
            <p className="text-white/70 text-sm mt-1">Process Bitcoin payments in seconds with sBTC's fast finality on Stacks blockchain.</p>
          </div>
          <div className="rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-md shadow-md">
            <ShieldCheck className="w-6 h-6 text-orange-300" />
            <h3 className="mt-3 font-semibold text-lg">Enterprise Security</h3>
            <p className="text-white/70 text-sm mt-1">Bitcoin-backed security with comprehensive audit trails and compliance features.</p>
          </div>
          <div className="rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-md shadow-md">
            <Sparkles className="w-6 h-6 text-orange-300" />
            <h3 className="mt-3 font-semibold text-lg">Developer-First</h3>
            <p className="text-white/70 text-sm mt-1">Complete API suite with webhooks, SDKs, and comprehensive documentation.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 pb-28">
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-10 border border-white/10 bg-white/5 backdrop-blur-xl text-center shadow-xl">
          <div className="absolute -inset-20 opacity-20" style={{background:'linear-gradient(135deg,#F7931A,#FFD580)'}} />
          <h2 className="relative text-2xl md:text-3xl font-bold">Ready to integrate Bitcoin payments?</h2>
          <p className="relative mt-2 text-white/80">Deploy payment infrastructure in minutes with our comprehensive platform.</p>
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/payment-links" className="px-5 py-3 rounded-xl text-[#1E1E1E] font-medium hover:scale-[1.02] transition shadow-lg"
              style={{background:'linear-gradient(90deg,#F7931A 0%,#FFD580 100%)'}}>
              Start Integration
            </Link>
            <Link to="/embedded-checkout" className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition font-medium">
              View Solutions
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Landing

// Centered glowing logo/text pill that collapses on scroll
function NavbarPill() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-center">
        <Link
          to="/"
          className="group relative inline-flex items-center justify-center gap-3 rounded-full px-5 py-2.5 transition-all border backdrop-blur-xl shadow-xl"
          style={{
            background: 'linear-gradient(90deg, rgba(247,147,26,0.25) 0%, rgba(255,213,128,0.25) 100%)',
            borderColor: 'rgba(255,255,255,0.15)'
          }}
        >
          {/* glow */}
          <span className="absolute -inset-1 rounded-full opacity-40 blur-2xl pointer-events-none"
                style={{ background: 'linear-gradient(90deg,#F7931A,#FFD580)' }} />

          <img src="/logo.png" alt="StacksPay" className="relative z-10 w-8 h-8 rounded-lg object-contain" />
          <span
            className={`relative z-10 font-semibold tracking-wide whitespace-nowrap transition-all duration-300 ${collapsed ? 'max-w-0 opacity-0 scale-95 -ml-2' : 'max-w-[200px] opacity-100 scale-100'}`}
            style={{ overflow: 'hidden' }}
          >
            StacksPay
          </span>
        </Link>
      </div>
    </div>
  )
}
