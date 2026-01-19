import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'TARS - Test Automation That Runs Itself',
  description: 'Transform PRDs into comprehensive test scenarios in seconds. AI-powered, privacy-first.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* Animated background */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30" />
          
          {/* Mesh gradients */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-violet-100/40 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-teal-100/40 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-to-r from-indigo-50/20 via-transparent to-purple-50/20 rounded-full blur-3xl" />
          
          {/* Subtle grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.4]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgb(226 232 240)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <Navigation />
        
        <main className="relative pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="relative border-t border-slate-200 py-10 mt-auto bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">TARS</span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-sm text-slate-500">v1.0.0</span>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                Powered by <span className="font-medium text-slate-700">Ollama</span> • Local AI, Total Privacy
              </div>
              <div className="flex items-center gap-4 text-sm">
                {['Jest', 'JUnit', 'Cypress', 'Playwright'].map((framework) => (
                  <span key={framework} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                    {framework}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
