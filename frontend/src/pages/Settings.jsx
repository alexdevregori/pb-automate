import { useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut } from 'lucide-react';
import { clearToken, getWorkspaceId } from '../lib/auth';
import { capture, reset } from '../lib/events';

const PB_OAUTH_SETTINGS = 'https://app.productboard.com/settings/integrations';

export default function Settings() {
  const navigate = useNavigate();
  const workspaceId = getWorkspaceId();

  const handleSignOut = () => {
    capture('signed_out');
    clearToken();
    reset();
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="mb-1 font-sans font-semibold text-3xl tracking-tight text-pb-dark">Settings</h1>
        <p className="text-[13.5px] text-pb-muted">Manage your Productboard connection.</p>
      </div>

      <div className="space-y-4">
        {/* Connection */}
        <section className="rounded-xl border border-pb-cream-dk bg-white p-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-pb-subtle">
            Productboard connection
          </h2>
          <div className="mb-5 flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pb-green" />
            <div>
              <p className="text-[14px] font-medium text-pb-dark">Connected via OAuth</p>
              {workspaceId && (
                <p className="mt-0.5 font-mono text-[12px] text-pb-subtle">
                  Workspace&nbsp;{workspaceId}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-pb-cream-dk bg-pb-cream px-4 py-2 text-[13px] font-medium text-pb-muted transition-colors hover:border-pb-dark/20 hover:text-pb-dark"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </section>

        {/* Disconnect */}
        <section className="rounded-xl border border-pb-err/30 bg-pb-err-bg/40 p-5">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-pb-err-text">
            Disconnect
          </h2>
          <p className="mb-3 text-[13.5px] text-pb-dark">
            To fully remove this app's access to your Productboard account:
          </p>
          <ol className="mb-4 space-y-1.5 text-[13.5px] text-pb-dark">
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-pb-muted">1.</span>
              <span>
                Go to{' '}
                <a
                  href={PB_OAUTH_SETTINGS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-pb-blue underline-offset-2 hover:underline"
                >
                  Productboard Integrations settings
                  <ExternalLink size={11} className="mb-0.5" />
                </a>
                {' '}and open the <strong className="font-medium">Manage</strong> tab.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-pb-muted">2.</span>
              <span>Scroll to <strong className="font-medium">Connected apps</strong>, find <strong className="font-medium">PB Automate</strong>, and click <strong className="font-medium">Remove</strong>.</span>
            </li>
          </ol>
          <p className="rounded-lg border border-pb-err/20 bg-white/60 px-3.5 py-2.5 text-[12.5px] text-pb-err-text">
            Removing the app will immediately sign you out and permanently delete all your scripts and run history.
          </p>
        </section>
      </div>
    </div>
  );
}
