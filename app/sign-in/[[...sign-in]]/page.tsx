import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#050505',
    }}>
      <SignIn forceRedirectUrl="/dashboard" />
    </div>
  )
}
