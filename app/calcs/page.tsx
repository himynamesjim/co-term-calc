'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Mail, FileText, ArrowLeft, Trash2, Edit2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, getCurrentUser, getSessionToken, signOut } from '@/lib/supabase';
import { AuthModal } from '@/components/auth-modal';
import { generateCoTermPDF } from '@/lib/pdf-generator';
import { generateCoTermEmail } from '@/lib/email-generator';

interface Calculation {
  id: string;
  title: string;
  design_data: any;
  created_at: string;
  updated_at: string;
}

export default function CalcsPage() {
  const router = useRouter();
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (!currentUser) {
        router.push('/');
        return;
      }

      await fetchCalculations(currentUser);
    };

    initAuth();
  }, []);

  const fetchCalculations = async (currentUser: any) => {
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/get-designs?design_type=coterm-calc&user_id=${currentUser.id}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCalculations(data.designs || []);
      }
    } catch (error) {
      console.error('Error fetching calculations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this calculation?')) {
      return;
    }

    try {
      const token = await getSessionToken();
      const response = await fetch('/api/delete-design', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ design_id: id })
      });

      if (response.ok) {
        setCalculations(calculations.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error deleting calculation:', error);
    }
  };

  const handleDownloadPDF = async (calc: Calculation) => {
    try {
      const data = calc.design_data;

      // Calculate results from the saved data
      const licenses = data.licenses || [];
      const billingTerm = data.billingTerm || 'Annual';

      // Calculate current costs based on billing term
      let currentAnnualCost = 0;
      let currentMonthlyCost = 0;
      let updatedAnnualCost = 0;
      let updatedMonthlyCost = 0;

      if (billingTerm === 'Monthly') {
        // For monthly billing, annualCost field is actually the monthly cost
        currentMonthlyCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * l.quantity), 0);
        currentAnnualCost = currentMonthlyCost * 12;

        updatedMonthlyCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
        updatedAnnualCost = updatedMonthlyCost * 12;
      } else {
        // For Annual and Pre-Paid, annualCost is the actual annual cost
        currentAnnualCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * l.quantity), 0);
        currentMonthlyCost = currentAnnualCost / 12;

        updatedAnnualCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
        updatedMonthlyCost = updatedAnnualCost / 12;
      }

      // Calculate cost changes
      const costChange = updatedAnnualCost - currentAnnualCost;
      const monthlyCostChange = updatedMonthlyCost - currentMonthlyCost;
      const costChangePercent = currentAnnualCost > 0
        ? ((updatedAnnualCost - currentAnnualCost) / currentAnnualCost) * 100
        : 0;

      // Calculate months remaining
      const agreementStart = new Date(data.agreementStartDate);
      const coTermStart = new Date(data.coTermStartDate);
      const agreementEnd = new Date(agreementStart);
      agreementEnd.setMonth(agreementEnd.getMonth() + data.agreementTermMonths);

      const monthsRemaining = (agreementEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

      // Calculate current year months for Annual billing
      const yearEnd = new Date(coTermStart.getFullYear(), 11, 31);
      const currentYearMonths = billingTerm === 'Annual'
        ? (yearEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        : 0;

      // Calculate co-term cost
      const coTermCost = licenses.reduce((sum: number, l: any) => {
        const monthlyRate = billingTerm === 'Monthly' ? l.annualCost : l.annualCost / 12;
        return sum + (monthlyRate * l.additionalLicenses * currentYearMonths);
      }, 0);

      await generateCoTermPDF({
        projectName: calc.title,
        agreementStartDate: data.agreementStartDate || '',
        agreementTermMonths: data.agreementTermMonths || 0,
        coTermStartDate: data.coTermStartDate || '',
        monthsRemaining: monthsRemaining,
        currentYearMonths: currentYearMonths,
        billingTerm: billingTerm,
        licenses: licenses,
        results: {
          currentMonthlyCost,
          currentAnnualCost,
          updatedMonthlyCost,
          updatedAnnualCost,
          monthlyCostChange,
          costChange,
          costChangePercent,
          coTermCost
        },
        companyLogo: data.companyLogo || null
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleDownloadEmail = async (calc: Calculation) => {
    try {
      const data = calc.design_data;
      const licenses = data.licenses || [];
      const billingTerm = data.billingTerm || 'Annual';

      // Calculate costs based on billing term
      let currentAnnualCost = 0;
      let currentMonthlyCost = 0;
      let updatedAnnualCost = 0;
      let updatedMonthlyCost = 0;

      if (billingTerm === 'Monthly') {
        currentMonthlyCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * l.quantity), 0);
        currentAnnualCost = currentMonthlyCost * 12;

        updatedMonthlyCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
        updatedAnnualCost = updatedMonthlyCost * 12;
      } else {
        currentAnnualCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * l.quantity), 0);
        currentMonthlyCost = currentAnnualCost / 12;

        updatedAnnualCost = licenses.reduce((sum: number, l: any) =>
          sum + (l.annualCost * (l.quantity + l.additionalLicenses)), 0);
        updatedMonthlyCost = updatedAnnualCost / 12;
      }

      const costChange = updatedAnnualCost - currentAnnualCost;
      const monthlyCostChange = updatedMonthlyCost - currentMonthlyCost;
      const costChangePercent = currentAnnualCost > 0
        ? ((updatedAnnualCost - currentAnnualCost) / currentAnnualCost) * 100
        : 0;

      const agreementStart = new Date(data.agreementStartDate);
      const coTermStart = new Date(data.coTermStartDate);
      const agreementEnd = new Date(agreementStart);
      agreementEnd.setMonth(agreementEnd.getMonth() + data.agreementTermMonths);

      const monthsRemaining = (agreementEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

      const yearEnd = new Date(coTermStart.getFullYear(), 11, 31);
      const currentYearMonths = billingTerm === 'Annual'
        ? (yearEnd.getTime() - coTermStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        : 0;

      const coTermCost = licenses.reduce((sum: number, l: any) => {
        const monthlyRate = billingTerm === 'Monthly' ? l.annualCost : l.annualCost / 12;
        return sum + (monthlyRate * l.additionalLicenses * currentYearMonths);
      }, 0);

      const emailHTML = generateCoTermEmail({
        projectName: calc.title,
        agreementStartDate: data.agreementStartDate || '',
        agreementTermMonths: data.agreementTermMonths || 0,
        coTermStartDate: data.coTermStartDate || '',
        monthsRemaining: monthsRemaining,
        currentYearMonths: currentYearMonths,
        billingTerm: billingTerm,
        licenses: licenses,
        results: {
          currentMonthlyCost,
          currentAnnualCost,
          updatedMonthlyCost,
          updatedAnnualCost,
          monthlyCostChange,
          costChange,
          costChangePercent,
          coTermCost
        }
      });

      // Copy to clipboard directly
      try {
        await navigator.clipboard.writeText(emailHTML);
        alert('Email HTML copied to clipboard! You can now paste it into your email client.');
      } catch (clipError) {
        console.error('Error copying to clipboard:', clipError);
        alert('Failed to copy email to clipboard. Please try again.');
      }
    } catch (error) {
      console.error('Error generating email:', error);
      alert('Failed to generate email. Please try again.');
    }
  };

  const calculateTotalCost = (calc: Calculation) => {
    const licenses = calc.design_data?.licenses || [];
    return licenses.reduce((sum: number, license: any) => {
      return sum + (license.annualCost || 0);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading calculations...</div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    router.push('/');
  };

  const leftWidth = isLeftSidebarCollapsed ? 0 : 280;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          window.location.reload();
        }}
      />

      {/* Left Sidebar */}
      <div
        style={{
          width: `${leftWidth}px`,
          minWidth: leftWidth > 0 ? `${leftWidth}px` : '0px',
          transition: 'all 0.3s ease',
          borderRight: leftWidth > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {leftWidth > 0 && (
          <>
            {/* Navigation Section */}
            <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {user ? (
                <div>
                  <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px" }}>
                    {user.email}
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      color: "#e2e8f0",
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#3b82f6",
                    border: "none",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer"
                  }}
                >
                  Login / Sign Up
                </button>
              )}
            </div>

            {/* Saved Calculations */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  Saved Calculations
                </h3>
              </div>
              {calculations.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "32px 16px" }}>
                  No saved calculations yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {calculations.map((design) => (
                    <div
                      key={design.id}
                      onClick={() => router.push(`/?load=${design.id}`)}
                      style={{
                        padding: "12px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: "500", color: "#e2e8f0", marginBottom: "4px" }}>
                        {design.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {new Date(design.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
        style={{
          position: 'fixed',
          left: `${leftWidth}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '24px',
          height: '48px',
          background: '#1e293b',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: 'none',
          borderTopRightRadius: '8px',
          borderBottomRightRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          zIndex: 50,
          color: '#94a3b8'
        }}
      >
        {isLeftSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Calculator
                </button>
                <div className="h-6 w-px bg-slate-700"></div>
                <h1 className="text-2xl font-bold text-white">All Calculations</h1>
              </div>
              <div className="text-slate-400 text-sm">
                {calculations.length} {calculations.length === 1 ? 'calculation' : 'calculations'}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-slate-400 text-sm mb-2">Total Calculations</div>
            <div className="text-3xl font-bold text-white">{calculations.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-slate-400 text-sm mb-2">Total Annual Value</div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(calculations.reduce((sum, calc) => sum + calculateTotalCost(calc), 0))}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="text-slate-400 text-sm mb-2">Avg Cost per Calc</div>
            <div className="text-3xl font-bold text-white">
              {calculations.length > 0
                ? formatCurrency(calculations.reduce((sum, calc) => sum + calculateTotalCost(calc), 0) / calculations.length)
                : '$0'
              }
            </div>
          </div>
        </div>

        {/* Calculations List */}
        {calculations.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
            <div className="text-slate-400 text-lg mb-4">No calculations yet</div>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Your First Calculation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {calculations.map((calc) => (
              <div
                key={calc.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-white">{calc.title}</h3>
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded">
                        {calc.design_data?.licenses?.length || 0} licenses
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-slate-400 text-xs mb-1">Agreement Start</div>
                        <div className="text-slate-200 text-sm flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {calc.design_data?.agreementStartDate
                            ? new Date(calc.design_data.agreementStartDate).toLocaleDateString()
                            : 'N/A'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs mb-1">Term</div>
                        <div className="text-slate-200 text-sm">
                          {calc.design_data?.agreementTermMonths || 0} months
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs mb-1">Total Cost</div>
                        <div className="text-slate-200 text-sm font-semibold">
                          {formatCurrency(calculateTotalCost(calc))}
                        </div>
                      </div>
                    </div>

                    <div className="text-slate-500 text-xs">
                      Last updated: {new Date(calc.updated_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => router.push(`/?load=${calc.id}`)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(calc)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Download PDF"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownloadEmail(calc)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Download Email"
                    >
                      <Mail className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(calc.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        </div>
      </div>
  );
}
