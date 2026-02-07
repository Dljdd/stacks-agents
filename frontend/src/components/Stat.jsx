export default function Stat({ icon, label, value, accent = false }) {
  return (
    <div className="flex items-center gap-5">
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ 
          width: '52px', 
          height: '52px',
          background: 'rgba(0, 207, 255, 0.12)', 
          color: '#00CFFF' 
        }}
      >
        <div className="w-6 h-6">
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-3xl font-bold leading-none mb-1"
          style={{ color: accent ? '#00CFFF' : 'rgba(255,255,255,0.9)' }}
        >
          {value}
        </div>
        <div 
          className="uppercase text-xs font-semibold tracking-wider leading-none" 
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
