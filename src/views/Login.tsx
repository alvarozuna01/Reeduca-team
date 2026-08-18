import { useState, type FormEvent } from 'react'
import { useApp } from '../state/AppContext'
import { Avatar } from '../components/Avatar'
import { Field, inputCls } from '../components/Modal'

export default function Login() {
  const { demo } = useApp()
  return (
    <div className="grid min-h-full place-items-center bg-[#f6f7f9] p-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-600 text-xl font-black text-white shadow-lg shadow-blue-600/30">
            R
          </span>
          <h1 className="mt-3 text-2xl font-black text-slate-800">
            ReEduca <span className="text-slate-400">· Gestión de Equipo</span>
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            Agenda, tareas, proyectos y equipo en un solo lugar.
          </p>
        </div>
        {demo ? <DemoLogin /> : <SupabaseLogin />}
      </div>
    </div>
  )
}

function DemoLogin() {
  const { users, loginDemo } = useApp()
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-center text-sm font-bold text-slate-500">¿Quién sos? Elegí tu perfil para entrar.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => loginDemo(u.id)}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <Avatar user={u} size={44} />
            <span className="font-extrabold text-slate-700">{u.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {u.role === 'admin' ? 'Gerente' : 'Equipo'}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-5 text-center text-[11px] font-semibold text-slate-400">
        Modo demo: los datos se guardan en este navegador. Para cuentas reales con contraseña, conectá Supabase
        (instrucciones en el README).
      </p>
    </div>
  )
}

type Mode = 'login' | 'signup' | 'reset'

function SupabaseLogin() {
  const { loginEmail, signUpEmail, resetPassword } = useApp()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    let err: string | null = null
    if (mode === 'login') {
      err = await loginEmail(email, password)
    } else if (mode === 'signup') {
      err = await signUpEmail(name, email, password)
      if (!err) setInfo('¡Cuenta creada! Revisá tu correo para confirmarla y después iniciá sesión.')
    } else {
      err = await resetPassword(email)
      if (!err) setInfo('Te enviamos un enlace para recuperar tu contraseña. Revisá tu correo.')
    }
    setError(err)
    setBusy(false)
  }

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {mode === 'signup' && (
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className={inputCls} required />
        </Field>
      )}
      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@equipo.com"
          className={inputCls}
          required
        />
      </Field>
      {mode !== 'reset' && (
        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
            required
            minLength={6}
          />
        </Field>
      )}

      {error && <p className="text-sm font-bold text-red-500">{error}</p>}
      {info && <p className="text-sm font-bold text-emerald-600">{info}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta' : 'Recuperar contraseña'}
      </button>

      <div className="flex justify-between text-xs font-bold text-blue-600">
        {mode !== 'login' && (
          <button type="button" onClick={() => switchTo('login')} className="hover:underline">
            Iniciar sesión
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" onClick={() => switchTo('signup')} className="hover:underline">
            Crear cuenta
          </button>
        )}
        {mode !== 'reset' && (
          <button type="button" onClick={() => switchTo('reset')} className="hover:underline">
            Olvidé mi contraseña
          </button>
        )}
      </div>
    </form>
  )
}
