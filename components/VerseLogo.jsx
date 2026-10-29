// "V" with a small spark; same shape as the app icons in public/icons
export default function VerseLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" aria-hidden="true">
      <path d="      M120 180 L236 400 L352 180" stroke="currentColor" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M425 70 Q430 112 472 117 Q430 122 425 164 Q420 122 378 117 Q420 112 425 70 Z" fill="currentColor" />
    </svg>
  );
}
