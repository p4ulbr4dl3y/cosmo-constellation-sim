import React from 'react'

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

export const Logo: React.FC<LogoProps> = ({ size = 24, className = '', ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Back orbit arc */}
      <g transform="rotate(-28 50 50)">
        <path
          d="M 8 50 A 42 16 0 0 1 92 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          opacity="0.35"
        />
      </g>
      {/* Planet */}
      <circle cx="50" cy="50" r="20" />
      {/* Front orbit arc */}
      <g transform="rotate(-28 50 50)">
        <path
          d="M 92 50 A 42 16 0 0 1 8 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="84" cy="58" r="6" fill="#ffffff" />
        <circle cx="84" cy="58" r="3.5" fill="currentColor" />
      </g>
    </svg>
  )
}
