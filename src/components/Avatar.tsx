import type { User } from '../types'
import { initials } from '../lib/utils'

export function Avatar({ user, size = 24 }: { user: User; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        className="rounded-full object-cover ring-2 ring-white"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      title={user.name}
      className="inline-flex items-center justify-center rounded-full font-extrabold text-white ring-2 ring-white select-none"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.48 }}
    >
      {initials(user.name)}
    </span>
  )
}

export function AvatarStack({ users, size = 20 }: { users: User[]; size?: number }) {
  return (
    <span className="flex items-center">
      {users.map((u, i) => (
        <span key={u.id} className="inline-flex" style={{ marginLeft: i === 0 ? 0 : -size * 0.28 }}>
          <Avatar user={u} size={size} />
        </span>
      ))}
    </span>
  )
}
