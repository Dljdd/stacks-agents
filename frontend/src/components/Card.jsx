export default function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl p-8 transition-all duration-200 ${className}`}
      style={{
        background: '#1A1D24',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.3)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 207, 255, 0.15)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(0, 0, 0, 0.3)'
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
      }}
    >
      {children}
    </div>
  );
}
