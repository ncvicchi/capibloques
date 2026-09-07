import { findAvatar } from '@/lib/user-preferences';

/** Ilustraciones SVG originales: sin descargas, fotos ni contenido externo. */
export default function UserAvatar({
  id,
  size = 48,
  decorative = false,
}: {
  id?: string;
  size?: number;
  decorative?: boolean;
}) {
  const a = findAvatar(id),
    kind = a.kind;
  const animal = [
    'capybara',
    'bear',
    'cat',
    'fox',
    'rabbit',
    'frog',
    'monster',
  ].includes(kind);
  return (
    <svg
      className="user-avatar"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : a.name}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <circle cx="50" cy="50" r="48" fill={a.background} />
      {animal && (
        <g fill={a.color}>
          {['cat', 'fox', 'monster'].includes(kind) ? (
            <>
              <path d="M22 48 20 19 43 35Z" />
              <path d="m57 35 23-16-2 29Z" />
            </>
          ) : kind === 'rabbit' ? (
            <>
              <ellipse cx="36" cy="29" rx="9" ry="22" />
              <ellipse cx="64" cy="29" rx="9" ry="22" />
            </>
          ) : (
            <>
              <circle cx="29" cy={kind === 'frog' ? 33 : 31} r="12" />
              <circle cx="71" cy={kind === 'frog' ? 33 : 31} r="12" />
            </>
          )}
          <rect
            x="18"
            y="31"
            width="64"
            height="53"
            rx={kind === 'capybara' ? 20 : 28}
          />
          <ellipse
            cx="50"
            cy="67"
            rx="22"
            ry="13"
            fill="#fff2d9"
            opacity=".8"
          />
          {kind === 'cat' && (
            <path
              d="m18 60-9-2m9 9-9 2m73-11 9-2m-9 11 9 2"
              stroke="#38445e"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      )}
      {kind === 'robot' && (
        <g stroke="#334058" strokeWidth="3" strokeLinejoin="round">
          <path d="M50 19v-8" />
          <circle cx="50" cy="10" r="5" fill={a.color} />
          <rect x="14" y="44" width="10" height="22" rx="4" fill={a.color} />
          <rect x="76" y="44" width="10" height="22" rx="4" fill={a.color} />
          <rect x="23" y="24" width="54" height="58" rx="15" fill={a.color} />
          <rect
            x="29"
            y="39"
            width="42"
            height="27"
            rx="8"
            fill="#f0fcff"
            stroke="none"
          />
        </g>
      )}
      {kind === 'star' && (
        <path
          d="m50 14 11 22 25 4-18 19 4 26-22-12-22 12 4-26-18-19 25-4Z"
          fill={a.color}
          stroke="#c4952b"
          strokeWidth="2"
        />
      )}
      {kind === 'cloud' && (
        <path
          d="M25 77a20 20 0 0 1-3-39 20 20 0 0 1 37-14 19 19 0 0 1 24 24c18 11 6 31-10 29Z"
          fill={a.color}
        />
      )}
      {kind === 'flower' && (
        <>
          <path
            d="M50 64v24m0-5q-21-1-20-15 18-1 20 15m0-3q19-2 19-15-17 0-19 15"
            fill="#589475"
            stroke="#589475"
            strokeWidth="3"
          />
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx="50"
              cy="25"
              rx="11"
              ry="17"
              transform={`rotate(${i * 45} 50 47)`}
              fill={a.color}
            />
          ))}
          <circle cx="50" cy="47" r="21" fill="#fff2b5" />
        </>
      )}
      {kind === 'cactus' && (
        <>
          <path
            d="M32 85V62H22q-10 0-10-10V38q0-10 10-10t10 10v9h4V28q0-17 14-17t14 17v14h6V32q0-10 10-10t10 10v20q0 9-12 9H64v24Z"
            fill={a.color}
          />
          <path d="M30 81h40l-5 11H35Z" fill="#dc9375" />
        </>
      )}
      <g fill="#27354d">
        <circle cx="38" cy={kind === 'flower' ? 44 : 51} r="3.2" />
        <circle cx="62" cy={kind === 'flower' ? 44 : 51} r="3.2" />
      </g>
      <path
        d={kind === 'flower' ? 'M43 53q7 7 14 0' : 'M42 64q8 8 16 0'}
        fill="none"
        stroke="#27354d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        cx="30"
        cy={kind === 'flower' ? 52 : 59}
        rx="5"
        ry="3"
        fill="#ee9caa"
        opacity=".65"
      />
      <ellipse
        cx="70"
        cy={kind === 'flower' ? 52 : 59}
        rx="5"
        ry="3"
        fill="#ee9caa"
        opacity=".65"
      />
    </svg>
  );
}
