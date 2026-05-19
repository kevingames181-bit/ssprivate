export const Poster = () => {
  // Alaska coastline simplified path
  const alaskaPath = "M 100 400 Q 150 350 200 380 L 250 360 Q 300 340 350 370 L 400 350 Q 450 330 500 360 L 550 340 Q 600 320 650 350 L 700 330 Q 750 310 800 340 L 850 320 Q 900 300 950 330";
  
  // Fish release data points
  const dataPoints = [
    { x: 250, y: 380, size: 30, color: '#FF6B6B', species: 'Chinook' },
    { x: 400, y: 360, size: 45, color: '#4ECDC4', species: 'Sockeye' },
    { x: 550, y: 350, size: 35, color: '#45B7D1', species: 'Coho' },
    { x: 700, y: 340, size: 50, color: '#FFA07A', species: 'Pink' },
    { x: 320, y: 420, size: 25, color: '#98D8C8', species: 'Chum' },
    { x: 480, y: 400, size: 40, color: '#FF6B6B', species: 'Chinook' },
    { x: 620, y: 380, size: 38, color: '#4ECDC4', species: 'Sockeye' },
    { x: 780, y: 360, size: 42, color: '#45B7D1', species: 'Coho' },
  ];

  return (
    <div className="poster-container">
      <svg className="poster-svg" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        {/* Background gradient */}
        <defs>
          <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#0D1B2A', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#1B4965', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#1B9AAA', stopOpacity: 1 }} />
          </linearGradient>
          
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          </pattern>
        </defs>

        {/* Background */}
        <rect width="1024" height="1024" fill="url(#oceanGradient)" />
        
        {/* Grid overlay */}
        <rect width="1024" height="1024" fill="url(#grid)" />

        {/* Title */}
        <text x="512" y="120" textAnchor="middle" fill="#FFFFFF" fontSize="72" fontWeight="700" fontFamily="Arial, sans-serif">
          SeaScope
        </text>
        
        {/* Subtitle line 1 */}
        <text x="512" y="170" textAnchor="middle" fill="#E5E5E5" fontSize="32" fontWeight="600" fontFamily="Arial, sans-serif">
          Explore. Discover. Innovate.
        </text>

        {/* Alaska coastline */}
        <path d={alaskaPath} stroke="#1B9AAA" strokeWidth="3" fill="none" opacity="0.6" />
        <path d={`${alaskaPath} L 950 500 L 100 500 Z`} fill="rgba(27, 154, 170, 0.1)" />

        {/* Data points with glow */}
        {dataPoints.map((point, idx) => (
          <g key={idx}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.size}
              fill={point.color}
              opacity="0.7"
              filter="url(#glow)"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={point.size * 0.5}
              fill={point.color}
              opacity="0.9"
            />
          </g>
        ))}

        {/* Icon section */}
        <g transform="translate(200, 600)">
          {/* Fish icon */}
          <circle cx="0" cy="0" r="35" fill="rgba(255,255,255,0.1)" stroke="#1B9AAA" strokeWidth="2" />
          <path d="M -15 0 Q -10 -8 0 -8 Q 10 -8 15 0 Q 10 8 0 8 Q -10 8 -15 0 M 8 0 L 8 1" 
                stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text x="0" y="60" textAnchor="middle" fill="#E5E5E5" fontSize="16" fontFamily="Arial, sans-serif">Species</text>
        </g>

        <g transform="translate(412, 600)">
          {/* Pin icon */}
          <circle cx="0" cy="0" r="35" fill="rgba(255,255,255,0.1)" stroke="#1B9AAA" strokeWidth="2" />
          <path d="M 0 -12 Q -8 -12 -8 -4 Q -8 4 0 12 Q 8 4 8 -4 Q 8 -12 0 -12 M 0 -6 Q 3 -6 3 -3 Q 3 0 0 0 Q -3 0 -3 -3 Q -3 -6 0 -6" 
                fill="#FFFFFF" />
          <text x="0" y="60" textAnchor="middle" fill="#E5E5E5" fontSize="16" fontFamily="Arial, sans-serif">Location</text>
        </g>

        <g transform="translate(624, 600)">
          {/* Calendar icon */}
          <circle cx="0" cy="0" r="35" fill="rgba(255,255,255,0.1)" stroke="#1B9AAA" strokeWidth="2" />
          <rect x="-10" y="-8" width="20" height="16" rx="2" stroke="#FFFFFF" strokeWidth="2" fill="none" />
          <line x1="-6" y1="-10" x2="-6" y2="-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <line x1="6" y1="-10" x2="6" y2="-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <line x1="-10" y1="-2" x2="10" y2="-2" stroke="#FFFFFF" strokeWidth="2" />
          <text x="0" y="60" textAnchor="middle" fill="#E5E5E5" fontSize="16" fontFamily="Arial, sans-serif">Date</text>
        </g>

        <g transform="translate(824, 600)">
          {/* Wave icon */}
          <circle cx="0" cy="0" r="35" fill="rgba(255,255,255,0.1)" stroke="#1B9AAA" strokeWidth="2" />
          <path d="M -12 0 Q -8 -6 -4 0 Q 0 6 4 0 Q 8 -6 12 0" 
                stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M -12 6 Q -8 0 -4 6 Q 0 12 4 6 Q 8 0 12 6" 
                stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text x="0" y="60" textAnchor="middle" fill="#E5E5E5" fontSize="16" fontFamily="Arial, sans-serif">Tide</text>
        </g>

        {/* Tagline */}
        <text x="512" y="750" textAnchor="middle" fill="#FFFFFF" fontSize="28" fontWeight="500" fontFamily="Arial, sans-serif">
          Turning Alaskan fishery data into insights, maps, and action.
        </text>

        {/* CTA Button */}
        <rect x="362" y="820" width="300" height="60" rx="30" fill="#1B9AAA" />
        <text x="512" y="857" textAnchor="middle" fill="#FFFFFF" fontSize="24" fontWeight="600" fontFamily="Arial, sans-serif">
          Explore the Map
        </text>

        {/* Website */}
        <text x="512" y="940" textAnchor="middle" fill="#E5E5E5" fontSize="22" fontFamily="Arial, sans-serif">
          www.getseascope.com
        </text>

        {/* Footer */}
        <text x="512" y="980" textAnchor="middle" fill="rgba(229,229,229,0.6)" fontSize="14" fontFamily="Arial, sans-serif">
          Official Product of Pyron Company
        </text>
      </svg>
    </div>
  );
};
