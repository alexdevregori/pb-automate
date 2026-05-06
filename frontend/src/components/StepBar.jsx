import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clearToken, isAuthenticated } from '../lib/auth';

const steps = ['Connect', 'Choose Script', 'Configure', 'Deploy', 'Done'];

export default function StepBar({ current }) {
  const navigate = useNavigate();
  const showLogout = isAuthenticated() && current > 1;

  const handleLogout = () => {
    clearToken();
    navigate('/');
  };

  return (
    <div className="py-6">
      {showLogout && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-gray-400 transition-colors hover:text-pb-dark"
          >
            Sign out
          </button>
        </div>
      )}
      <div className="flex items-center justify-center gap-2">
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === current;
          const isDone = stepNum < current;
          return (
            <React.Fragment key={label}>
              {i > 0 && (
                <div
                  className={`h-0.5 w-8 ${isDone ? 'bg-pb-blue' : 'bg-gray-300'}`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-pb-blue text-white'
                      : isDone
                      ? 'bg-pb-blue/20 text-pb-blue'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-pb-dark' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
