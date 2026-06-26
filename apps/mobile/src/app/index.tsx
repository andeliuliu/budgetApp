import { AuthGate } from '@/auth/auth-gate';

export default function IndexRoute() {
  return <AuthGate />;
}
