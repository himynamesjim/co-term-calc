'use client';

import { Calculator, FileText, Mail, Shield, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0d14] via-[#0f1419] to-[#1a1f2e]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Ambient background effects */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          {/* Main Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 rounded-full px-4 py-2 mb-6">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Professional Co-Term Analysis Tool</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Simplify Your
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Co-Term Calculations
              </span>
            </h1>

            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
              Calculate and analyze co-term costs for licensing agreements with professional
              PDF exports and email templates. Save time and impress your clients.
            </p>

            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg font-semibold rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
            >
              <Calculator className="w-5 h-5" />
              Get Started Free
            </button>

            <p className="text-sm text-slate-400 mt-4">
              No credit card required • Sign up in seconds
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            {/* Feature 1 */}
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all">
              <div className="w-14 h-14 bg-purple-600/20 rounded-xl flex items-center justify-center mb-6">
                <Calculator className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Smart Calculations</h3>
              <p className="text-slate-400 leading-relaxed">
                Step-by-step wizard guides you through agreement details, licensing, and billing terms with real-time cost analysis.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/50 transition-all">
              <div className="w-14 h-14 bg-blue-600/20 rounded-xl flex items-center justify-center mb-6">
                <FileText className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Professional PDFs</h3>
              <p className="text-slate-400 leading-relaxed">
                Export beautiful, branded PDF reports with your company logo, detailed breakdowns, and financial summaries.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-green-500/50 transition-all">
              <div className="w-14 h-14 bg-green-600/20 rounded-xl flex items-center justify-center mb-6">
                <Mail className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Email Templates</h3>
              <p className="text-slate-400 leading-relaxed">
                Generate HTML and plain text email templates ready to send to clients with all calculation details included.
              </p>
            </div>
          </div>

          {/* Additional Features */}
          <div className="mt-16 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-10">
            <h3 className="text-2xl font-bold text-white mb-8 text-center">Everything You Need</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Multiple Billing Terms</h4>
                  <p className="text-slate-400 text-sm">Support for Monthly, Annual, and Pre-Paid billing structures</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Save & Manage</h4>
                  <p className="text-slate-400 text-sm">Save calculations and access them anytime from your dashboard</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Time-Saving</h4>
                  <p className="text-slate-400 text-sm">Reduce manual calculations from hours to minutes</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <TrendingUp className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-1">Cost Analysis</h4>
                  <p className="text-slate-400 text-sm">Instant visibility into cost changes and financial impact</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Join professionals who trust CoTerm Calculator for their licensing analysis needs.
            </p>
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg font-semibold rounded-xl shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
            >
              <Calculator className="w-5 h-5" />
              Sign Up Now
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-500 text-sm">
            © 2025 CoTerm Calculator. Built for professionals who value precision and efficiency.
          </p>
        </div>
      </div>
    </div>
  );
}
