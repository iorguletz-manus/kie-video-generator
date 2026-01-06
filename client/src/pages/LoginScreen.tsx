import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { APP_LOGO, APP_TITLE } from '@/const';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: number; username: string; profileImageUrl: string | null }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true); // true = Login, false = Register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  const loginMutation = trpc.appAuth.login.useMutation();
  const registerMutation = trpc.appAuth.register.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error('Username și password sunt obligatorii!');
      return;
    }

    try {
      if (isLogin) {
        // Login
        const result = await loginMutation.mutateAsync({
          username: username.trim(),
          password: password.trim(),
        });

        if (result.success && result.user) {
          toast.success(`Bun venit, ${result.user.username}!`);
          onLoginSuccess(result.user);
        }
      } else {
        // Register
        if (username.trim().length < 3) {
          toast.error('Username-ul trebuie să aibă minim 3 caractere!');
          return;
        }
        
        if (!invitationCode.trim()) {
          toast.error('Invitation Code este obligatoriu!');
          return;
        }

        const result = await registerMutation.mutateAsync({
          username: username.trim(),
          password: password.trim(),
          invitationCode: invitationCode.trim(),
        });

        if (result.success && result.user) {
          toast.success(`Cont creat! Bun venit, ${result.user.username}!`);
          onLoginSuccess(result.user);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Eroare la autentificare!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md border-2 border-blue-200 shadow-xl">
        <CardHeader className="text-center">
          {APP_LOGO && (
            <div className="flex justify-center mb-4">
              <img src={APP_LOGO} alt="Logo" className="h-16 w-auto" />
            </div>
          )}
          <CardTitle className="text-3xl font-bold text-blue-900">
            {APP_TITLE}
          </CardTitle>
          <CardDescription className="text-lg text-blue-700">
            {isLogin ? 'Loghează-te pentru a continua' : 'Creează un cont nou'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Introdu username-ul"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Introdu password-ul"
              />
            </div>
            
            {/* Invitation Code - only for Register */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Invitation Code
                </label>
                <input
                  type="password"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Introdu codul de invitație"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
              disabled={loginMutation.isPending || registerMutation.isPending}
            >
              {loginMutation.isPending || registerMutation.isPending
                ? 'Se procesează...'
                : isLogin
                ? 'Login'
                : 'Creează Cont'}
            </Button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setUsername('');
                  setPassword('');
                  setInvitationCode('');
                }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {isLogin ? 'Nu ai cont? Creează unul nou' : 'Ai deja cont? Loghează-te'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
