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
      <g fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round">
        <path d="M 87.27 54.12 A 37.50 37.50 0 0 1 84.84 63.86" />
        <path d="M 77.73 75.24 A 37.50 37.50 0 0 1 70.04 81.69" />
        <path d="M 57.60 86.72 A 37.50 37.50 0 0 1 47.59 87.42" />
        <path d="M 34.56 84.17 A 37.50 37.50 0 0 1 26.05 78.86" />
        <path d="M 17.42 68.57 A 37.50 37.50 0 0 1 13.66 59.27" />
        <path d="M 12.73 45.88 A 37.50 37.50 0 0 1 15.16 36.14" />
        <path d="M 42.40 13.28 A 37.50 37.50 0 0 1 52.41 12.58" />
        <path d="M 65.44 15.83 A 37.50 37.50 0 0 1 73.95 21.14" />
        <path d="M 82.58 31.43 A 37.50 37.50 0 0 1 86.34 40.73" />
        <path d="M 77.58 57.17 A 28.50 28.50 0 0 1 73.78 65.70" />
        <path d="M 64.44 74.57 A 28.50 28.50 0 0 1 55.72 77.92" />
        <path d="M 42.83 77.58 A 28.50 28.50 0 0 1 34.30 73.78" />
        <path d="M 25.43 64.44 A 28.50 28.50 0 0 1 22.08 55.72" />
        <path d="M 22.42 42.83 A 28.50 28.50 0 0 1 26.22 34.30" />
        <path d="M 35.56 25.43 A 28.50 28.50 0 0 1 44.28 22.08" />
        <path d="M 57.17 22.42 A 28.50 28.50 0 0 1 65.70 26.22" />
        <path d="M 74.57 35.56 A 28.50 28.50 0 0 1 77.92 44.28" />
      </g>
      <circle cx="50" cy="50" r="20.5" />
      <circle cx="27.43" cy="20.05" r="4.8" />
      <circle cx="69.07" cy="71.18" r="3.8" />
    </svg>
  )
}
