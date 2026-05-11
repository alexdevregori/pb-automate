import { useLocation } from 'react-router-dom';

export default function Login() {
  const { search } = useLocation();
  const disconnected = new URLSearchParams(search).has('disconnected');

  const handleOAuth = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pb-cream px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pb-dark">
            <svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M 10 18 L 50 18 L 90 50 L 50 82 L 10 82 L 38 50 Z" fill="#FAF7F2" />
            </svg>
          </div>
          <span className="font-sans font-semibold text-2xl tracking-tight text-pb-dark">Automate</span>
        </div>

        {disconnected && (
          <div className="mb-4 rounded-lg border border-pb-err/30 bg-pb-err-bg px-4 py-3 text-[13px] text-pb-err-text">
            Your Productboard connection was removed. Please reconnect to continue.
          </div>
        )}

        <div className="rounded-2xl border border-pb-dark/[0.08] bg-white p-8 shadow-sm">
          <h1 className="mb-1 font-sans font-semibold text-[22px] tracking-tight text-pb-dark">Sign in</h1>
          <p className="mb-6 text-[13.5px] text-pb-muted">
            Connect your Productboard workspace to get started.
          </p>

          <button
            onClick={handleOAuth}
            className="w-full rounded-lg bg-pb-dark px-4 py-2.5 text-sm font-medium text-pb-cream transition-colors hover:bg-pb-dark/90"
          >
            Connect with Productboard
          </button>
        </div>
      </div>
    </div>
  );
}
