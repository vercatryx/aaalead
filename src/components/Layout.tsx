import React from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import type { ReportType } from '../App';
import { REPORTS } from '../config/reports';

interface LayoutProps {
  children: React.ReactNode;
  selectedReport: ReportType;
  onSelectReport: (type: ReportType) => void;
  currentView?: 'reports' | 'documents';
  onViewChange?: (view: 'reports' | 'documents') => void;
  onClearStorage?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, selectedReport, onSelectReport, currentView = 'reports', onViewChange, onClearStorage }) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 font-sans">

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col p-6 z-20 shadow-sm">
        <div className="mb-8 flex items-center justify-center rounded-lg p-4" style={{ backgroundColor: 'rgb(25 36 50 / 90%)' }}>
          <img 
            src="/aaaleadlogo.png" 
            alt="AAA Lead Logo" 
            className="h-12 w-auto"
          />
        </div>

        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block pl-2">
            Generate Report
          </label>

          <div className="space-y-1">
            {REPORTS.map((report) => (
              <button
                key={report.id}
                onClick={() => {
                  onViewChange?.('reports');
                  onSelectReport(report.id as ReportType);
                }}
                className={`w-full group flex items-center justify-between p-3 rounded-lg transition-all duration-200 border ${selectedReport === report.id && currentView === 'reports'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <FileText
                    size={18}
                    className={`transition-colors duration-200 ${selectedReport === report.id && currentView === 'reports' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
                      }`}
                  />
                  <span className="font-medium text-sm">
                    {report.name}
                  </span>
                </div>

                {selectedReport === report.id && currentView === 'reports' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Documents Section */}
        <div className="pt-6 border-t border-slate-100 mb-4">
          <button
            onClick={() => onViewChange?.('documents')}
            className={`w-full group flex items-center justify-between p-3 rounded-lg transition-all duration-200 border ${currentView === 'documents'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <div className="flex items-center gap-3">
              <FolderOpen
                size={18}
                className={`transition-colors duration-200 ${currentView === 'documents' ? 'text-green-600' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
              />
              <span className="font-medium text-sm">
                Documents
              </span>
            </div>

            {currentView === 'documents' && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
            )}
          </button>
        </div>

        {/* User Account Section */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              U
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">User Account</p>
              <p className="text-xs text-slate-500">Inspector</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto bg-slate-50">
        <div className="relative z-10 w-full min-h-full flex flex-col p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
