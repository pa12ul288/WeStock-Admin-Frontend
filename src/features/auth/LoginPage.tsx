import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, type Location } from 'react-router-dom';
import { z } from 'zod';
import { errorMessage } from '../../lib/errors';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { LoginShowcase } from './LoginShowcase';
import { useSignIn, useStaffQuery } from './queries';
import styles from './LoginPage.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your work email.')
    .regex(EMAIL_PATTERN, 'That email doesn’t look right. Check for a typo.'),
  password: z.string().min(1, 'Enter your password.'),
  keep: z.boolean(),
});
type LoginValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  ['anjali@brainwired.demo', 'Super admin'],
  ['priya@brainwired.demo', 'Support'],
  ['rahul@brainwired.demo', 'Support'],
  ['fatima@brainwired.demo', 'Viewer'],
  ['vikram@brainwired.demo', 'Support, invited'],
] as const;

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={
          open
            ? 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
            : 'M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2'
        }
      />
    </svg>
  );
}

export function LoginPage() {
  const location = useLocation();
  const { data: staff } = useStaffQuery();
  const signIn = useSignIn();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState<string | null>(null);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setFocus,
    clearErrors,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    reValidateMode: 'onSubmit',
    defaultValues: { email: '', password: '', keep: false },
  });

  useEffect(() => {
    document.title = 'Sign in · WeSTOCK Admin';
  }, []);

  const from = (location.state as { from?: Location } | null)?.from;
  if (staff) return <Navigate to={from ?? '/'} replace />;

  const onInput = () => {
    clearErrors();
    setServerError('');
  };
  const error = errors.email?.message ?? errors.password?.message ?? serverError;

  return (
    <div className={styles.page}>
      <section className={styles.left}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7l4 11 5-9 5 9 4-11" />
            </svg>
          </span>
          <span className={styles.wordmark}>
            WeSTOCK <span className={styles.wordmarkSub}>Admin</span>
          </span>
        </div>

        <form
          className={styles.form}
          noValidate
          onSubmit={(event) =>
            void handleSubmit((values) => {
              setServerError('');
              signIn.mutate(values, {
                onError: (signInError) => setServerError(errorMessage(signInError)),
              });
            })(event)
          }
        >
          <div>
            <span className={styles.eyebrow}>For brainwired staff</span>
            <h1 className={styles.title}>Sign in</h1>
            <p className={styles.sub}>Use your brainwired work email.</p>
          </div>

          <label className={styles.label}>
            Work email
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="name@[brainwired domain]"
              aria-invalid={Boolean(errors.email)}
              {...register('email', { onChange: onInput })}
            />
          </label>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="login-password" className={styles.labelText}>
                Password
              </label>
              <button
                type="button"
                className={styles.forgot}
                onClick={() => setForgotEmail(getValues('email').trim())}
              >
                Forgot password?
              </button>
            </div>
            <span className={styles.passwordBox}>
              <input
                id="login-password"
                className={`${styles.input} ${styles.passwordInput}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!errors.email && Boolean(errors.password)}
                {...register('password', { onChange: onInput })}
              />
              <button
                type="button"
                className={styles.eye}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
              >
                <EyeIcon open={!showPassword} />
              </button>
            </span>
          </div>

          <label className={styles.keep}>
            <input type="checkbox" {...register('keep')} /> Keep me signed in on this computer
          </label>

          {error && (
            <div className={styles.warn} role="alert">
              {error}
            </div>
          )}

          <button type="submit" className={styles.submit} disabled={signIn.isPending}>
            {signIn.isPending ? 'Signing in…' : 'Sign in'}
          </button>

          <p className={styles.note}>
            Only staff added by a super admin can sign in. Farmers use the WeSTOCK mobile app.
          </p>

          <details className={styles.demo}>
            <summary>Demo accounts</summary>
            <p className={styles.demoHint}>Any password of 6 or more characters works.</p>
            <ul>
              {DEMO_ACCOUNTS.map(([email, role]) => (
                <li key={email}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue('email', email);
                      onInput();
                      setFocus('password');
                    }}
                  >
                    {email}
                  </button>
                  <span>{role}</span>
                </li>
              ))}
            </ul>
          </details>
        </form>

        <span className={styles.powered}>Powered by brainwired</span>
      </section>

      <LoginShowcase />

      {forgotEmail !== null && (
        <ForgotPasswordDialog initialEmail={forgotEmail} onClose={() => setForgotEmail(null)} />
      )}
    </div>
  );
}
